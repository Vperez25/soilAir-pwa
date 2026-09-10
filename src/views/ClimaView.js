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
 *
 * PERSISTENCIA (sessionStorage)
 * El campo "Filtrar" recuerda lo escrito en sessionStorage, así que sobrevive a
 * un F5 pero muere al cerrar la pestaña. El porqué de ese mecanismo y no otro
 * está en services/filtroService.js.
 */

import { climaService } from '../services/climaService.js';
import { filtroGuardado, guardarFiltro, filtrar } from '../services/filtroService.js';
import { rutaCompleta } from '../router/router.js';
import { claseEstado } from '../utils/slugify.js';
import { escaparHtml } from '../utils/escapar.js';

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

/**
 * Barra superior + contenedor VACÍO de la lista.
 *
 * La lista se deja vacía a propósito: la llena pintarLista(), que es la misma
 * función que corre con cada tecla del filtro. Así solo hay UN lugar que decide
 * qué tarjetas se ven.
 */
function Panel(lecturas) {
  const hora = lecturas[0]?.hora ? HORA.format(new Date(lecturas[0].hora)) : '—';

  // El valor viene de sessionStorage, o sea del usuario: se escapa antes de
  // meterlo en el atributo (ver utils/escapar.js).
  const filtro = escaparHtml(filtroGuardado());

  return `
    <div class="clima-barra">
      <span>Open-Meteo · lectura de las ${hora} h · <span id="clima-conteo"></span></span>

      <span class="clima-acciones">
        <label class="clima-filtro">
          <span class="clima-filtro__etiqueta">Filtrar</span>
          <input
            type="search"
            class="clima-filtro__campo"
            data-filtro
            value="${filtro}"
            placeholder="parcela, región o cultivo"
            aria-label="Filtrar parcelas por nombre, región o cultivo"
          />
        </label>
        <button type="button" class="clima-boton" data-accion="recargar">Actualizar</button>
      </span>
    </div>

    <div id="clima-lista"></div>
  `;
}

/** Mensaje cuando el filtro no deja pasar ninguna parcela. */
function SinCoincidencias(filtro) {
  return `
    <p class="clima-vacio">
      Ninguna parcela coincide con “${escaparHtml(filtro)}”.
      <button type="button" class="clima-boton" data-accion="limpiar-filtro">Quitar filtro</button>
    </p>
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
    <div class="clima-barra"><span>Consultando la red de parcelas…</span></div>

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

  // Último resultado bueno de la API. Vive aquí, en el cierre de montar(), para
  // que filtrar NO vuelva a pegarle a Open-Meteo: el filtro es de pantalla.
  let lecturas = [];

  // Los escuchadores van en el PANEL y no en cada control, porque el contenido
  // del panel se reescribe entero en cada carga: un listener puesto sobre el
  // botón o sobre el campo se perdería con el primer repintado.
  panel.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-accion="recargar"]')) {
      panel.innerHTML = Cargando();
      cargar(panel, vigente).then((datos) => {
        lecturas = datos;
      });
      return;
    }

    if (evento.target.closest('[data-accion="limpiar-filtro"]')) {
      guardarFiltro('');
      const campo = panel.querySelector('[data-filtro]');
      if (campo) campo.value = '';
      pintarLista(panel, lecturas);
    }
  });

  // 'input' se dispara con cada tecla y también con la "x" del type="search".
  panel.addEventListener('input', (evento) => {
    if (!evento.target.closest('[data-filtro]')) return;

    // Se guarda ANTES de pintar: si sessionStorage falla, guardarFiltro() avisa
    // y devuelve false, pero el filtrado en pantalla ocurre igual.
    guardarFiltro(evento.target.value);
    pintarLista(panel, lecturas);
  });

  lecturas = await cargar(panel, vigente);
};

/**
 * Pinta dentro de #clima-lista solo las parcelas que pasan el filtro guardado.
 *
 * @param {HTMLElement} panel
 * @param {Array<Object>} lecturas todas las lecturas recibidas de la API
 */
function pintarLista(panel, lecturas) {
  const lista = panel.querySelector('#clima-lista');
  if (!lista) return;

  const filtro = filtroGuardado();
  const visibles = filtrar(lecturas, filtro);

  const conteo = panel.querySelector('#clima-conteo');
  if (conteo) {
    conteo.textContent =
      visibles.length === lecturas.length
        ? `${lecturas.length} parcelas`
        : `${visibles.length} de ${lecturas.length} parcelas`;
  }

  lista.innerHTML = visibles.length
    ? `<section class="rejilla" aria-label="Condiciones por parcela">
         ${visibles.map(TarjetaClima).join('')}
       </section>`
    : SinCoincidencias(filtro);
}

/**
 * Pide los datos y pinta el resultado (éxito o error) dentro del panel.
 *
 * @param {HTMLElement} panel
 * @param {() => boolean} [vigente] false si el usuario ya navegó a otra ruta
 * @returns {Promise<Array<Object>>} las lecturas obtenidas, o [] si hubo error
 */
async function cargar(panel, vigente = () => true) {
  try {
    const lecturas = await climaService.obtenerCondiciones();

    // El usuario pudo haber cambiado de vista mientras esperábamos: en ese caso
    // el panel ya no está en pantalla y no hay que escribir nada.
    if (!vigente() || !panel.isConnected) return [];

    panel.innerHTML = Panel(lecturas);
    pintarLista(panel, lecturas);

    return lecturas;
  } catch (error) {
    if (!vigente() || !panel.isConnected) return [];

    panel.innerHTML = MensajeError(error.message ?? 'Ocurrió un error inesperado.');
    return [];
  }
}
