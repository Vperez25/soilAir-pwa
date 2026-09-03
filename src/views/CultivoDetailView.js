/**
 * views/CultivoDetailView.js
 * -----------------------------------------------------------------------------
 * Ruta dinámica "/cultivo/:id".
 *
 * Aquí está el IMPORT DINÁMICO del ejercicio: cultivosService.js se descarga
 * hasta que el usuario entra a un detalle. En la pestaña Network se ve aparecer
 * el archivo justo en ese momento, no al cargar la app.
 */

import { MedidorRango } from "../components/MedidorRango.js";
import { NotFoundView } from "./NotFoundView.js";
import { rutaCompleta } from "../router/router.js";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
});

export async function CultivoDetailView({ params }) {
  // ── Import dinámico: se resuelve en tiempo de ejecución ──────────────────
  const { default: cultivosService } =
    await import("../services/cultivosService.js");

  const cultivo = cultivosService.obtenerPorId(params.id);

  // El parámetro existe pero no corresponde a ningún cultivo del catálogo.
  if (!cultivo) {
    return NotFoundView({
      titulo: "Cultivo no encontrado",
      mensaje: `No hay ningún cultivo con el identificador “${params.id}”.`,
    });
  }

  const alertas = cultivosService.contarAlertas(cultivo);

  return `
    <a class="volver" href="${rutaCompleta("/")}" data-link>← Todos los cultivos</a>

    <article class="ficha">
      <header class="ficha__encabezado">
        <p class="ficha__familia">${cultivo.familia} · ciclo de ${cultivo.cicloDias} días</p>
        <h1 class="ficha__titulo">${cultivo.nombre}</h1>
        <p class="ficha__cientifico">${cultivo.cientifico}</p>
        <p class="ficha__resumen">${cultivo.resumen}</p>
      </header>

      <section class="lectura">
        <h2 class="lectura__titulo">Última lectura</h2>
        <dl class="lectura__meta">
          <div><dt>Nodo</dt><dd><code>${cultivo.lectura.nodo}</code></dd></div>
          <div><dt>Ubicación</dt><dd>${cultivo.lectura.parcela}</dd></div>
          <div><dt>Recibida</dt><dd>${FECHA.format(new Date(cultivo.lectura.fecha))}</dd></div>
          <div>
            <dt>Parámetros fuera de rango</dt>
            <dd>${alertas === 0 ? "ninguno" : `${alertas} de 10`}</dd>
          </div>
        </dl>
      </section>

      <section class="bloque">
        <h2 class="bloque__titulo">Ambiente</h2>
        <ul class="metricas">${cultivo.ambiente.map(MedidorRango).join("")}</ul>
      </section>

      <section class="bloque">
        <h2 class="bloque__titulo">Suelo</h2>
        <ul class="metricas">${cultivo.suelo.map(MedidorRango).join("")}</ul>
      </section>

      <section class="notas">
        <h2 class="notas__titulo">Recomendaciones</h2>
        <ul>${cultivo.notas.map((nota) => `<li>${nota}</li>`).join("")}</ul>
      </section>
    </article>
  `;
}
