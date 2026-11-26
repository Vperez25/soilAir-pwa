/**
 * src/main.js
 * -----------------------------------------------------------------------------
 * Punto de entrada: declara la tabla de rutas, prepara el App Shell y arranca el
 * router.
 *
 * Aquí también se enciende la capa de persistencia, y el ORDEN importa:
 *
 *   1. iniciarTema()      antes que nada, para que ninguna vista se pinte con
 *                         el tema equivocado (el parpadeo inicial ya lo evita
 *                         el script de arranque de index.html).
 *   2. registrarVisita()  una sola vez por carga del documento: en una SPA
 *                         navegar entre vistas no es una visita nueva.
 *   3. router.iniciar()   al final, cuando el shell ya está completo.
 *   4. registrarSW()      en el evento `load`, ya con la página cargada.
 *
 * OPTIMIZACIÓN DE CARGA
 * Este archivo solo importa de forma ESTÁTICA lo que cualquier pantalla necesita
 * para pintarse (router, encabezado, tema, instalación). Todo lo demás llega con
 * import() dinámico, cuando hace falta:
 *
 *   - Las vistas: cada ruta trae una función `cargar` y el router la descarga
 *     al entrar (o al pasar el mouse por su enlace). Abrir el catálogo ya no
 *     descarga la bitácora, el diagnóstico ni IndexedDB.
 *   - El CSS de cada vista: `estilos` de la ruta (ver utils/estilos.js).
 *   - Lo que no pinta nada al abrir (Service Worker, push, cola de la bitácora,
 *     avisos del pie): después del evento `load`, cuando el navegador está libre.
 *
 * Los módulos estáticos de aquí están también en los <link rel="modulepreload">
 * de index.html: el navegador los pide todos en paralelo en vez de descubrirlos
 * uno por uno. Si se agrega un import estático, hay que agregarlo allá.
 */

import { Router } from "./router/router.js";
import { montarNavbar, marcarActivo } from "./components/Navbar.js";
import { montarSelectorTema } from "./components/SelectorTema.js";
import { iniciarTema } from "./services/temaService.js";
import { registrarVisita } from "./services/visitasService.js";
import { iniciarRegistroFetch } from "./pwa/fetchLog.js";
import { NotFoundView } from "./views/NotFoundView.js";
import { iniciarInstalacion } from "./pwa/instalacion.js";
import { montarBotonInstalar } from "./components/BotonInstalar.js";

/**
 * Tabla de rutas. `cargar` importa la vista solo cuando se necesita; `estilos`
 * son las hojas que esa vista usa además de las globales de index.html.
 */
const rutas = [
  {
    path: "/",
    titulo: "Catálogo de cultivos",
    cargar: () => import("./views/HomeView.js").then((m) => m.HomeView),
    estilos: ["styles/cultivosView.css"],
  },
  {
    path: "/clima",
    titulo: "Condiciones en campo",
    cargar: () => import("./views/ClimaView.js").then((m) => m.ClimaView),
    estilos: ["styles/climaView.css"],
  },
  {
    path: "/bitacora",
    titulo: "Bitácora de campo",
    cargar: () => import("./views/BitacoraView.js").then((m) => m.BitacoraView),
    estilos: ["styles/climaView.css", "styles/bitacora.css", "styles/envios.css", "styles/ubicacion.css"],
  },
  {
    path: "/acerca",
    titulo: "Acerca",
    cargar: () => import("./views/AboutView.js").then((m) => m.AboutView),
  },
  {
    path: "/diagnostico",
    titulo: "Diagnóstico",
    cargar: () => import("./views/DiagnosticoView.js").then((m) => m.DiagnosticoView),
    estilos: ["styles/climaView.css", "styles/persistencia.css", "styles/serviceWorker.css"],
  },
  {
    path: "/cuenta",
    titulo: "Cuenta y avisos",
    cargar: () => import("./views/CuentaView.js").then((m) => m.CuentaView),
    estilos: ["styles/climaView.css", "styles/bitacora.css", "styles/cuenta.css"],
  },
  {
    path: "/cultivo/:id",
    titulo: "Ficha del cultivo",
    cargar: () => import("./views/CultivoDetailView.js").then((m) => m.CultivoDetailView),
    estilos: ["styles/cultivosView.css"],
  },
];

// Tema guardado en localStorage + sincronización con las otras pestañas.
iniciarTema();

// En index.html los enlaces del encabezado son rutas internas ("/", "/clima").
// El navbar les antepone el BASE_PATH para que apunten a la URL real, tanto en
// local como publicado en GitHub Pages.
montarNavbar();
montarSelectorTema();

// Cookie de registro: suma una visita y renueva su caducidad de 30 días.
// Si el navegador no acepta cookies devuelve null y no pasa nada más.
registrarVisita();

// Empieza a recoger lo que el Service Worker informa de cada petición (HIT / MISS)
// para mostrarlo en /diagnostico. Va antes que el router: así no se pierden las
// peticiones del arranque.
iniciarRegistroFetch();

iniciarInstalacion(); // lo primero que se ejecuta, antes de cualquier await
montarBotonInstalar(); // después de que exista el DOM del Shell (el script es type="module", ya existe)

const router = new Router(rutas, {
  contenedor: document.querySelector("#app"),
  noEncontrada: NotFoundView,
  // Cada vez que se monta una vista, el navbar subraya la sección activa.
  alRenderizar: marcarActivo,
});

router.iniciar();

/* ── Después de la carga: lo que no pinta nada al abrir ──────────────────── */

/** Ejecuta `tarea` cuando el navegador esté libre (o pronto, si no hay API). */
const enReposo = (tarea) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(tarea, { timeout: 3000 })
    : setTimeout(tarea, 1000);

window.addEventListener("load", () => {
  // Service Worker: se registra en `load`, cuando la página y sus recursos ya
  // cargaron, para que el registro no compita con ellos. Va aquí, en el punto
  // de entrada, y no dentro de una vista: una vista se monta cada vez que se
  // navega y registraría el worker una y otra vez.
  import("./pwa/registerSW.js").then((m) => m.registrarSW());

  // Push: si este dispositivo ya estaba suscrito y hay sesión, se vuelve a
  // mandar la suscripción al backend (y se renueva si cambió la llave VAPID).
  import("./pwa/pushService.js").then((m) => m.reenviarSuscripcion("al abrir la app"));

  enReposo(() => {
    // Cola de envíos de la bitácora: escucha al Service Worker, prepara el plan
    // B (evento online) y, si quedó algo pendiente de otra sesión, lo vuelve a
    // pedir. Va en el punto de entrada y no en la vista: "al abrir la app"
    // tiene que pasar aunque se entre por otra ruta que no sea /bitacora.
    import("./services/outboxService.js").then((m) => m.iniciarEnvios());

    // Control de avisos del pie de página (permiso de notificaciones).
    import("./pwa/notificaciones.js").then((m) => m.iniciarNotificaciones());
  });
});
