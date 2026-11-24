import {
  ActivityRecord,
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
  WithdrawalAllocationItem,
} from '../types/database';

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
 * Fecha local actual en formato YYYY-MM-DD (evita desfasajes UTC después de las 21:00 en UTC-3).
 */
export function getTodayLocalIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

/**
 * Devuelve la fecha efectiva del gasto para líderes y cálculo trimestral:
 * siempre prioriza la fecha de la actividad (`activity_date`) sobre la fecha contable (`expense_date`).
 */
export function getExpenseEffectiveDate(exp: {
  activity_date?: string | null;
  expense_date: string;
}): string {
  return (exp.activity_date && exp.activity_date.trim()) || exp.expense_date;
}

/**
 * Indica si un gasto es formal / aplicado (impacta en presupuesto real y LCR).
 * Los gastos proyectados de actividad o planificados sin fecha devuelven false.
 */
export function isExpenseApplied(
  exp: Pick<ExpenseRecord, 'is_applied' | 'expense_type'>
): boolean {
  if (exp.is_applied === false) return false;
  if (
    exp.expense_type === 'PROYECTADO_ACTIVIDAD' ||
    exp.expense_type === 'PLANIFICADO_SIN_FECHA'
  ) {
    return false;
  }
  return true;
}

/**
 * Devuelve las asignaciones a retiros en efectivo de un gasto (soporta hasta 2 retiros).
 */
export function getExpenseWithdrawalAllocations(
  exp: Pick<ExpenseRecord, 'withdrawal_allocations' | 'withdrawal_ref' | 'gross_amount'>
): WithdrawalAllocationItem[] {
  if (Array.isArray(exp.withdrawal_allocations) && exp.withdrawal_allocations.length > 0) {
    return exp.withdrawal_allocations.map((a) => ({
      withdrawal_ref: a.withdrawal_ref,
      amount: Number(a.amount || 0),
    }));
  }
  if (exp.withdrawal_ref) {
    return [{ withdrawal_ref: exp.withdrawal_ref, amount: Number(exp.gross_amount || 0) }];
  }
  return [];
}

/**
 * Consolida los gastos reales de una misma actividad en una sola línea para la vista del líder.
 * Los gastos sin `activity_id` se mantienen individuales.
 */
export function consolidateLeaderExpenses(
  expenses: ExpenseRecord[],
  activities: ActivityRecord[]
): ExpenseRecord[] {
  const byActivity = new Map<number, ExpenseRecord[]>();
  const standalone: ExpenseRecord[] = [];

  expenses.forEach((exp) => {
    if (exp.activity_id) {
      const list = byActivity.get(exp.activity_id) || [];
      list.push(exp);
      byActivity.set(exp.activity_id, list);
    } else {
      standalone.push(exp);
    }
  });

  const consolidated: ExpenseRecord[] = [...standalone];

  byActivity.forEach((group, actId) => {
    if (group.length === 1) {
      consolidated.push(group[0]);
      return;
    }
    const primary = group[0];
    const act = activities.find((a) => a.id === actId);
    const totalGross = Number(
      group.reduce((acc, r) => acc + Number(r.gross_amount), 0).toFixed(2)
    );
    const totalExt = Number(
      group.reduce((acc, r) => acc + Number(r.external_reimbursement || 0), 0).toFixed(2)
    );
    const totalNet = Number(
      group.reduce((acc, r) => acc + Number(r.net_amount), 0).toFixed(2)
    );

    consolidated.push({
      ...primary,
      concept: act ? act.title : primary.concept,
      supplier_name:
        group.length > 1 ? `${group.length} comprobantes vinculados` : primary.supplier_name,
      gross_amount: totalGross,
      external_reimbursement: totalExt,
      net_amount: totalNet,
    });
  });

  return consolidated.sort((a, b) =>
    getExpenseEffectiveDate(b).localeCompare(getExpenseEffectiveDate(a))
  );
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
  ESTACA: 'Presupuesto propio de Estaca',
  CHURCHWIDE: 'Churchwide Events',
  TODAS: 'Todas las Organizaciones',
};

export const ORGANIZATION_SHORT_LABELS: Record<OrganizationCode, string> = {
  MJ: 'MMJJ',
  HJ: 'HHJJ',
  SEMINARIO: 'Seminario',
  SS: 'Soc. Socorro',
  PRIMARIA: 'Primaria',
  JAS: 'JAS',
  AS: 'AS',
  CFS: 'FamilySearch',
  ESTACA: 'Estaca',
  CHURCHWIDE: 'Churchwide Events',
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

/**
 * Parser inteligente para el atajo rápido "MMDD-MONTO" (ADR-008 / Paso 6.4)
 * Ejemplo: "0315-1250" -> { isValid: true, date: '2026-03-15', amount: 1250, ref: '0315-1250' }
 */
export function parseMmddMontoShortcut(
  rawInput: string,
  year = new Date().getFullYear()
): { isValid: boolean; date?: string; amount?: number; ref?: string } {
  const clean = rawInput.trim();
  const match = /^(\d{2})(\d{2})-(\d+(?:[.,]\d{1,2})?)$/.exec(clean);
  if (!match) {
    return { isValid: false };
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const amount = parseFloat(match[3].replace(',', '.'));

  if (month < 1 || month > 12 || day < 1 || day > 31 || !Number.isFinite(amount) || amount <= 0) {
    return { isValid: false };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const isoDate = `${year}-${mm}-${dd}`;
  return {
    isValid: true,
    date: isoDate,
    amount,
    ref: `${mm}${dd}-${Math.round(amount)}`,
  };
}

/**
 * Genera el código MMDD-MONTO a partir de una fecha YYYY-MM-DD y un importe
 */
export function buildMmddMontoRef(isoDate: string, amount: number): string {
  const parts = isoDate.trim().slice(0, 10).split('-');
  if (parts.length !== 3) return '';
  const [, month, day] = parts;
  const rounded = Math.round(Number(amount) || 0);
  if (rounded <= 0) return '';
  return `${month.padStart(2, '0')}${day.padStart(2, '0')}-${rounded}`;
}

/**
 * Validación estricta de correo Google (@gmail.com).
 */
export function isValidGmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!clean) return false;
  return /^[a-z0-9._%+-]+@gmail\.com$/.test(clean);
}

/**
 * Normaliza un celular uruguayo legado (+598 9X XXX XXX) al formato canónico 09xxxxxxx (9 dígitos).
 */
export function normalizeUruguayanMobile(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (/^5989\d{7}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }
  if (/^009\d{7}$/.test(digits)) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Valida formato estricto de celular uruguayo sin espacios: 09xxxxxxx (9 dígitos).
 */
export function isValidUruguayanMobile(raw: string): boolean {
  const clean = raw.trim();
  if (!clean) return false;
  return /^09\d{7}$/.test(clean);
}

/**
 * Formatea un celular uruguayo 09xxxxxxx en grupos de 3 dígitos (09X XXX XXX) para lectura en directorio.
 */
export function formatUruguayanMobile(raw: string | null | undefined): string {
  const norm = normalizeUruguayanMobile(raw);
  if (!norm) return '';
  if (/^09\d{7}$/.test(norm)) {
    return `${norm.slice(0, 3)} ${norm.slice(3, 6)} ${norm.slice(6, 9)}`;
  }
  return raw?.trim() || norm;
}

/**
 * Genera el enlace oficial de WhatsApp (https://wa.me/5989xxxxxxx) a partir de 09xxxxxxx.
 */
export function toWhatsAppUrl(raw: string | null | undefined): string | null {
  const norm = normalizeUruguayanMobile(raw);
  if (!/^09\d{7}$/.test(norm)) return null;
  return `https://wa.me/598${norm.slice(1)}`;
}
