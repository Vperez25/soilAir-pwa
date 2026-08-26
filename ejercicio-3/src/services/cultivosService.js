/**
 * services/cultivosService.js
 * -----------------------------------------------------------------------------
 * EXPORTACIÓN POR DEFECTO del proyecto.
 *
 * Este módulo tiene la ficha técnica completa de cada cultivo (rangos ideales y
 * críticos de suelo y ambiente) más la última lectura simulada del nodo SoilAir,
 * y sabe comparar una contra la otra.
 *
 * Se carga con import() dinámico desde views/CultivoDetailView.js: es el archivo
 * pesado del proyecto y solo hace falta cuando el usuario abre un detalle.
 */

import { CULTIVOS } from './cultivosIndex.js';
import { slugify } from '../utils/slugify.js';

/**
 * Ficha técnica por cultivo. Cada parámetro trae su rango ideal y su rango
 * crítico, igual que los JSON de assets/plants en la app móvil.
 */
const FICHAS = {
  jitomate: {
    ambiente: {
      temperatura: { ideal: [23, 25], critico: [8, 30] },
      humedad: { ideal: [60, 70], critico: [40, 90] },
      radiacion: { ideal: [800, 1000], critico: [500, 1200] },
    },
    suelo: {
      temperatura: { ideal: [20, 25], critico: [12, 35] },
      ph: { ideal: [6.0, 6.8], critico: [5.0, 7.5] },
      humedad: { ideal: [60, 80], critico: [30, 90] },
      conductividad: { ideal: [0, 2.5], critico: [0, 5.0] },
      n: { ideal: [100, 150], critico: [50, 300] },
      p: { ideal: [65, 110], critico: [20, 200] },
      k: { ideal: [160, 240], critico: [50, 400] },
    },
    lectura: {
      nodo: 'SOILAIR_A1',
      parcela: 'Invernadero 1 · cama norte',
      fecha: '2026-08-25T07:40:00',
      ambiente: { temperatura: 24.1, humedad: 63, radiacion: 910 },
      suelo: { temperatura: 22.4, ph: 6.4, humedad: 71, conductividad: 1.8, n: 118, p: 74, k: 152 },
    },
    notas: [
      'El potasio quedó por debajo del ideal: revisar la fertirrigación antes del cuaje.',
      'Con la humedad de suelo arriba de 80 % aumenta el riesgo de Phytophthora.',
    ],
  },

  maiz: {
    ambiente: {
      temperatura: { ideal: [21, 27], critico: [10, 39] },
      humedad: { ideal: [60, 70], critico: [30, 90] },
      radiacion: { ideal: [600, 1200], critico: [400, 1500] },
    },
    suelo: {
      temperatura: { ideal: [29, 32], critico: [10, 35] },
      ph: { ideal: [6.0, 7.2], critico: [5.0, 8.0] },
      humedad: { ideal: [50, 80], critico: [30, 90] },
      conductividad: { ideal: [0.5, 3.0], critico: [0.2, 5.0] },
      n: { ideal: [100, 150], critico: [50, 200] },
      p: { ideal: [40, 80], critico: [10, 120] },
      k: { ideal: [40, 120], critico: [20, 200] },
    },
    lectura: {
      nodo: 'SOILAIR_B4',
      parcela: 'Parcela 4 · temporal',
      fecha: '2026-08-25T07:35:00',
      ambiente: { temperatura: 26.8, humedad: 58, radiacion: 1040 },
      suelo: { temperatura: 24.6, ph: 6.9, humedad: 44, conductividad: 1.4, n: 96, p: 52, k: 88 },
    },
    notas: [
      'Suelo frío para la etapa actual: la absorción de fósforo se vuelve lenta abajo de 29 °C.',
      'Humedad de suelo bajo el ideal; conviene adelantar el riego.',
    ],
  },

  lechuga: {
    ambiente: {
      temperatura: { ideal: [15, 18], critico: [7, 21] },
      humedad: { ideal: [60, 80], critico: [30, 90] },
      radiacion: { ideal: [450, 600], critico: [200, 1600] },
    },
    suelo: {
      temperatura: { ideal: [15, 24], critico: [5, 35] },
      ph: { ideal: [6.0, 6.5], critico: [5.0, 8.5] },
      humedad: { ideal: [20, 40], critico: [10, 60] },
      conductividad: { ideal: [0, 1.2], critico: [0, 2.0] },
      n: { ideal: [80, 150], critico: [20, 300] },
      p: { ideal: [30, 80], critico: [10, 150] },
      k: { ideal: [40, 100], critico: [10, 200] },
    },
    lectura: {
      nodo: 'SOILAIR_A2',
      parcela: 'Invernadero 1 · cama sur',
      fecha: '2026-08-25T07:41:00',
      ambiente: { temperatura: 22.6, humedad: 66, radiacion: 520 },
      suelo: { temperatura: 19.8, ph: 6.2, humedad: 33, conductividad: 0.9, n: 104, p: 46, k: 62 },
    },
    notas: [
      'Temperatura de aire fuera del rango crítico: riesgo de espigado prematuro.',
      'Todo lo demás está en rango; sostener el riego ligero y frecuente.',
    ],
  },

  fresa: {
    ambiente: {
      temperatura: { ideal: [14, 21], critico: [-4, 32] },
      humedad: { ideal: [60, 75], critico: [30, 90] },
      radiacion: { ideal: [450, 600], critico: [200, 1600] },
    },
    suelo: {
      temperatura: { ideal: [15, 24], critico: [5, 35] },
      ph: { ideal: [5.5, 6.5], critico: [4.5, 8.0] },
      humedad: { ideal: [20, 40], critico: [10, 60] },
      conductividad: { ideal: [0, 1.2], critico: [0, 2.0] },
      n: { ideal: [80, 150], critico: [20, 300] },
      p: { ideal: [30, 80], critico: [10, 150] },
      k: { ideal: [40, 100], critico: [10, 200] },
    },
    lectura: {
      nodo: 'SOILAIR_C1',
      parcela: 'Túnel 2 · surco 3',
      fecha: '2026-08-25T07:38:00',
      ambiente: { temperatura: 19.4, humedad: 71, radiacion: 570 },
      suelo: { temperatura: 18.9, ph: 6.9, humedad: 38, conductividad: 1.1, n: 92, p: 51, k: 74 },
    },
    notas: [
      'pH arriba del ideal: a partir de 6.8 se bloquea el hierro y aparece clorosis.',
      'Aplicar enmienda ácida y volver a medir en 72 horas.',
    ],
  },

  'chile-manzano': {
    ambiente: {
      temperatura: { ideal: [18, 22], critico: [5, 35] },
      humedad: { ideal: [60, 80], critico: [30, 90] },
      radiacion: { ideal: [450, 600], critico: [200, 1600] },
    },
    suelo: {
      temperatura: { ideal: [15, 24], critico: [5, 35] },
      ph: { ideal: [5.5, 7.5], critico: [5.0, 8.0] },
      humedad: { ideal: [20, 40], critico: [10, 60] },
      conductividad: { ideal: [0, 6.0], critico: [0, 8.0] },
      n: { ideal: [150, 200], critico: [50, 300] },
      p: { ideal: [40, 70], critico: [10, 120] },
      k: { ideal: [200, 300], critico: [50, 400] },
    },
    lectura: {
      nodo: 'SOILAIR_D2',
      parcela: 'Ladera alta · terraza 2',
      fecha: '2026-08-25T07:30:00',
      ambiente: { temperatura: 20.2, humedad: 74, radiacion: 495 },
      suelo: { temperatura: 17.5, ph: 6.6, humedad: 29, conductividad: 2.4, n: 168, p: 58, k: 214 },
    },
    notas: [
      'Lectura completa dentro de rango ideal: no se requiere intervención.',
      'Mantener el monitoreo cada 6 horas durante el amarre de fruto.',
    ],
  },

  trigo: {
    ambiente: {
      temperatura: { ideal: [10, 24], critico: [3, 35] },
      humedad: { ideal: [40, 70], critico: [20, 90] },
      radiacion: { ideal: [900, 1400], critico: [500, 1600] },
    },
    suelo: {
      temperatura: { ideal: [15, 24], critico: [5, 32] },
      ph: { ideal: [5.5, 7.5], critico: [5.0, 8.0] },
      humedad: { ideal: [20, 40], critico: [10, 50] },
      conductividad: { ideal: [0, 6.0], critico: [0, 8.0] },
      n: { ideal: [150, 200], critico: [50, 300] },
      p: { ideal: [40, 70], critico: [10, 120] },
      k: { ideal: [200, 300], critico: [50, 400] },
    },
    lectura: {
      nodo: 'SOILAIR_B7',
      parcela: 'Parcela 7 · riego rodado',
      fecha: '2026-08-25T07:33:00',
      ambiente: { temperatura: 21.7, humedad: 46, radiacion: 1260 },
      suelo: { temperatura: 20.1, ph: 7.9, humedad: 8, conductividad: 3.2, n: 143, p: 44, k: 186 },
    },
    notas: [
      'Humedad de suelo en zona crítica baja: hay estrés hídrico en curso.',
      'pH casi en el límite crítico alto, típico de suelos calcáreos de la zona.',
    ],
  },
};

/** Etiqueta y unidad de cada parámetro, para no repetirlas en las vistas. */
const PARAMETROS = {
  temperatura: { etiqueta: 'Temperatura', unidad: '°C' },
  humedad: { etiqueta: 'Humedad', unidad: '%' },
  radiacion: { etiqueta: 'Radiación', unidad: 'W/m²' },
  ph: { etiqueta: 'pH', unidad: '' },
  conductividad: { etiqueta: 'Conductividad', unidad: 'mS/cm' },
  n: { etiqueta: 'Nitrógeno (N)', unidad: 'mg/kg' },
  p: { etiqueta: 'Fósforo (P)', unidad: 'mg/kg' },
  k: { etiqueta: 'Potasio (K)', unidad: 'mg/kg' },
};

/**
 * Clasifica una lectura contra sus rangos.
 * Misma lógica que SensorCard en la app móvil.
 */
function evaluar(valor, rango) {
  const [idealMin, idealMax] = rango.ideal;
  const [critMin, critMax] = rango.critico;

  if (valor >= idealMin && valor <= idealMax) return 'optimo';
  if (valor < idealMin) return valor < critMin ? 'critico-bajo' : 'bajo';
  return valor > critMax ? 'critico-alto' : 'alto';
}

/** Arma la lista de métricas de un bloque (ambiente o suelo) ya evaluadas. */
function construirMetricas(rangos, lecturas) {
  return Object.entries(rangos).map(([clave, rango]) => {
    const valor = lecturas[clave];
    return {
      clave,
      etiqueta: PARAMETROS[clave].etiqueta,
      unidad: PARAMETROS[clave].unidad,
      valor,
      ideal: rango.ideal,
      critico: rango.critico,
      estado: evaluar(valor, rango),
    };
  });
}

const cultivosService = {
  /** Devuelve la ficha completa de un cultivo, o null si el id no existe. */
  obtenerPorId(id) {
    const base = CULTIVOS.find((cultivo) => slugify(cultivo.nombre) === id);
    const ficha = FICHAS[id];
    if (!base || !ficha) return null;

    return {
      ...base,
      id,
      lectura: ficha.lectura,
      notas: ficha.notas,
      ambiente: construirMetricas(ficha.ambiente, ficha.lectura.ambiente),
      suelo: construirMetricas(ficha.suelo, ficha.lectura.suelo),
    };
  },

  /** Cuenta cuántos parámetros salieron del rango ideal en la última lectura. */
  contarAlertas(ficha) {
    return [...ficha.ambiente, ...ficha.suelo].filter((m) => m.estado !== 'optimo').length;
  },
};

export default cultivosService;
