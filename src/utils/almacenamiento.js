/**
 * utils/almacenamiento.js
 * -----------------------------------------------------------------------------
 * Envoltura segura de localStorage y sessionStorage.
 *
 * Ninguna vista toca Web Storage directamente, por la misma razón por la que
 * ninguna vista llama a fetch(): el navegador puede negar el acceso y ese error
 * debe atenderse en UN solo lugar.
 *
 * Lo que se maneja aquí:
 *
 *   - Acceso denegado. En navegación privada estricta o con los datos de sitio
 *     bloqueados, el simple hecho de LEER window.localStorage lanza
 *     SecurityError. Por eso hasta la detección va dentro de try/catch, y por
 *     eso no basta con preguntar `if (window.localStorage)`.
 *
 *   - Cuota llena. setItem() lanza QuotaExceededError (código 22, o 1014
 *     NS_ERROR_DOM_QUOTA_REACHED en Firefox). Se distingue del resto para dar
 *     un mensaje que sí explique qué pasó.
 *
 * En cualquiera de los dos casos la función devuelve el valor por defecto o
 * `false`, la app SIGUE funcionando sin persistencia y el usuario solo ve un
 * aviso que no bloquea nada (components/Aviso.js).
 *
 * Los valores se guardan como texto plano, no como JSON: los dos datos que
 * persiste la SPA (tema y filtro) ya son cadenas, y así el valor que se ve en
 * DevTools es el mismo que muestra la vista de diagnóstico.
 */

import { avisar } from '../components/Aviso.js';

/** Nombres de los dos almacenes, para no escribir la cadena a mano. */
export const LOCAL = 'local';
export const SESION = 'sesion';

/** Prefijo común: separa lo de SoilAir de lo que haya dejado otro sitio. */
const PREFIJO = 'soilair:';

/**
 * Claves que usa la aplicación. Están juntas para que la vista de diagnóstico
 * sepa qué mirar y para que un cambio de nombre no se quede a medias.
 */
export const CLAVES = {
  /** localStorage · tema elegido por el usuario: "claro" u "oscuro". */
  tema: `${PREFIJO}tema`,
  /** sessionStorage · texto del filtro aplicado en la vista /clima. */
  filtroClima: `${PREFIJO}clima:filtro`,
};

/** Etiqueta legible de cada almacén, para los mensajes de error. */
const ETIQUETAS = {
  [LOCAL]: 'localStorage',
  [SESION]: 'sessionStorage',
};

/** Resultado de la detección, ya calculado. Se prueba una vez por almacén. */
const cache = new Map();

/**
 * Devuelve el objeto Storage del navegador. Se aísla en su propia función
 * porque este acceso es el que lanza SecurityError cuando el sitio tiene los
 * datos bloqueados.
 *
 * @param {'local'|'sesion'} tipo
 * @returns {Storage}
 */
function almacen(tipo) {
  return tipo === LOCAL ? window.localStorage : window.sessionStorage;
}

/**
 * ¿Se puede leer Y escribir en este almacén?
 *
 * No alcanza con comprobar que el objeto exista: Safari en modo privado sí
 * expone localStorage, pero cualquier setItem() falla. La única prueba honesta
 * es escribir algo y borrarlo.
 *
 * @param {'local'|'sesion'} tipo
 * @returns {boolean}
 */
export function disponible(tipo) {
  if (cache.has(tipo)) return cache.get(tipo);

  let resultado = false;

  try {
    const prueba = `${PREFIJO}__prueba__`;
    almacen(tipo).setItem(prueba, '1');
    almacen(tipo).removeItem(prueba);
    resultado = true;
  } catch {
    resultado = false;
  }

  cache.set(tipo, resultado);
  return resultado;
}

/**
 * Lee un valor. Si el almacén no está disponible o la clave no existe,
 * devuelve `porDefecto` sin lanzar nada.
 *
 * @param {'local'|'sesion'} tipo
 * @param {string} clave una de CLAVES
 * @param {string|null} [porDefecto]
 * @returns {string|null}
 */
export function leer(tipo, clave, porDefecto = null) {
  if (!disponible(tipo)) {
    avisar(
      `Tu navegador tiene bloqueado ${ETIQUETAS[tipo]}. La app funciona igual, pero no recordará esta preferencia.`,
      { clave: `sin-${tipo}` }
    );
    return porDefecto;
  }

  try {
    const valor = almacen(tipo).getItem(clave);
    return valor === null ? porDefecto : valor;
  } catch {
    return porDefecto;
  }
}

/**
 * Escribe un valor.
 *
 * @param {'local'|'sesion'} tipo
 * @param {string} clave
 * @param {string} valor
 * @returns {boolean} true si de verdad se guardó
 */
export function guardar(tipo, clave, valor) {
  if (!disponible(tipo)) {
    avisar(
      `Tu navegador tiene bloqueado ${ETIQUETAS[tipo]}. La app funciona igual, pero no recordará esta preferencia.`,
      { clave: `sin-${tipo}` }
    );
    return false;
  }

  try {
    almacen(tipo).setItem(clave, String(valor));
    return true;
  } catch (error) {
    // Firefox usa el nombre viejo; el resto de los navegadores, el código 22.
    const cuotaLlena =
      error?.name === 'QuotaExceededError' ||
      error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error?.code === 22 ||
      error?.code === 1014;

    avisar(
      cuotaLlena
        ? `El almacenamiento del navegador está lleno: no se pudo guardar en ${ETIQUETAS[tipo]}. Libera espacio desde la vista de diagnóstico.`
        : `No se pudo escribir en ${ETIQUETAS[tipo]}. La app sigue funcionando sin recordar este dato.`,
      { clave: cuotaLlena ? `cuota-${tipo}` : `error-${tipo}`, tono: 'error' }
    );

    return false;
  }
}

/**
 * Borra una clave.
 *
 * @param {'local'|'sesion'} tipo
 * @param {string} clave
 * @returns {boolean} true si la operación se pudo ejecutar
 */
export function borrar(tipo, clave) {
  if (!disponible(tipo)) return false;

  try {
    almacen(tipo).removeItem(clave);
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve todo lo que SoilAir tiene guardado en un almacén. Lo usa la vista de
 * diagnóstico para pintar el contenido real, no solo las claves que espera.
 *
 * @param {'local'|'sesion'} tipo
 * @returns {Array<[string, string]>} pares [clave, valor]
 */
export function volcar(tipo) {
  if (!disponible(tipo)) return [];

  try {
    const deposito = almacen(tipo);
    const pares = [];

    for (let i = 0; i < deposito.length; i++) {
      const clave = deposito.key(i);
      if (clave?.startsWith(PREFIJO)) pares.push([clave, deposito.getItem(clave)]);
    }

    return pares;
  } catch {
    return [];
  }
}
