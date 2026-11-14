/**
 * services/sesionService.js
 * -----------------------------------------------------------------------------
 * Sesión del usuario con el backend (soilAir-api).
 *
 * La app vive en GitHub Pages y el backend en otro origen, así que la sesión no
 * puede ser una cookie (sería de terceros y varios navegadores la bloquean). El
 * backend entrega un token al entrar y la app lo manda en cada petición como
 * `Authorization: Bearer <token>`:
 *
 *   - al guardar o borrar la suscripción push (pwa/pushService.js),
 *   - en cada entrada de la bitácora (la cola lo guarda con el envío para que
 *     el Service Worker también pueda mandarlo con Background Sync).
 *
 * El token se guarda en localStorage (utils/almacenamiento.js); la vista de
 * diagnóstico no lo muestra.
 */

import { API_BASE } from '../config.js';
import { pedirJson } from './apiService.js';
import { borrar, CLAVES, guardar, leer, LOCAL } from '../utils/almacenamiento.js';

const ETIQUETA = '[sesion]';

/** Funciones que quieren enterarse cuando se entra o se sale. */
const oyentes = new Set();

/** @returns {{usuario: string, token: string}|null} */
export function sesionActual() {
  try {
    const sesion = JSON.parse(leer(LOCAL, CLAVES.sesion) ?? 'null');
    return sesion?.token && sesion?.usuario ? sesion : null;
  } catch {
    return null;
  }
}

/** Token de la sesión actual, o null. */
export function tokenActual() {
  return sesionActual()?.token ?? null;
}

/** @param {(sesion: {usuario: string, token: string}|null) => void} oyente */
export function alCambiarSesion(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function fijarSesion(sesion) {
  if (sesion) guardar(LOCAL, CLAVES.sesion, JSON.stringify(sesion));
  else borrar(LOCAL, CLAVES.sesion);
  oyentes.forEach((oyente) => oyente(sesion));
}

async function autenticar(ruta, usuario, password) {
  const { datos } = await pedirJson(`${API_BASE}/api/auth/${ruta}`, {
    metodo: 'POST',
    cuerpo: { usuario, password },
  });
  const sesion = { usuario: datos.usuario, token: datos.token };
  fijarSesion(sesion);
  console.log(`${ETIQUETA} sesión iniciada como ${sesion.usuario}`);
  return sesion;
}

/** Inicia sesión. Lanza ApiError con el mensaje del servidor si falla. */
export function entrar(usuario, password) {
  return autenticar('login', usuario, password);
}

/** Crea la cuenta y deja la sesión iniciada. */
export function registrarse(usuario, password) {
  return autenticar('registro', usuario, password);
}

/**
 * Cierra la sesión en el servidor (invalida el token) y en este navegador.
 * Si el servidor no responde, la sesión local se cierra igual.
 */
export async function salir() {
  const token = tokenActual();
  if (token) {
    await pedirJson(`${API_BASE}/api/auth/logout`, { metodo: 'POST', token }).catch((error) =>
      console.warn(`${ETIQUETA} el servidor no confirmó el cierre: ${error.message}`)
    );
  }
  fijarSesion(null);
}

/**
 * Pregunta al servidor si el token sigue vigente. Con 401 la sesión local se
 * borra; sin red se conserva (puede que solo falte conexión).
 *
 * @returns {Promise<boolean>} true si la sesión es válida
 */
export async function comprobarSesion() {
  const token = tokenActual();
  if (!token) return false;

  try {
    await pedirJson(`${API_BASE}/api/auth/sesion`, { token });
    return true;
  } catch (error) {
    if (error.estado === 401) {
      console.warn(`${ETIQUETA} la sesión expiró; se cierra en este navegador`);
      fijarSesion(null);
      return false;
    }
    throw error;
  }
}
