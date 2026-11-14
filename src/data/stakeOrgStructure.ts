import { DirectoryOrgCode, OrganizationCode, UserRole } from '../types/database';

export interface FixedCallingSlot {
  slot_key: string;
  calling: string;
  defaultRole: UserRole;
  defaultCanApprove?: boolean;
  isPermanentAdmin?: boolean;
}

export interface DirectoryOrgDefinition {
  code: DirectoryOrgCode;
  label: string;
  shortLabel: string;
  hasBudget: boolean;
  budgetOrgCode: OrganizationCode;
  defaultExtraRole: UserRole;
  maxExtras: number;
  extraLabel: string;
  fixedSlots: FixedCallingSlot[];
}

export const STAKE_UNITS: string[] = [
  'Aeroparque',
  'Carrasco',
  'Malvin',
  'Mvd9',
  'Paso Carrasco',
  'Rama',
];

export const STAKE_ORG_STRUCTURE: DirectoryOrgDefinition[] = [
  {
    code: 'PRESIDENCIA',
    label: 'Presidencia de Estaca',
    shortLabel: 'Presidencia',
    hasBudget: true,
    budgetOrgCode: 'TODAS',
    defaultExtraRole: 'PRESIDENCIA',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      {
        slot_key: 'pres-presidente',
        calling: 'Presidente de Estaca',
        defaultRole: 'ADMIN',
        defaultCanApprove: true,
        isPermanentAdmin: true,
      },
      {
        slot_key: 'pres-consejero-1',
        calling: 'Primer Consejero',
        defaultRole: 'PRESIDENCIA',
        defaultCanApprove: true,
      },
      {
        slot_key: 'pres-consejero-2',
        calling: 'Segundo Consejero',
        defaultRole: 'PRESIDENCIA',
        defaultCanApprove: true,
      },
      {
        slot_key: 'pres-secretario',
        calling: 'Secretario de Estaca',
        defaultRole: 'PRESIDENCIA',
        defaultCanApprove: false,
      },
      {
        slot_key: 'pres-secretario-ejecutivo',
        calling: 'Secretario Ejecutivo',
        defaultRole: 'PRESIDENCIA',
        defaultCanApprove: false,
      },
      {
        slot_key: 'pres-secretario-financiero',
        calling: 'Secretario Financiero',
        defaultRole: 'ADMIN',
        defaultCanApprove: true,
        isPermanentAdmin: true,
      },
    ],
  },
  {
    code: 'SUMO_CONSEJO',
    label: 'Sumo Consejo',
    shortLabel: 'Sumo Consejo',
    hasBudget: false,
    budgetOrgCode: 'ESTACA',
    defaultExtraRole: 'CONSULTA',
    maxExtras: 0,
    extraLabel: '',
    fixedSlots: Array.from({ length: 12 }, (_, idx) => ({
      slot_key: `sc-${idx + 1}`,
      calling: `Miembro del Sumo Consejo #${idx + 1}`,
      defaultRole: 'CONSULTA' as UserRole,
    })),
  },
  {
    code: 'SS',
    label: 'Sociedad de Socorro',
    shortLabel: 'Soc. Socorro',
    hasBudget: true,
    budgetOrgCode: 'SS',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretaria auxiliar o asesora',
    fixedSlots: [
      { slot_key: 'ss-presidenta', calling: 'Presidenta', defaultRole: 'LIDER' },
      { slot_key: 'ss-consejera-1', calling: '1ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'ss-consejera-2', calling: '2ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'ss-secretaria', calling: 'Secretaria', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'HJ',
    label: 'Hombres Jóvenes',
    shortLabel: 'HHJJ',
    hasBudget: true,
    budgetOrgCode: 'HJ',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      { slot_key: 'hj-presidente', calling: 'Presidente', defaultRole: 'LIDER' },
      { slot_key: 'hj-consejero-1', calling: 'Primer Consejero', defaultRole: 'LIDER' },
      { slot_key: 'hj-consejero-2', calling: 'Segundo Consejero', defaultRole: 'LIDER' },
      { slot_key: 'hj-secretario', calling: 'Secretario', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'MJ',
    label: 'Mujeres Jóvenes',
    shortLabel: 'MMJJ',
    hasBudget: true,
    budgetOrgCode: 'MJ',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretaria auxiliar o asesora',
    fixedSlots: [
      { slot_key: 'mj-presidenta', calling: 'Presidenta', defaultRole: 'LIDER' },
      { slot_key: 'mj-consejera-1', calling: '1ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'mj-consejera-2', calling: '2ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'mj-secretaria', calling: 'Secretaria', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'ESCUELA_DOMINICAL',
    label: 'Escuela Dominical',
    shortLabel: 'Esc. Dominical',
    hasBudget: false,
    budgetOrgCode: 'ESTACA',
    defaultExtraRole: 'CONSULTA',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      { slot_key: 'ed-presidente', calling: 'Presidente', defaultRole: 'CONSULTA' },
      { slot_key: 'ed-consejero-1', calling: 'Primer Consejero', defaultRole: 'CONSULTA' },
      { slot_key: 'ed-consejero-2', calling: 'Segundo Consejero', defaultRole: 'CONSULTA' },
      { slot_key: 'ed-secretario', calling: 'Secretario', defaultRole: 'CONSULTA' },
    ],
  },
  {
    code: 'PRIMARIA',
    label: 'Primaria',
    shortLabel: 'Primaria',
    hasBudget: true,
    budgetOrgCode: 'PRIMARIA',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretaria auxiliar o asesora',
    fixedSlots: [
      { slot_key: 'prim-presidenta', calling: 'Presidenta', defaultRole: 'LIDER' },
      { slot_key: 'prim-consejera-1', calling: '1ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'prim-consejera-2', calling: '2ª Consejera', defaultRole: 'LIDER' },
      { slot_key: 'prim-secretaria', calling: 'Secretaria', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'JAS',
    label: 'Jóvenes Adultos Solteros (JAS)',
    shortLabel: 'JAS',
    hasBudget: true,
    budgetOrgCode: 'JAS',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      {
        slot_key: 'jas-presidente',
        calling: 'Presidente del Comité de Jóvenes Adultos Solteros',
        defaultRole: 'LIDER',
      },
      {
        slot_key: 'jas-miembro',
        calling: 'Miembro del Comité de Jóvenes Adultos Solteros',
        defaultRole: 'LIDER',
      },
    ],
  },
  {
    code: 'AS',
    label: 'Adultos Solteros (AS)',
    shortLabel: 'AS',
    hasBudget: true,
    budgetOrgCode: 'AS',
    defaultExtraRole: 'LIDER',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      { slot_key: 'as-rep-1', calling: 'Representante de AS (Varón)', defaultRole: 'LIDER' },
      { slot_key: 'as-rep-2', calling: 'Representante de AS (Mujer)', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'CFS',
    label: 'Centro FamilySearch (CFS)',
    shortLabel: 'CFS',
    hasBudget: true,
    budgetOrgCode: 'CFS',
    defaultExtraRole: 'LIDER',
    maxExtras: 2,
    extraLabel: 'Agregar auxiliar de CFS',
    fixedSlots: [
      { slot_key: 'cfs-director', calling: 'Director/a CFS', defaultRole: 'LIDER' },
    ],
  },
  {
    code: 'BIENESTAR',
    label: 'Bienestar y Autosuficiencia',
    shortLabel: 'Bienestar',
    hasBudget: false,
    budgetOrgCode: 'ESTACA',
    defaultExtraRole: 'CONSULTA',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      {
        slot_key: 'bien-esp-servicios',
        calling: 'Especialista en Servicios de Bienestar y Autosuficiencia de Estaca',
        defaultRole: 'CONSULTA',
      },
      {
        slot_key: 'bien-esp-educacion',
        calling: 'Especialista de Bienestar y Autosuficiencia asignada a Educación',
        defaultRole: 'CONSULTA',
      },
      {
        slot_key: 'bien-facilitadora',
        calling: 'Facilitadora de Educación para un Mejor Empleo',
        defaultRole: 'CONSULTA',
      },
    ],
  },
  {
    code: 'MUSICA',
    label: 'Música',
    shortLabel: 'Música',
    hasBudget: false,
    budgetOrgCode: 'ESTACA',
    defaultExtraRole: 'CONSULTA',
    maxExtras: 3,
    extraLabel: 'Agregar secretario auxiliar o asesor',
    fixedSlots: [
      {
        slot_key: 'mus-coordinador',
        calling: 'Coordinador de música de estaca',
        defaultRole: 'CONSULTA',
      },
      { slot_key: 'mus-asesor', calling: 'Asesor musical', defaultRole: 'CONSULTA' },
      { slot_key: 'mus-especialista', calling: 'Especialista en música', defaultRole: 'CONSULTA' },
    ],
  },
];

export const DIRECTORY_ORG_BY_CODE: Record<DirectoryOrgCode, DirectoryOrgDefinition> =
  STAKE_ORG_STRUCTURE.reduce((acc, item) => {
    acc[item.code] = item;
    return acc;
  }, {} as Record<DirectoryOrgCode, DirectoryOrgDefinition>);
