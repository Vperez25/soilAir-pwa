/**
 * router/router.js
 * -----------------------------------------------------------------------------
 * Router de historial (History API) para la SPA de SoilAir.
 *
 * Lo que se completó en este archivo (Parte A del ejercicio):
 *   - matchRoute(): antes solo comparaba rutas exactas; ahora entiende
 *     segmentos dinámicos escritos como ":nombre" y devuelve sus valores.
 */

/**
 * BASE es la carpeta desde la que se sirve index.html.
 * Se calcula a partir de la URL de este módulo (…/src/router/router.js),
 * así funciona igual si Live Server sirve el proyecto en "/" o en
 * "/ejercicio-3/", sin tocar el código.
 */
export const BASE = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

/** Convierte una ruta interna ("/cultivo/maiz") en una URL real del navegador. */
export function rutaCompleta(ruta) {
  return `${BASE}${ruta}`;
}

/** Toma la URL actual del navegador y devuelve la ruta interna de la SPA. */
export function rutaActual() {
  let ruta = location.pathname.slice(BASE.length) || '/';
  if (!ruta.startsWith('/')) ruta = `/${ruta}`;

  // Live Server abre el proyecto como ".../index.html"; para la SPA ese
  // archivo es la raiz, no una ruta distinta.
  ruta = ruta.replace(/\/index\.html$/, '/');

  return ruta || '/';
}

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
  constructor(rutas, { contenedor, noEncontrada }) {
    this.rutas = rutas;
    this.contenedor = contenedor;
    this.noEncontrada = noEncontrada;
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

    this.contenedor.innerHTML = '<p class="cargando">Cargando…</p>';
    this.contenedor.innerHTML = await vista({ params: params ?? {}, ruta });
    window.scrollTo({ top: 0 });

    this.marcarNavActiva(ruta);
  }

  marcarNavActiva(ruta) {
    document.querySelectorAll('.nav a[data-link]').forEach((a) => {
      const suRuta = a.getAttribute('href').slice(BASE.length) || '/';
      a.classList.toggle('activo', suRuta === ruta);
    });
  }
}
