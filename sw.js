/**
 * sw.js
 * -----------------------------------------------------------------------------
 * Service Worker de SoilAir — precache del App Shell con caché VERSIONADA.
 *
 * Hace dos cosas, cada una en su evento del ciclo de vida:
 *
 *   install    abre la caché de ESTA versión y guarda en ella el App Shell.
 *   activate   borra las cachés de versiones anteriores.
 *
 * Todavía NO atiende peticiones: la app sigue pidiéndolo todo a la red. La caché
 * se llena pero aún no se lee; usarla es el siguiente paso.
 *
 * Este archivo corre en un hilo aparte, sin página, sin DOM y sin Web Storage.
 * Sus mensajes se ven en DevTools -> Application -> Service Workers -> enlace
 * "inspect" del worker -> Console, NO en la consola de la página.
 *
 * POR QUÉ ESTÁ EN LA RAÍZ Y NO EN src/
 * El scope máximo de un Service Worker es la carpeta donde vive su script. En la
 * raíz puede controlar toda la app. Ver el experimento en la vista /diagnostico.
 */

/* ── Contexto de ejecución (diagnóstico) ──────────────────────────────────── */

console.log('[SW] sw.js se ejecutó');

// En una página esto sería "Window"; aquí es el contexto global del worker.
console.log('[SW] Contexto global (self.constructor.name):', self.constructor.name);

// No hay página: no existen ni window, ni document, ni localStorage.
console.log('[SW] typeof window:', typeof window);
console.log('[SW] typeof document:', typeof document);
console.log('[SW] typeof localStorage:', typeof localStorage);

// Dónde quedó registrado este worker (lo fija src/pwa/registerSW.js).
console.log('[SW] self.registration.scope:', self.registration.scope);

/* ── Versión de la caché ──────────────────────────────────────────────────── */

/**
 * Prefijo común de TODAS las cachés de SoilAir. activate solo borra las que
 * empiezan así: Cache Storage es compartido por todo el ORIGEN, y en GitHub
 * Pages el origen (vperez25.github.io) es el de todos los proyectos del usuario.
 * Borrar "todo lo que no sea la versión actual" se llevaría también las cachés
 * de otros repositorios.
 */
const CACHE_PREFIJO = 'soilair-app-shell-';

/**
 * Nombre de la caché de esta versión. Es lo ÚNICO que hay que cambiar para
 * publicar una versión nueva del shell (v1 -> v2): al cambiar este archivo el
 * navegador instala un worker nuevo, que crea una caché con el nombre nuevo, y
 * cuando toma el control borra la anterior.
 */
const CACHE_VERSION = `${CACHE_PREFIJO}v2`;

/* ── App Shell ────────────────────────────────────────────────────────────── */

/**
 * Lo mínimo que el navegador necesita para PINTAR la aplicación: el HTML de
 * entrada, sus hojas de estilo y el JavaScript que la arranca.
 *
 * Las rutas son relativas a ESTE archivo, no al sitio: una URL relativa dentro
 * de un worker se resuelve contra la ubicación de su script. Como sw.js está en
 * la raíz de la app, './index.html' es /index.html en local y
 * /soilAir-pwa/index.html en GitHub Pages, sin escribir el nombre del repo.
 *
 * "JS de arranque" aquí es main.js y todo lo que importa de forma ESTÁTICA
 * (incluidas las vistas): si falta un solo módulo de ese grafo, el navegador no
 * ejecuta main.js y la app no arranca.
 *
 * NO se incluye lo que se pide bajo demanda:
 *   - src/services/cultivosService.js  (import() dinámico al abrir una ficha)
 *   - los datos del clima (Open-Meteo) y la bitácora (IndexedDB)
 *   - las tipografías de Google Fonts: son de otro dominio, y sin ellas el CSS
 *     ya cae a fuentes del sistema (Georgia / system-ui).
 *
 * cache.addAll() es todo o nada: si UNA de estas rutas da error, la instalación
 * entera falla y el worker nuevo no llega a activarse. Por eso la lista debe
 * mantenerse al día cuando se agrega o se renombra un archivo del arranque.
 */
const APP_SHELL = [
  // HTML de entrada. "./" y "./index.html" son dos URL distintas para la caché.
  './',
  './index.html',

  // Hojas de estilo (el mismo orden que en index.html)
  './styles/main.css',
  './styles/shell.css',
  './styles/views.css',
  './styles/cultivosView.css',
  './styles/climaView.css',
  './styles/persistencia.css',
  './styles/bitacora.css',
  './styles/serviceWorker.css',

  // JS de arranque
  './src/main.js',
  './src/config.js',
  './src/router/router.js',
  './src/pwa/registerSW.js',
  './src/pwa/swDiagnostico.js',
  './src/components/Aviso.js',
  './src/components/CultivoCard.js',
  './src/components/MedidorRango.js',
  './src/components/Navbar.js',
  './src/components/SelectorTema.js',
  './src/components/ServiceWorkerPanel.js',
  './src/services/apiService.js',
  './src/services/climaService.js',
  './src/services/cultivosIndex.js',
  './src/services/dbService.js',
  './src/services/filtroService.js',
  './src/services/temaService.js',
  './src/services/visitasService.js',
  './src/utils/almacenamiento.js',
  './src/utils/cookies.js',
  './src/utils/escapar.js',
  './src/utils/slugify.js',
  './src/vendor/idb.js',
  './src/views/AboutView.js',
  './src/views/BitacoraView.js',
  './src/views/ClimaView.js',
  './src/views/CultivoDetailView.js',
  './src/views/DiagnosticoView.js',
  './src/views/HomeView.js',
  './src/views/NotFoundView.js',

  // Icono del encabezado
  './images/favicon.png',
];

/* ── install: precachear el App Shell ─────────────────────────────────────── */

self.addEventListener('install', (event) => {
  console.log(`[SW] install: precacheando el App Shell en "${CACHE_VERSION}"`);

  // waitUntil() mantiene la fase "installing" hasta que la promesa termine: sin
  // él, el navegador daría por instalado el worker antes de que se escriba la
  // caché. Si la promesa se rechaza, la instalación falla y el worker se
  // descarta.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      // cache: 'reload' se salta la caché HTTP del navegador. Sin eso, una
      // versión nueva podría guardar copias VIEJAS de los archivos: GitHub Pages
      // los sirve con max-age=600 y addAll() usaría esa copia local.
      await cache.addAll(APP_SHELL.map((ruta) => new Request(ruta, { cache: 'reload' })));

      console.log(`[SW] install: ${APP_SHELL.length} recursos guardados en "${CACHE_VERSION}"`);
    })()
  );
});

/* ── activate: limpiar las cachés de versiones anteriores ─────────────────── */

self.addEventListener('activate', (event) => {
  console.log(`[SW] activate: la versión vigente es "${CACHE_VERSION}"`);

  event.waitUntil(
    (async () => {
      // 1. Listar todas las cachés del origen.
      const existentes = await caches.keys();
      console.log('[SW] activate: cachés existentes:', existentes.join(' | ') || '(ninguna)');

      // 2. Quedarse con las de SoilAir que NO son la versión actual. Las que no
      //    llevan nuestro prefijo son de otro proyecto del mismo origen: no se tocan.
      const obsoletas = existentes.filter(
        (nombre) => nombre.startsWith(CACHE_PREFIJO) && nombre !== CACHE_VERSION
      );

      // 3. Eliminarlas.
      await Promise.all(
        obsoletas.map((nombre) => {
          console.log(`[SW] activate: eliminando la caché anterior "${nombre}"`);
          return caches.delete(nombre);
        })
      );

      console.log('[SW] activate: cachés después de limpiar:', (await caches.keys()).join(' | '));
    })()
  );
});
