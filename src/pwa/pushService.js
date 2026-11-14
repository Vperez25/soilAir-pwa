/**
 * pwa/pushService.js
 * -----------------------------------------------------------------------------
 * Suscripción a notificaciones push (Push API) contra el backend propio.
 *
 *   activarPush()          permiso -> llave pública del backend ->
 *                          pushManager.subscribe({ userVisibleOnly: true }) ->
 *                          POST /api/push/suscripciones con la sesión
 *   desactivarPush()       DELETE en el backend y unsubscribe() en el navegador
 *   reenviarSuscripcion()  al abrir la app: vuelve a mandar la suscripción
 *                          (upsert); si las llaves VAPID del servidor cambiaron,
 *                          se suscribe de nuevo con la llave nueva
 *   listarDispositivos()   suscripciones del usuario (celular, laptop…)
 *
 * El envío NO está aquí ni en ningún endpoint público: lo hace el backend
 * cuando se registra una entrada en la bitácora. Lo que llega lo pinta el
 * evento `push` de sw.js.
 */

import { API_BASE } from '../config.js';
import { pedirJson } from '../services/apiService.js';
import { tokenActual } from '../services/sesionService.js';

const ETIQUETA = '[push]';

/** Cuánto se espera a que haya un Service Worker activo. */
const ESPERA_SW = 10000;

/** Error de permiso, para que la vista explique qué hacer en cada caso. */
export class ErrorPermiso extends Error {
  constructor(permiso) {
    super(
      permiso === 'denied'
        ? 'El permiso de notificaciones está bloqueado para este sitio.'
        : 'No se concedió el permiso de notificaciones.'
    );
    this.name = 'ErrorPermiso';
    this.permiso = permiso;
  }
}

/**
 * ¿Hay Push API aquí? Requiere contexto seguro (HTTPS o localhost), Service
 * Worker, PushManager y Notification. En iPhone/iPad solo existe con la app
 * instalada en la pantalla de inicio (iOS 16.4+).
 */
export function soportaPush() {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** navigator.serviceWorker.ready, pero sin esperar para siempre. */
function registroListo() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('no hay un Service Worker activo')), ESPERA_SW)
    ),
  ]);
}

/** La llave pública VAPID viaja en base64url; subscribe() la quiere en bytes. */
function base64UrlABytes(texto) {
  const relleno = '='.repeat((4 - (texto.length % 4)) % 4);
  const base64 = (texto + relleno).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (caracter) => caracter.charCodeAt(0));
}

async function llavePublica() {
  const { datos } = await pedirJson(`${API_BASE}/api/push/llave-publica`);
  return base64UrlABytes(datos.publicKey);
}

/** ¿La suscripción se creó con esta llave? Si el navegador no lo dice, se asume que sí. */
function mismaLlave(suscripcion, llave) {
  const actual = suscripcion.options?.applicationServerKey;
  if (!actual) return true;
  const bytes = new Uint8Array(actual);
  return bytes.length === llave.length && bytes.every((byte, i) => byte === llave[i]);
}

/** Suscripción con la llave actual del backend: reutiliza la que haya o crea una. */
async function suscribir(registro, llave) {
  let suscripcion = await registro.pushManager.getSubscription();

  if (suscripcion && !mismaLlave(suscripcion, llave)) {
    // Las llaves VAPID del servidor cambiaron: la suscripción vieja quedó
    // atada a la llave anterior y el servicio push rechazaría los envíos.
    console.warn(`${ETIQUETA} la llave VAPID cambió; se renueva la suscripción`);
    await suscripcion.unsubscribe();
    suscripcion = null;
  }

  return (
    suscripcion ??
    registro.pushManager.subscribe({
      // Obligatorio en Chrome: cada push debe mostrar una notificación visible.
      userVisibleOnly: true,
      applicationServerKey: llave,
    })
  );
}

function guardarEnBackend(suscripcion, token) {
  // toJSON() -> { endpoint, expirationTime, keys: { p256dh, auth } }
  return pedirJson(`${API_BASE}/api/push/suscripciones`, {
    metodo: 'POST',
    cuerpo: suscripcion.toJSON(),
    token,
  });
}

/** Suscripción push de este navegador, o null. */
export async function suscripcionActual() {
  if (!soportaPush()) return null;
  const registro = await registroListo();
  return registro.pushManager.getSubscription();
}

/**
 * Activa los avisos en este dispositivo. Debe llamarse desde un clic: el
 * permiso se pide en la primera línea, sin un await antes.
 *
 * @returns {Promise<PushSubscription>}
 * @throws {ErrorPermiso|ApiError|Error}
 */
export async function activarPush() {
  if (!soportaPush()) throw new Error('Este navegador no admite notificaciones push.');

  const token = tokenActual();
  if (!token) throw new Error('Inicia sesión para activar los avisos.');

  const permiso =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permiso !== 'granted') throw new ErrorPermiso(permiso);

  const [registro, llave] = await Promise.all([registroListo(), llavePublica()]);
  const suscripcion = await suscribir(registro, llave);

  await guardarEnBackend(suscripcion, token);
  console.log(`${ETIQUETA} suscripción guardada en el backend (${new URL(suscripcion.endpoint).host})`);
  return suscripcion;
}

/**
 * Da de baja este dispositivo. Primero se avisa al backend para que deje de
 * enviar; si no responde (sin red), la baja local sigue igual: el siguiente
 * envío a ese endpoint devolverá 410 y el backend la borrará solo.
 *
 * @returns {Promise<boolean>} false si no había suscripción
 */
export async function desactivarPush() {
  const suscripcion = await suscripcionActual();
  if (!suscripcion) return false;

  const token = tokenActual();
  if (token) {
    await pedirJson(`${API_BASE}/api/push/suscripciones`, {
      metodo: 'DELETE',
      cuerpo: { endpoint: suscripcion.endpoint },
      token,
    }).catch((error) =>
      console.warn(`${ETIQUETA} el backend no confirmó la baja (${error.message}); se borrará al responder 410`)
    );
  }

  await suscripcion.unsubscribe();
  console.log(`${ETIQUETA} suscripción dada de baja en este dispositivo`);
  return true;
}

/**
 * Al abrir la app: si este dispositivo ya estaba suscrito y hay sesión, la
 * suscripción se vuelve a mandar. Así el backend se entera si el navegador la
 * renovó, si en este navegador entró otro usuario o si la fila se había
 * borrado. Nunca lanza.
 *
 * @param {string} [motivo] para la consola
 */
export async function reenviarSuscripcion(motivo = 'al abrir la app') {
  if (!soportaPush() || Notification.permission !== 'granted') return;

  const token = tokenActual();
  if (!token) return;

  try {
    const registro = await registroListo();
    if (!(await registro.pushManager.getSubscription())) return;

    const suscripcion = await suscribir(registro, await llavePublica());
    const { estado } = await guardarEnBackend(suscripcion, token);
    console.log(`${ETIQUETA} ${motivo}: suscripción reenviada al backend (HTTP ${estado})`);
  } catch (error) {
    console.warn(`${ETIQUETA} ${motivo}: no se pudo reenviar la suscripción: ${error.message}`);
  }
}

/**
 * Dispositivos suscritos del usuario, según el backend.
 *
 * @returns {Promise<Array<{id: number, endpoint: string, servicio: string,
 *          userAgent: string|null, creadaEn: string}>>}
 */
export async function listarDispositivos() {
  const token = tokenActual();
  if (!token) return [];
  const { datos } = await pedirJson(`${API_BASE}/api/push/suscripciones`, { token });
  return Array.isArray(datos) ? datos : [];
}
