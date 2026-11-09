/**
 * components/PanelEnvios.js
 * -----------------------------------------------------------------------------
 * Panel "Envío al servidor" de la vista /bitacora.
 *
 * Responde a cuatro preguntas que el usuario no puede ver en ningún otro lado:
 *
 *   1. ¿En qué modo está la app?   Background Sync o plan B, y por qué.
 *   2. ¿Hay conexión?              navigator.onLine, al día con online/offline.
 *   3. ¿Qué falta por enviar?      la cola (store outbox), con intentos y error.
 *   4. ¿Qué pasó la última vez?    el resultado del último envío.
 *
 * Y trae el botón "Reintentar ahora", el tercer reintento del plan B (los otros
 * dos, el evento online y la apertura de la app, viven en outboxService.js).
 * En modo Background Sync el botón también sirve: manda la cola desde la página
 * sin esperar a que el navegador decida reintentar.
 */

import {
  MODO,
  MOTIVO_PLAN_B,
  TAG_SYNC,
  alCambiarCola,
  enviarPendientes,
  leerPendientes,
  leerUltimoResultado,
} from '../services/outboxService.js';
import { escaparHtml } from '../utils/escapar.js';

const HORA = new Intl.DateTimeFormat('es-MX', { timeStyle: 'medium' });

/** Hora legible de una fecha ISO; vacío si no se puede interpretar. */
function hora(iso) {
  const momento = new Date(iso);
  return Number.isNaN(momento.getTime()) ? '' : HORA.format(momento);
}

/** Texto fijo del modo: no cambia mientras la página esté abierta. */
function Modo() {
  if (MODO === 'background-sync') {
    return `
      <p class="envios__modo envios__modo--bs">Modo: Background Sync</p>
      <p class="envios__explica">
        Este navegador tiene <code>SyncManager</code>. Al guardar, la entrada
        entra a la cola y se registra la tag <code>${escaparHtml(TAG_SYNC)}</code>:
        el navegador la envía en cuanto haya red, aunque cierres la pestaña, y
        si el servidor falla la vuelve a intentar solo.
      </p>
    `;
  }

  const porque =
    MOTIVO_PLAN_B === 'simulado'
      ? 'Simulación de un navegador sin <code>SyncManager</code> (la URL lleva <code>?plan-b</code>).'
      : 'Este navegador no tiene <code>SyncManager</code>.';

  return `
    <p class="envios__modo envios__modo--planb">Modo: plan B (sin Background Sync)</p>
    <p class="envios__explica">
      ${porque} La cola la envía la propia página: al volver la conexión, al
      abrir la app o con «Reintentar ahora». Solo funciona con la app abierta.
    </p>
  `;
}

/** Marcado del panel. El estado variable se pinta después, en montar(). */
export function PanelEnvios() {
  return `
    <section id="envios" class="envios envios--${MODO}" aria-labelledby="envios-titulo">
      <div class="envios__cabecera">
        <h2 id="envios-titulo" class="envios__titulo">Envío al servidor</h2>
        <span class="envios__red" data-envios-red></span>
      </div>

      ${Modo()}

      <div class="envios__estado" data-envios-estado aria-live="polite">
        <p class="cargando">Leyendo la cola…</p>
      </div>

      <div class="envios__pie">
        <button type="button" class="clima-boton" data-envios-reintentar>Reintentar ahora</button>
        <p class="envios__resultado" data-envios-resultado role="status"></p>
      </div>
    </section>
  `;
}

/**
 * Conecta el panel ya montado. Se desconecta solo cuando la vista deja de
 * estar en pantalla (vigente() devuelve false).
 *
 * @param {HTMLElement} contenedor
 * @param {{vigente: () => boolean,
 *          describir: (pendiente: Object) => {titulo: string, detalle: string}}} opciones
 *        describir: cómo nombrar un envío pendiente (lo sabe la vista, no el panel)
 */
export function montarPanelEnvios(contenedor, { vigente, describir }) {
  const panel = contenedor.querySelector('#envios');
  if (!panel) return;

  const red = panel.querySelector('[data-envios-red]');
  const estado = panel.querySelector('[data-envios-estado]');
  const resultado = panel.querySelector('[data-envios-resultado]');
  const boton = panel.querySelector('[data-envios-reintentar]');

  let turno = 0;

  function pintarRed() {
    const enLinea = navigator.onLine;
    red.textContent = enLinea ? 'En línea' : 'Sin conexión';
    red.className = `envios__red envios__red--${enLinea ? 'si' : 'no'}`;
  }

  function pintarResultado(ultimo) {
    if (!ultimo) {
      resultado.textContent = '';
      resultado.className = 'envios__resultado';
      return;
    }

    const cuando = hora(ultimo.hora);
    resultado.textContent = cuando ? `${cuando} · ${ultimo.texto}` : ultimo.texto;
    resultado.className = `envios__resultado envios__resultado--${ultimo.tono}`;
  }

  async function pintarCola() {
    const mio = ++turno;
    let pendientes;

    try {
      pendientes = await leerPendientes();
    } catch {
      if (mio !== turno) return;
      estado.innerHTML = '<p class="envios__vacia">No se pudo leer la cola de envíos.</p>';
      return;
    }

    if (mio !== turno || !vigente()) return;

    if (!pendientes.length) {
      estado.innerHTML = `
        <p class="envios__conteo envios__conteo--vacia">Cola vacía · no hay nada pendiente de envío</p>
      `;
      return;
    }

    const filas = pendientes
      .map((pendiente) => {
        const { titulo, detalle } = describir(pendiente);
        const intentos =
          pendiente.intentos === 1 ? '1 intento' : `${pendiente.intentos ?? 0} intentos`;
        const error = pendiente.ultimoError
          ? ` · último error: ${escaparHtml(pendiente.ultimoError)}`
          : '';

        return `
          <li class="envios__item">
            <span class="envios__item-titulo">${escaparHtml(titulo)}</span>
            <span class="envios__item-detalle">${escaparHtml(detalle)}</span>
            <span class="envios__item-meta">
              outbox #${escaparHtml(pendiente.id)} · ${escaparHtml(intentos)}${error}
            </span>
          </li>
        `;
      })
      .join('');

    estado.innerHTML = `
      <p class="envios__conteo">
        ${pendientes.length === 1 ? '1 envío pendiente' : `${pendientes.length} envíos pendientes`}
      </p>
      <ol class="envios__lista">${filas}</ol>
    `;
  }

  function pintar(ultimo = leerUltimoResultado()) {
    pintarRed();
    pintarResultado(ultimo);
    return pintarCola();
  }

  /* Reintentar ahora ------------------------------------------------------- */

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      await enviarPendientes('botón Reintentar ahora');
    } finally {
      boton.disabled = false;
    }
  });

  /* Mantenerse al día ------------------------------------------------------ */

  // Escuchas globales: se quitan solas la primera vez que se disparan con la
  // vista ya desmontada (el router no tiene un "al salir de la vista").
  const alCambiarRed = () => {
    if (!vigente()) {
      window.removeEventListener('online', alCambiarRed);
      window.removeEventListener('offline', alCambiarRed);
      return;
    }
    pintarRed();
  };
  window.addEventListener('online', alCambiarRed);
  window.addEventListener('offline', alCambiarRed);

  const dejar = alCambiarCola((ultimo) => {
    if (!vigente()) {
      dejar();
      return;
    }
    pintar(ultimo);
  });

  return pintar();
}
