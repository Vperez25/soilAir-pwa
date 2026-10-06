/**
 * pwa/fetchLog.js
 * -----------------------------------------------------------------------------
 * Registro en memoria de las peticiones que atiende el Service Worker.
 *
 * Por cada petición, sw.js manda a las páginas abiertas un mensaje
 * { type: 'FETCH_LOG', method, path, source } (ver reportFetch en sw.js). Aquí se
 * escuchan desde que arranca la app y se guardan las más recientes, de modo que
 * la vista /diagnostico las encuentre ya acumuladas aunque se abra DESPUÉS de
 * navegar por otras vistas.
 *
 * Solo recibe mensajes una página que el worker CONTROLA: en la primera carga
 * después de registrarlo no llega ninguno hasta recargar con F5.
 *
 * El registro vive en memoria: se vacía al recargar la página.
 */

/** Cuántas peticiones se recuerdan. Una carga completa del shell son ~45. */
const MAXIMO = 80;

/** Más recientes primero. @type {Array<{method: string, path: string, source: string, hora: Date}>} */
const entradas = [];

/** Funciones que quieren enterarse de cada cambio (las vistas abiertas). */
const oyentes = new Set();

const avisar = () => oyentes.forEach((oyente) => oyente());

/** Empieza a escuchar al worker. Se llama una vez desde main.js. */
export function iniciarRegistroFetch() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (evento) => {
    const dato = evento.data;
    if (dato?.type !== 'FETCH_LOG') return;

    entradas.unshift({
      method: String(dato.method),
      path: String(dato.path),
      source: String(dato.source),
      hora: new Date(),
    });
    if (entradas.length > MAXIMO) entradas.length = MAXIMO;

    avisar();
  });

  // Los mensajes del worker esperan en una cola hasta que la página la abre.
  // Se abre ya para no perder las peticiones del arranque.
  navigator.serviceWorker.startMessages?.();
}

/** Peticiones registradas, las más recientes primero. */
export function leerRegistro() {
  return entradas;
}

/** Vacía el registro. */
export function limpiarRegistro() {
  entradas.length = 0;
  avisar();
}

/**
 * Pide que se le avise en cada cambio del registro.
 *
 * @param {() => void} oyente
 * @returns {() => void} función para dejar de escuchar
 */
export function alCambiarRegistro(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}
