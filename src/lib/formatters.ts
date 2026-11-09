import { OrganizationCode, QuarterCode } from '../types/database';

/**
 * Regla Sagrada #4 (Constitution):
 * Formato numérico oficial: `#.##0,00` (punto para miles, coma para decimales).
 * En interfaz se antepone `$ ` -> `$ #.##0,00`.
 */
export function formatCurrency(amount: number | null | undefined, includeSymbol = true): string {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const isNegative = safeNum < 0;
  const absVal = Math.abs(safeNum);

  const [integerPart, decimalPart] = absVal.toFixed(2).split('.');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedNumber = `${withThousands},${decimalPart}`;

  if (!includeSymbol) {
    return isNegative ? `-${formattedNumber}` : formattedNumber;
  }

  return isNegative ? `-$ ${formattedNumber}` : `$ ${formattedNumber}`;
}

/**
 * Formato oficial de fecha: `dd/mm/aaaa`
 * Evita desfasajes de zona horaria parseando directamente componentes YYYY-MM-DD.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const clean = dateString.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const y = parsed.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Determina el trimestre (T1-T4) a partir de una fecha YYYY-MM-DD
 */
export function getQuarterFromDate(dateString: string): QuarterCode {
  const clean = dateString.trim().slice(0, 10);
  const parts = clean.split('-');
  const month = parts.length === 3 ? parseInt(parts[1], 10) : new Date(dateString).getMonth() + 1;

  if (month <= 3) return 'T1';
  if (month <= 6) return 'T2';
  if (month <= 9) return 'T3';
  return 'T4';
}

export const ORGANIZATION_LABELS: Record<OrganizationCode, string> = {
  MJ: 'Mujeres Jóvenes',
  HJ: 'Hombres Jóvenes',
  SEMINARIO: 'Seminario',
  SS: 'Sociedad de Socorro',
  PRIMARIA: 'Primaria',
  JAS: 'Jóvenes Adultos Solteros',
  AS: 'Adultos Solteros',
  CFS: 'Centro FamilySearch',
  ESTACA: 'Fondos Generales de Estaca',
  TODAS: 'Todas las Organizaciones',
};

export const ORGANIZATION_SHORT_LABELS: Record<OrganizationCode, string> = {
  MJ: 'MMJJ',
  HJ: 'HHJJ',
  SEMINARIO: 'Seminario',
  SS: 'Soc. Socorro',
  PRIMARIA: 'Primaria',
  JAS: 'JAS',
  AS: 'Adultos Solteros',
  CFS: 'FamilySearch',
  ESTACA: 'Estaca',
  TODAS: 'Todas',
};

/**
 * Regla Sagrada #9: Confidencialidad de Costo Estimado en Actividades de Calendario
 * El campo `estimated_cost` y el distintivo visual `💰 Con Presupuesto` son visibles
 * únicamente para Administradores, Presidencia de Estaca y líderes de la organización anfitriona
 * (incluyendo MJ y HJ para eventos de SEMINARIO).
 */
export function canViewActivityBudget(
  userRole: string,
  userOrg: OrganizationCode,
  activityOrg: OrganizationCode
): boolean {
  if (userRole === 'ADMIN' || userRole === 'PRESIDENCIA') {
    return true;
  }
  if (userRole !== 'LIDER') {
    return false;
  }
  if (userOrg === activityOrg) {
    return true;
  }
  if ((userOrg === 'MJ' || userOrg === 'HJ') && activityOrg === 'SEMINARIO') {
    return true;
  }
  return false;
}
