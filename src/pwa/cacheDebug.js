/**
 * pwa/cacheDebug.js
 * -----------------------------------------------------------------------------
 * Herramienta de depuración de la Cache API: listar lo que hay guardado y borrar
 * una entrada suelta.
 *
 * La Cache API también existe en la página (no solo en el Service Worker), por
 * eso esto se puede hacer desde aquí sin pasar mensajes al worker.
 *
 * Sirve para ver el efecto del cache first: un archivo que cambió en el servidor
 * se sigue sirviendo VIEJO desde la caché hasta que su entrada se borra y la
 * siguiente petición vuelve a la red.
 */

/**
 * Prefijo de las cachés de SoilAir. Es el MISMO valor que CACHE_PREFIJO en sw.js
 * (un worker clásico no puede importar este módulo). Cache Storage es compartido
 * por todo el origen, y en GitHub Pages por todos los proyectos del usuario: sin
 * el filtro, esta herramienta mostraría —y dejaría borrar— cachés ajenas.
 */
export const CACHE_PREFIJO = 'soilair-app-shell-';

/** ¿Hay Cache API? Solo existe en contextos seguros (HTTPS o localhost). */
export function cacheDisponible() {
  return 'caches' in window;
}

/**
 * Lista las cachés de SoilAir con sus entradas.
 *
 * Puede haber más de una a la vez: mientras una versión nueva espera a
 * activarse, existen la vieja y la nueva.
 *
 * @returns {Promise<Array<{nombre: string, entradas: Array<{url: string, ruta: string}>}>>}
 */
export async function listarCaches() {
  const nombres = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIJO)).sort();
  const resultado = [];

  for (const nombre of nombres) {
    const cache = await caches.open(nombre);
    const peticiones = await cache.keys();

    resultado.push({
      nombre,
      entradas: peticiones.map((p) => {
        const url = new URL(p.url);
        return { url: p.url, ruta: url.pathname + url.search };
      }),
    });
  }

  return resultado;
}

/**
 * Borra UNA entrada de una caché con cache.delete().
 *
 * @param {string} nombreCache
 * @param {string} url URL completa de la entrada
 * @returns {Promise<boolean>} true si la entrada existía y se borró
 */
export async function eliminarEntrada(nombreCache, url) {
  // caches.open() CREA la caché si no existe. Si una activación acaba de borrar
  // esta versión, abrirla de nuevo la resucitaría vacía.
  if (!(await caches.has(nombreCache))) return false;

  const cache = await caches.open(nombreCache);
  return cache.delete(url);
}
