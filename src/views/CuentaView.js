/**
 * views/CuentaView.js
 * -----------------------------------------------------------------------------
 * Ruta "/cuenta" — sesión con el backend y avisos push de este dispositivo.
 *
 *   Sesión   entrar / crear cuenta / cerrar sesión   -> services/sesionService.js
 *   Avisos   activar / desactivar en este dispositivo
 *            y lista de dispositivos del usuario      -> pwa/pushService.js
 *
 * Qué dispara un aviso: una entrada nueva en la bitácora (la crea el backend al
 * recibirla). Al tocar el aviso se abre la ficha del cultivo.
 */

import { avisar } from '../components/Aviso.js';
import {
  activarPush,
  desactivarPush,
  ErrorPermiso,
  listarDispositivos,
  soportaPush,
  suscripcionActual,
} from '../pwa/pushService.js';
import {
  alCambiarSesion,
  comprobarSesion,
  entrar,
  registrarse,
  salir,
  sesionActual,
} from '../services/sesionService.js';
import { escaparHtml } from '../utils/escapar.js';

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** "Edge · Windows" a partir del user agent que guardó el backend. */
function nombreDispositivo(userAgent = '') {
  const ua = String(userAgent);
  const navegador =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/SamsungBrowser/.test(ua) && 'Samsung Internet') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    'Navegador';
  const sistema =
    (/Android/.test(ua) && 'Android') ||
    (/iPhone|iPad/.test(ua) && 'iOS') ||
    (/Windows/.test(ua) && 'Windows') ||
    (/Mac OS X/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    'sistema desconocido';
  return `${navegador} · ${sistema}`;
}

/** Texto para un error de red o del servidor. */
function explicar(error) {
  if (error?.tipo === 'timeout') return 'El servidor tardó demasiado en responder; inténtalo de nuevo.';
  if (error?.tipo === 'network') return 'No hay conexión con el servidor. Revisa tu red.';
  return error?.message || 'Ocurrió un error inesperado.';
}

/* ── Marcado ──────────────────────────────────────────────────────────────── */

function FormularioSesion() {
  return `
    <form id="cuenta-form" class="bitacora-form cuenta-tarjeta" autocomplete="on">
      <h2 class="bitacora-form__titulo">Sesión</h2>
      <p class="cuenta-texto">
        Tus entradas de la bitácora y tus avisos quedan ligados a tu cuenta. Usa
        la misma en el celular y en la laptop para recibir los avisos en los dos.
      </p>

      <div class="bitacora-form__campos">
        <label class="campo">
          <span class="campo__etiqueta">Usuario</span>
          <input class="campo__control" name="usuario" autocomplete="username" required
                 minlength="3" maxlength="32" pattern="[A-Za-z0-9._\\-]{3,32}"
                 autocapitalize="none" spellcheck="false" placeholder="p. ej. vincent" />
        </label>
        <label class="campo">
          <span class="campo__etiqueta">Contraseña</span>
          <input class="campo__control" name="password" type="password" required
                 minlength="8" maxlength="128" autocomplete="current-password"
                 placeholder="Mínimo 8 caracteres" />
        </label>
      </div>

      <div class="bitacora-form__pie">
        <button type="submit" class="clima-boton" value="entrar">Entrar</button>
        <button type="submit" class="clima-boton" value="registro">Crear cuenta</button>
        <p id="cuenta-mensaje" class="bitacora-mensaje" role="status"></p>
      </div>
    </form>
  `;
}

function SesionIniciada(usuario) {
  return `
    <section class="bitacora-form cuenta-tarjeta">
      <h2 class="bitacora-form__titulo">Sesión</h2>
      <p class="cuenta-texto">Sesión iniciada como <strong>${escaparHtml(usuario)}</strong>.</p>
      <div class="bitacora-form__pie">
        <button type="button" class="clima-boton" data-accion="salir">Cerrar sesión</button>
        <p id="cuenta-mensaje" class="bitacora-mensaje" role="status"></p>
      </div>
    </section>
  `;
}

function Dispositivos(lista, endpointPropio) {
  if (!lista.length) return '<p class="cuenta-texto">Todavía no hay dispositivos suscritos.</p>';

  const filas = lista
    .map((d) => {
      const propio = d.endpoint === endpointPropio;
      return `
        <li class="cuenta-dispositivo${propio ? ' cuenta-dispositivo--propio' : ''}">
          <span class="cuenta-dispositivo__nombre">${escaparHtml(nombreDispositivo(d.userAgent))}${propio ? ' (este dispositivo)' : ''}</span>
          <span class="cuenta-dispositivo__meta">${escaparHtml(d.servicio)} · desde ${escaparHtml(FECHA.format(new Date(d.creadaEn)))}</span>
        </li>`;
    })
    .join('');

  return `
    <p class="cuenta-subtitulo">Tus dispositivos suscritos (${lista.length})</p>
    <ul class="cuenta-dispositivos">${filas}</ul>
  `;
}

export function CuentaView() {
  return `
    <section class="portada">
      <p class="portada__eyebrow">Sesión · Push API · VAPID</p>
      <h1 class="portada__titulo">Cuenta y avisos</h1>
      <p class="portada__texto">
        Cada vez que se registra una entrada en la bitácora, el servidor de
        SoilAir avisa a todos tus dispositivos, aunque la app esté cerrada.
        Al tocar el aviso se abre la ficha del cultivo.
      </p>
    </section>

    <div id="cuenta-sesion"><p class="cargando">Cargando…</p></div>

    <section id="cuenta-push" class="bitacora-form cuenta-tarjeta" aria-live="polite">
      <h2 class="bitacora-form__titulo">Avisos push</h2>
      <p class="cargando">Revisando este dispositivo…</p>
    </section>
  `;
}

/* ── Comportamiento ───────────────────────────────────────────────────────── */

/**
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 */
CuentaView.montar = async ({ contenedor, vigente }) => {
  const cajaSesion = contenedor.querySelector('#cuenta-sesion');
  const cajaPush = contenedor.querySelector('#cuenta-push');
  if (!cajaSesion || !cajaPush) return;

  const decir = (texto, tono = 'ok') => {
    const mensaje = contenedor.querySelector('#cuenta-mensaje');
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = texto ? `bitacora-mensaje bitacora-mensaje--${tono}` : 'bitacora-mensaje';
  };

  const decirPush = (texto, tono = 'ok') => {
    const mensaje = cajaPush.querySelector('#push-mensaje');
    if (!mensaje) return;
    mensaje.textContent = texto;
    mensaje.className = texto ? `bitacora-mensaje bitacora-mensaje--${tono}` : 'bitacora-mensaje';
  };

  function pintarSesion() {
    const sesion = sesionActual();
    cajaSesion.innerHTML = sesion ? SesionIniciada(sesion.usuario) : FormularioSesion();
  }

  /** Estado de los avisos en este dispositivo. */
  async function pintarPush() {
    const titulo = '<h2 class="bitacora-form__titulo">Avisos push</h2>';
    const pie = (botones) => `
      <div class="bitacora-form__pie">
        ${botones}
        <p id="push-mensaje" class="bitacora-mensaje" role="status"></p>
      </div>`;

    if (!soportaPush()) {
      cajaPush.innerHTML = `${titulo}
        <p class="cuenta-estado">Estado: <strong>no disponible</strong></p>
        <p class="cuenta-texto">
          Este navegador no admite notificaciones push${window.isSecureContext ? '' : ' (hace falta HTTPS)'}.
          En iPhone y iPad funcionan con iOS 16.4 o posterior y SoilAir instalada en la pantalla de inicio.
        </p>`;
      return;
    }

    const sesion = sesionActual();
    let suscripcion = null;
    try {
      suscripcion = await suscripcionActual();
    } catch (error) {
      console.warn(`[cuenta] no se pudo leer la suscripción: ${error.message}`);
    }
    if (!vigente()) return;

    const permiso = Notification.permission;

    if (!sesion) {
      cajaPush.innerHTML = `${titulo}
        <p class="cuenta-estado">Estado: <strong>${suscripcion ? 'suscrito, sin sesión' : 'sin sesión'}</strong></p>
        <p class="cuenta-texto">Inicia sesión para activar los avisos en este dispositivo.</p>
        ${pie('<button type="button" class="clima-boton" disabled>Activar avisos push</button>')}`;
      return;
    }

    if (permiso === 'denied') {
      cajaPush.innerHTML = `${titulo}
        <p class="cuenta-estado">Estado: <strong>permiso bloqueado</strong></p>
        <p class="cuenta-texto">
          Para desbloquearlo, abre el candado junto a la dirección › Permisos del sitio ›
          Notificaciones › Permitir, y recarga la página.
        </p>`;
      return;
    }

    if (!suscripcion) {
      cajaPush.innerHTML = `${titulo}
        <p class="cuenta-estado">Estado: <strong>desactivados en este dispositivo</strong></p>
        <p class="cuenta-texto">
          El navegador te pedirá permiso para mostrar notificaciones. Puedes darte
          de baja cuando quieras desde aquí.
        </p>
        ${pie('<button type="button" class="clima-boton" data-accion="activar">Activar avisos push</button>')}`;
      return;
    }

    cajaPush.innerHTML = `${titulo}
      <p class="cuenta-estado">Estado: <strong class="cuenta-estado--ok">activos en este dispositivo</strong></p>
      <div id="push-dispositivos"><p class="cargando">Consultando tus dispositivos…</p></div>
      ${pie('<button type="button" class="clima-boton" data-accion="desactivar">Desactivar en este dispositivo</button>')}`;

    try {
      const lista = await listarDispositivos();
      if (!vigente()) return;
      cajaPush.querySelector('#push-dispositivos').innerHTML = Dispositivos(lista, suscripcion.endpoint);
    } catch (error) {
      if (!vigente()) return;
      cajaPush.querySelector('#push-dispositivos').innerHTML =
        `<p class="cuenta-texto">No se pudo consultar la lista de dispositivos: ${escaparHtml(explicar(error))}</p>`;
    }
  }

  /* Sesión ----------------------------------------------------------------- */

  cajaSesion.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const formulario = evento.target;
    const accion = evento.submitter?.value ?? 'entrar';
    const datos = new FormData(formulario);
    const usuario = String(datos.get('usuario') ?? '').trim().toLowerCase();
    const password = String(datos.get('password') ?? '');

    const botones = formulario.querySelectorAll('button');
    botones.forEach((boton) => (boton.disabled = true));
    decir(accion === 'registro' ? 'Creando la cuenta…' : 'Entrando…');

    try {
      await (accion === 'registro' ? registrarse(usuario, password) : entrar(usuario, password));
    } catch (error) {
      if (!vigente()) return;
      botones.forEach((boton) => (boton.disabled = false));
      decir(explicar(error), 'error');
      return;
    }
    // alCambiarSesion repinta las dos tarjetas.
  });

  cajaSesion.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion="salir"]');
    if (!boton) return;

    boton.disabled = true;
    // Al salir, este dispositivo deja de recibir los avisos de esa cuenta.
    await desactivarPush().catch((error) =>
      console.warn(`[cuenta] no se pudo dar de baja la suscripción: ${error.message}`)
    );
    await salir();
    avisar('Cerraste sesión. Este dispositivo ya no recibirá avisos de esa cuenta.');
  });

  /* Avisos ----------------------------------------------------------------- */

  cajaPush.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;
    boton.disabled = true;

    try {
      if (boton.dataset.accion === 'activar') {
        // activarPush() pide el permiso en su primera línea: sigue dentro del clic.
        await activarPush();
        await pintarPush();
        decirPush('Listo: este dispositivo recibirá un aviso con cada entrada nueva de la bitácora.');
      } else if (boton.dataset.accion === 'desactivar') {
        await desactivarPush();
        await pintarPush();
        decirPush('Avisos desactivados en este dispositivo.');
      }
    } catch (error) {
      if (!vigente()) return;
      if (error instanceof ErrorPermiso) {
        await pintarPush();
        if (error.permiso !== 'denied') decirPush(error.message, 'error');
        return;
      }
      boton.disabled = false;
      decirPush(`No se pudo completar: ${explicar(error)}`, 'error');
    }
  });

  const dejar = alCambiarSesion(() => {
    if (!vigente()) {
      dejar();
      return;
    }
    pintarSesion();
    pintarPush();
  });

  pintarSesion();
  await pintarPush();

  // Si el token expiró en el servidor, la sesión local se cierra y se repinta.
  comprobarSesion().catch(() => {});
};
