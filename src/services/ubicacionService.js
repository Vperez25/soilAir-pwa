/**
 * services/ubicacionService.js
 * -----------------------------------------------------------------------------
 * Ubicación del dispositivo (Geolocation API) y estado del permiso
 * (Permissions API).
 *
 * CASO DE USO
 * En la Bitácora de campo, el técnico puede adjuntar a una entrada el punto
 * exacto de la parcela donde hizo la observación (dónde apareció la plaga, qué
 * válvula regó). Así puede volver a ese punto o mandárselo al agrónomo.
 *
 * Este módulo NO toca el DOM: solo habla con el navegador y devuelve datos o
 * errores. Qué se muestra y cuándo se pide lo decide components/CampoUbicacion.js.
 *
 * La lectura es PUNTUAL (getCurrentPosition), nunca un seguimiento
 * (watchPosition): una entrada de bitácora necesita un punto, no un recorrido.
 */

/**
 * Opciones de la lectura.
 *
 *   enableHighAccuracy: true
 *     Pide el GPS. En campo importa el surco o el punto de la parcela, y el GPS
 *     da 5–20 m de error; la ubicación por red o Wi-Fi puede errar por cientos
 *     de metros y caer en otra parcela. Gasta más batería, pero es UNA lectura
 *     por clic.
 *
 *   timeout: 15000
 *     El GPS tarda en fijar satélites, sobre todo la primera vez. Con menos de
 *     15 s fallaría seguido al aire libre (código 3); con más, el usuario se
 *     queda esperando sin saber si algo pasa.
 *
 *   maximumAge: 60000
 *     Una lectura de hace menos de un minuto sigue siendo el mismo punto: el
 *     técnico está parado escribiendo la nota. Reutilizarla responde al
 *     instante y ahorra batería; una más vieja podría ser de otra parcela.
 */
export const OPCIONES_UBICACION = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60000,
});

/**
 * Un mensaje por cada código de GeolocationPositionError. El 0 no es del
 * estándar: lo usa este módulo cuando el navegador ni siquiera tiene la API.
 */
export const MENSAJES_ERROR = Object.freeze({
  0: 'Este navegador no puede leer la ubicación. Escribe la referencia de la parcela a mano.',
  1: 'No diste permiso para usar la ubicación. Puedes escribir la referencia de la parcela a mano, o volver a habilitar el permiso.',
  2: 'El dispositivo no pudo saber dónde estás: no hay señal GPS ni de red, o la ubicación del teléfono está apagada. Intenta a cielo abierto o escribe la referencia.',
  3: 'La ubicación tardó demasiado (más de 15 s). Pasa bajo techo o entre árboles; intenta otra vez a cielo abierto o escribe la referencia.',
});

/** Error con el código de la Geolocation API (1, 2 o 3) o 0 si no hay API. */
export class UbicacionError extends Error {
  /**
   * @param {0|1|2|3} codigo
   * @param {string} mensaje
   */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'UbicacionError';
    this.codigo = codigo;
  }
}

/** ¿El navegador expone la Geolocation API? */
export function soportaUbicacion() {
  return 'geolocation' in navigator;
}

/**
 * Lee la ubicación UNA vez. Es la única función que llama a la Geolocation
 * API, y solo se usa después de un clic del usuario (ver CampoUbicacion.js):
 * la primera vez que se llama, el navegador muestra su pregunta de permiso.
 *
 * @param {PositionOptions} [opciones]
 * @returns {Promise<{lat: number, lon: number, precision: number, fecha: string}>}
 *          precision: radio de error en metros
 * @throws {UbicacionError} con codigo 1 (permiso), 2 (no disponible),
 *         3 (tiempo agotado) o 0 (sin API)
 */
export function obtenerUbicacion(opciones = OPCIONES_UBICACION) {
  return new Promise((resolver, rechazar) => {
    if (!soportaUbicacion()) {
      rechazar(new UbicacionError(0, MENSAJES_ERROR[0]));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) =>
        resolver({
          lat: posicion.coords.latitude,
          lon: posicion.coords.longitude,
          precision: Math.round(posicion.coords.accuracy),
          fecha: new Date(posicion.timestamp).toISOString(),
        }),
      (error) => {
        const mensaje = MENSAJES_ERROR[error.code] ?? `No se pudo leer la ubicación (${error.message}).`;
        rechazar(new UbicacionError(error.code, mensaje));
      },
      opciones
    );
  });
}

/**
 * Estado del permiso de ubicación, SIN preguntarle nada al usuario.
 *
 *   'granted'      ya lo concedió
 *   'denied'       lo bloqueó
 *   'prompt'       aún no decide: se le preguntará al pulsar el botón
 *   'desconocido'  el navegador no tiene Permissions API (o no acepta
 *                  'geolocation' en ella): solo se sabrá al intentar leer
 *
 * @param {(estado: string) => void} [alCambiar] se llama si el usuario cambia
 *        el permiso desde los ajustes del sitio mientras la página está abierta
 * @returns {Promise<{estado: string, dejar: () => void}>} dejar() quita el aviso
 */
export async function consultarPermiso(alCambiar) {
  const sinDatos = { estado: 'desconocido', dejar: () => {} };
  if (!navigator.permissions?.query) return sinDatos;

  try {
    const permiso = await navigator.permissions.query({ name: 'geolocation' });
    const oyente = () => alCambiar?.(permiso.state);
    permiso.addEventListener('change', oyente);
    return { estado: permiso.state, dejar: () => permiso.removeEventListener('change', oyente) };
  } catch {
    return sinDatos;
  }
}

/* ── Formato ──────────────────────────────────────────────────────────────── */

/** "19.43261, -99.13321": 5 decimales son ~1 m, más que la precisión del GPS. */
export function coordenadas({ lat, lon }) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** Enlace que abre el punto en Google Maps (o en la app de mapas del teléfono). */
export function enlaceMapa({ lat, lon }) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}
