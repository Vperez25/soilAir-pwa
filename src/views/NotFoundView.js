/**
 * views/NotFoundView.js
 * -----------------------------------------------------------------------------
 * Ruta no encontrada (404). La usa el router cuando ninguna ruta coincide, y
 * también CultivoDetailView cuando el :id no existe en el catálogo.
 */

import { rutaCompleta } from '../router/router.js';

export function NotFoundView({ titulo, mensaje } = {}) {
  return `
    <section class="error">
      <p class="error__codigo">404</p>
      <h1 class="error__titulo">${titulo ?? 'Esta ruta no existe'}</h1>
      <p class="error__texto">
        ${mensaje ?? 'La dirección que escribiste no corresponde a ninguna pantalla de SoilAir.'}
      </p>
      <a class="error__enlace" href="${rutaCompleta('/')}" data-link>Ir al catálogo de cultivos</a>
    </section>
  `;
}
