import { BASE_PATH } from '../config.js';

const ETIQUETA = '[notificaciones]';
const TAG_BITACORA = 'soilair-bitacora-sincronizada';

export function iniciarControlNotificaciones() {
  const boton = document.getElementById('boton-notificaciones');
  const estado = document.getElementById('estado-notificaciones');
  const ayuda = document.getElementById('ayuda-notificaciones');
  if (!boton || !estado || !ayuda) return;

  function pintar() {
    if (!('Notification' in window)) {
      boton.disabled = true;
      boton.textContent = 'Notificaciones no disponibles';
      estado.textContent = 'Este navegador no admite notificaciones.';
      ayuda.hidden = true;
      return;
    }

    switch (Notification.permission) {
      case 'granted':
        boton.disabled = true;
        boton.textContent = 'Notificaciones activadas';
        estado.textContent = 'Permiso concedido.';
        ayuda.hidden = true;
        break;
      case 'denied':
        boton.disabled = true;
        boton.textContent = 'Notificaciones bloqueadas';
        estado.textContent = 'El permiso está bloqueado en el navegador.';
        ayuda.textContent =
          'Para desbloquearlas, abre los permisos del sitio junto a la dirección, permite Notificaciones y recarga. SoilAir no puede volver a pedir el permiso mientras esté bloqueado.';
        ayuda.hidden = false;
        break;
      default:
        boton.disabled = false;
        boton.textContent = 'Activar notificaciones';
        estado.textContent = 'Aún no has elegido.';
        ayuda.hidden = true;
    }
  }

  boton.addEventListener('click', async () => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;

    boton.disabled = true;
    try {
      await Notification.requestPermission();
      pintar();
    } catch (error) {
      console.error(`${ETIQUETA} no se pudo solicitar el permiso:`, error);
      pintar();
      estado.textContent = `No se pudo solicitar el permiso: ${error.message}`;
    }
  });

  pintar();
}

/**
 * Avisa cuando la página terminó de enviar entradas de la bitácora.
 * Nunca pide permiso: solo muestra el aviso si ya fue concedido.
 */
export async function notificarBitacoraSincronizada(enviados) {
  if (
    !enviados ||
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification('Bitácora sincronizada', {
      body: `${enviados} ${enviados === 1 ? 'entrada se envió' : 'entradas se enviaron'} y la cola quedó vacía.`,
      icon: new URL(`${BASE_PATH}/images/icons/icon-192.png`, location.origin).href,
      tag: TAG_BITACORA,
      data: { url: new URL(`${BASE_PATH}/bitacora`, location.origin).href },
    });
  } catch (error) {
    console.error(`${ETIQUETA} no se pudo mostrar el aviso de sincronización:`, error);
  }
}
