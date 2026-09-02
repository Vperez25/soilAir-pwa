/**
 * services/climaService.js
 * -----------------------------------------------------------------------------
 * Servicio de datos REALES: condiciones actuales de las parcelas monitoreadas.
 *
 * API: Open-Meteo (https://open-meteo.com) — gratuita, sin API key, sin OAuth,
 * responde JSON. Se eligió porque devuelve variables de AIRE y de SUELO, que es
 * justo lo que mide un nodo SoilAir: temperatura, humedad relativa, radiación
 * solar, temperatura del suelo y humedad volumétrica del suelo.
 *
 * Open-Meteo acepta varias coordenadas en una sola petición (separadas por
 * comas) y regresa un arreglo con los resultados EN EL MISMO ORDEN. Por eso las
 * seis parcelas se resuelven con un único fetch.
 *
 * Este módulo no toca el DOM: recibe JSON crudo y entrega objetos ya listos
 * para pintar. Toda la red vive en ApiService.
 */

import { ApiService } from './apiService.js';
import { slugify } from '../utils/slugify.js';

/**
 * Parcelas de la red SoilAir. El campo `cultivo` corresponde a un cultivo del
 * catálogo, así que la tarjeta puede enlazar a su ficha con el mismo slug que
 * usa CultivoCard.
 *
 * @type {Array<{nodo:string, parcela:string, region:string, cultivo:string, lat:number, lon:number}>}
 */
const PARCELAS = [
  { nodo: 'SOILAIR_A1', parcela: 'Invernadero 1', region: 'Villa Guerrero, Méx.', cultivo: 'Jitomate', lat: 18.96, lon: -99.64 },
  { nodo: 'SOILAIR_B4', parcela: 'Parcela 4 · temporal', region: 'Irapuato, Gto.', cultivo: 'Maíz', lat: 20.68, lon: -101.35 },
  { nodo: 'SOILAIR_A2', parcela: 'Invernadero 1 · cama sur', region: 'Zumpango, Méx.', cultivo: 'Lechuga', lat: 19.79, lon: -99.1 },
  { nodo: 'SOILAIR_C1', parcela: 'Túnel 2 · surco 3', region: 'Zamora, Mich.', cultivo: 'Fresa', lat: 19.99, lon: -102.28 },
  { nodo: 'SOILAIR_D2', parcela: 'Ladera alta · terraza 2', region: 'Zacapoaxtla, Pue.', cultivo: 'Chile Manzano', lat: 19.86, lon: -97.59 },
  { nodo: 'SOILAIR_B7', parcela: 'Parcela 7 · riego rodado', region: 'Cd. Obregón, Son.', cultivo: 'Trigo', lat: 27.49, lon: -109.94 },
];

/** Variables que se le piden a la API para el momento actual. */
const VARIABLES_ACTUALES = [
  'temperature_2m',
  'relative_humidity_2m',
  'shortwave_radiation',
  'soil_temperature_0cm',
  'soil_moisture_0_to_1cm',
];

/** Variables del resumen del día. */
const VARIABLES_DIARIAS = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'];

/**
 * Traduce la humedad volumétrica del suelo (m³/m³) y la lluvia esperada en una
 * recomendación de riego. Es la única "inteligencia" del servicio y sale de los
 * datos reales de la API, no de valores inventados.
 *
 * @param {number} humedadSuelo fracción de agua en el suelo (0 a ~0.5)
 * @param {number} lluvia milímetros previstos para hoy
 * @returns {{estado:string, texto:string}} estado para la clase CSS y texto visible
 */
function evaluarRiego(humedadSuelo, lluvia) {
  if (humedadSuelo < 0.12) {
    return { estado: 'critico-bajo', texto: 'Suelo seco · regar hoy' };
  }
  if (humedadSuelo < 0.2) {
    return lluvia >= 5
      ? { estado: 'bajo', texto: 'Suelo bajo, pero se espera lluvia' }
      : { estado: 'bajo', texto: 'Humedad baja · adelantar riego' };
  }
  if (humedadSuelo > 0.4) {
    return { estado: 'critico-alto', texto: 'Suelo saturado · suspender riego' };
  }
  if (lluvia >= 10) {
    return { estado: 'alto', texto: 'Lluvia fuerte prevista · no regar' };
  }
  return { estado: 'optimo', texto: 'Humedad en rango · sin acción' };
}

/**
 * Convierte un resultado crudo de Open-Meteo + su parcela en el objeto que
 * consume la vista.
 *
 * @param {Object} parcela entrada de PARCELAS
 * @param {Object} datos   objeto devuelto por la API para esa coordenada
 */
function normalizar(parcela, datos) {
  const actual = datos.current ?? {};
  const dia = datos.daily ?? {};
  const lluvia = dia.precipitation_sum?.[0] ?? 0;
  const humedadSuelo = actual.soil_moisture_0_to_1cm ?? 0;

  return {
    ...parcela,
    cultivoId: slugify(parcela.cultivo),
    hora: actual.time ?? null,
    zona: datos.timezone_abbreviation ?? '',
    elevacion: datos.elevation ?? null,
    // Bloque AIRE + bloque SUELO, ya con etiqueta y unidad para pintarse tal cual.
    metricas: [
      { clave: 'temperatura', etiqueta: 'Aire', valor: actual.temperature_2m, unidad: '°C' },
      { clave: 'humedad', etiqueta: 'Humedad', valor: actual.relative_humidity_2m, unidad: '%' },
      { clave: 'radiacion', etiqueta: 'Radiación', valor: actual.shortwave_radiation, unidad: 'W/m²' },
      { clave: 'suelo-temp', etiqueta: 'Suelo', valor: actual.soil_temperature_0cm, unidad: '°C' },
      { clave: 'suelo-hum', etiqueta: 'Agua en suelo', valor: redondear(humedadSuelo * 100, 0), unidad: '%' },
    ],
    maxima: dia.temperature_2m_max?.[0] ?? null,
    minima: dia.temperature_2m_min?.[0] ?? null,
    lluvia,
    riego: evaluarRiego(humedadSuelo, lluvia),
  };
}

/** Redondeo corto; evita los 14.800000000000001 al pintar. */
function redondear(valor, decimales = 1) {
  if (typeof valor !== 'number' || Number.isNaN(valor)) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

class ClimaService extends ApiService {
  constructor() {
    super('https://api.open-meteo.com', { timeout: 12000 });
  }

  /** Las parcelas configuradas, por si la vista necesita pintar el esqueleto. */
  get parcelas() {
    return PARCELAS;
  }

  /**
   * Trae las condiciones actuales de TODAS las parcelas en una sola petición.
   *
   * @returns {Promise<Array<Object>>} una entrada por parcela, en el mismo orden
   * @throws {ApiError} lo que haya lanzado ApiService.get()
   */
  async obtenerCondiciones() {
    const datos = await this.get('/v1/forecast', {
      latitude: PARCELAS.map((p) => p.lat),
      longitude: PARCELAS.map((p) => p.lon),
      current: VARIABLES_ACTUALES,
      daily: VARIABLES_DIARIAS,
      forecast_days: 1,
      timezone: 'auto',
    });

    // Con una sola coordenada la API devuelve un objeto; con varias, un arreglo.
    const lista = Array.isArray(datos) ? datos : [datos];

    if (lista.length !== PARCELAS.length) {
      throw new Error('La API devolvió menos parcelas de las solicitadas.');
    }

    return PARCELAS.map((parcela, i) => normalizar(parcela, lista[i]));
  }
}

/** Instancia única: la vista solo importa y usa. */
export const climaService = new ClimaService();

export default climaService;
