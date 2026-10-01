/**
 * pwa/sw-anidado.js
 * -----------------------------------------------------------------------------
 * "Copia de sw.js dentro de una subcarpeta", sin copiar el código.
 *
 * NUNCA debe quedar registrado. Existe solo para el experimento de scope
 * inválido (registerSW.js -> probarScopeInvalido): al vivir en /src/pwa/, el
 * navegador solo le permite controlar /src/pwa/..., así que pedirle el scope de
 * toda la app tiene que fallar. Es lo que le pasaría a sw.js si estuviera en
 * src/ en vez de en la raíz.
 *
 * La ruta es relativa a ESTE archivo, así que sirve igual en la raíz del
 * dominio que en /soilAir-pwa/.
 */

importScripts('../../sw.js');
