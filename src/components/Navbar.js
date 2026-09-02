/**
 * components/Navbar.js
 * -----------------------------------------------------------------------------
 * Barra de navegación del App Shell.
 *
 * El MARCADO sigue en index.html a propósito: es parte del App Shell y tiene que
 * pintarse antes de que corra un solo módulo. Lo que vive aquí es la LÓGICA que
 * ese marcado necesita:
 *
 *   - linkPath()      arma el href real de cada enlace (le pone el BASE_PATH),
 *   - montarNavbar()  reescribe los href del encabezado al arrancar la app,
 *   - marcarActivo()  subraya la sección en la que está el usuario.
 *
 * En el HTML los enlaces se escriben como rutas internas ("/", "/clima"), sin
 * saber nada del repositorio. Este módulo es el que los traduce.
 */

import { BASE_PATH, quitarBase } from '../config.js';

/**
 * Ruta interna -> href real del navegador.
 *
 *   linkPath('/clima')  ->  '/soilAir-pwa/clima'   (publicado en GitHub Pages)
 *   linkPath('/clima')  ->  '/clima'               (en local)
 *
 * @param {string} ruta ruta interna, con diagonal inicial
 * @returns {string}
 */
export function linkPath(ruta) {
  return `${BASE_PATH}${ruta}`;
}

/**
 * Recorre los enlaces del encabezado y les cambia el href por el completo.
 * Se llama una sola vez, al arrancar la aplicación.
 */
export function montarNavbar() {
  document.querySelectorAll('.topbar a[data-link]').forEach((enlace) => {
    enlace.setAttribute('href', linkPath(enlace.getAttribute('href')));
  });
}

/**
 * Marca como activo el enlace que corresponde a la ruta que se está mostrando.
 * Para comparar hay que volver a la ruta interna, así que al href del enlace se
 * le quita el BASE_PATH con el mismo replace que usa el router.
 *
 * @param {string} ruta ruta interna actual (la que devuelve rutaActual())
 */
export function marcarActivo(ruta) {
  document.querySelectorAll('.nav a[data-link]').forEach((enlace) => {
    const suRuta = quitarBase(enlace.getAttribute('href'));
    enlace.classList.toggle('activo', suRuta === ruta);
  });
}
