/**
 * components/CultivoCard.js
 * -----------------------------------------------------------------------------
 * Tarjeta de un cultivo dentro del listado.
 *
 * Usa la exportación nombrada slugify() de utils/slugify.js para construir la
 * URL del detalle ("Chile Manzano" -> /cultivo/chile-manzano). El mismo slug lo
 * vuelve a calcular cultivosService.js al buscar la ficha, así que el id nunca
 * se escribe a mano en los datos.
 */

import { slugify } from '../utils/slugify.js';
import { rutaCompleta } from '../router/router.js';

export function CultivoCard(cultivo) {
  const id = slugify(cultivo.nombre);

  return `
    <article class="tarjeta">
      <p class="tarjeta__familia">${cultivo.familia}</p>
      <h2 class="tarjeta__nombre">${cultivo.nombre}</h2>
      <p class="tarjeta__cientifico">${cultivo.cientifico}</p>
      <p class="tarjeta__resumen">${cultivo.resumen}</p>

      <dl class="tarjeta__datos">
        <div>
          <dt>Ciclo</dt>
          <dd>${cultivo.cicloDias} días</dd>
        </div>
        <div>
          <dt>Identificador</dt>
          <dd><code>${id}</code></dd>
        </div>
      </dl>

      <a class="tarjeta__enlace" href="${rutaCompleta(`/cultivo/${id}`)}" data-link>
        Ver ficha y última lectura
      </a>
    </article>
  `;
}
