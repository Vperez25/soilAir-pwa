/**
 * sw.js
 * -----------------------------------------------------------------------------
 * Service Worker de SoilAir — App Shell en caché VERSIONADA, servida desde caché.
 *
 * Hace tres cosas, cada una en su evento:
 *
 *   install    abre la caché de ESTA versión y guarda en ella el App Shell.
 *   activate   borra las cachés de versiones anteriores.
 *   fetch      responde desde la caché cuando puede y guarda lo que le falta.
 *
 * La estrategia de fetch es CACHE FIRST: si el recurso está guardado, se sirve de
 * ahí sin preguntarle a la red. Es lo que hace rápida a la app y lo que le
 * permitirá funcionar sin conexión, pero tiene un costo: un archivo que CAMBIA en
 * el servidor sigue sirviéndose viejo mientras no cambie CACHE_VERSION o se borre
 * su entrada (vista /diagnostico -> Contenido de la caché).
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
 * publicar una versión nueva del shell (v2 -> v3): al cambiar este archivo el
 * navegador instala un worker nuevo, que crea una caché con el nombre nuevo, y
 * cuando toma el control borra la anterior.
 *
 * Tanto lo precacheado en install como lo guardado en runtime por fetch van a
 * ESTA caché, así que al subir la versión se renuevan las dos cosas juntas.
 */
const CACHE_VERSION = `${CACHE_PREFIJO}v3`;

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
  './src/pwa/cacheDebug.js',
  './src/pwa/fetchLog.js',
  './src/pwa/registerSW.js',
  './src/pwa/swDiagnostico.js',
  './src/components/Aviso.js',
  './src/components/CachePanel.js',
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

/* ── fetch: servir desde la caché y guardar lo que falta ──────────────────── */

/**
 * URL absoluta del App Shell tal como quedó guardado en install. Se calcula
 * igual que las rutas de APP_SHELL (relativa a este archivo), así que apunta a
 * /index.html en local y a /soilAir-pwa/index.html en GitHub Pages.
 */
const INDEX_URL = new URL('./index.html', self.location.href).href;

/**
 * ¿Es una URL de una vista del router (/clima, /cultivo/maiz, /)? Las vistas no
 * son archivos: no tienen extensión. Una URL con extensión (/sw.js, /404.html,
 * una imagen escrita en la barra de direcciones) sí es un archivo real y debe
 * pedirse a la red tal cual.
 */
function esRutaDelRouter(url) {
  return !/\.[a-z0-9]+$/i.test(url.pathname);
}

/**
 * Avisa a las páginas abiertas de qué petición acaba de atender el worker y de
 * dónde salió la respuesta. La vista /diagnostico lo muestra en su registro de
 * peticiones (src/pwa/fetchLog.js). Devuelve la promesa para poder pasarla a
 * event.waitUntil() y que el worker no se apague antes de enviar el mensaje.
 *
 * @param {Request} request
 * @param {'cache'|'app-shell'|'network'} source de dónde salió la respuesta
 */
function reportFetch(request, source) {
  return self.clients.matchAll({ type: 'window' }).then((clients) => {
    const path = request.url.replace(self.location.origin, '');
    clients.forEach((client) =>
      client.postMessage({ type: 'FETCH_LOG', method: request.method, path, source })
    );
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // ── Filtro: cuándo NO se interviene ──────────────────────────────────────
  // Salir sin llamar a respondWith() deja que la petición siga su camino normal,
  // como si el Service Worker no existiera.

  // 1. Solo GET. Una petición POST, PUT o DELETE modifica algo en el servidor:
  //    responderla con una copia vieja sería mentirle a la app sobre lo que pasó
  //    (y la Cache API ni siquiera acepta guardar respuestas a otros métodos).
  if (request.method !== 'GET') return;

  // 2. Solo el mismo origen. Lo de otros dominios (Open-Meteo, Google Fonts) no
  //    es nuestro: su contenido cambia sin avisarnos, como los datos del clima,
  //    que deben ser siempre los de ahora; y sus respuestas no se pueden
  //    inspeccionar, así que no sabríamos si guardar un error.
  if (url.origin !== self.location.origin) return;

  // 3. Navegaciones (el usuario abre o recarga una URL). Si es una vista del
  //    router, siempre se responde con el mismo index.html del App Shell: el
  //    router del lado del cliente decide qué pintar. Así /clima, /cultivo/maiz
  //    y / comparten UNA entrada en vez de guardar un HTML por cada ruta.
  //    Si la URL es un archivo concreto, se deja pasar.
  if (request.mode === 'navigate') {
    if (esRutaDelRouter(url)) event.respondWith(responderNavegacion(event, request));
    return;
  }

  // 4. El resto (CSS, JS, imágenes): primero la caché, después la red.
  event.respondWith(responderDesdeCache(event, request));
});

/**
 * Navegación a una vista del router: responde con el App Shell guardado.
 * Si por algún motivo no está en la caché, cae a la red.
 */
async function responderNavegacion(event, request) {
  const cache = await caches.open(CACHE_VERSION);
  const shell = await cache.match(INDEX_URL);

  if (shell) {
    console.log('[SW] HIT', request.url, '(navegación -> App Shell)');
    event.waitUntil(reportFetch(request, 'app-shell'));
    return shell;
  }

  console.log('[SW] MISS', request.url, '(el App Shell no está en la caché)');
  event.waitUntil(reportFetch(request, 'network'));
  return fetch(request);
}

/**
 * Recurso propio: busca en la caché de ESTA versión; si no está, lo pide a la
 * red y lo guarda para la próxima.
 */
async function responderDesdeCache(event, request) {
  const cache = await caches.open(CACHE_VERSION);

  // HIT: ya estaba guardado. No se consulta a la red.
  const guardada = await cache.match(request);
  if (guardada) {
    console.log('[SW] HIT', request.url);
    event.waitUntil(reportFetch(request, 'cache'));
    return guardada;
  }

  // MISS: hay que ir a la red.
  console.log('[SW] MISS', request.url);
  const respuesta = await fetch(request);

  if (respuesta.ok) {
    // Una Response solo se puede leer una vez. Se entrega la original a la página
    // y se guarda una COPIA (clone) para la caché; clone() tiene que llamarse
    // antes de que la página empiece a consumir el cuerpo.
    // waitUntil() mantiene vivo el worker hasta que termine de escribir: sin él,
    // el navegador podría apagarlo en cuanto responde.
    event.waitUntil(cache.put(request, respuesta.clone()));
  } else {
    // Una respuesta 404 o 500 NO se guarda: quedaría fija y se serviría desde la
    // caché aunque el servidor ya se hubiera corregido.
    console.warn('[SW] MISS', request.url, `respondió ${respuesta.status}: no se guarda`);
  }

  event.waitUntil(reportFetch(request, 'network'));
  return respuesta;
}
