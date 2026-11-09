/**
 * components/CampoUbicacion.js
 * -----------------------------------------------------------------------------
 * Campo "Ubicación en la parcela" del formulario de la Bitácora.
 *
 * Es solo interfaz: la Geolocation API y la Permissions API se usan a través de
 * services/ubicacionService.js. Reglas que sigue:
 *
 *   - PERMISO CON CONTEXTO. La pregunta del navegador no aparece al cargar la
 *     página: solo después de pulsar "Adjuntar mi ubicación", y debajo de un
 *     texto que explica para qué sirve.
 *   - ESTADO VISIBLE. Antes de pulsar, se muestra el estado del permiso
 *     (Permissions API) y se actualiza si el usuario lo cambia en los ajustes.
 *     Si el navegador no tiene esa API, se dice que se sabrá al pulsar.
 *   - SI SE DENIEGA, LA APP SIGUE. La referencia escrita (parcela, surco) está
 *     siempre disponible, y se explica cómo volver a habilitar el permiso.
 */

import {
  obtenerUbicacion,
  consultarPermiso,
  coordenadas,
  enlaceMapa,
} from '../services/ubicacionService.js';
import { escaparHtml } from '../utils/escapar.js';

/** Largo máximo de la referencia escrita; el mismo valor va en el maxlength. */
export const MAX_REFERENCIA = 120;

/** Texto del estado del permiso, según la Permissions API. */
const ESTADOS = {
  granted: { clase: 'si', texto: 'concedido. Se lee al pulsar el botón.' },
  prompt: { clase: 'pendiente', texto: 'aún no lo decides. El navegador te lo preguntará al pulsar el botón.' },
  denied: { clase: 'no', texto: 'bloqueado. Escribe la referencia abajo o vuelve a habilitarlo (ver cómo).' },
  desconocido: {
    clase: 'pendiente',
    texto: 'este navegador no informa el estado del permiso; lo sabrás al pulsar el botón.',
  },
};

/** Cómo volver a habilitar el permiso, para cuando está bloqueado. */
const COMO_HABILITAR = `
  <p class="ubicacion__ayuda-titulo">Cómo volver a habilitar la ubicación</p>
  <ol class="ubicacion__pasos">
    <li>Toca el ícono que está a la izquierda de la dirección (candado o ajustes).</li>
    <li>Entra a <strong>Permisos</strong> o <strong>Configuración del sitio</strong> y cambia
      <strong>Ubicación</strong> a <strong>Permitir</strong>.</li>
    <li>Recarga la página y vuelve a pulsar «Adjuntar mi ubicación».</li>
  </ol>
  <p class="ubicacion__ayuda-nota">
    En el teléfono revisa también que la ubicación del sistema esté encendida
    (Android: Ajustes → Ubicación · iPhone: Ajustes → Privacidad y seguridad →
    Localización → Sitios web de Safari).
  </p>
`;

/** Marcado del campo. Va dentro de .bitacora-form__campos. */
export function CampoUbicacion() {
  return `
    <fieldset class="ubicacion campo--ancho" data-ubicacion>
      <legend class="campo__etiqueta">Ubicación en la parcela (opcional)</legend>

      <p class="ubicacion__para-que">
        Sirve para marcar el punto exacto donde hiciste la observación —dónde
        apareció la plaga, qué válvula regaste— y poder volver a él o
        mandárselo al agrónomo. Se lee una sola vez, cuando pulsas el botón;
        SoilAir no sigue tu recorrido.
      </p>

      <p class="ubicacion__permiso" data-permiso>Permiso de ubicación: consultando…</p>

      <div class="ubicacion__acciones">
        <button type="button" class="clima-boton" data-ubicar>Adjuntar mi ubicación</button>
        <span class="ubicacion__lectura" data-lectura aria-live="polite"></span>
      </div>

      <div class="ubicacion__aviso" data-aviso-ubicacion role="alert" hidden></div>

      <label class="campo">
        <span class="campo__etiqueta">Referencia escrita (parcela, surco, válvula)</span>
        <input
          class="campo__control"
          name="referencia"
          maxlength="${MAX_REFERENCIA}"
          placeholder="Ej. Parcela norte, surco 5"
        />
      </label>
    </fieldset>
  `;
}

/**
 * Conecta el campo ya montado.
 *
 * @param {HTMLElement} contenedor
 * @param {{vigente: () => boolean}} opciones
 * @returns {{leer: () => Object|null, limpiar: () => void}}
 *          leer(): la ubicación adjuntada, o null si no hay
 */
export function montarCampoUbicacion(contenedor, { vigente }) {
  const campo = contenedor.querySelector('[data-ubicacion]');
  const permiso = campo.querySelector('[data-permiso]');
  const boton = campo.querySelector('[data-ubicar]');
  const lectura = campo.querySelector('[data-lectura]');
  const aviso = campo.querySelector('[data-aviso-ubicacion]');
  const referencia = campo.querySelector('[name="referencia"]');

  /** Ubicación adjuntada a la entrada que se está escribiendo. */
  let ubicacion = null;

  /** Último estado conocido del permiso. */
  let estadoPermiso = 'desconocido';

  function pintarPermiso(estado) {
    estadoPermiso = estado;
    const { clase, texto } = ESTADOS[estado] ?? ESTADOS.desconocido;
    permiso.innerHTML = `Permiso de ubicación: <strong>${escaparHtml(texto)}</strong>`;
    permiso.className = `ubicacion__permiso ubicacion__permiso--${clase}`;
    if (estado === 'denied') mostrarAviso('', { ayuda: true });
  }

  function mostrarAviso(texto, { ayuda = false } = {}) {
    if (!texto && !ayuda) {
      aviso.hidden = true;
      aviso.innerHTML = '';
      return;
    }
    aviso.innerHTML = `${texto ? `<p class="ubicacion__error">${escaparHtml(texto)}</p>` : ''}${ayuda ? COMO_HABILITAR : ''}`;
    aviso.hidden = false;
  }

  function pintarLectura() {
    if (!ubicacion) {
      lectura.innerHTML = '';
      boton.textContent = 'Adjuntar mi ubicación';
      return;
    }

    lectura.innerHTML = `
      <span class="ubicacion__punto">${escaparHtml(coordenadas(ubicacion))}</span>
      <span class="ubicacion__precision">±${escaparHtml(ubicacion.precision)} m</span>
      <a href="${escaparHtml(enlaceMapa(ubicacion))}" target="_blank" rel="noopener">Ver en el mapa</a>
      <button type="button" class="ubicacion__quitar" data-quitar>Quitar</button>
    `;
    boton.textContent = 'Volver a leer';
  }

  /* Estado del permiso, sin preguntar nada ---------------------------------- */

  consultarPermiso((estado) => {
    if (!vigente()) return;
    pintarPermiso(estado);
    // Si lo vuelve a habilitar, la ayuda ya no hace falta.
    if (estado !== 'denied') mostrarAviso('');
  }).then(({ estado, dejar }) => {
    if (!vigente()) {
      dejar();
      return;
    }
    pintarPermiso(estado);
  });

  /* Leer SOLO después del clic ---------------------------------------------- */

  boton.addEventListener('click', async () => {
    boton.disabled = true;
    mostrarAviso('');
    lectura.textContent = 'Buscando tu ubicación…';

    try {
      ubicacion = await obtenerUbicacion();
      pintarLectura();
    } catch (error) {
      ubicacion = null;
      pintarLectura();
      // Código 1: además del mensaje, cómo volver a habilitarlo.
      mostrarAviso(error.message, { ayuda: error.codigo === 1 });
      // La alternativa queda a la mano: el cursor va a la referencia escrita.
      referencia.focus();
    } finally {
      boton.disabled = false;
    }
  });

  lectura.addEventListener('click', (evento) => {
    if (!evento.target.closest('[data-quitar]')) return;
    ubicacion = null;
    pintarLectura();
  });

  return {
    leer: () => ubicacion,
    limpiar: () => {
      ubicacion = null;
      pintarLectura();
      // Si el permiso sigue bloqueado, la ayuda para habilitarlo se queda.
      mostrarAviso('', { ayuda: estadoPermiso === 'denied' });
    },
  };
}
