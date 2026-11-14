/**
 * src/config.js
 * -----------------------------------------------------------------------------
 * Configuración global de la aplicación.
 *
 * PROBLEMA QUE RESUELVE
 * GitHub Pages no publica el proyecto en la raíz del dominio, sino dentro de una
 * carpeta con el nombre del repositorio:
 *
 *   https://vperez25.github.io/soilAir-pwa/
 *                              └────┬────┘
 *                             ese segmento sobra
 *
 * Si el router no lo toma en cuenta, la primera pantalla carga bien pero al
 * cambiar de sección la ruta interna sale mal y todo cae en el 404.
 *
 * Por eso el nombre del repositorio se escribe UNA sola vez aquí y de él se
 * deriva BASE_PATH, que es el prefijo que hay que ponerle a cada enlace
 * (linkPath / rutaCompleta) y quitarle a cada URL leída del navegador.
 */

/** Nombre del repositorio en GitHub. Debe coincidir con la URL de Pages. */
export const REPO = 'soilAir-pwa';

/** URL pública del proyecto, para referencia y para el README. */
export const URL_PAGES = `https://vperez25.github.io/${REPO}/`;

/**
 * URL del backend propio de SoilAir (repositorio soilAir-api, desplegado en
 * Vercel como función serverless). Es el ÚNICO lugar del frontend donde
 * aparece: los servicios arman sus rutas a partir de aquí.
 *
 * GitHub Pages solo sirve archivos estáticos: no puede guardar secretos ni
 * mandar notificaciones push. Por eso el backend vive en OTRO origen, con
 * HTTPS, y es quien guarda las suscripciones y envía los avisos. Su CORS solo
 * acepta el origen exacto de este sitio (https://vperez25.github.io).
 *
 * En local (Live Server o python -m http.server) se usa el backend de
 * desarrollo (`npm run dev` en soilAir-api).
 *
 * El Service Worker NO intercepta este origen (ver el filtro del evento fetch
 * en sw.js): las llamadas al backend nunca pasan por la caché.
 */
const EN_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const API_BASE = EN_LOCAL ? 'http://localhost:3000' : 'https://soilair-api.vercel.app';

/**
 * Endpoint que recibe las entradas de la bitácora (POST, cuerpo JSON). El
 * backend la guarda en PostgreSQL y, si llegó con sesión, avisa por push a los
 * dispositivos del usuario.
 *
 * Cada envío pendiente guarda la URL con la que se creó (store outbox), así que
 * cambiarla aquí no redirige lo que ya estaba en la cola.
 */
export const API_BITACORA = `${API_BASE}/api/bitacora`;

/**
 * Prefijo que el navegador antepone a todas las rutas de la SPA.
 *
 *   GitHub Pages   https://vperez25.github.io/soilAir-pwa/clima  ->  '/soilAir-pwa'
 *   Live Server    http://127.0.0.1:5500/clima                   ->  ''
 *
 * Se detecta mirando el primer segmento de la URL en vez de fijarlo a ciegas:
 * así el mismo código funciona publicado y en local, sin tocar nada.
 */
export const BASE_PATH =
  location.pathname === `/${REPO}` || location.pathname.startsWith(`/${REPO}/`) ? `/${REPO}` : '';

/**
 * Quita el BASE_PATH de una URL del navegador y devuelve la ruta interna.
 *
 *   quitarBase('/soilAir-pwa/clima')  ->  '/clima'
 *   quitarBase('/clima')              ->  '/clima'   (en local BASE_PATH es '')
 *
 * @param {string} pathname normalmente location.pathname
 * @returns {string} ruta interna de la SPA, siempre con diagonal inicial
 */
export function quitarBase(pathname) {
  // El replace solo debe actuar al INICIO de la ruta; por eso el startsWith.
  const ruta = BASE_PATH && pathname.startsWith(BASE_PATH)
    ? pathname.replace(BASE_PATH, '')
    : pathname;

  return ruta.startsWith('/') ? ruta : `/${ruta}`;
}
