/**
 * views/HomeView.js
 * -----------------------------------------------------------------------------
 * Ruta estática "/" — listado de cultivos monitoreados.
 *
 * Solo importa el índice ligero. La ficha técnica (cultivosService.js) NO se
 * descarga aquí: eso ocurre al abrir un detalle.
 */

import { CULTIVOS } from "../services/cultivosIndex.js";
import { CultivoCard } from "../components/CultivoCard.js";

export function HomeView() {
  return `
    <section class="portada">
      <p class="portada__eyebrow">Red de nodos · 6 parcelas activas</p>
      <h1 class="portada__titulo">Catálogo de cultivos</h1>
      <p class="portada__texto">
        Cada cultivo tiene un rango ideal y un rango crítico de suelo y de aire.
        SoilAir compara contra ellos lo que miden los nodos en campo. Abre un
        cultivo para ver su ficha y la última lectura recibida.
      </p>
    </section>

    <section class="rejilla" aria-label="Cultivos">
      ${CULTIVOS.map(CultivoCard).join("")}
    </section>
  `;
}
