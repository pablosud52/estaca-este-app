export type NormativaTabId =
  | 'OPERATIONAL_SUMMARY'
  | 'FUNDS_USE'
  | 'ANNUAL_CLOSING'
  | 'MONEY_EXCEPTION';

export type FundsCategoryFilter =
  | 'ALL'
  | 'PRESUPUESTO'
  | 'OFRENDAS'
  | 'REEMBOLSABLES'
  | 'OTROS'
  | 'MIEMBRO';

export interface NormativaDocMeta {
  id: NormativaTabId;
  tabLabel: string;
  title: string;
  subtitle: string;
  issuedLabel: string;
  pdfUrl?: string;
  downloadFilename?: string;
}

export const NORMATIVA_DOCS: Record<NormativaTabId, NormativaDocMeta> = {
  OPERATIONAL_SUMMARY: {
    id: 'OPERATIONAL_SUMMARY',
    tabLabel: 'Resumen Operativo',
    title: 'Resumen Operativo de Finanzas',
    subtitle: 'Datos clave de funcionamiento mensual de la tarjeta y cierre contable de la Estaca y Unidades',
    issuedLabel: 'Referencia interna · Estaca y Unidades',
  },
  FUNDS_USE: {
    id: 'FUNDS_USE',
    tabLabel: 'Uso Apropiado de los Fondos',
    title: 'Uso Apropiado de los Fondos Sagrados del Señor',
    subtitle: 'Aprobación del gasto por categoría y referencia al Manual General',
    issuedLabel: 'Marzo 2026',
    pdfUrl: '/docs/normativas/uso-apropiado-fondos-2026.pdf',
    downloadFilename: 'Uso-Apropiado-Fondos-Sagrados-Marzo-2026.pdf',
  },
  ANNUAL_CLOSING: {
    id: 'ANNUAL_CLOSING',
    tabLabel: 'Cierre Anual',
    title: 'Cierre de Fin de Año y Presupuesto',
    subtitle: 'Departamento de Registros y Estadísticas – Finanzas de Unidades Locales (Área Sudamérica Sur)',
    issuedLabel: 'Aviso Oficial Área',
    pdfUrl: '/docs/normativas/cierre-anual.pdf',
    downloadFilename: 'Cierre-de-Fin-de-Anio-y-Presupuesto.pdf',
  },
  MONEY_EXCEPTION: {
    id: 'MONEY_EXCEPTION',
    tabLabel: 'Excepción de Dinero',
    title: 'Excepción de Dinero – Normas Vigentes',
    subtitle: 'Departamento de Finanzas y Membresía de Unidades Locales · Manual General, cap. 34',
    issuedLabel: '27 de marzo de 2024',
    pdfUrl: '/docs/normativas/excepcion-de-dinero-2024.pdf',
    downloadFilename: 'Excepcion-de-Dinero-2024.pdf',
  },
};

export interface FundsNote {
  code: string;
  text: string;
  url?: string;
}

export const FUNDS_NOTES: Record<string, FundsNote> = {
  A: {
    code: 'A',
    text: 'Según kilómetros y monto aprobado anualmente para cada estaca o distrito. Ver pautas del formulario "Solicitud de reembolso por gastos de viaje y de teléfono".',
  },
  B: {
    code: 'B',
    text: 'Fondo Perpetuo de Educación (FPE).',
  },
  C: {
    code: 'C',
    text: 'A cargo de Propiedades (Facilidades Físicas); deberá tratarlo con el Gerente de Propiedades.',
  },
  D: {
    code: 'D',
    text: 'Los hermanos que asistan por primera vez al Templo y no cuenten con recursos suficientes pueden ser ayudados para el viaje y la compra de ropa (ropa blanca, ceremonial y garments). Tras completar el Obispo/Pte. de Rama el "Formulario de solicitud y aprobación del Fondo General de Ayuda para Participantes del Templo", el Presidente de Estaca/Misión debe enviarlo a la Presidencia de Área para su aprobación al menos 15 días antes del viaje (Carta Pcia. de Área 11 de septiembre de 2025).',
  },
  E: {
    code: 'E',
    text: 'A las personas que no son miembros de la Iglesia normalmente se les remite a recursos de la comunidad local. En raras ocasiones, y con la guía del Espíritu, el obispo podría darles ayuda con ofrendas de ayuno o pedidos del obispo (por ejemplo, padres o cuidadores no miembros a cargo de uno o más hijos que sí lo sean).',
  },
  F: {
    code: 'F',
    text: 'Todo material para el funcionamiento de la unidad es pagado por el presupuesto de la misma. Tener en cuenta de no sobregirarse.',
  },
  G: {
    code: 'G',
    text: 'Los materiales personales son a cargo de cada miembro.',
  },
  H: {
    code: 'H',
    text: 'Seguir las pautas del Manual General sobre límites de aprobación para Obispos y Presidentes de Estaca. Si excede el monto de aprobación del Presidente de Estaca, antes de comprometer la ayuda debe recibir aprobación por escrito de la Presidencia de Área.',
    url: 'https://www.churchofjesuschrist.org/help/support/medical-fast-offer-limits-south-america-south?lang=spa',
  },
  I: {
    code: 'I',
    text: 'Excepto cuando ese año hay una actividad "Para la Fortaleza de la Juventud" (PFJ).',
  },
  J: {
    code: 'J',
    text: 'Esta ayuda cumple las normas de cualquier gasto de ofrendas (Manual General, secciones 22.3.2 y 22.4).',
  },
  K: {
    code: 'K',
    text: 'Antes de hacer un gasto debe tener la aprobación previa, por escrito, del Presidente de Estaca o Distrito.',
  },
  L: {
    code: 'L',
    text: 'Antes de hacer un gasto para el Presidente de Estaca o Distrito debe tener la aprobación previa, por escrito, de un miembro de la Presidencia de Área (estaca) o Presidente de Misión (distrito).',
  },
};

export interface AppropriateFundsItem {
  id: number;
  concept: string;
  ofrendas: string;
  presupuesto: string;
  reembolsables: string;
  otros: string;
  miembro: string;
  reference: string;
  notes: string[];
}

export const APPROPRIATE_FUNDS_ITEMS: AppropriateFundsItem[] = [
  {
    id: 1,
    concept: 'Actividades del barrio, de organizaciones, del Sacerdocio y seminario (incluido el refrigerio)',
    ofrendas: 'NO',
    presupuesto: 'SI',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 34.6.2.2 - Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 2,
    concept: 'Artículos esenciales: Alimentos, Ropa, Vivienda (alquiler, arriendo), Servicios Públicos, Terapia y Atención Médica (última opción y a corto plazo)',
    ofrendas: 'SI',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'MG Sección 22.4.2 y 22.4',
    notes: [],
  },
  {
    id: 3,
    concept: 'Atención médica (corto plazo)',
    ofrendas: 'SI (H)',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'MG Sección 22.5.2.1 y 22.4',
    notes: ['H'],
  },
  {
    id: 4,
    concept: 'Ayuda a los no miembros de la Iglesia',
    ofrendas: 'NO (E)',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'MG Sección 22.5.1.4',
    notes: ['E'],
  },
  {
    id: 5,
    concept: 'Ayuda de Ofrendas a largo plazo o por tiempo indefinido',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'MG Sección 22.3.2, 22.4, 22.4.2',
    notes: [],
  },
  {
    id: 6,
    concept: 'Ayuda de Ofrendas para el Obispo y/o sus familiares que vivan dentro del barrio',
    ofrendas: 'SI (K)',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 22.5.1.2',
    notes: ['K'],
  },
  {
    id: 7,
    concept: 'Ayuda de Ofrendas para el Presidente de Estaca/Distrito y/o sus familiares que vivan dentro de la estaca',
    ofrendas: 'SI (L)',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 22.5.1.2',
    notes: ['L'],
  },
  {
    id: 8,
    concept: 'Ayuda médica que sea moral, ética o legalmente cuestionable',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'MG Sección 22.5.2.1 (Uso de las ofrendas de ayuno para gastos médicos)',
    notes: [],
  },
  {
    id: 9,
    concept: 'Campamento anual diurno o actividad para niños de la Primaria de 8 a 11 años',
    ofrendas: 'NO',
    presupuesto: 'SI',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 20.6.2',
    notes: [],
  },
  {
    id: 10,
    concept: 'Conferencias de la Juventud (convenciones de HH y MM JJ)',
    ofrendas: 'NO',
    presupuesto: 'SI (I)',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 20.4',
    notes: ['I'],
  },
  {
    id: 11,
    concept: 'Cursos de corta duración de formación vocacional',
    ofrendas: 'SI (J)',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'MG Sección 22.4.2',
    notes: ['J'],
  },
  {
    id: 12,
    concept: 'Deudas de consumo u obligaciones incurridas por negocios fracasados o empresas especulativas',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'MG Sección 22.5.2.2',
    notes: [],
  },
  {
    id: 13,
    concept: 'Educación formal para jóvenes y/o adultos',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'FPE (B)',
    miembro: 'SI',
    reference: 'Ver normas del FPE',
    notes: ['B'],
  },
  {
    id: 14,
    concept: 'Elementos básicos de higiene',
    ofrendas: 'SI',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'MG Sección 22.3.2',
    notes: [],
  },
  {
    id: 15,
    concept: 'Financiamiento de Misioneros de Tiempo Completo (Compromiso Misional mensual)',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'MG Sección 24.3.4',
    notes: [],
  },
  {
    id: 16,
    concept: 'Financiamiento Servicio Misional en Casa (Misioneros de Servicio)',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'MG Sección 24.3.4.3',
    notes: [],
  },
  {
    id: 17,
    concept: 'Garments, ropa blanca y ropa ceremonial del Templo (no por primera vez)',
    ofrendas: 'SI',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'MG Sección 38.5.2 - Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 18,
    concept: 'Garments, ropa blanca y ropa ceremonial del Templo (por primera vez)',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'APROB PA (D)',
    miembro: 'N/A',
    reference: 'Carta Pcia. Área 11 de septiembre 2025',
    notes: ['D'],
  },
  {
    id: 19,
    concept: 'Gastos de artículos de oficina',
    ofrendas: 'NO',
    presupuesto: 'SI',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 20,
    concept: 'Gastos de viaje a las unidades para obispos, presidentes, secretarios y líderes de estaca',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'SI (A)',
    otros: 'NO',
    miembro: 'N/A',
    reference: 'Formulario: "Solicitud de reembolso por gastos de viaje y teléfono"',
    notes: ['A'],
  },
  {
    id: 21,
    concept: 'Gastos telefónicos, recarga de celular (solo estaca/distrito)',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'SI (A)',
    otros: 'NO',
    miembro: 'SI',
    reference: 'Formulario: "Solicitud de reembolso por gastos de viaje y teléfono"',
    notes: ['A'],
  },
  {
    id: 22,
    concept: 'Mantenimiento, Equipos y Amoblamientos del Centro de Reuniones',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'Propiedades (C)',
    miembro: 'N/A',
    reference: 'MG Sección 34.6.2.2 y Gastos Presupuesto (LUBA)',
    notes: ['C'],
  },
  {
    id: 23,
    concept: 'Materiales de la Iglesia (Manuales, Folletos, Láminas, etc.)',
    ofrendas: 'N/A',
    presupuesto: 'SI (F)',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI (G)',
    reference: 'Carta Obispado Presidente 6 de agosto 2014',
    notes: ['F', 'G'],
  },
  {
    id: 24,
    concept: 'Reparación de equipos de la Iglesia por descuido o daño',
    ofrendas: 'N/A',
    presupuesto: 'SI',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 25,
    concept: 'Viajes al Templo (no por primera vez)',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'SI',
    reference: 'Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 26,
    concept: 'Viajes al Templo con los HH y MM JJ',
    ofrendas: 'NO',
    presupuesto: 'SI',
    reembolsables: 'NO',
    otros: 'NO',
    miembro: 'NO',
    reference: 'Gastos Presupuesto (LUBA)',
    notes: [],
  },
  {
    id: 27,
    concept: 'Viajes al Templo por primera vez',
    ofrendas: 'NO',
    presupuesto: 'NO',
    reembolsables: 'NO',
    otros: 'APROB PA (D)',
    miembro: 'N/A',
    reference: 'Carta Pcia. Área 11 de septiembre 2025',
    notes: ['D'],
  },
];

export function isCategoryAllowedValue(val: string): boolean {
  const upper = val.trim().toUpperCase();
  return upper !== 'NO' && upper !== 'N/A' && !upper.startsWith('NO ');
}
