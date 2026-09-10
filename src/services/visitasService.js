/**
 * services/visitasService.js
 * -----------------------------------------------------------------------------
 * Registro de visitas del usuario.  ->  Cookie
 *
 * POR QUÉ UNA COOKIE Y NO WEB STORAGE
 * Este es el único dato de los tres que identifica al VISITANTE y no a la
 * pantalla: un id simulado, cuántas veces ha abierto SoilAir y cuándo lo hizo
 * la vez anterior. Es exactamente lo que en una app con backend viajaría en
 * cada petición para reconocer al usuario, y la cookie es el único de los tres
 * mecanismos que se manda solo en la cabecera HTTP. Guardarlo aquí deja el
 * proyecto listo para ese paso sin cambiar de mecanismo, y de paso es el único
 * que permite fijar una FECHA DE CADUCIDAD: localStorage nunca expira por su
 * cuenta y sessionStorage se borra demasiado pronto.
 *
 * CUÁNTO DURA: 30 DÍAS
 * El ciclo de monitoreo de una parcela es mensual —así se revisan los rangos de
 * suelo en la app móvil—, así que 30 días es lo que tarda un usuario normal en
 * volver. Si pasa más de un mes sin abrir la app, el registro caduca solo y la
 * siguiente visita empieza de cero, que es el comportamiento correcto: un
 * contador de hace medio año ya no describe a nadie. Además evita dejar un
 * identificador en el navegador por tiempo indefinido sin motivo.
 */

import { setCookie, getCookie, deleteCookie, cookiesActivas } from '../utils/cookies.js';

/** Nombre de la cookie. Sin ":" porque ese carácter no es válido en cookies. */
export const COOKIE_REGISTRO = 'soilair_registro';

/** Días de vida de la cookie. Ver la justificación en la cabecera del archivo. */
export const DIAS_VIGENCIA = 30;

/** Id de sesión SIMULADO. No hay servidor: solo sirve para verlo en pantalla. */
function nuevoId() {
  const azar = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SA-${azar}`;
}

/**
 * Lee la cookie y devuelve el registro ya convertido a objeto.
 *
 * El contenido es JSON, así que puede venir corrupto (una versión anterior de
 * la app, alguien editándolo desde DevTools). Si no se puede interpretar se
 * trata como si no existiera, en vez de dejar que reviente el arranque.
 *
 * @returns {{id:string, visitas:number, ultima:string, anterior:string|null}|null}
 */
export function leerRegistro() {
  const crudo = getCookie(COOKIE_REGISTRO);
  if (!crudo) return null;

  try {
    const registro = JSON.parse(crudo);
    if (typeof registro !== 'object' || registro === null) return null;
    if (typeof registro.visitas !== 'number') return null;
    return registro;
  } catch {
    return null;
  }
}

/**
 * Suma una visita y actualiza la cookie. Se llama UNA vez por carga de la
 * página, desde main.js: navegar entre vistas no cuenta como visita nueva
 * porque en una SPA el documento nunca se vuelve a pedir.
 *
 * Renovar la cookie en cada visita también renueva su expiración, así que los
 * 30 días se cuentan desde la última vez que el usuario entró, no desde la
 * primera.
 *
 * @returns {{id:string, visitas:number, ultima:string, anterior:string|null}|null}
 *          null si el navegador no acepta cookies
 */
export function registrarVisita() {
  if (!cookiesActivas()) return null;

  const previo = leerRegistro();

  const registro = {
    id: previo?.id ?? nuevoId(),
    visitas: (previo?.visitas ?? 0) + 1,
    ultima: new Date().toISOString(),
    anterior: previo?.ultima ?? null,
  };

  return setCookie(COOKIE_REGISTRO, JSON.stringify(registro), DIAS_VIGENCIA)
    ? registro
    : null;
}

/** Borra el registro. Lo usa el botón "Limpiar" de la vista de diagnóstico. */
export function borrarRegistro() {
  return deleteCookie(COOKIE_REGISTRO);
}

/** ¿El navegador acepta cookies? Reexportado para la vista de diagnóstico. */
export { cookiesActivas };
