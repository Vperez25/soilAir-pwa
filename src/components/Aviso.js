/**
 * components/Aviso.js
 * -----------------------------------------------------------------------------
 * Franja de avisos NO bloqueantes del App Shell.
 *
 * Es la contraparte de MensajeError() de ClimaView: aquel ocupa el panel porque
 * sin datos no hay vista que mostrar; este aparece en una esquina porque la app
 * SÍ puede seguir usándose. Un fallo de almacenamiento nunca debe interrumpir
 * lo que el usuario está haciendo, así que aquí no hay alert() ni confirm().
 *
 * La región vive en index.html con aria-live="polite": tiene que estar en el
 * DOM antes de recibir texto, o el lector de pantalla no anuncia el cambio.
 */

/**
 * Avisos ya mostrados, por clave. Sin esto, un localStorage bloqueado dispara
 * un aviso por cada lectura (tema, filtro, diagnóstico...) y la pantalla se
 * llena de la misma frase repetida.
 *
 * @type {Set<string>}
 */
const yaMostrados = new Set();

/** Milisegundos que el aviso permanece en pantalla antes de irse solo. */
const DURACION = 7000;

/** Devuelve la región de avisos; si el HTML no la trae, la crea. */
function region() {
  let zona = document.querySelector('#avisos');

  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'avisos';
    zona.className = 'avisos';
    zona.setAttribute('role', 'status');
    zona.setAttribute('aria-live', 'polite');
    document.body.appendChild(zona);
  }

  return zona;
}

/**
 * Muestra un aviso pasajero en la esquina de la pantalla.
 *
 * @param {string} mensaje texto visible para el usuario
 * @param {{clave?: string, tono?: 'aviso'|'error'}} [opciones]
 *        clave: identificador para no repetir el mismo aviso en la sesión.
 */
export function avisar(mensaje, { clave, tono = 'aviso' } = {}) {
  if (clave) {
    if (yaMostrados.has(clave)) return;
    yaMostrados.add(clave);
  }

  const aviso = document.createElement('p');
  aviso.className = `aviso aviso--${tono}`;
  aviso.textContent = mensaje;

  const cerrar = document.createElement('button');
  cerrar.type = 'button';
  cerrar.className = 'aviso__cerrar';
  cerrar.setAttribute('aria-label', 'Cerrar aviso');
  cerrar.textContent = '×';
  cerrar.addEventListener('click', () => aviso.remove());

  aviso.appendChild(cerrar);
  region().appendChild(aviso);

  setTimeout(() => aviso.remove(), DURACION);
}

export default avisar;
