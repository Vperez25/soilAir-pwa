/**
 * sw.js
 * -----------------------------------------------------------------------------
 * Service Worker de SoilAir — App Shell en caché VERSIONADA, servida desde caché,
 * con una estrategia distinta según el tipo de recurso.
 *
 * Hace cuatro cosas, cada una en su evento:
 *
 *   install    abre la caché de ESTA versión y guarda en ella el App Shell.
 *   activate   borra las cachés de versiones anteriores.
 *   fetch      elige una estrategia según la petición y responde con ella.
 *   sync       Background Sync: envía al servidor la cola de la bitácora
 *              (store outbox de IndexedDB) cuando el navegador ve que hay red.
 *
 * Estrategias de fetch:
 *
 *   Cache First              CSS, JS, imágenes propias. Si está guardado se sirve
 *                            sin preguntarle a la red. Es rápido y funciona sin
 *                            conexión, pero un archivo que CAMBIA en el servidor
 *                            sigue sirviéndose viejo mientras no cambie
 *                            CACHE_VERSION o se borre su entrada.
 *   Network First            Datos del clima (Open-Meteo). Siempre intenta la red
 *                            para tener datos de ahora; solo si falla usa la
 *                            última copia guardada.
 *   Stale-While-Revalidate   Google Fonts y data/demo-swr.json. Responde al
 *                            instante con la copia guardada y la actualiza en
 *                            segundo plano para la próxima vez.
 *   App Shell                Navegaciones a vistas del router: siempre el mismo
 *                            index.html guardado.
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

console.log("[SW] sw.js se ejecutó");

// En una página esto sería "Window"; aquí es el contexto global del worker.
console.log(
  "[SW] Contexto global (self.constructor.name):",
  self.constructor.name,
);

// No hay página: no existen ni window, ni document, ni localStorage.
console.log("[SW] typeof window:", typeof window);
console.log("[SW] typeof document:", typeof document);
console.log("[SW] typeof localStorage:", typeof localStorage);

// Dónde quedó registrado este worker (lo fija src/pwa/registerSW.js).
console.log("[SW] self.registration.scope:", self.registration.scope);

/* ── Versión de la caché ──────────────────────────────────────────────────── */

/**
 * Prefijo común de TODAS las cachés de SoilAir. activate solo borra las que
 * empiezan así: Cache Storage es compartido por todo el ORIGEN, y en GitHub
 * Pages el origen (vperez25.github.io) es el de todos los proyectos del usuario.
 * Borrar "todo lo que no sea la versión actual" se llevaría también las cachés
 * de otros repositorios.
 */
const CACHE_PREFIJO = "soilair-app-shell-";

/**
 * Nombre de la caché de esta versión. Es lo ÚNICO que hay que cambiar para
 * publicar una versión nueva del shell (v4 -> v5): al cambiar este archivo el
 * navegador instala un worker nuevo, que crea una caché con el nombre nuevo, y
 * cuando toma el control borra la anterior.
 *
 * Tanto lo precacheado en install como lo guardado en runtime por fetch van a
 * ESTA caché, así que al subir la versión se renuevan las dos cosas juntas.
 */
const CACHE_VERSION = `${CACHE_PREFIJO}v14`;

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
 *   - los datos del clima (Open-Meteo) y la bitácora (IndexedDB)
 *   - las tipografías de Google Fonts: son de otro dominio y se guardan en
 *     runtime con Stale-While-Revalidate al usarse por primera vez.
 *
 * cache.addAll() es todo o nada: si UNA de estas rutas da error, la instalación
 * entera falla y el worker nuevo no llega a activarse. Por eso la lista debe
 * mantenerse al día cuando se agrega o se renombra un archivo del arranque.
 */
const APP_SHELL = [
  // HTML de entrada. "./" y "./index.html" son dos URL distintas para la caché.
  "./",
  "./index.html",

  // Hojas de estilo (el mismo orden que en index.html)
  "./styles/main.css",
  "./styles/shell.css",
  "./styles/views.css",
  "./styles/cultivosView.css",
  "./styles/climaView.css",
  "./styles/persistencia.css",
  "./styles/bitacora.css",
  "./styles/serviceWorker.css",
  "./styles/instalacion.css",
  "./styles/envios.css",

  // JS de arranque
  "./src/main.js",
  "./src/config.js",
  "./src/router/router.js",
  "./src/pwa/cacheDebug.js",
  "./src/pwa/fetchLog.js",
  "./src/pwa/registerSW.js",
  "./src/pwa/swDiagnostico.js",
  "./src/pwa/instalacion.js",
  "./src/components/Aviso.js",
  "./src/components/CachePanel.js",
  "./src/components/CultivoCard.js",
  "./src/components/MedidorRango.js",
  "./src/components/Navbar.js",
  "./src/components/SelectorTema.js",
  "./src/components/ServiceWorkerPanel.js",
  "./src/components/BotonInstalar.js",
  "./src/components/PanelEnvios.js",
  "./src/services/apiService.js",
  "./src/services/outboxService.js",
  "./src/services/climaService.js",
  "./src/services/cultivosIndex.js",
  "./src/services/cultivosService.js",
  "./src/services/dbService.js",
  "./src/services/filtroService.js",
  "./src/services/temaService.js",
  "./src/services/visitasService.js",
  "./src/utils/almacenamiento.js",
  "./src/utils/cookies.js",
  "./src/utils/escapar.js",
  "./src/utils/slugify.js",
  "./src/vendor/idb.js",
  "./src/views/AboutView.js",
  "./src/views/BitacoraView.js",
  "./src/views/ClimaView.js",
  "./src/views/CultivoDetailView.js",
  "./src/views/DiagnosticoView.js",
  "./src/views/HomeView.js",
  "./src/views/NotFoundView.js",

  // Web App Manifest y sus íconos. Sin ellos en la caché, una recarga sin
  // conexión pierde el manifest: la pestaña se queda sin favicon y DevTools ->
  // Application -> Manifest no puede mostrar los íconos.
  "./manifest.json",
  "./images/icons/icon-192.png",
  "./images/icons/icon-512.png",
  "./images/icons/icon-maskable-512.png",

  // Íconos que enlaza el HTML: favicon y apple-touch-icon (iOS)
  "./images/icons/favicon-32.png",
  "./images/icons/apple-touch-icon.png",

  // Capturas de pantalla que enlaza el manifest.
  "./images/screenshots/escritorio-1280x720r.png",
  "./images/screenshots/movil-540x720r.png",
];

/* ── install: precachear el App Shell ─────────────────────────────────────── */

self.addEventListener("install", (event) => {
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
      await cache.addAll(
        APP_SHELL.map((ruta) => new Request(ruta, { cache: "reload" })),
      );

      console.log(
        `[SW] install: ${APP_SHELL.length} recursos guardados en "${CACHE_VERSION}"`,
      );
    })(),
  );
});

/* ── activate: limpiar las cachés de versiones anteriores ─────────────────── */

self.addEventListener("activate", (event) => {
  console.log(`[SW] activate: la versión vigente es "${CACHE_VERSION}"`);

  event.waitUntil(
    (async () => {
      // 1. Listar todas las cachés del origen.
      const existentes = await caches.keys();
      console.log(
        "[SW] activate: cachés existentes:",
        existentes.join(" | ") || "(ninguna)",
      );

      // 2. Quedarse con las de SoilAir que NO son la versión actual. Las que no
      //    llevan nuestro prefijo son de otro proyecto del mismo origen: no se tocan.
      const obsoletas = existentes.filter(
        (nombre) =>
          nombre.startsWith(CACHE_PREFIJO) && nombre !== CACHE_VERSION,
      );

      // 3. Eliminarlas.
      await Promise.all(
        obsoletas.map((nombre) => {
          console.log(
            `[SW] activate: eliminando la caché anterior "${nombre}"`,
          );
          return caches.delete(nombre);
        }),
      );

      console.log(
        "[SW] activate: cachés después de limpiar:",
        (await caches.keys()).join(" | "),
      );
    })(),
  );
});

/* ── fetch: utilidades ────────────────────────────────────────────────────── */

/**
 * URL absoluta del App Shell tal como quedó guardado en install. Se calcula
 * igual que las rutas de APP_SHELL (relativa a este archivo), así que apunta a
 * /index.html en local y a /soilAir-pwa/index.html en GitHub Pages.
 */
const INDEX_URL = new URL("./index.html", self.location.href).href;

/**
 * ¿Es una URL de una vista del router (/clima, /cultivo/maiz, /)? Las vistas no
 * son archivos: no tienen extensión. Una URL con extensión (/sw.js, /404.html,
 * una imagen escrita en la barra de direcciones) sí es un archivo real y debe
 * pedirse a la red tal cual.
 */
function esRutaDelRouter(url) {
  return !/\.[a-z0-9]+$/i.test(url.pathname);
}

/** Respuesta de error uniforme para cuando no hay red ni copia guardada. */
function sinConexion(mensaje) {
  return new Response(mensaje, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * ¿Vale la pena guardar esta respuesta? Las normales, si son 2xx. Las "opaque"
 * (peticiones no-cors a otro dominio, como el CSS y las fuentes de Google Fonts)
 * siempre tienen status 0 y ok=false aunque hayan salido bien; no se pueden
 * inspeccionar, pero sin guardarlas las fuentes nunca llegarían a la caché.
 * Solo se usa en SWR de Google Fonts.
 */
function esGuardable(respuesta) {
  return respuesta.ok || respuesta.type === "opaque";
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
  return self.clients.matchAll({ type: "window" }).then((clients) => {
    const path = request.url.replace(self.location.origin, "");
    clients.forEach((client) =>
      client.postMessage({
        type: "FETCH_LOG",
        method: request.method,
        path,
        source,
      }),
    );
  });
}

/* ── fetch: filtro y selección de estrategia ──────────────────────────────── */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // ── Filtro: cuándo NO se interviene ──────────────────────────────────────
  // Salir sin llamar a respondWith() deja que la petición siga su camino normal,
  // como si el Service Worker no existiera.

  // 1. Solo GET. Una petición POST, PUT o DELETE modifica algo en el servidor:
  //    responderla con una copia vieja sería mentirle a la app sobre lo que pasó
  //    (y la Cache API ni siquiera acepta guardar respuestas a otros métodos).
  if (request.method !== "GET") return;

  // 2. Navegaciones (el usuario abre o recarga una URL). Si es una vista del
  //    router, siempre se responde con el mismo index.html del App Shell: el
  //    router del lado del cliente decide qué pintar. Así /clima, /cultivo/maiz
  //    y / comparten UNA entrada en vez de guardar un HTML por cada ruta.
  //    Si la URL es un archivo concreto, se deja pasar.
  if (request.mode === "navigate") {
    if (esRutaDelRouter(url))
      event.respondWith(responderNavegacion(event, request));
    return;
  }

  // 3. Solo recursos propios y los dominios externos previstos. Cualquier otro
  //    dominio no es nuestro y se deja pasar sin tocar.
  const esLocal = url.origin === self.location.origin;
  const esOpenMeteo = url.hostname === "api.open-meteo.com";
  const esGoogleFonts =
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";

  if (!esLocal && !esOpenMeteo && !esGoogleFonts) return;

  // 4. Elegir y ejecutar la estrategia adecuada.
  const estrategia = getStrategy(request);
  event.respondWith(estrategia(event, request));
});

/** Devuelve la estrategia que corresponde a cada tipo de petición. */
function getStrategy(request) {
  const url = new URL(request.url);

  // Datos meteorológicos: deben ser los de ahora.
  if (
    url.hostname === "api.open-meteo.com" &&
    url.pathname === "/v1/forecast"
  ) {
    return networkFirst;
  }

  // Archivo de prueba para SWR.

  if (url.pathname.endsWith("/data/demo-swr.json")) {
    return staleWhileRevalidate;
  }

  // Google Fonts: cambian poco y no importa servir la copia anterior.
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    return staleWhileRevalidate;
  }

  if (url.pathname.endsWith("/data/demo-network.json")) {
    return networkFirst;
  }

  // El resto de recursos GET propios usa Cache First.
  return cacheFirst;
}

/* ── Navegación: App Shell ────────────────────────────────────────────────── */

/**
 * Navegación a una vista del router: responde con el App Shell guardado.
 * Si por algún motivo no está en la caché, cae a la red.
 */
async function responderNavegacion(event, request) {
  const cache = await caches.open(CACHE_VERSION);
  const shell = await cache.match(INDEX_URL);

  if (shell) {
    console.log("[SW] HIT", request.url, "(navegación -> App Shell)");
    event.waitUntil(reportFetch(request, "app-shell"));
    return shell;
  }

  console.log("[SW] MISS", request.url, "(el App Shell no está en la caché)");
  event.waitUntil(reportFetch(request, "network"));

  try {
    return await fetch(request);
  } catch {
    return sinConexion("SoilAir no está disponible sin conexión.");
  }
}

/* ── Estrategia: Cache First ──────────────────────────────────────────────── */

/**
 * Primero la caché, después la red. Lo que no estaba se guarda para la próxima.
 */
async function cacheFirst(event, request) {
  const cache = await caches.open(CACHE_VERSION);

  // HIT: ya estaba guardado. No se consulta a la red.
  const guardada = await cache.match(request);
  if (guardada) {
    console.log("[SW] HIT", request.url);
    event.waitUntil(reportFetch(request, "cache"));
    return guardada;
  }

  // MISS: hay que ir a la red.
  console.log("[SW] MISS", request.url);

  let respuesta;
  try {
    respuesta = await fetch(request);
  } catch {
    // Sin conexión y sin copia guardada.
    return sinConexion("Recurso no disponible sin conexión.");
  }

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
    console.warn(
      "[SW] MISS",
      request.url,
      `respondió ${respuesta.status}: no se guarda`,
    );
  }

  event.waitUntil(reportFetch(request, "network"));
  return respuesta;
}

/* ── Estrategia: Network First ────────────────────────────────────────────── */

/**
 * Primero la red; la caché solo es el plan B (sin conexión o error del
 * servidor). Cada respuesta buena actualiza la copia guardada.
 */
async function networkFirst(event, request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const respuesta = await fetch(request);

    if (respuesta.ok) {
      console.log("[SW] NETWORK", request.url);
      event.waitUntil(cache.put(request, respuesta.clone()));
      event.waitUntil(reportFetch(request, "network"));
      return respuesta;
    }

    // El servidor respondió con error: intentar la última copia buena.
    const guardada = await cache.match(request);
    if (guardada) {
      console.log(
        "[SW] FALLBACK",
        request.url,
        `(red respondió ${respuesta.status}; se usa la copia guardada)`,
      );
      event.waitUntil(reportFetch(request, "cache"));
      return guardada;
    }

    event.waitUntil(reportFetch(request, "network"));
    return respuesta;
  } catch {
    // Sin conexión: servir la última copia si existe.
    const guardada = await cache.match(request);
    if (guardada) {
      console.log(
        "[SW] FALLBACK",
        request.url,
        "(sin conexión; copia guardada)",
      );
      event.waitUntil(reportFetch(request, "cache"));
      return guardada;
    }

    console.warn("[SW] OFFLINE", request.url, "(sin red ni copia guardada)");
    return sinConexion("No hay conexión ni datos guardados.");
  }
}

/* ── Estrategia: Stale-While-Revalidate ───────────────────────────────────── */

/**
 * Responde al instante con la copia guardada (aunque esté "rancia") y, en
 * paralelo, pide la versión nueva a la red para dejarla lista la próxima vez.
 * Si nunca hubo copia, espera a la red como cualquier petición.
 */
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE_VERSION);
  const guardada = await cache.match(request);

  const actualizar = (async () => {
    const respuesta = await fetch(request);

    if (!esGuardable(respuesta)) {
      throw new Error(
        `No se pudo actualizar el recurso (${respuesta.status}).`,
      );
    }

    await cache.put(request, respuesta.clone());
    return respuesta;
  })();

  if (guardada) {
    console.log("[SW] STALE", request.url, "(se revalida en segundo plano)");

    // Si la actualización falla (sin conexión) no pasa nada: ya se entregó la copia.
    event.waitUntil(actualizar.catch(() => undefined));
    event.waitUntil(reportFetch(request, "cache"));

    // Entregar inmediatamente la versión guardada.
    return guardada;
  }

  console.log("[SW] MISS", request.url, "(primera vez; se espera a la red)");

  try {
    // Si nunca hubo copia, la primera viene de la red.
    const respuesta = await actualizar;
    event.waitUntil(reportFetch(request, "network"));
    return respuesta;
  } catch {
    return sinConexion("Recurso no disponible.");
  }
}

/* ── Background Sync: cola de envíos de la bitácora ───────────────────────── */

/**
 * La página (src/services/outboxService.js) guarda cada entrada nueva en el
 * store `outbox` de IndexedDB y DESPUÉS registra esta tag con
 * registration.sync.register(). El navegador dispara aquí el evento `sync`
 * cuando hay conexión: enseguida si ya la había, o en cuanto vuelva si no. No
 * hace falta que la pestaña siga abierta.
 *
 * Reglas:
 *   - Cada elemento se borra de la cola SOLO después de que el servidor
 *     responda 2xx. Un error lo deja donde estaba, con un intento más.
 *   - Si alguno falla, la promesa de waitUntil se RECHAZA: es la señal para que
 *     el navegador programe otro intento (Chrome espera unos minutos y prueba
 *     hasta 3 veces; en el último, event.lastChance es true).
 *
 * Las constantes repiten las de src/services/outboxService.js y
 * src/services/dbService.js: un worker clásico no puede importar módulos ES.
 * Si cambia una, hay que cambiarla en los dos lados.
 */
const TAG_SYNC = "soilair-sync-bitacora";
const CANAL_OUTBOX = "soilair-outbox";
const CANDADO_OUTBOX = "soilair-outbox";

const DB_NOMBRE = "soilair";
const DB_VERSION = 2;
const STORE_BITACORA = "bitacora";
const STORE_OUTBOX = "outbox";

self.addEventListener("sync", (event) => {
  console.log(
    `[SW] sync: tag "${event.tag}"` +
      (event.lastChance ? " (último intento del navegador)" : ""),
  );

  // Otra tag: no es de la bitácora, no se toca.
  if (event.tag !== TAG_SYNC) return;

  // Sin waitUntil el navegador daría el evento por terminado al instante y
  // podría apagar el worker a mitad de los envíos.
  event.waitUntil(enviarCola(event.lastChance));
});

/* ── IndexedDB sin librería ───────────────────────────────────────────────── */

/** Convierte una petición de IndexedDB (eventos) en promesa. */
function idbPromesa(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

/** Se cumple cuando la transacción terminó de escribirse en disco. */
function idbFin(tx) {
  return new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () =>
      rechazar(tx.error || new DOMException("Transacción abortada", "AbortError"));
  });
}

/**
 * Abre la base de la app con la MISMA versión y el MISMO upgrade que
 * dbService.js. En la práctica la página siempre la crea antes (es quien
 * registra el sync), pero si el worker la creara vacía, la página ya no podría
 * agregar los stores: upgrade solo corre cuando la versión sube.
 */
function abrirBase() {
  const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION);

  peticion.onupgradeneeded = (evento) => {
    const db = peticion.result;

    if (evento.oldVersion < 1) {
      db.createObjectStore(STORE_BITACORA, { keyPath: "id", autoIncrement: true })
        .createIndex("cultivo", "cultivo");
    }

    if (evento.oldVersion < 2) {
      db.createObjectStore(STORE_OUTBOX, { keyPath: "id", autoIncrement: true })
        .createIndex("entradaId", "entradaId");
    }
  };

  return idbPromesa(peticion).then((db) => {
    // Si una página pide una versión más nueva, se suelta la base.
    db.onversionchange = () => db.close();
    return db;
  });
}

/** Todos los envíos pendientes, del más antiguo al más nuevo. */
function leerCola(db) {
  const tx = db.transaction(STORE_OUTBOX, "readonly");
  return idbPromesa(tx.objectStore(STORE_OUTBOX).getAll());
}

/**
 * Confirmado por el servidor: fuera de la cola y la entrada marcada como
 * enviada, en una sola transacción. Hace lo mismo que confirmarEnvio() de
 * dbService.js.
 */
async function confirmarEnCola(db, pendiente, idServidor) {
  const tx = db.transaction([STORE_BITACORA, STORE_OUTBOX], "readwrite");
  const terminado = idbFin(tx);

  tx.objectStore(STORE_OUTBOX).delete(pendiente.id);

  // Si el usuario borró la entrada mientras viajaba, no se vuelve a crear.
  const entradas = tx.objectStore(STORE_BITACORA);
  const entrada = await idbPromesa(entradas.get(pendiente.entradaId));
  if (entrada) {
    entradas.put({
      ...entrada,
      envio: { estado: "enviada", idServidor, enviadaEn: new Date().toISOString() },
    });
  }

  return terminado;
}

/** Falló: sigue en la cola con un intento más. Igual que registrarFallo(). */
async function registrarFalloEnCola(db, idPendiente, motivo) {
  const tx = db.transaction(STORE_OUTBOX, "readwrite");
  const terminado = idbFin(tx);
  const store = tx.objectStore(STORE_OUTBOX);

  const pendiente = await idbPromesa(store.get(idPendiente));
  if (pendiente) {
    store.put({
      ...pendiente,
      intentos: (pendiente.intentos ?? 0) + 1,
      ultimoError: motivo,
      ultimoIntento: new Date().toISOString(),
    });
  }

  return terminado;
}

/* ── Envío ────────────────────────────────────────────────────────────────── */

/**
 * Manda UN elemento de la cola. Lanza si no hubo una respuesta 2xx: fetch() no
 * lanza con un 404 o un 500, hay que revisar response.ok a mano.
 *
 * Esta petición la hace el propio worker, así que NO pasa por su evento fetch.
 */
async function enviarElemento(pendiente) {
  let respuesta;

  try {
    respuesta = await fetch(pendiente.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(pendiente.cuerpo),
      // Un servidor que nunca contesta no debe dejar el evento colgado.
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
  } catch (error) {
    throw new Error(
      error.name === "TimeoutError"
        ? "el servidor tardó demasiado en responder"
        : "sin conexión con el servidor",
    );
  }

  if (!respuesta.ok) {
    throw new Error(`el servidor respondió ${respuesta.status}`);
  }

  const datos = await respuesta.json().catch(() => null);
  return { estado: respuesta.status, idServidor: datos?.id ?? null };
}

/** Avisa a las páginas abiertas (src/services/outboxService.js) del resultado. */
function avisarPaginas(crudo) {
  if (!("BroadcastChannel" in self)) return;

  const canal = new BroadcastChannel(CANAL_OUTBOX);
  canal.postMessage({ type: "OUTBOX_CAMBIO", crudo });
  canal.close();
}

/**
 * Recorre la cola y manda cada elemento. Corre con el mismo Web Lock que usa la
 * página, para que un "Reintentar ahora" simultáneo no envíe dos veces lo mismo.
 *
 * @param {boolean} ultimaOportunidad event.lastChance
 * @returns {Promise<void>} se RECHAZA si algún envío falló
 */
function enviarCola(ultimaOportunidad) {
  const trabajo = async () => {
    const db = await abrirBase();

    try {
      const pendientes = await leerCola(db);

      if (!pendientes.length) {
        console.log("[SW] sync: la cola está vacía, no hay nada que enviar");
        avisarPaginas({ enviados: 0, fallidos: 0, origen: "service-worker" });
        return;
      }

      console.log(
        `[SW] sync: ${pendientes.length} envío(s) pendiente(s) en la cola (outbox)`,
      );

      let enviados = 0;
      let fallidos = 0;
      let ultimoError = "";

      for (const pendiente of pendientes) {
        try {
          const { estado, idServidor } = await enviarElemento(pendiente);

          // SOLO aquí, con la confirmación del servidor, sale de la cola.
          await confirmarEnCola(db, pendiente, idServidor);
          enviados++;
          console.log(
            `[SW] sync: entrada #${pendiente.entradaId} confirmada por el servidor ` +
              `(HTTP ${estado}, id ${idServidor}); se borra de la cola`,
          );
        } catch (error) {
          fallidos++;
          ultimoError = error.message;
          await registrarFalloEnCola(db, pendiente.id, error.message);
          console.warn(
            `[SW] sync: entrada #${pendiente.entradaId} NO se envió (${error.message}); sigue en la cola`,
          );
        }
      }

      avisarPaginas({
        enviados,
        fallidos,
        ultimoError,
        origen: "service-worker",
        ultimaOportunidad,
      });

      if (fallidos) {
        console.warn(
          `[SW] sync: ${fallidos} pendiente(s); se rechaza waitUntil para que el navegador reintente` +
            (ultimaOportunidad
              ? ". Era el último intento: queda en la cola hasta el próximo sync.register"
              : ""),
        );
        // Rechazar waitUntil = pedirle al navegador otro intento más tarde.
        throw new Error(`${fallidos} envío(s) de la bitácora siguen pendientes`);
      }

      console.log(`[SW] sync: ${enviados} entrada(s) confirmadas; la cola quedó vacía`);
    } finally {
      db.close();
    }
  };

  return self.navigator.locks
    ? self.navigator.locks.request(CANDADO_OUTBOX, trabajo)
    : trabajo();
}
