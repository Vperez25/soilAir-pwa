/**
 * instalation.js
 * Captura beforeinstallprompt y appinstalled, y detecta si la app corre instalada.
 * Se inicia al arrancar la app (main.js), no al abrir una vista: el evento
 * puede dispararse en cualquier momento, y si nadie lo escucha se pierde.
 */

let eventoGuardado = null;
const oyentes = new Set();

function notificar() {
  oyentes.forEach((fn) => fn());
}

/** ¿La app corre instalada? Cubre Chromium (display-mode) e iOS (standalone). */
export function estaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.navigator.standalone === true
  );
}

/** iPhone, iPad y iPadOS (que se presenta como Mac con pantalla táctil). */
export function esIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** ¿Hay evento guardado y la app no está ya instalada? */
export function puedeInstalar() {
  return eventoGuardado !== null && !estaInstalada();
}

/** Registra un callback que se llama cuando cambia el estado de instalación. */
export function alCambiarInstalacion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/**
 * Muestra el diálogo nativo de instalación.
 * @returns {Promise<'accepted'|'dismissed'|null>} lo que eligió el usuario,
 *          o null si no había evento guardado.
 */
export async function pedirInstalacion() {
  if (!eventoGuardado) return null;

  const evento = eventoGuardado;
  evento.prompt();
  const { outcome } = await evento.userChoice;

  // El evento solo se puede usar una vez.
  eventoGuardado = null;
  notificar();
  return outcome;
}

export function iniciarInstalacion() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // evita la mini-barra automática
    eventoGuardado = e;
    console.log("[instalacion] beforeinstallprompt guardado");
    notificar();
  });

  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    console.log("[instalacion] appinstalled");
    notificar();
  });

  // Si cambia el modo de visualización (por ejemplo, tras instalar), se actualiza la UI.
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", notificar);
}
