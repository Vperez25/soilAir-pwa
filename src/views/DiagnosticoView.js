/**
 * views/DiagnosticoView.js
 * -----------------------------------------------------------------------------
 * Ruta "/diagnostico" — qué guarda SoilAir en el navegador y cómo está su
 * Service Worker. Dos grupos:
 *
 *   1. Almacenamiento   el valor REAL que hay ahora mismo en cada uno de los tres
 *                       mecanismos, si el navegador los permite, cuánto vive cada
 *                       dato y por qué está ahí y no en otro lado. Cada mecanismo
 *                       tiene su propio botón para vaciarlo sin tocar los otros dos.
 *   2. Service Worker   estado, verificador de scope y experimentos. Lo pinta
 *                       components/ServiceWorkerPanel.js.
 *
 * No lee los almacenes por su cuenta: los tres MECANISMOS de abajo delegan en
 * los mismos servicios que usa el resto de la app, así que lo que aparece en
 * pantalla es exactamente lo que ve el resto del código.
 */

import { LOCAL, SESION, CLAVES, disponible, volcar, borrar } from '../utils/almacenamiento.js';
import { olvidarTema } from '../services/temaService.js';
import { borrarFiltro } from '../services/filtroService.js';
import {
  COOKIE_REGISTRO,
  DIAS_VIGENCIA,
  leerRegistro,
  borrarRegistro,
  cookiesActivas,
} from '../services/visitasService.js';
import { getCookie } from '../utils/cookies.js';
import { escaparHtml } from '../utils/escapar.js';
import { ServiceWorkerPanel } from '../components/ServiceWorkerPanel.js';
import { CachePanel } from '../components/CachePanel.js';

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Fecha ISO -> texto legible. Devuelve el crudo si no se puede interpretar. */
function fecha(iso) {
  const momento = new Date(iso);
  return Number.isNaN(momento.getTime()) ? String(iso) : FECHA.format(momento);
}

/* ── Los tres mecanismos ──────────────────────────────────────────────────── */

/**
 * Descripción de cada mecanismo. Se declara como datos y no como tres bloques
 * de HTML repetidos: agregar un cuarto dato persistido es agregar una entrada.
 *
 * @type {Array<{
 *   id: string, titulo: string, dato: string, vida: string, porque: string,
 *   disponible: () => boolean, filas: () => Array<[string, string]>,
 *   limpiar: () => void
 * }>}
 */
const MECANISMOS = [
  {
    id: 'local',
    titulo: 'localStorage',
    dato: 'Tema de la interfaz (claro / oscuro)',
    vida: 'Sin caducidad. Se comparte entre todas las pestañas del sitio.',
    porque:
      'Es una preferencia del usuario: tiene que seguir ahí mañana y ser la misma en cada pestaña.',
    disponible: () => disponible(LOCAL),
    filas: () => volcar(LOCAL),
    limpiar: () => olvidarTema(),
  },
  {
    id: 'sesion',
    titulo: 'sessionStorage',
    dato: 'Filtro aplicado en la vista Clima',
    vida: 'Mientras viva ESTA pestaña. Aguanta un F5; se borra al cerrarla.',
    porque:
      'Es el estado de una consulta en curso, no una preferencia: recordarlo para siempre se leería como un error.',
    disponible: () => disponible(SESION),
    filas: () => volcar(SESION),
    limpiar: () => borrarFiltro(),
  },
  {
    id: 'cookie',
    titulo: `Cookie · ${COOKIE_REGISTRO}`,
    dato: 'Registro de visitas (id simulado, contador y fecha)',
    vida: `${DIAS_VIGENCIA} días, contados desde la última visita.`,
    porque:
      'Identifica al visitante, es el único de los tres que caduca solo y el único que viajaría al servidor si lo hubiera.',
    disponible: () => cookiesActivas(),
    filas: filasCookie,
    limpiar: () => borrarRegistro(),
  },
];

/** Desglosa la cookie de registro en filas legibles. */
function filasCookie() {
  const registro = leerRegistro();
  if (!registro) return [];

  const caduca = new Date(new Date(registro.ultima).getTime() + DIAS_VIGENCIA * 86400000);

  return [
    ['Id de sesión (simulado)', registro.id],
    ['Visitas contadas', String(registro.visitas)],
    ['Esta visita', fecha(registro.ultima)],
    ['Visita anterior', registro.anterior ? fecha(registro.anterior) : 'ninguna, es la primera'],
    ['Caduca el', fecha(caduca.toISOString())],
    ['Valor crudo', getCookie(COOKIE_REGISTRO) ?? ''],
  ];
}

/* ── Marcado ──────────────────────────────────────────────────────────────── */

/** Tabla de pares clave/valor, o el aviso de que no hay nada guardado. */
function Contenido(mecanismo) {
  if (!mecanismo.disponible()) {
    return `
      <p class="diag__bloqueado">
        Este navegador tiene bloqueado el mecanismo. La app funciona igual, pero
        este dato no se recuerda.
      </p>
    `;
  }

  const filas = mecanismo.filas();

  if (!filas.length) {
    return `<p class="diag__vacio">Sin datos guardados todavía.</p>`;
  }

  return `
    <dl class="diag__filas">
      ${filas
        .map(
          ([clave, valor]) => `
        <div>
          <dt>${escaparHtml(clave)}</dt>
          <dd><code>${escaparHtml(valor)}</code></dd>
        </div>`
        )
        .join('')}
    </dl>
  `;
}

function Tarjeta(mecanismo) {
  const activo = mecanismo.disponible();

  return `
    <article class="diag-tarjeta${activo ? '' : ' diag-tarjeta--inactiva'}">
      <header class="diag-tarjeta__encabezado">
        <h3 class="diag-tarjeta__titulo">${escaparHtml(mecanismo.titulo)}</h3>
        <span class="diag-tarjeta__estado">${activo ? 'disponible' : 'bloqueado'}</span>
      </header>

      <p class="diag-tarjeta__dato">${escaparHtml(mecanismo.dato)}</p>

      ${Contenido(mecanismo)}

      <dl class="diag-tarjeta__meta">
        <div><dt>Duración</dt><dd>${escaparHtml(mecanismo.vida)}</dd></div>
        <div><dt>Por qué aquí</dt><dd>${escaparHtml(mecanismo.porque)}</dd></div>
      </dl>

      <button
        type="button"
        class="clima-boton"
        data-limpiar="${mecanismo.id}"
        ${activo ? '' : 'disabled'}
      >
        Limpiar ${escaparHtml(mecanismo.titulo.split(' · ')[0])}
      </button>
    </article>
  `;
}

/* ── Vista ────────────────────────────────────────────────────────────────── */

export function DiagnosticoView() {
  return `
    <section class="portada">
      <p class="portada__eyebrow">Persistencia y Service Worker</p>
      <h1 class="portada__titulo">Diagnóstico</h1>
      <p class="portada__texto">
        Lo que SoilAir guarda en este navegador y el estado de su Service
        Worker, con los valores que tienen en este momento.
      </p>
    </section>

    <section class="diag-grupo" aria-labelledby="diag-g-almacenamiento">
      <h2 id="diag-g-almacenamiento" class="diag-grupo__titulo">Almacenamiento</h2>
      <p class="diag-grupo__texto">
        Los tres mecanismos que usa SoilAir. Cada uno se limpia por separado:
        borrar el tema no toca el filtro, y borrar la cookie no toca ninguno de
        los dos.
      </p>
      <div id="diag-panel" class="diag-rejilla"></div>
    </section>

    <section class="diag-grupo" aria-labelledby="diag-g-sw">
      <h2 id="diag-g-sw" class="diag-grupo__titulo">Service Worker</h2>
      <p class="diag-grupo__texto">
        Si está registrado, hasta dónde llega su scope y si ya controla esta
        página. Los mensajes de <code>sw.js</code> no salen aquí: se ven en la
        consola del worker, desde DevTools → Application → Service Workers.
      </p>
      ${ServiceWorkerPanel()}
    </section>

    <section class="diag-grupo" aria-labelledby="diag-g-cache">
      <h2 id="diag-g-cache" class="diag-grupo__titulo">Caché</h2>
      <p class="diag-grupo__texto">
        Qué atiende el Service Worker y qué hay guardado en la Cache API.
      </p>
      ${CachePanel()}
    </section>
  `;
}

/**
 * El contenido se pinta desde montar() y no desde DiagnosticoView(), porque
 * hay que repintarlo en tres momentos distintos: al entrar, al pulsar un botón
 * de limpiar y cuando OTRA pestaña cambia el tema.
 *
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 */
DiagnosticoView.montar = async ({ contenedor, vigente }) => {
  const panel = contenedor.querySelector('#diag-panel');
  if (!panel) return;

  const pintar = () => {
    panel.innerHTML = MECANISMOS.map(Tarjeta).join('');
  };

  panel.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-limpiar]');
    if (!boton) return;

    const mecanismo = MECANISMOS.find((m) => m.id === boton.dataset.limpiar);
    mecanismo?.limpiar();

    // Se repinta todo el panel y no solo la tarjeta tocada: limpiar el tema
    // también cambia el color de las otras dos.
    pintar();
  });

  // Si el usuario limpia el tema en otra pestaña, esta lo refleja al momento.
  // El listener se quita solo cuando la vista deja de estar en el DOM: el
  // router reemplaza #app entero, así que panel.isConnected pasa a false.
  const alCambiarOtraPestana = (evento) => {
    if (!panel.isConnected) {
      window.removeEventListener('storage', alCambiarOtraPestana);
      return;
    }
    if (evento.key === CLAVES.tema) pintar();
  };

  window.addEventListener('storage', alCambiarOtraPestana);

  // Las tarjetas de almacenamiento se pintan primero: son síncronas y no tienen
  // por qué esperar a que el navegador conteste lo del Service Worker.
  pintar();

  await Promise.all([
    ServiceWorkerPanel.montar({ contenedor, vigente }),
    CachePanel.montar({ contenedor, vigente }),
  ]);
};

/** Reexportado por si otra vista necesita vaciar una clave suelta. */
export { borrar };
