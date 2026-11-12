/**
 * Permiso y avisos locales relacionados con la sincronización de la bitácora.
 */

import { BASE_PATH } from '../config.js';

const ETIQUETA = '[notificaciones]';
const ICONO = new URL(`${BASE_PATH}/images/icons/icon-192.png`, location.origin).href;
const URL_BITACORA = new URL(`${BASE_PATH}/bitacora`, location.origin).href;

function mostrarEstado(estado, mensaje = '') {
  const estadoCaja = document.querySelector('#estado-notificaciones');
  const boton = document.querySelector('#activar-notificaciones');
  if (!estadoCaja || !boton) return;

  if (estado === 'default') {
    estadoCaja.textContent = mensaje || 'Estado: default (predeterminado). Pulsa para solicitar permiso.';
    boton.textContent = 'Activar notificaciones';
    boton.disabled = false;
    boton.hidden = false;
    return;
  }

  if (estado === 'granted') {
    estadoCaja.textContent = mensaje || 'Estado: granted. Recibirás un aviso cuando la bitácora termine de sincronizarse.';
    boton.textContent = 'Notificaciones activadas';
    boton.disabled = true;
    boton.hidden = false;
    return;
  }

  if (estado === 'denied') {
    estadoCaja.textContent =
      mensaje ||
      'Estado: denied. Para desbloquearlo, abre el candado junto a la dirección > Permisos del sitio > Notificaciones > Permitir y recarga. También puedes cambiarlo desde la configuración de notificaciones del navegador.';
    boton.textContent = 'Permiso bloqueado';
    boton.disabled = true;
    boton.hidden = false;
    return;
  }

  estadoCaja.textContent = mensaje;
  boton.textContent = 'Notificaciones no disponibles';
  boton.disabled = true;
  boton.hidden = false;
}

function refrescarEstado() {
  if (!window.isSecureContext) {
    mostrarEstado('unsupported', 'Estado no disponible: las notificaciones requieren HTTPS o localhost.');
    return;
  }

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    mostrarEstado('unsupported', 'Estado no disponible: este navegador no admite notificaciones mediante Service Worker.');
    return;
  }

  mostrarEstado(Notification.permission);
}

export function iniciarNotificaciones() {
  const boton = document.querySelector('#activar-notificaciones');
  if (!boton) return;

  refrescarEstado();

  boton.addEventListener('click', async () => {
    if (!('Notification' in window) || Notification.permission !== 'default') {
      refrescarEstado();
      return;
    }

    boton.disabled = true;
    try {
      const permiso = await Notification.requestPermission();
      mostrarEstado(permiso);
    } catch (error) {
      console.error(`${ETIQUETA} no se pudo solicitar el permiso: ${error.message}`);
      const permiso = Notification.permission;
      mostrarEstado(
        permiso,
        permiso === 'default' ? `No se pudo solicitar el permiso: ${error.message}` : ''
      );
    }
  });

  window.addEventListener('focus', refrescarEstado);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refrescarEstado();
  });
}

export async function notificarSincronizacionBitacora(enviados) {
  if (
    enviados < 1 ||
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Bitácora sincronizada', {
    body: enviados === 1
      ? 'El servidor confirmó el envío de tu entrada de campo.'
      : `El servidor confirmó el envío de ${enviados} entradas de campo.`,
    icon: ICONO,
    tag: 'soilair-bitacora-sincronizada',
    data: { url: URL_BITACORA },
  });
}
