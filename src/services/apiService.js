/**
 * services/apiService.js
 * -----------------------------------------------------------------------------
 * Cliente HTTP genérico (patrón ApiService visto en clase).
 *
 * Es la ÚNICA parte del proyecto que llama a fetch(). Las vistas nunca hablan
 * con la red directamente: piden datos a un servicio, y ese servicio hereda de
 * aquí. Así, si mañana hay que cambiar el manejo de errores o agregar una
 * cabecera, se toca un solo archivo.
 *
 * Responsabilidades:
 *   - armar la URL final (base + ruta + query string),
 *   - cortar la petición si el servidor tarda demasiado,
 *   - revisar response.ok y lanzar un Error con un mensaje legible,
 *   - devolver el JSON ya parseado.
 */

/** Error propio para distinguir "falló la API" de un bug de JavaScript. */
export class ApiError extends Error {
  /**
   * @param {string} mensaje texto que la vista puede mostrar al usuario
   * @param {number} [estado] código HTTP, si lo hubo
   * @param {'network'|'timeout'|'http'} [tipo] categoría del error
   * @param {string} [nombreOriginal] nombre del error original de fetch
   */
  constructor(mensaje, estado, tipo, nombreOriginal) {
    super(mensaje);
    this.name = nombreOriginal || "ApiError";
    this.estado = estado;
    this.tipo = tipo;
  }
}

export class ApiService {
  /**
   * @param {string} baseUrl raíz de la API (sin diagonal final)
   * @param {{timeout?: number}} [opciones] milisegundos antes de abortar
   */
  constructor(baseUrl, { timeout = 5000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeout = timeout;
  }

  /**
   * Construye la URL completa a partir de la ruta y un objeto de parámetros.
   * URLSearchParams se encarga de codificar los valores.
   *
   * @param {string} ruta   por ejemplo "/v1/forecast"
   * @param {Object} params pares clave/valor del query string
   * @returns {string}
   */
  construirUrl(ruta, params = {}) {
    const url = new URL(`${this.baseUrl}${ruta}`);

    for (const [clave, valor] of Object.entries(params)) {
      if (valor === undefined || valor === null) continue;
      // Un arreglo se manda como lista separada por comas (formato Open-Meteo).
      url.searchParams.set(
        clave,
        Array.isArray(valor) ? valor.join(",") : String(valor),
      );
    }

    return url.toString();
  }

  /**
   * Petición GET que devuelve JSON.
   *
   * @param {string} ruta
   * @param {Object} [params]
   * @returns {Promise<any>} el cuerpo de la respuesta ya convertido a objeto
   * @throws {ApiError} si la red falla, si tarda demasiado o si !response.ok
   */
  async get(ruta, params = {}) {
    const url = this.construirUrl(ruta, params);

    let respuesta;

    // Solo los errores TypeError de red/CORS se intentan una segunda vez.
    for (let intento = 0; intento < 2; intento++) {
      // Cada intento necesita su propio AbortController y su propio reloj.
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), this.timeout);

      try {
        respuesta = await fetch(url, {
          signal: control.signal,
          headers: { Accept: "application/json" },
        });
        break;
      } catch (error) {
        if (error.name === "TypeError" && intento === 0) {
          console.log("Error de red/CORS. Reintentando la petición...");
          continue;
        }

        // Aquí se distinguen la falta de internet, CORS y el timeout.
        if (error.name === "AbortError") {
          throw new ApiError(
            "El servidor tardó demasiado en responder.",
            undefined,
            "timeout",
            "AbortError",
          );
        }

        throw new ApiError(
          "No se pudo conectar con el servicio. Revisa tu conexión a internet.",
          undefined,
          "network",
          error.name === "TypeError" ? "TypeError" : error.name,
        );
      } finally {
        clearTimeout(reloj);
      }
    }

    // fetch NO lanza error con 404 ni con 500: hay que revisarlo a mano.
    if (!respuesta.ok) {
      throw new ApiError(
        `El servicio respondió con un error ${respuesta.status} (${respuesta.statusText || "sin detalle"}).`,
        respuesta.status,
        "http",
      );
    }

    try {
      return await respuesta.json();
    } catch {
      throw new ApiError("La respuesta del servicio no venía en formato JSON.");
    }
  }
}

export default ApiService;
