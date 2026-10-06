/**
 * components/CachePanel.js
 * -----------------------------------------------------------------------------
 * Panel de depuración de la caché, dentro de la vista /diagnostico (debajo del
 * panel del Service Worker). Dos bloques:
 *
 *   1. Peticiones atendidas   qué pidió la página y de dónde salió la respuesta:
 *                             HIT (caché) o MISS (red). Viene de pwa/fetchLog.js.
 *   2. Contenido de la caché  lo que hay guardado, con un botón para borrar una
 *                             entrada (pwa/cacheDebug.js -> cache.delete()).
 *
 * Es un componente como ServiceWorkerPanel: devuelve marcado con el mismo
 * patrón y se conecta al DOM con .montar() cuando ya está en pantalla.
 */

import { listarCaches, eliminarEntrada, cacheDisponible } from '../pwa/cacheDebug.js';
import { leerRegistro, limpiarRegistro, alCambiarRegistro } from '../pwa/fetchLog.js';
import { escaparHtml } from '../utils/escapar.js';

const HORA = new Intl.DateTimeFormat('es-MX', { timeStyle: 'medium' });

/** Cómo se muestra cada origen de respuesta que informa el worker. */
const ORIGENES = {
  cache: { texto: '✓ HIT · caché', acierto: true },
  'app-shell': { texto: '✓ HIT · App Shell', acierto: true },
  network: { texto: '✗ MISS · red', acierto: false },
};

/* ── Marcado ──────────────────────────────────────────────────────────────── */

function Codigo(texto) {
  return `<code>${escaparHtml(texto)}</code>`;
}

function ListaRegistro(entradas) {
  if (!entradas.length) {
    const controlada = Boolean(navigator.serviceWorker?.controller);

    return `
      <p class="sw-vacio-bloque">
        ${
          controlada
            ? 'Todavía no hay peticiones registradas. Navega por la app y vuelve aquí.'
            : 'Esta página no está controlada por el Service Worker, así que no recibe sus mensajes. Recarga con F5.'
        }
      </p>
    `;
  }

  return `
    <ul class="cache-log cache-caja">
      ${entradas
        .map((e) => {
          const origen = ORIGENES[e.source] ?? { texto: e.source, acierto: false };
          return `
      <li class="cache-log__fila">
        <span class="cache-hora">${escaparHtml(HORA.format(e.hora))}</span>
        <span class="cache-log__peticion">${escaparHtml(e.method)} ${Codigo(e.path)}</span>
        <span class="sw-valor cache-log__origen ${origen.acierto ? 'sw-valor--si' : ''}">${escaparHtml(origen.texto)}</span>
      </li>`;
        })
        .join('')}
    </ul>
  `;
}

function ListaCaches(todas, filtro) {
  if (!todas.length) {
    return '<p class="sw-vacio-bloque">No hay cachés de SoilAir. El worker crea una al instalarse.</p>';
  }

  const buscado = filtro.trim().toLowerCase();

  return todas
    .map((cache) => {
      const visibles = cache.entradas.filter((e) => e.ruta.toLowerCase().includes(buscado));

      return `
      <h4 class="sw-subtitulo">
        Caché ${Codigo(cache.nombre)} · ${cache.entradas.length} entradas${
        buscado ? ` (${visibles.length} coinciden con el filtro)` : ''
      }
      </h4>
      ${
        visibles.length
          ? `
      <div class="sw-tabla-caja cache-caja">
        <table class="sw-tabla">
          <thead>
            <tr><th scope="col">Ruta</th><th scope="col"><span class="cache-oculto">Acción</span></th></tr>
          </thead>
          <tbody>
            ${visibles
              .map(
                (e) => `
            <tr>
              <td>${Codigo(e.ruta)}</td>
              <td>
                <button
                  type="button"
                  class="clima-boton"
                  data-eliminar
                  data-cache="${escaparHtml(cache.nombre)}"
                  data-url="${escaparHtml(e.url)}"
                  aria-label="Eliminar ${escaparHtml(e.ruta)} de ${escaparHtml(cache.nombre)}"
                >Eliminar</button>
              </td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
          : '<p class="sw-vacio-bloque">Ninguna entrada coincide con el filtro.</p>'
      }`;
    })
    .join('');
}

/* ── Componente ───────────────────────────────────────────────────────────── */

export function CachePanel() {
  return `
    <div id="cache-vista" class="sw-vista">
      <section class="sw-seccion" aria-labelledby="cache-t-log">
        <header class="sw-seccion__cabecera">
          <h3 id="cache-t-log" class="sw-seccion__titulo">Peticiones atendidas por el worker</h3>
          <button type="button" class="clima-boton" data-accion="limpiar-registro">Limpiar registro</button>
        </header>
        <p class="sw-seccion__texto">
          <strong>HIT</strong>: la respuesta salió de la caché, sin tocar la red.
          <strong>MISS</strong>: no estaba, se pidió a la red y, si respondió bien, se guardó
          para la próxima. Lo más reciente va arriba.
        </p>
        <div id="cache-log" aria-live="polite"></div>
      </section>

      <section class="sw-seccion" aria-labelledby="cache-t-contenido">
        <header class="sw-seccion__cabecera">
          <h3 id="cache-t-contenido" class="sw-seccion__titulo">Contenido de la caché</h3>
          <button type="button" class="clima-boton" data-accion="actualizar-lista">Actualizar lista</button>
        </header>
        <p class="sw-seccion__texto">
          Lo guardado al instalar (App Shell) y lo que el worker fue guardando mientras
          la app se usaba. <strong>Eliminar</strong> ejecuta <code>cache.delete()</code> sobre
          esa entrada: la próxima vez que la página la pida será un MISS y se bajará de nuevo
          de la red. Sirve para ver cómo un archivo que cambió se sigue sirviendo viejo
          mientras su entrada siga guardada.
        </p>
        <label class="clima-filtro">
          <span class="clima-filtro__etiqueta">Filtrar</span>
          <input
            type="search"
            class="clima-filtro__campo"
            data-filtro-cache
            placeholder="p. ej. cultivosService"
            aria-label="Filtrar las entradas de la caché por ruta"
          />
        </label>
        <p id="cache-mensaje" class="sw-mensaje" aria-live="polite"></p>
        <div id="cache-lista"><p class="cargando">Leyendo la caché…</p></div>
      </section>
    </div>
  `;
}

/**
 * Conecta el panel con la caché y con el registro de peticiones.
 *
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 *        los mismos dos datos que el router le pasa a cualquier vista
 */
CachePanel.montar = async ({ contenedor, vigente }) => {
  const vista = contenedor.querySelector('#cache-vista');
  const log = contenedor.querySelector('#cache-log');
  const lista = contenedor.querySelector('#cache-lista');
  const mensaje = contenedor.querySelector('#cache-mensaje');
  const campoFiltro = contenedor.querySelector('[data-filtro-cache]');
  if (!vista || !log || !lista || !mensaje || !campoFiltro) return;

  /** Mensaje junto a la lista; sin texto, lo limpia. */
  const decir = (texto, tono = 'ok') => {
    mensaje.textContent = texto;
    mensaje.className = texto ? `sw-mensaje sw-mensaje--${tono}` : 'sw-mensaje';
  };

  /* Registro de peticiones: se repinta solo con cada mensaje del worker. */
  const pintarLog = () => {
    log.innerHTML = ListaRegistro(leerRegistro());
  };

  // La vista se reemplaza al navegar: cuando su contenedor ya no está en el DOM
  // el oyente se da de baja solo, igual que el de 'storage' en DiagnosticoView.
  const dejarDeEscuchar = alCambiarRegistro(() => {
    if (!vista.isConnected) return dejarDeEscuchar();
    pintarLog();
  });
  pintarLog();

  /* Contenido de la caché ---------------------------------------------------- */

  let contenido = [];

  const pintarLista = () => {
    lista.innerHTML = ListaCaches(contenido, campoFiltro.value);
  };

  async function leerCaches() {
    if (!cacheDisponible()) {
      lista.innerHTML =
        '<p class="sw-vacio-bloque">Este navegador no expone la Cache API (hace falta HTTPS o localhost).</p>';
      return;
    }

    try {
      contenido = await listarCaches();
    } catch (error) {
      // Se dice en pantalla: si la lista no carga, el usuario tiene que saber por qué.
      lista.innerHTML = `<p class="sw-mensaje sw-mensaje--error">No se pudo leer la caché. ${escaparHtml(error.name)}: ${escaparHtml(error.message)}</p>`;
      return;
    }

    if (!vigente() || !vista.isConnected) return;
    pintarLista();
  }

  campoFiltro.addEventListener('input', pintarLista);

  vista.addEventListener('click', async (evento) => {
    if (evento.target.closest('[data-accion="limpiar-registro"]')) {
      limpiarRegistro();
      return;
    }

    if (evento.target.closest('[data-accion="actualizar-lista"]')) {
      decir('');
      await leerCaches();
      return;
    }

    const boton = evento.target.closest('[data-eliminar]');
    if (!boton) return;

    boton.disabled = true;
    const { cache, url } = boton.dataset;
    const ruta = new URL(url).pathname;

    try {
      const existia = await eliminarEntrada(cache, url);
      decir(
        existia
          ? `Eliminada ${ruta} de ${cache}. La próxima petición será un MISS.`
          : `${ruta} ya no estaba en ${cache}.`
      );
    } catch (error) {
      decir(`No se pudo eliminar ${ruta}. ${error.name}: ${error.message}`, 'error');
    }

    await leerCaches();
  });

  await leerCaches();
};
