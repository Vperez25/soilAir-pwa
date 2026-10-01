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
 */

import { Router } from './router/router.js';
import { montarNavbar, marcarActivo } from './components/Navbar.js';
import { montarSelectorTema } from './components/SelectorTema.js';
import { iniciarTema } from './services/temaService.js';
import { registrarVisita } from './services/visitasService.js';
import { registrarSW } from './pwa/registerSW.js';
import { HomeView } from './views/HomeView.js';
import { AboutView } from './views/AboutView.js';
import { ClimaView } from './views/ClimaView.js';
import { BitacoraView } from './views/BitacoraView.js';
import { CultivoDetailView } from './views/CultivoDetailView.js';
import { DiagnosticoView } from './views/DiagnosticoView.js';
import { ServiceWorkerView } from './views/ServiceWorkerView.js';
import { NotFoundView } from './views/NotFoundView.js';

const rutas = [
  { path: '/', view: HomeView, titulo: 'Catálogo de cultivos' },
  { path: '/clima', view: ClimaView, titulo: 'Condiciones en campo' },
  { path: '/bitacora', view: BitacoraView, titulo: 'Bitácora de campo' },
  { path: '/acerca', view: AboutView, titulo: 'Acerca' },
  { path: '/diagnostico', view: DiagnosticoView, titulo: 'Diagnóstico de almacenamiento' },
  { path: '/service-worker', view: ServiceWorkerView, titulo: 'Service Worker' },
  { path: '/cultivo/:id', view: CultivoDetailView, titulo: 'Ficha del cultivo' },
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

const router = new Router(rutas, {
  contenedor: document.querySelector('#app'),
  noEncontrada: NotFoundView,
  // Cada vez que se monta una vista, el navbar subraya la sección activa.
  alRenderizar: marcarActivo,
});

router.iniciar();

// Service Worker: se registra en `load`, cuando la página y sus recursos ya
// cargaron, para que el registro no compita con ellos. Va aquí, en el punto de
// entrada, y no dentro de una vista: una vista se monta cada vez que se navega
// y registraría el worker una y otra vez.
window.addEventListener('load', registrarSW);
