import { BudgetIncomeEntry, ExpenseRecord, QuarterCode } from '../types/database';
import { INITIAL_OPENING_BALANCE_2026 } from '../data/seedData';
import { isExpenseApplied } from './formatters';

export interface YearIncomeSummary {
  openingBalanceRow?: BudgetIncomeEntry;
  hasSavedOpeningBalance: boolean;
  appliedOpeningBalance: number;
  quarterIncomesOnly: Record<QuarterCode, number>;
  quarterTotals: Record<QuarterCode, number>;
  annualIncomesOnly: number;
  annualTotalAvailable: number;
}

export interface ClosingCapStats {
  annualIncomesOnly: number;
  annualTotalAvailable: number;
  totalSpent: number;
  remainingBalance: number;
  cap50: number;
  excessOverCap: number;
  hasRisk: boolean;
  suggestedNextYearCarryOver: number;
  hasT4Incomes: boolean;
}

export interface SuggestedOpeningBalance {
  isAvailable: boolean;
  suggestedAmount: number;
  rawRemaining: number;
  excessOverCap: number;
  sourceYear: number;
}

export function getExpenseEffectiveDate(e: Pick<ExpenseRecord, 'activity_date' | 'expense_date'>): string {
  return (e.activity_date && e.activity_date.trim()) || e.expense_date;
}

export function getQuarterFromDate(dateStr: string): QuarterCode {
  const month = parseInt(dateStr.slice(5, 7), 10);
  if (month <= 3) return 'T1';
  if (month <= 6) return 'T2';
  if (month <= 9) return 'T3';
  return 'T4';
}

/**
 * Calcula los totales de ingresos de un año a partir de `budget_incomes`.
 * Separa el Saldo Inicial de T1 de los ingresos propios de los 4 trimestres.
 */
export function computeYearIncomeSummary(
  incomes: BudgetIncomeEntry[],
  year: number
): YearIncomeSummary {
  const yearRows = incomes.filter((i) => Number(i.year) === year);
  const openingBalanceRow = yearRows.find((i) => i.entry_type === 'SALDO_INICIAL');
  const hasSavedOpeningBalance = Boolean(openingBalanceRow);
  const appliedOpeningBalance = openingBalanceRow
    ? Number(Number(openingBalanceRow.amount).toFixed(2))
    : 0;

  const quarterIncomesOnly: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  yearRows.forEach((row) => {
    if (row.entry_type === 'SALDO_INICIAL') return;
    quarterIncomesOnly[row.quarter] += Number(row.amount) || 0;
  });

  (['T1', 'T2', 'T3', 'T4'] as QuarterCode[]).forEach((q) => {
    quarterIncomesOnly[q] = Number(quarterIncomesOnly[q].toFixed(2));
  });

  const quarterTotals: Record<QuarterCode, number> = {
    T1: Number((appliedOpeningBalance + quarterIncomesOnly.T1).toFixed(2)),
    T2: quarterIncomesOnly.T2,
    T3: quarterIncomesOnly.T3,
    T4: quarterIncomesOnly.T4,
  };

  const annualIncomesOnly = Number(
    (
      quarterIncomesOnly.T1 +
      quarterIncomesOnly.T2 +
      quarterIncomesOnly.T3 +
      quarterIncomesOnly.T4
    ).toFixed(2)
  );

  const annualTotalAvailable = Number((appliedOpeningBalance + annualIncomesOnly).toFixed(2));

  return {
    openingBalanceRow,
    hasSavedOpeningBalance,
    appliedOpeningBalance,
    quarterIncomesOnly,
    quarterTotals,
    annualIncomesOnly,
    annualTotalAvailable,
  };
}

/**
 * Calcula el Monitor de Quita al Cierre (Regla del 50% del Área):
 * Si el saldo al 31/12 supera el 50% de la suma de los 4 ingresos del año (sin saldo inicial),
 * se descuenta el excedente.
 */
export function computeClosingCapStats(
  incomes: BudgetIncomeEntry[],
  expenses: ExpenseRecord[],
  year: number
): ClosingCapStats {
  const summary = computeYearIncomeSummary(incomes, year);

  const totalSpent = Number(
    expenses
      .filter((e) => {
        if (e.is_reimbursable_oai || e.status === 'REEMBOLSADO_OAI') return false;
        if (!isExpenseApplied(e)) return false;
        const effectiveDate = getExpenseEffectiveDate(e);
        return parseInt(effectiveDate.slice(0, 4), 10) === year;
      })
      .reduce((acc, e) => acc + Number(e.net_amount || 0), 0)
      .toFixed(2)
  );

  const remainingBalance = Number((summary.annualTotalAvailable - totalSpent).toFixed(2));
  const cap50 = Number((summary.annualIncomesOnly * 0.5).toFixed(2));
  const hasRisk = summary.annualIncomesOnly > 0 && remainingBalance > cap50;
  const excessOverCap = hasRisk ? Number((remainingBalance - cap50).toFixed(2)) : 0;
  const suggestedNextYearCarryOver =
    summary.annualIncomesOnly > 0
      ? Number(Math.max(0, remainingBalance - excessOverCap).toFixed(2))
      : 0;

  return {
    annualIncomesOnly: summary.annualIncomesOnly,
    annualTotalAvailable: summary.annualTotalAvailable,
    totalSpent,
    remainingBalance,
    cap50,
    excessOverCap,
    hasRisk,
    suggestedNextYearCarryOver,
    hasT4Incomes: summary.quarterIncomesOnly.T4 > 0,
  };
}

/**
 * Calcula la sugerencia en vivo del Saldo Inicial para `targetYear` desde `targetYear - 1`.
 * Se activa cuando el año anterior ya tiene ingresos cargados en T4.
 */
export function computeSuggestedOpeningBalance(
  allIncomes: BudgetIncomeEntry[],
  allExpenses: ExpenseRecord[],
  targetYear: number
): SuggestedOpeningBalance {
  const prevYear = targetYear - 1;

  if (targetYear === 2026) {
    return {
      isAvailable: true,
      suggestedAmount: INITIAL_OPENING_BALANCE_2026,
      rawRemaining: INITIAL_OPENING_BALANCE_2026,
      excessOverCap: 0,
      sourceYear: 2025,
    };
  }

  const prevStats = computeClosingCapStats(allIncomes, allExpenses, prevYear);
  if (!prevStats.hasT4Incomes) {
    return {
      isAvailable: false,
      suggestedAmount: 0,
      rawRemaining: 0,
      excessOverCap: 0,
      sourceYear: prevYear,
    };
  }

  return {
    isAvailable: true,
    suggestedAmount: prevStats.suggestedNextYearCarryOver,
    rawRemaining: prevStats.remainingBalance,
    excessOverCap: prevStats.excessOverCap,
    sourceYear: prevYear,
  };
}
