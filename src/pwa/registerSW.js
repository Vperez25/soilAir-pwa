/**
 * pwa/registerSW.js
 * -----------------------------------------------------------------------------
 * Registro del Service Worker.
 *
 * UNA SOLA CONSTANTE DE RUTA BASE
 * La URL del script y el scope salen de BASE_PATH (src/config.js), que vale
 * '/soilAir-pwa' en GitHub Pages y '' en local. Nada de aquí escribe una ruta
 * absoluta a mano:
 *
 *   GitHub Pages   SW_URL = '/soilAir-pwa/sw.js'   SW_SCOPE = '/soilAir-pwa/'
 *   Live Server    SW_URL = '/sw.js'               SW_SCOPE = '/'
 *
 * Si se escribiera '/sw.js' directamente, en GitHub Pages apuntaría a
 * vperez25.github.io/sw.js, que no existe: el sitio vive dentro de una carpeta.
 *
 * El scope termina en "/" a propósito. Sin esa diagonal, "/soilAir-pwa" y
 * "/soilAir-pwa-otro" también cumplirían el prefijo.
 */

import { BASE_PATH } from '../config.js';

/** Ruta del script del Service Worker, en la raíz de la app. */
export const SW_URL = `${BASE_PATH}/sw.js`;

/** Alcance del Service Worker: toda la app, y solo la app. */
export const SW_SCOPE = `${BASE_PATH}/`;

/** Prefijo de los mensajes de consola, para encontrarlos con el filtro de DevTools. */
const ETIQUETA = '[registerSW]';

/** ¿Este navegador (y este contexto) expone Service Workers? */
export function soportaSW() {
  return 'serviceWorker' in navigator;
}

/**
 * Convierte una ruta de la app en URL absoluta, igual que lo hace el navegador
 * para comparar contra el scope (que siempre es absoluto).
 *
 * @param {string} ruta
 * @returns {string}
 */
export function urlAbsoluta(ruta) {
  return new URL(ruta, location.href).href;
}

/**
 * Registra sw.js con scope explícito. Se llama una vez desde main.js, en el
 * evento `load`, para que el registro no compita con la carga de la página.
 *
 * Nunca lanza: si algo falla lo explica en consola y devuelve null, de modo que
 * una app sin Service Worker sigue funcionando exactamente igual.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registrarSW() {
  if (!soportaSW()) {
    // En HTTP (fuera de localhost) el navegador ni siquiera define
    // navigator.serviceWorker: es la causa más común, así que se menciona.
    console.warn(
      window.isSecureContext
        ? `${ETIQUETA} Este navegador no soporta Service Workers.`
        : `${ETIQUETA} Contexto NO seguro: los Service Workers solo funcionan en HTTPS o en localhost.`
    );
    return null;
  }

  try {
    console.log(`${ETIQUETA} Registrando ${SW_URL} con scope ${SW_SCOPE}`);

    const registro = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });

    console.log(`${ETIQUETA} Registrado. Scope:`, registro.scope);
    return registro;
  } catch (error) {
    console.error(
      `${ETIQUETA} No se pudo registrar ${SW_URL} (scope ${SW_SCOPE}): ${error.name}: ${error.message}`
    );
    return null;
  }
}

/* ── Experimento: scope inválido a propósito ──────────────────────────────── */

/**
 * Script que vive UNA CARPETA MÁS ADENTRO que la raíz de la app. No contiene
 * código propio: solo carga sw.js. Representa la "copia de sw.js dentro de src/"
 * y permite provocar el error de scope en cualquier despliegue.
 *
 * Con sw.js en la raíz no se puede hacer el experimento directamente cuando la
 * app está en la raíz del dominio: no existe un scope más ancho que "/".
 */
const SW_ANIDADO_URL = `${SW_SCOPE}src/pwa/sw-anidado.js`;

/**
 * Intenta registrar un script de /src/pwa/ con el scope de TODA la app, que es
 * más ancho que su carpeta. El navegador debe rechazarlo con SecurityError.
 *
 * @returns {Promise<{script: string, scope: string, maximo: string,
 *                    error: {nombre: string, mensaje: string}|null}>}
 *          `error` es null solo si el navegador aceptó el registro (inesperado).
 */
export async function probarScopeInvalido() {
  const intento = {
    script: urlAbsoluta(SW_ANIDADO_URL),
    scope: urlAbsoluta(SW_SCOPE),
    // Hasta dónde llega un script: la carpeta donde está.
    maximo: new URL('./', urlAbsoluta(SW_ANIDADO_URL)).href,
  };

  try {
    const registro = await navigator.serviceWorker.register(SW_ANIDADO_URL, { scope: SW_SCOPE });

    // El navegador lo aceptó: no debería. Se deshace para no dejar un registro
    // de más que confunda las demás pruebas.
    await registro.unregister();
    return { ...intento, error: null };
  } catch (error) {
    console.error(`${ETIQUETA} Scope inválido rechazado (esperado): ${error.name}: ${error.message}`);
    return { ...intento, error: { nombre: error.name, mensaje: error.message } };
  }
}

/* ── Reto: un segundo registro con scope más estrecho ─────────────────────── */

/** Subcarpeta de la app que recibe el segundo registro. Ver registrarScopeEstrecho(). */
export const SW_SCOPE_ESTRECHO = `${SW_SCOPE}cultivo/`;

/**
 * Registra EL MISMO sw.js con un scope más estrecho (/cultivo/). Es válido
 * porque un scope puede ser igual o más ESTRECHO que la carpeta del script,
 * nunca más ancho. Queda como un segundo registro, aparte del de la app.
 *
 * @returns {Promise<ServiceWorkerRegistration>}
 */
export function registrarScopeEstrecho() {
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE_ESTRECHO });
}

/**
 * Elimina el registro estrecho y solo ese.
 *
 * Se busca por scope exacto en la lista completa en vez de usar
 * getRegistration(url): esa función devuelve el registro que COINCIDE con la
 * URL, y si el estrecho no existe devolvería el de toda la app, que es justo el
 * que no se debe borrar.
 *
 * @returns {Promise<boolean>} true si había un registro estrecho y se quitó
 */
export async function quitarScopeEstrecho() {
  const registros = await navigator.serviceWorker.getRegistrations();
  const estrecho = registros.find((r) => r.scope === urlAbsoluta(SW_SCOPE_ESTRECHO));

  return estrecho ? estrecho.unregister() : false;
}
