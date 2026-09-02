/**
 * src/main.js
 * -----------------------------------------------------------------------------
 * Punto de entrada: declara la tabla de rutas, prepara el navbar y arranca el
 * router.
 */

import { Router } from './router/router.js';
import { montarNavbar, marcarActivo } from './components/Navbar.js';
import { HomeView } from './views/HomeView.js';
import { AboutView } from './views/AboutView.js';
import { ClimaView } from './views/ClimaView.js';
import { CultivoDetailView } from './views/CultivoDetailView.js';
import { NotFoundView } from './views/NotFoundView.js';

const rutas = [
  { path: '/', view: HomeView, titulo: 'Catálogo de cultivos' },
  { path: '/clima', view: ClimaView, titulo: 'Condiciones en campo' },
  { path: '/acerca', view: AboutView, titulo: 'Acerca' },
  { path: '/cultivo/:id', view: CultivoDetailView, titulo: 'Ficha del cultivo' },
];

// En index.html los enlaces del encabezado son rutas internas ("/", "/clima").
// El navbar les antepone el BASE_PATH para que apunten a la URL real, tanto en
// local como publicado en GitHub Pages.
montarNavbar();

const router = new Router(rutas, {
  contenedor: document.querySelector('#app'),
  noEncontrada: NotFoundView,
  // Cada vez que se monta una vista, el navbar subraya la sección activa.
  alRenderizar: marcarActivo,
});

router.iniciar();
