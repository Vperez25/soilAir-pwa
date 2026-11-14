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

/**
 * Espera por defecto de las peticiones al backend propio (Vercel + Neon). Deja
 * margen para el arranque en frío de la función y para que Neon despierte la
 * base, que se suspende tras unos minutos sin uso (unos segundos en total).
 */
export const TIMEOUT_BACKEND = 20000;

/**
 * Petición con cuerpo JSON a una URL completa (POST, DELETE…), con la sesión
 * opcional en `Authorization: Bearer`. La usan la cola de la bitácora, la
 * sesión y las suscripciones push.
 *
 * NO reintenta por su cuenta: repetir un POST a ciegas podría duplicar el
 * registro; cuándo volver a intentar lo decide quien llama.
 *
 * @param {string} url
 * @param {{metodo?: string, cuerpo?: any, token?: string|null, timeout?: number}} [opciones]
 * @returns {Promise<{estado: number, datos: any}>} estado HTTP y JSON recibido
 *          (null si la respuesta no traía JSON, como un 204)
 * @throws {ApiError} sin conexión, tiempo agotado o respuesta que no es 2xx. Con
 *         una respuesta de error, el mensaje es el `error` que mandó el servidor.
 */
export async function pedirJson(url, { metodo = "GET", cuerpo, token = null, timeout = TIMEOUT_BACKEND } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeout);

  const headers = { Accept: "application/json" };
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      signal: control.signal,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("el servidor tardó demasiado en responder", undefined, "timeout", "AbortError");
    }
    throw new ApiError("sin conexión con el servidor", undefined, "network", error.name);
  } finally {
    clearTimeout(reloj);
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ApiError(datos?.error || `el servidor respondió ${respuesta.status}`, respuesta.status, "http");
  }

  return { estado: respuesta.status, datos };
}

/**
 * POST con cuerpo JSON. Lo usa la cola de envíos (services/outboxService.js)
 * cuando el envío se hace desde la página: en el plan B y con el botón
 * "Reintentar ahora". En modo Background Sync el envío lo hace sw.js con su
 * propio fetch(), porque el worker no puede importar módulos.
 *
 * @param {string} url
 * @param {any} cuerpo se envía con JSON.stringify()
 * @param {{timeout?: number, token?: string|null}} [opciones]
 */
export function postJson(url, cuerpo, { timeout = TIMEOUT_BACKEND, token = null } = {}) {
  return pedirJson(url, { metodo: "POST", cuerpo, token, timeout });
}

export default ApiService;
