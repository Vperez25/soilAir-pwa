/**
 * views/ClimaView.js
 * -----------------------------------------------------------------------------
 * Ruta "/clima" — condiciones REALES de las parcelas, traídas de Open-Meteo.
 *
 * Esta vista NO llama a fetch: le pide los datos a climaService, que hereda de
 * ApiService. Aquí solo se decide qué HTML corresponde a cada uno de los tres
 * estados de la petición:
 *
 *   1. Cargando -> se pintan tarjetas "skeleton", una por parcela conocida.
 *   2. Éxito    -> las tarjetas skeleton se sustituyen por los datos reales.
 *   3. Error    -> mensaje visible con el motivo y un botón para reintentar.
 *
 * El router monta primero lo que devuelve ClimaView() (estado 1, instantáneo) y
 * después llama a ClimaView.montar(), que hace el trabajo asíncrono. Gracias a
 * eso el usuario ve el esqueleto de inmediato, sin pantalla en blanco.
 */

import { climaService } from '../services/climaService.js';
import { rutaCompleta } from '../router/router.js';
import { claseEstado } from '../utils/slugify.js';

const HORA = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Muestra un número con su unidad, o un guion si la API no lo mandó. */
function dato(valor, unidad) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const numero = typeof valor === 'number' ? Math.round(valor * 10) / 10 : valor;
  return `${numero}<small>${unidad}</small>`;
}

/* ── Estado 1: cargando ───────────────────────────────────────────────────── */

/** Una tarjeta gris con el nombre real de la parcela y bloques de relleno. */
function TarjetaSkeleton(parcela) {
  return `
    <article class="clima-tarjeta clima-tarjeta--skeleton" aria-hidden="true">
      <p class="clima-tarjeta__region">${parcela.region}</p>
      <h2 class="clima-tarjeta__parcela">${parcela.parcela}</h2>
      <p class="clima-tarjeta__cultivo">${parcela.cultivo}</p>

      <ul class="clima-metricas">
        ${['Aire', 'Humedad', 'Radiación', 'Suelo', 'Agua en suelo']
          .map(
            (etiqueta) => `
          <li class="clima-metrica">
            <span class="clima-metrica__etiqueta">${etiqueta}</span>
            <span class="clima-metrica__valor bloque-fantasma">████</span>
          </li>`
          )
          .join('')}
      </ul>

      <p class="clima-tarjeta__riego bloque-fantasma">█████████████████</p>
    </article>
  `;
}

/* ── Estado 2: éxito ──────────────────────────────────────────────────────── */

function TarjetaClima(lectura) {
  return `
    <article class="clima-tarjeta ${claseEstado(lectura.riego.estado)}">
      <p class="clima-tarjeta__region">${lectura.region}</p>
      <h2 class="clima-tarjeta__parcela">${lectura.parcela}</h2>
      <p class="clima-tarjeta__cultivo">
        <a href="${rutaCompleta(`/cultivo/${lectura.cultivoId}`)}" data-link>${lectura.cultivo}</a>
        · <code>${lectura.nodo}</code>
      </p>

      <ul class="clima-metricas">
        ${lectura.metricas
          .map(
            (m) => `
          <li class="clima-metrica clima-metrica--${m.clave}">
            <span class="clima-metrica__etiqueta">${m.etiqueta}</span>
            <span class="clima-metrica__valor">${dato(m.valor, m.unidad)}</span>
          </li>`
          )
          .join('')}
      </ul>

      <p class="clima-tarjeta__riego">${lectura.riego.texto}</p>

      <p class="clima-tarjeta__pie">
        Máx ${dato(lectura.maxima, '°C')} · Mín ${dato(lectura.minima, '°C')} ·
        Lluvia ${dato(lectura.lluvia, 'mm')}
      </p>
    </article>
  `;
}

function Exito(lecturas) {
  const hora = lecturas[0]?.hora ? HORA.format(new Date(lecturas[0].hora)) : '—';

  return `
    <p class="clima-barra">
      <span>Datos de Open-Meteo · lectura de las ${hora} h · ${lecturas.length} parcelas</span>
      <button type="button" class="clima-boton" data-accion="recargar">Actualizar</button>
    </p>

    <section class="rejilla" aria-label="Condiciones por parcela">
      ${lecturas.map(TarjetaClima).join('')}
    </section>
  `;
}

/* ── Estado 3: error ──────────────────────────────────────────────────────── */

function MensajeError(mensaje) {
  return `
    <div class="clima-error" role="alert">
      <p class="clima-error__titulo">No se pudieron cargar las condiciones</p>
      <p class="clima-error__texto">${mensaje}</p>
      <button type="button" class="clima-boton" data-accion="recargar">Reintentar</button>
    </div>
  `;
}

/* ── Vista ────────────────────────────────────────────────────────────────── */

/** Contenido del panel mientras se espera la respuesta (estado 1). */
function Cargando() {
  return `
    <p class="clima-barra"><span>Consultando la red de parcelas…</span></p>

    <section class="rejilla" aria-label="Cargando condiciones">
      ${climaService.parcelas.map(TarjetaSkeleton).join('')}
    </section>
  `;
}

export function ClimaView() {
  return `
    <section class="portada">
      <p class="portada__eyebrow">Datos en vivo · Open-Meteo</p>
      <h1 class="portada__titulo">Condiciones en campo</h1>
      <p class="portada__texto">
        Mientras un nodo no está conectado, SoilAir estima las condiciones de la
        parcela con datos meteorológicos reales: aire, radiación y también
        temperatura y humedad del suelo. La recomendación de riego se calcula a
        partir de esas mediciones.
      </p>
    </section>

    <div id="clima-panel">${Cargando()}</div>
  `;
}

/**
 * Gancho que ejecuta el router DESPUÉS de montar el HTML de arriba.
 * Aquí ocurre la petición con async/await y try/catch.
 *
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 */
ClimaView.montar = async ({ contenedor, vigente }) => {
  const panel = contenedor.querySelector('#clima-panel');
  if (!panel) return;

  // Un clic en "Actualizar" o "Reintentar" vuelve a empezar el ciclo completo.
  panel.addEventListener('click', (evento) => {
    if (!evento.target.closest('[data-accion="recargar"]')) return;
    panel.innerHTML = Cargando();
    cargar(panel, vigente);
  });

  await cargar(panel, vigente);
};

/**
 * Pide los datos y pinta el resultado (éxito o error) dentro del panel.
 *
 * @param {HTMLElement} panel
 * @param {() => boolean} [vigente] false si el usuario ya navegó a otra ruta
 */
async function cargar(panel, vigente = () => true) {
  try {
    const lecturas = await climaService.obtenerCondiciones();

    // El usuario pudo haber cambiado de vista mientras esperábamos: en ese caso
    // el panel ya no está en pantalla y no hay que escribir nada.
    if (!vigente() || !panel.isConnected) return;

    panel.innerHTML = Exito(lecturas);
  } catch (error) {
    if (!vigente() || !panel.isConnected) return;

    panel.innerHTML = MensajeError(error.message ?? 'Ocurrió un error inesperado.');
  }
}
