/**
 * components/ServiceWorkerPanel.js
 * -----------------------------------------------------------------------------
 * Panel del Service Worker dentro de la vista /diagnostico
 * (views/DiagnosticoView.js lo monta debajo de las tarjetas de almacenamiento).
 *
 * Cuatro bloques:
 *   1. Estado          lo que dice el navegador sobre el registro y el control.
 *   2. Verificador     qué rutas del proyecto caen dentro o fuera del scope.
 *   3. Scope inválido  experimento que provoca el error a propósito.
 *   4. Reto            un segundo registro con scope más estrecho.
 *
 * El panel no llama a navigator.serviceWorker.register(): eso vive en
 * pwa/registerSW.js. Tampoco consulta el estado por su cuenta: usa
 * pwa/swDiagnostico.js. Aquí solo se decide qué HTML corresponde a cada dato.
 *
 * Es un componente y no una vista: no conoce la ruta, no pinta título de página
 * y se usa igual que MedidorRango o CultivoCard — se llama para obtener el
 * marcado y luego se le pide .montar() cuando ya está en el DOM.
 *
 * Todo se repinta desde pintarTodo(), que es lo que ejecuta el botón
 * "Actualizar estado": el estado de un worker cambia solo (instalando ->
 * activado), y la página no se entera si no se le pregunta de nuevo.
 */

import {
  SW_URL,
  SW_SCOPE,
  SW_SCOPE_ESTRECHO,
  urlAbsoluta,
  soportaSW,
  probarScopeInvalido,
  registrarScopeEstrecho,
  quitarScopeEstrecho,
} from '../pwa/registerSW.js';
import { leerEstado, filasVerificador } from '../pwa/swDiagnostico.js';
import { escaparHtml } from '../utils/escapar.js';

const HORA = new Intl.DateTimeFormat('es-MX', { timeStyle: 'medium' });

/* ── Piezas de marcado ────────────────────────────────────────────────────── */

/** "Sí" / "No" con color y símbolo: el color solo no basta para quien no lo distingue. */
function SiNo(valor) {
  return valor
    ? '<span class="sw-valor sw-valor--si">✓ Sí</span>'
    : '<span class="sw-valor sw-valor--no">✗ No</span>';
}

/** Valor de texto técnico (URL, estado): monoespaciado y escapado. */
function Codigo(texto) {
  return texto ? `<code>${escaparHtml(texto)}</code>` : '<span class="sw-vacio">—</span>';
}

/** Fila de la lista de estado. */
function Fila(pregunta, respuesta, detalle = '') {
  return `
    <div class="sw-fila">
      <dt>${escaparHtml(pregunta)}</dt>
      <dd>
        ${respuesta}
        ${detalle ? `<small class="sw-detalle">${detalle}</small>` : ''}
      </dd>
    </div>
  `;
}

/* ── 1. Estado ────────────────────────────────────────────────────────────── */

/**
 * Explica POR QUÉ la página no está controlada, que es la duda más común: el
 * worker se registró bien y aun así `controller` es null.
 */
function ExplicarControl(estado) {
  if (estado.controlador) return 'Esta página se pidió con el worker ya activo.';
  if (!estado.app) return 'No hay worker registrado que pueda controlarla.';
  return 'Recarga con F5. En la primera carga después de registrar, la página ya se había pedido y no la toma ningún worker; con Ctrl+Shift+R tampoco, porque esa recarga ignora el Service Worker a propósito.';
}

function PanelEstado(estado, hora) {
  const app = estado.app;

  const filasEstado = [
    Fila('¿El navegador soporta Service Workers?', SiNo(estado.soporta)),
    Fila(
      '¿Contexto seguro?',
      SiNo(estado.seguro),
      `Origen: ${escaparHtml(estado.origen)} · HTTPS o localhost`
    ),
    Fila(
      '¿Service Worker registrado?',
      SiNo(Boolean(app)),
      app ? '' : `Se esperaba ${escaparHtml(urlAbsoluta(SW_URL))}`
    ),
    Fila('Scope', Codigo(app?.scope), app ? '' : `Esperado: ${escaparHtml(urlAbsoluta(SW_SCOPE))}`),
    Fila('URL del script', Codigo(app?.script)),
    Fila(
      'Estado del worker',
      app
        ? `<span class="sw-valor">${escaparHtml(app.activo ?? app.enEspera ?? app.instalando ?? 'desconocido')}</span>`
        : '<span class="sw-vacio">—</span>',
      app
        ? `activo: ${escaparHtml(app.activo ?? '—')} · en espera: ${escaparHtml(app.enEspera ?? '—')} · instalando: ${escaparHtml(app.instalando ?? '—')}`
        : ''
    ),
    Fila('¿Controla esta página?', SiNo(Boolean(estado.controlador)), ExplicarControl(estado)),
  ];

  return `
    ${estado.error ? `<p class="sw-error" role="alert">No se pudo consultar al navegador: ${escaparHtml(estado.error)}</p>` : ''}
    <dl class="sw-filas">${filasEstado.join('')}</dl>
    <p class="sw-hora">Última lectura: ${escaparHtml(hora)}</p>
  `;
}

/* ── 2. Verificador de scope ──────────────────────────────────────────────── */

function PanelVerificador(estado) {
  // Se evalúa contra el scope REGISTRADO; si todavía no hay registro, contra el
  // que se pidió, para que la tabla sirva también antes de registrar.
  const scope = estado.app?.scope ?? urlAbsoluta(SW_SCOPE);
  // «Registro que gana» solo dice algo cuando hay registros que compiten por
  // una misma URL; con uno solo repetiría el mismo scope en cada fila.
  const hayRegistros = estado.registros.length > 1;
  const filas = filasVerificador(scope, estado.registros);

  return `
    <p class="sw-scope">
      Scope evaluado: ${Codigo(scope)}
      <small>${estado.app ? '(el registrado)' : '(el esperado: todavía no hay registro)'}</small>
    </p>

    <div class="sw-tabla-caja">
      <table class="sw-tabla">
        <thead>
          <tr>
            <th scope="col">Ruta probada</th>
            <th scope="col">Resultado</th>
            ${hayRegistros ? '<th scope="col">Registro que gana</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${filas
            .map(
              (fila) => `
            <tr>
              <th scope="row">
                ${escaparHtml(fila.etiqueta)}
                ${Codigo(fila.url)}
                <small class="sw-detalle">${escaparHtml(fila.nota)}</small>
              </th>
              <td>
                <span class="sw-valor ${fila.dentro ? 'sw-valor--si' : 'sw-valor--no'}">
                  ${fila.dentro ? '✓ Dentro' : '✗ Fuera'}
                </span>
              </td>
              ${hayRegistros ? `<td>${Codigo(fila.gana)}</td>` : ''}
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ── 4. Reto: lista de registros ──────────────────────────────────────────── */

function PanelRegistros(estado) {
  if (!estado.registros.length) {
    return '<p class="sw-vacio-bloque">No hay ningún registro en este dominio.</p>';
  }

  return `
    <div class="sw-tabla-caja">
      <table class="sw-tabla">
        <thead>
          <tr>
            <th scope="col">Scope</th>
            <th scope="col">Script</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${estado.registros
            .map(
              (registro) => `
            <tr>
              <td>${Codigo(registro.scope)}</td>
              <td>${Codigo(registro.script)}</td>
              <td>${escaparHtml(registro.activo ?? registro.enEspera ?? registro.instalando ?? '—')}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ── Componente ───────────────────────────────────────────────────────────── */

/**
 * Marcado del panel. Los títulos de bloque son h3 porque el título del grupo
 * («Service Worker») lo pone quien lo usa, como h2.
 */
export function ServiceWorkerPanel() {
  const sinSoporte = soportaSW() ? '' : 'disabled';

  return `
    <div id="sw-vista" class="sw-vista">
      <section class="sw-seccion" aria-labelledby="sw-t-estado">
        <header class="sw-seccion__cabecera">
          <h3 id="sw-t-estado" class="sw-seccion__titulo">Estado</h3>
          <button type="button" class="clima-boton" data-accion="actualizar">Actualizar estado</button>
        </header>
        <div id="sw-estado" aria-live="polite"><p class="cargando">Consultando al navegador…</p></div>
      </section>

      <section class="sw-seccion" aria-labelledby="sw-t-scope">
        <h3 id="sw-t-scope" class="sw-seccion__titulo">Verificador de scope</h3>
        <p class="sw-seccion__texto">
          Un worker solo controla las URL cuyo texto <strong>empieza</strong> por su
          scope. La comparación es por prefijo, igual que la hace el navegador.
        </p>
        <div id="sw-verificador"></div>
      </section>

      <section class="sw-seccion" aria-labelledby="sw-t-invalido">
        <h3 id="sw-t-invalido" class="sw-seccion__titulo">Scope inválido a propósito</h3>
        <p class="sw-seccion__texto">
          Un script solo puede controlar su propia carpeta y las de abajo. Este
          experimento registra un script de <code>/src/pwa/</code> pidiendo el scope
          de <em>toda la app</em>, que es más ancho que su carpeta: el navegador debe
          rechazarlo. Es lo que le pasaría a <code>sw.js</code> si estuviera dentro de
          <code>src/</code> en vez de en la raíz.
        </p>
        <button type="button" class="clima-boton" data-accion="scope-invalido" ${sinSoporte}>
          Probar scope inválido
        </button>
        <div id="sw-invalido" class="sw-resultado" aria-live="polite"></div>
      </section>

      <section class="sw-seccion" aria-labelledby="sw-t-reto">
        <h3 id="sw-t-reto" class="sw-seccion__titulo">Reto: dos registros con el mismo sw.js</h3>
        <p class="sw-seccion__texto">
          Registra <code>${escaparHtml(SW_URL)}</code> una segunda vez con un scope más
          estrecho, <code>${escaparHtml(SW_SCOPE_ESTRECHO)}</code>. Cuando varios registros
          cubren una URL, gana el de scope <strong>más largo</strong> (el más específico):
          mira la columna «Registro que gana» del verificador al registrarlo.
        </p>
        <div class="sw-botones">
          <button type="button" class="clima-boton" data-accion="registrar-estrecho" ${sinSoporte}>
            Registrar scope estrecho
          </button>
          <button type="button" class="clima-boton" data-accion="quitar-estrecho" ${sinSoporte}>
            Quitar scope estrecho
          </button>
        </div>
        <p id="sw-reto-mensaje" class="sw-mensaje" aria-live="polite"></p>
        <h4 class="sw-subtitulo">Registros del dominio · getRegistrations()</h4>
        <div id="sw-registros"></div>
      </section>
    </div>
  `;
}

/**
 * Conecta el panel con el navegador una vez que su HTML ya está en el DOM.
 *
 * @param {{contenedor: HTMLElement, vigente: () => boolean}} contexto
 *        los mismos dos datos que el router le pasa a cualquier vista
 */
ServiceWorkerPanel.montar = async ({ contenedor, vigente }) => {
  const vista = contenedor.querySelector('#sw-vista');
  const estadoCaja = contenedor.querySelector('#sw-estado');
  const verificador = contenedor.querySelector('#sw-verificador');
  const registros = contenedor.querySelector('#sw-registros');
  const invalido = contenedor.querySelector('#sw-invalido');
  const retoMensaje = contenedor.querySelector('#sw-reto-mensaje');
  if (!vista || !estadoCaja || !verificador || !registros || !invalido || !retoMensaje) return;

  // Workers a los que ya se les pidió avisar de sus cambios de estado, para no
  // acumular escuchadores cada vez que se repinta.
  const vigilados = new WeakSet();

  /** Lee el estado y repinta los tres bloques que dependen de él. */
  async function pintarTodo() {
    const estado = await leerEstado();
    if (!vigente() || !vista.isConnected) return;

    estadoCaja.innerHTML = PanelEstado(estado, HORA.format(new Date()));
    verificador.innerHTML = PanelVerificador(estado);
    registros.innerHTML = PanelRegistros(estado);

    // Un worker pasa solo de «installing» a «activated»: se repinta cuando
    // ocurra, en vez de dejar la pantalla con el estado viejo.
    for (const { registro } of estado.registros) {
      for (const worker of [registro.installing, registro.waiting, registro.active]) {
        if (!worker || vigilados.has(worker)) continue;
        vigilados.add(worker);
        worker.addEventListener('statechange', pintarTodo);
      }
    }
  }

  /** Muestra un texto junto al reto; sin texto, lo limpia. */
  const decirReto = (texto, tono = 'ok') => {
    retoMensaje.textContent = texto;
    retoMensaje.className = texto ? `sw-mensaje sw-mensaje--${tono}` : 'sw-mensaje';
  };

  vista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;

    boton.disabled = true;

    try {
      switch (boton.dataset.accion) {
        case 'actualizar':
          await pintarTodo();
          break;

        case 'scope-invalido': {
          const intento = await probarScopeInvalido();
          if (!vigente() || !vista.isConnected) break;

          invalido.innerHTML = intento.error
            ? `
              <div class="sw-error" role="alert">
                <p class="sw-error__titulo">${escaparHtml(intento.error.nombre)}: el navegador rechazó el scope</p>
                <dl class="sw-filas">
                  ${Fila('Script', Codigo(intento.script))}
                  ${Fila('Scope pedido', Codigo(intento.scope))}
                  ${Fila('Máximo permitido para ese script', Codigo(intento.maximo))}
                </dl>
                <p class="sw-error__texto">${escaparHtml(intento.error.mensaje)}</p>
              </div>`
            : '<p class="sw-mensaje sw-mensaje--error">El navegador aceptó el scope, que no debería. Se deshizo el registro.</p>';
          break;
        }

        case 'registrar-estrecho':
          decirReto('');
          await registrarScopeEstrecho();
          decirReto(`Registrado con scope ${urlAbsoluta(SW_SCOPE_ESTRECHO)}`);
          await pintarTodo();
          break;

        case 'quitar-estrecho':
          decirReto(
            (await quitarScopeEstrecho())
              ? 'Registro estrecho eliminado.'
              : 'No había ningún registro estrecho que quitar.'
          );
          await pintarTodo();
          break;
      }
    } catch (error) {
      // Cualquier fallo del navegador se dice en pantalla, no solo en consola.
      decirReto(`No se pudo completar la acción. ${error.name}: ${error.message}`, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  await pintarTodo();
};
