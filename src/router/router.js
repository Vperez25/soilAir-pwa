/**
 * router/router.js
 * -----------------------------------------------------------------------------
 * Router de historial (History API) para la SPA de SoilAir.
 *
 * Hay dos formas de escribir una dirección en este proyecto:
 *
 *   ruta interna  ->  '/cultivo/maiz'                 (la que conoce el router)
 *   ruta completa ->  '/soilAir-pwa/cultivo/maiz'     (la que ve el navegador)
 *
 * La diferencia entre ambas es BASE_PATH, que vive en src/config.js. Aquí están
 * las dos funciones que traducen de una a otra:
 *
 *   rutaCompleta()  (fullPath)  interna  -> completa   [le PONE el BASE_PATH]
 *   rutaActual()    (path)      completa -> interna    [le QUITA el BASE_PATH]
 */

import { BASE_PATH, quitarBase } from '../config.js';

/**
 * Convierte una ruta interna ("/cultivo/maiz") en la URL real del navegador
 * ("/soilAir-pwa/cultivo/maiz"). Es el `fullPath` de las notas de clase.
 *
 * @param {string} ruta ruta interna, con diagonal inicial
 * @returns {string}
 */
export function rutaCompleta(ruta) {
  return `${BASE_PATH}${ruta}`;
}

/**
 * Toma la URL actual del navegador y devuelve la ruta interna de la SPA.
 * Es el `path` de las notas de clase: aquí ocurre el replace del BASE_PATH.
 *
 * @returns {string}
 */
export function rutaActual() {
  // quitarBase() hace el replace del prefijo del repositorio (ver config.js).
  let ruta = quitarBase(location.pathname);

  // Live Server abre el proyecto como ".../index.html"; para la SPA ese
  // archivo es la raiz, no una ruta distinta. Lo mismo con 404.html, que en
  // GitHub Pages es una copia del index para que funcionen los enlaces directos.
  ruta = ruta.replace(/\/(index|404)\.html$/, '/');

  return ruta || '/';
}

/** Alias con los nombres usados en clase, por si resultan más claros al leer. */
export const fullPath = rutaCompleta;
export const path = rutaActual;

/**
 * Compara un patrón de ruta contra una ruta real y extrae los parámetros.
 *
 *   matchRoute('/cultivo/:id', '/cultivo/maiz')  ->  { id: 'maiz' }
 *   matchRoute('/cultivo/:id', '/cultivo')       ->  null
 *   matchRoute('/acerca',      '/acerca')        ->  {}
 *
 * @param {string} patron patrón declarado en la tabla de rutas
 * @param {string} ruta   ruta real que viene de la URL
 * @returns {Object|null} objeto con los parámetros, o null si no coincide
 */
export function matchRoute(patron, ruta) {
  // "/cultivo/:id" -> ["cultivo", ":id"]   (filter(Boolean) tira los vacíos)
  const segmentosPatron = patron.split('/').filter(Boolean);
  const segmentosRuta = ruta.split('/').filter(Boolean);

  // Distinta cantidad de segmentos => imposible que coincida.
  if (segmentosPatron.length !== segmentosRuta.length) return null;

  const params = {};

  for (let i = 0; i < segmentosPatron.length; i++) {
    const esperado = segmentosPatron[i];
    const recibido = segmentosRuta[i];

    if (esperado.startsWith(':')) {
      // Segmento dinámico: guardamos el valor bajo el nombre del parámetro.
      params[esperado.slice(1)] = decodeURIComponent(recibido);
    } else if (esperado !== recibido) {
      // Segmento estático que no coincide: la ruta no es esta.
      return null;
    }
  }

  return params;
}

export class Router {
  /**
   * @param {Array<{path: string, view: Function, titulo?: string}>} rutas
   * @param {{contenedor: HTMLElement, noEncontrada: Function}} opciones
   */
  constructor(rutas, { contenedor, noEncontrada, alRenderizar }) {
    this.rutas = rutas;
    this.contenedor = contenedor;
    this.noEncontrada = noEncontrada;
    // Callback OPCIONAL que se ejecuta con la ruta ya montada. Lo usa main.js
    // para avisarle al navbar cual seccion debe marcar como activa; asi el
    // router no necesita conocer el marcado del encabezado.
    this.alRenderizar = alRenderizar;
    // Contador de renders: sirve para saber si una vista asíncrona sigue
    // siendo la que está en pantalla cuando por fin recibe sus datos.
    this.renderId = 0;
  }

  iniciar() {
    // Atrás / Adelante del navegador.
    window.addEventListener('popstate', () => this.render());

    // Cualquier <a data-link> navega sin recargar la página.
    document.addEventListener('click', (evento) => {
      const enlace = evento.target.closest('a[data-link]');
      if (!enlace) return;
      if (enlace.origin !== location.origin) return;

      evento.preventDefault();
      this.navegar(enlace.getAttribute('href'));
    });

    this.render();
  }

  /** Navega a una URL ya completa (la que trae el href del enlace). */
  navegar(url) {
    if (url === location.pathname) return;
    history.pushState({}, '', url);
    this.render();
  }

  /** Busca la ruta que coincide con la URL actual y monta su vista. */
  async render() {
    const ruta = rutaActual();
    const token = ++this.renderId;

    let encontrada = null;
    let params = null;

    for (const candidata of this.rutas) {
      const resultado = matchRoute(candidata.path, ruta);
      if (resultado) {
        encontrada = candidata;
        params = resultado;
        break;
      }
    }

    const vista = encontrada ? encontrada.view : this.noEncontrada;
    document.title = encontrada?.titulo
      ? `${encontrada.titulo} · SoilAir`
      : 'Ruta no encontrada · SoilAir';

    const contexto = { params: params ?? {}, ruta };

    this.contenedor.innerHTML = '<p class="cargando">Cargando…</p>';
    this.contenedor.innerHTML = await vista(contexto);
    window.scrollTo({ top: 0 });

    this.alRenderizar?.(ruta);

    // Gancho OPCIONAL para vistas que necesitan trabajar sobre el DOM ya
    // montado (por ejemplo, pedir datos a una API y luego reemplazar el
    // skeleton). Las vistas que no definen .montar() se comportan exactamente
    // igual que antes: esta rama simplemente no se ejecuta.
    if (typeof vista.montar === 'function') {
      await vista.montar({
        ...contexto,
        contenedor: this.contenedor,
        // vigente() avisa a la vista si el usuario ya navegó a otra ruta,
        // para que no escriba sobre una pantalla que ya no le pertenece.
        vigente: () => this.renderId === token,
      });
    }
  }
}
