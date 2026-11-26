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
import { FotoCultivo } from './FotoCultivo.js';

/**
 * Ancho que ocupa la foto en cada diseño de la rejilla (cultivosView.css):
 * 3 columnas desde 60rem (~300 px cada una), 2 desde 40rem y 1 en móvil.
 */
const SIZES_TARJETA = '(min-width: 60rem) 300px, (min-width: 40rem) 46vw, 92vw';

/**
 * @param {Object} cultivo
 * @param {number} [indice] posición en el listado (se usa con Array.map). Solo
 *        la primera tarjeta, la que se ve al abrir, carga su foto con
 *        prioridad; las demás esperan al scroll (loading="lazy").
 */
export function CultivoCard(cultivo, indice = 0) {
  const id = slugify(cultivo.nombre);

  return `
    <article class="tarjeta">
      ${FotoCultivo(id, { sizes: SIZES_TARJETA, prioridad: indice === 0, clase: 'tarjeta__foto' })}
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
