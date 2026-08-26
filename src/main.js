/**
 * src/main.js
 * -----------------------------------------------------------------------------
 * Punto de entrada: declara la tabla de rutas y arranca el router.
 */

import { Router, rutaCompleta } from './router/router.js';
import { HomeView } from './views/HomeView.js';
import { AboutView } from './views/AboutView.js';
import { CultivoDetailView } from './views/CultivoDetailView.js';
import { NotFoundView } from './views/NotFoundView.js';

const rutas = [
  { path: '/', view: HomeView, titulo: 'Catálogo de cultivos' },
  { path: '/acerca', view: AboutView, titulo: 'Acerca' },
  { path: '/cultivo/:id', view: CultivoDetailView, titulo: 'Ficha del cultivo' },
];

// Los enlaces del encabezado se escriben como rutas internas ("/", "/acerca");
// aquí se les antepone la carpeta real donde se está sirviendo el proyecto.
document.querySelectorAll('.topbar a[data-link]').forEach((enlace) => {
  enlace.setAttribute('href', rutaCompleta(enlace.getAttribute('href')));
});

const router = new Router(rutas, {
  contenedor: document.querySelector('#app'),
  noEncontrada: NotFoundView,
});

router.iniciar();
