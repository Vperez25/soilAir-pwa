/**
 * utils/cookies.js
 * -----------------------------------------------------------------------------
 * Patrón setCookie / getCookie / deleteCookie visto en clase, sin librerías.
 *
 * `document.cookie` es una sola cadena con TODAS las cookies del sitio
 * separadas por "; ". Escribir en él no reemplaza esa cadena: agrega o
 * actualiza una entrada. Por eso:
 *
 *   - para escribir hay que armar a mano el texto "clave=valor; atributo=..."
 *   - para leer hay que partir la cadena y buscar la clave
 *   - para borrar no existe un método: se reescribe la misma cookie con una
 *     fecha de expiración en el pasado y el navegador la descarta
 *
 * Los valores van con encodeURIComponent porque ";" "," y "=" son separadores
 * dentro de la cadena y romperían el formato.
 *
 * Nota: las cookies NO existen bajo file://. Este proyecto se abre con Live
 * Server o GitHub Pages, así que sobre http(s) funcionan; aun así todo va
 * dentro de try/catch, igual que Web Storage.
 */

import { avisar } from '../components/Aviso.js';

/**
 * ¿El navegador acepta cookies?
 *
 * navigator.cookieEnabled miente en algunos navegadores, así que además se
 * escribe una cookie de prueba y se comprueba que se pueda leer de vuelta.
 *
 * @returns {boolean}
 */
export function cookiesActivas() {
  try {
    if (navigator.cookieEnabled === false) return false;

    document.cookie = '__soilair_prueba__=1; SameSite=Lax; path=/';
    const funciona = document.cookie.includes('__soilair_prueba__=');
    document.cookie = '__soilair_prueba__=; Max-Age=0; SameSite=Lax; path=/';

    return funciona;
  } catch {
    return false;
  }
}

/**
 * Crea o actualiza una cookie con una expiración EXPLÍCITA.
 *
 * Sin `expires` el navegador la trataría como cookie de sesión y se borraría
 * al cerrar el navegador, que es justo lo que aquí no queremos: el registro de
 * visitas tiene sentido precisamente entre una sesión y la siguiente.
 *
 * @param {string} nombre
 * @param {string} valor  se codifica con encodeURIComponent
 * @param {number} dias   días de vida; debe ser un número explícito
 * @returns {boolean} true si la cookie quedó escrita
 */
export function setCookie(nombre, valor, dias) {
  try {
    const vence = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    // SameSite=Lax: la cookie es de este sitio y no se manda desde otros
    // dominios. Sin este atributo los navegadores nuevos marcan una advertencia.
    document.cookie =
      `${encodeURIComponent(nombre)}=${encodeURIComponent(valor)}` +
      `; expires=${vence.toUTCString()}` +
      `; path=/` +
      `; SameSite=Lax`;

    return getCookie(nombre) !== null;
  } catch {
    avisar('No se pudo escribir la cookie de registro. La app sigue funcionando.', {
      clave: 'sin-cookies',
      tono: 'error',
    });
    return false;
  }
}

/**
 * Devuelve el valor de una cookie, o null si no existe.
 *
 * @param {string} nombre
 * @returns {string|null}
 */
export function getCookie(nombre) {
  try {
    const buscado = encodeURIComponent(nombre);

    // "a=1; b=2" -> ["a=1", "b=2"]
    for (const trozo of document.cookie.split(';')) {
      const cookie = trozo.trim();
      // indexOf y no split('='): el valor puede traer "=" dentro.
      const corte = cookie.indexOf('=');
      if (corte === -1) continue;

      if (cookie.slice(0, corte) === buscado) {
        return decodeURIComponent(cookie.slice(corte + 1));
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Borra una cookie. No hay API para eliminarlas: se reescribe la misma clave
 * con Max-Age=0 y el mismo `path` con el que se creó (si el path no coincide,
 * el navegador la considera otra cookie distinta y la original sobrevive).
 *
 * @param {string} nombre
 * @returns {boolean}
 */
export function deleteCookie(nombre) {
  try {
    document.cookie =
      `${encodeURIComponent(nombre)}=` +
      `; expires=Thu, 01 Jan 1970 00:00:00 GMT` +
      `; Max-Age=0` +
      `; path=/` +
      `; SameSite=Lax`;

    return getCookie(nombre) === null;
  } catch {
    return false;
  }
}
