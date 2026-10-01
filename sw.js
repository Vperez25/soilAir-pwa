/**
 * sw.js
 * -----------------------------------------------------------------------------
 * Service Worker de SoilAir — versión de PRUEBA DE CONTEXTO Y SCOPE.
 *
 * Todavía no hace nada útil a propósito. Su único trabajo es demostrar DÓNDE se
 * ejecuta: un Service Worker corre en un hilo aparte, sin página, sin DOM y sin
 * Web Storage. Los mensajes de abajo se ven en DevTools -> Application ->
 * Service Workers -> (enlace "inspect" del worker) -> Console, NO en la consola
 * de la página: es otro contexto de ejecución.
 *
 * POR QUÉ ESTÁ EN LA RAÍZ Y NO EN src/
 * El scope máximo de un Service Worker es la carpeta donde vive su script. Un
 * sw.js dentro de src/ solo podría controlar /src/...; en la raíz puede
 * controlar toda la app. Ver el experimento en la vista /service-worker.
 *
 * Los eventos del ciclo de vida y la gestión de peticiones se agregan en los
 * siguientes ejercicios; por ahora este archivo solo escribe en consola.
 */

console.log('[SW] sw.js se ejecutó');

// En una página esto sería "Window"; aquí es el contexto global del worker.
console.log('[SW] Contexto global (self.constructor.name):', self.constructor.name);

// No hay página: no existen ni window, ni document, ni Web Storage.
console.log('[SW] typeof window:', typeof window);
console.log('[SW] typeof document:', typeof document);
console.log('[SW] typeof localStorage:', typeof localStorage);

// Dónde quedó registrado este worker: es el scope que pidió registerSW.js,
// siempre que su carpeta lo permita.
console.log('[SW] self.registration.scope:', self.registration.scope);
