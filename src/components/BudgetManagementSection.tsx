import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCurrency, ORGANIZATION_LABELS } from '../lib/formatters';
import {
  computeSuggestedOpeningBalance,
  computeYearIncomeSummary,
} from '../lib/budgetUtils';
import {
  BudgetAllocation,
  BudgetIncomeEntry,
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
} from '../types/database';

const EDITABLE_BUDGET_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'SEMINARIO',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
];

const ALL_BUDGET_ORGS: OrganizationCode[] = [...EDITABLE_BUDGET_ORGS, 'ESTACA'];
const QUARTERS: QuarterCode[] = ['T1', 'T2', 'T3', 'T4'];

interface BudgetManagementSectionProps {
  year: number;
  budgets: BudgetAllocation[];
  budgetIncomes: BudgetIncomeEntry[];
  expenses: ExpenseRecord[];
  onSaveBudgetAllocation: (
    allocation: Omit<BudgetAllocation, 'id' | 'total_assigned'> & { id?: number }
  ) => Promise<void>;
  onSaveOpeningBalance: (year: number, amount: number, lcrRef?: string) => Promise<void>;
  onSaveQuarterIncomes: (
    year: number,
    quarter: QuarterCode,
    unitRows: Array<{ slot_index: number; amount: number; lcr_ref: string }>,
    adjustments: Array<{ id?: number; amount: number; description: string; lcr_ref: string }>
  ) => Promise<void>;
  onResetFutureYearProjection: (year: number) => Promise<void>;
  onSavedToast: (msg: string) => void;
  controlledSubTab?: 'INCOMES' | 'DISTRIBUTION';
  onControlledSubTabChange?: (tab: 'INCOMES' | 'DISTRIBUTION') => void;
  hideHeader?: boolean;
}

interface RowDraft {
  id?: number;
  t1: string;
  t2: string;
  t3: string;
  t4: string;
  dirty: boolean;
  saving: boolean;
}

type QuarterField = 't1' | 't2' | 't3' | 't4';

interface UnitIncomeDraft {
  slot_index: number;
  amount: string;
  lcr_ref: string;
}

interface AdjustmentDraft {
  localKey: string;
  id?: number;
  amount: string;
  description: string;
  lcr_ref: string;
}

interface QuarterIncomeDraftState {
  units: UnitIncomeDraft[];
  adjustments: AdjustmentDraft[];
  editing: boolean;
  dirty: boolean;
  saving: boolean;
}

/**
 * Parsea un string numérico en formato `15.000,50` o `-7.629,60` a número.
 */
function parseLocaleAmount(raw: string, allowNegative = false): number {
  const clean = raw.trim();
  if (!clean) return 0;

  let n: number;
  if (clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    n = parseFloat(normalized);
  } else {
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      n = parseFloat(clean.replace(/\./g, ''));
    } else {
      n = parseFloat(clean);
    }
  }

  if (!Number.isFinite(n)) return 0;
  if (!allowNegative && n < 0) return 0;
  return Number(n.toFixed(2));
}

function formatSignedCurrency(val: number): string {
  if (val < 0) {
    return `-$ ${formatCurrency(Math.abs(val), false)}`;
  }
  return formatCurrency(val, true);
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0,0%';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
}

export const BudgetManagementSection: React.FC<BudgetManagementSectionProps> = ({
  year,
  budgets,
  budgetIncomes,
  expenses,
  onSaveBudgetAllocation,
  onSaveOpeningBalance,
  onSaveQuarterIncomes,
  onResetFutureYearProjection,
  onSavedToast,
  controlledSubTab,
  onControlledSubTabChange,
  hideHeader = false,
}) => {
  const currentCalendarYear = new Date().getFullYear();
  const isFutureProjectionYear = year > currentCalendarYear;

  const [internalSubTab, setInternalSubTab] = useState<'INCOMES' | 'DISTRIBUTION'>('INCOMES');
  const activeSubTab = controlledSubTab ?? internalSubTab;
  const setActiveSubTab = onControlledSubTabChange ?? setInternalSubTab;
  const [mobileQuarter, setMobileQuarter] = useState<QuarterCode>('T1');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ==================== ESTADO: SALDO INICIAL T1 ====================
  const incomeSummary = useMemo(
    () => computeYearIncomeSummary(budgetIncomes, year),
    [budgetIncomes, year]
  );

  const suggestedOpening = useMemo(
    () => computeSuggestedOpeningBalance(budgetIncomes, expenses, year),
    [budgetIncomes, expenses, year]
  );

  const [openingInput, setOpeningInput] = useState<string>('');
  const [openingFocused, setOpeningFocused] = useState(false);
  const [openingEditing, setOpeningEditing] = useState(false);
  const [openingClearedToSuggestion, setOpeningClearedToSuggestion] = useState(false);
  const [openingSaving, setOpeningSaving] = useState(false);

  useEffect(() => {
    setConfirmResetOpen(false);
    if (incomeSummary.hasSavedOpeningBalance) {
      setOpeningInput(formatCurrency(incomeSummary.appliedOpeningBalance, false));
      setOpeningEditing(false);
      setOpeningClearedToSuggestion(false);
    } else if (suggestedOpening.isAvailable) {
      setOpeningInput(formatCurrency(suggestedOpening.suggestedAmount, false));
      setOpeningEditing(true);
      setOpeningClearedToSuggestion(true);
    } else {
      setOpeningInput('');
      setOpeningEditing(true);
      setOpeningClearedToSuggestion(false);
    }
  }, [
    year,
    incomeSummary.hasSavedOpeningBalance,
    incomeSummary.appliedOpeningBalance,
    suggestedOpening.isAvailable,
    suggestedOpening.suggestedAmount,
  ]);

  // ==================== ESTADO: INGRESOS T1-T4 ====================
  const [quarterDrafts, setQuarterDrafts] = useState<Record<QuarterCode, QuarterIncomeDraftState>>(
    {} as Record<QuarterCode, QuarterIncomeDraftState>
  );
  const [focusedIncomeCell, setFocusedIncomeCell] = useState<string | null>(null);
  const [openAdjustments, setOpenAdjustments] = useState<Record<QuarterCode, boolean>>({
    T1: false,
    T2: false,
    T3: false,
    T4: false,
  });

  useEffect(() => {
    const next = {} as Record<QuarterCode, QuarterIncomeDraftState>;
    QUARTERS.forEach((q) => {
      const qRows = budgetIncomes.filter((i) => Number(i.year) === year && i.quarter === q);
      const unitRows: UnitIncomeDraft[] = Array.from({ length: 7 }, (_, idx) => {
        const slot = idx + 1;
        const found = qRows.find(
          (r) => r.entry_type === 'INGRESO_UNIDAD' && Number(r.slot_index) === slot
        );
        return {
          slot_index: slot,
          amount: formatCurrency(found ? Number(found.amount) : 0, false),
          lcr_ref: found?.lcr_ref || '',
        };
      });
      const adjRows: AdjustmentDraft[] = qRows
        .filter((r) => r.entry_type === 'AJUSTE')
        .map((r, idx) => ({
          localKey: `adj-${q}-${r.id}-${idx}`,
          id: r.id,
          amount:
            Number(r.amount) < 0
              ? `-${formatCurrency(Math.abs(Number(r.amount)), false)}`
              : formatCurrency(Number(r.amount), false),
          description: r.description || '',
          lcr_ref: r.lcr_ref || '',
        }));

      const hasSavedData =
        qRows.some((r) => r.entry_type === 'INGRESO_UNIDAD' && Number(r.amount) !== 0) ||
        adjRows.length > 0;

      next[q] = {
        units: unitRows,
        adjustments: adjRows,
        editing: !hasSavedData,
        dirty: false,
        saving: false,
      };
    });
    setQuarterDrafts(next);
  }, [budgetIncomes, year]);

  // Totales en vivo de cada trimestre (para mostrar arriba de cada columna y alimentar Distribución)
  const liveQuarterIncomeTotals = useMemo(() => {
    const totals: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    QUARTERS.forEach((q) => {
      const qd = quarterDrafts[q];
      let sum = 0;
      if (qd) {
        qd.units.forEach((u) => {
          sum += parseLocaleAmount(u.amount, false);
        });
        qd.adjustments.forEach((a) => {
          sum += parseLocaleAmount(a.amount, true);
        });
      }
      if (q === 'T1' && incomeSummary.hasSavedOpeningBalance && !openingClearedToSuggestion) {
        sum += incomeSummary.appliedOpeningBalance;
      }
      totals[q] = Number(sum.toFixed(2));
    });
    return totals;
  }, [
    quarterDrafts,
    incomeSummary.hasSavedOpeningBalance,
    incomeSummary.appliedOpeningBalance,
    openingClearedToSuggestion,
  ]);

  const liveAnnualIncomeTotal = useMemo(
    () =>
      Number(
        (
          liveQuarterIncomeTotals.T1 +
          liveQuarterIncomeTotals.T2 +
          liveQuarterIncomeTotals.T3 +
          liveQuarterIncomeTotals.T4
        ).toFixed(2)
      ),
    [liveQuarterIncomeTotals]
  );

  // ==================== HANDLERS SALDO INICIAL ====================
  const handleOpeningChange = (val: string) => {
    if (val.trim() === '') {
      setOpeningClearedToSuggestion(true);
      setOpeningInput('');
      return;
    }
    setOpeningClearedToSuggestion(false);
    setOpeningInput(val);
  };

  const handleOpeningBlur = () => {
    setOpeningFocused(false);
    if (openingInput.trim() === '') {
      setOpeningClearedToSuggestion(true);
      if (suggestedOpening.isAvailable) {
        setOpeningInput(formatCurrency(suggestedOpening.suggestedAmount, false));
      }
      return;
    }
    const parsed = parseLocaleAmount(openingInput, false);
    setOpeningInput(formatCurrency(parsed, false));
  };

  const handleOpeningFocus = () => {
    setOpeningFocused(true);
    if (!openingInput.trim()) return;
    const parsed = parseLocaleAmount(openingInput, false);
    setOpeningInput(parsed === 0 && !incomeSummary.hasSavedOpeningBalance ? '' : String(parsed).replace('.', ','));
  };

  const handleSaveOpening = async () => {
    if (openingSaving) return;
    const valToSave =
      openingInput.trim() === ''
        ? suggestedOpening.isAvailable
          ? suggestedOpening.suggestedAmount
          : 0
        : parseLocaleAmount(openingInput, false);

    setOpeningSaving(true);
    try {
      await onSaveOpeningBalance(year, valToSave, `APERTURA-${year}`);
      setOpeningClearedToSuggestion(false);
      setOpeningEditing(false);
      setOpeningInput(formatCurrency(valToSave, false));
      onSavedToast(`Saldo inicial ${year} aplicado (${formatCurrency(valToSave)}).`);
    } finally {
      setOpeningSaving(false);
    }
  };

  // ==================== HANDLERS INGRESOS T1-T4 ====================
  const handleUnitAmountChange = (q: QuarterCode, slotIdx: number, val: string) => {
    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: {
        ...prev[q],
        dirty: true,
        units: prev[q].units.map((u) =>
          u.slot_index === slotIdx ? { ...u, amount: val } : u
        ),
      },
    }));
  };

  const handleUnitRefChange = (q: QuarterCode, slotIdx: number, val: string) => {
    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: {
        ...prev[q],
        dirty: true,
        units: prev[q].units.map((u) =>
          u.slot_index === slotIdx ? { ...u, lcr_ref: val } : u
        ),
      },
    }));
  };

  const handleAddAdjustment = (q: QuarterCode) => {
    setOpenAdjustments((prev) => ({ ...prev, [q]: true }));
    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: {
        ...prev[q],
        editing: true,
        dirty: true,
        adjustments: [
          ...prev[q].adjustments,
          {
            localKey: `adj-new-${q}-${Date.now()}-${Math.random()}`,
            amount: '',
            description: '',
            lcr_ref: '',
          },
        ],
      },
    }));
  };

  const handleUpdateAdjustment = (
    q: QuarterCode,
    localKey: string,
    field: 'amount' | 'description' | 'lcr_ref',
    val: string
  ) => {
    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: {
        ...prev[q],
        dirty: true,
        adjustments: prev[q].adjustments.map((a) =>
          a.localKey === localKey ? { ...a, [field]: val } : a
        ),
      },
    }));
  };

  const handleRemoveAdjustment = (q: QuarterCode, localKey: string) => {
    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: {
        ...prev[q],
        dirty: true,
        adjustments: prev[q].adjustments.filter((a) => a.localKey !== localKey),
      },
    }));
  };

  const handleSaveQuarter = async (q: QuarterCode) => {
    const qd = quarterDrafts[q];
    if (!qd || qd.saving) return;

    setQuarterDrafts((prev) => ({
      ...prev,
      [q]: { ...prev[q], saving: true },
    }));

    try {
      await onSaveQuarterIncomes(
        year,
        q,
        qd.units.map((u) => ({
          slot_index: u.slot_index,
          amount: parseLocaleAmount(u.amount, false),
          lcr_ref: u.lcr_ref.trim(),
        })),
        qd.adjustments
          .filter((a) => parseLocaleAmount(a.amount, true) !== 0 || a.description.trim() !== '')
          .map((a) => ({
            id: a.id,
            amount: parseLocaleAmount(a.amount, true),
            description: a.description.trim() || `Ajuste ${q}`,
            lcr_ref: a.lcr_ref.trim(),
          }))
      );
      setQuarterDrafts((prev) => ({
        ...prev,
        [q]: { ...prev[q], dirty: false, editing: false, saving: false },
      }));
      onSavedToast(`Ingresos ${q} (${year}) guardados correctamente.`);
    } catch {
      setQuarterDrafts((prev) => ({
        ...prev,
        [q]: { ...prev[q], saving: false },
      }));
    }
  };

  // ==================== ESTADO: DISTRIBUCIÓN POR ORGANIZACIÓN ====================
  const [drafts, setDrafts] = useState<Record<OrganizationCode, RowDraft>>(
    {} as Record<OrganizationCode, RowDraft>
  );
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [savingAllDistribution, setSavingAllDistribution] = useState(false);

  useEffect(() => {
    const next = {} as Record<OrganizationCode, RowDraft>;
    ALL_BUDGET_ORGS.forEach((org) => {
      const existing = budgets.find((b) => b.organization === org && Number(b.year) === year);
      next[org] = {
        id: existing?.id,
        t1: formatCurrency(existing ? Number(existing.t1_assigned) : 0, false),
        t2: formatCurrency(existing ? Number(existing.t2_assigned) : 0, false),
        t3: formatCurrency(existing ? Number(existing.t3_assigned) : 0, false),
        t4: formatCurrency(existing ? Number(existing.t4_assigned) : 0, false),
        dirty: false,
        saving: false,
      };
    });
    setDrafts(next);
  }, [budgets, year]);

  // Suma de las 8 organizaciones editables
  const orgs8Totals = useMemo(() => {
    const totals: Record<QuarterField, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };
    EDITABLE_BUDGET_ORGS.forEach((org) => {
      const d = drafts[org];
      if (!d) return;
      totals.t1 += parseLocaleAmount(d.t1);
      totals.t2 += parseLocaleAmount(d.t2);
      totals.t3 += parseLocaleAmount(d.t3);
      totals.t4 += parseLocaleAmount(d.t4);
    });
    return {
      t1: Number(totals.t1.toFixed(2)),
      t2: Number(totals.t2.toFixed(2)),
      t3: Number(totals.t3.toFixed(2)),
      t4: Number(totals.t4.toFixed(2)),
    };
  }, [drafts]);

  // Estaca automática = Total Ingresos Trimestre - Suma 8 organizaciones
  const estacaAuto = useMemo(() => {
    return {
      t1: Number((liveQuarterIncomeTotals.T1 - orgs8Totals.t1).toFixed(2)),
      t2: Number((liveQuarterIncomeTotals.T2 - orgs8Totals.t2).toFixed(2)),
      t3: Number((liveQuarterIncomeTotals.T3 - orgs8Totals.t3).toFixed(2)),
      t4: Number((liveQuarterIncomeTotals.T4 - orgs8Totals.t4).toFixed(2)),
    };
  }, [liveQuarterIncomeTotals, orgs8Totals]);

  const negativeQuarters = useMemo(() => {
    const list: QuarterCode[] = [];
    if (estacaAuto.t1 < 0) list.push('T1');
    if (estacaAuto.t2 < 0) list.push('T2');
    if (estacaAuto.t3 < 0) list.push('T3');
    if (estacaAuto.t4 < 0) list.push('T4');
    return list;
  }, [estacaAuto]);

  const hasNegativeEstaca = negativeQuarters.length > 0;
  const anyDirtyDistribution = EDITABLE_BUDGET_ORGS.some((org) => drafts[org]?.dirty);

  const handleFieldChange = (org: OrganizationCode, field: QuarterField, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: value,
        dirty: true,
      },
    }));
  };

  const handleFieldFocus = (org: OrganizationCode, field: QuarterField) => {
    const key = `${org}-${field}`;
    setFocusedCell(key);
    const d = drafts[org];
    if (!d) return;
    const numericVal = parseLocaleAmount(d[field]);
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: numericVal === 0 ? '' : String(numericVal).replace('.', ','),
      },
    }));
  };

  const handleFieldBlur = (org: OrganizationCode, field: QuarterField) => {
    setFocusedCell(null);
    const d = drafts[org];
    if (!d) return;
    const numericVal = parseLocaleAmount(d[field]);
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: formatCurrency(numericVal, false),
      },
    }));
  };

  const saveEstacaRow = async () => {
    const estacaExisting = budgets.find(
      (b) => b.organization === 'ESTACA' && Number(b.year) === year
    );
    await onSaveBudgetAllocation({
      id: estacaExisting?.id,
      year,
      organization: 'ESTACA',
      t1_assigned: estacaAuto.t1,
      t2_assigned: estacaAuto.t2,
      t3_assigned: estacaAuto.t3,
      t4_assigned: estacaAuto.t4,
      notes: 'Estaca (Remanente Disponible)',
    });
  };

  const handleSaveRow = async (org: OrganizationCode) => {
    if (hasNegativeEstaca) return;
    const d = drafts[org];
    if (!d || d.saving) return;

    setDrafts((prev) => ({
      ...prev,
      [org]: { ...prev[org], saving: true },
    }));

    try {
      await onSaveBudgetAllocation({
        id: d.id,
        year,
        organization: org,
        t1_assigned: parseLocaleAmount(d.t1),
        t2_assigned: parseLocaleAmount(d.t2),
        t3_assigned: parseLocaleAmount(d.t3),
        t4_assigned: parseLocaleAmount(d.t4),
      });
      await saveEstacaRow();
      setDrafts((prev) => ({
        ...prev,
        [org]: { ...prev[org], dirty: false, saving: false },
      }));
      onSavedToast(`Presupuesto ${year} de ${ORGANIZATION_LABELS[org]} guardado y Estaca actualizada.`);
    } catch {
      setDrafts((prev) => ({
        ...prev,
        [org]: { ...prev[org], saving: false },
      }));
    }
  };

  const handleSaveAllDistribution = async () => {
    if (hasNegativeEstaca || savingAllDistribution) return;
    setSavingAllDistribution(true);
    try {
      for (const org of EDITABLE_BUDGET_ORGS) {
        const d = drafts[org];
        if (!d || !d.dirty) continue;
        await onSaveBudgetAllocation({
          id: d.id,
          year,
          organization: org,
          t1_assigned: parseLocaleAmount(d.t1),
          t2_assigned: parseLocaleAmount(d.t2),
          t3_assigned: parseLocaleAmount(d.t3),
          t4_assigned: parseLocaleAmount(d.t4),
        });
      }
      await saveEstacaRow();
      setDrafts((prev) => {
        const updated = { ...prev };
        EDITABLE_BUDGET_ORGS.forEach((org) => {
          if (updated[org]) updated[org] = { ...updated[org], dirty: false };
        });
        return updated;
      });
      onSavedToast(`Distribución de presupuestos ${year} guardada.`);
    } finally {
      setSavingAllDistribution(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!isFutureProjectionYear || resetting) return;
    setResetting(true);
    try {
      await onResetFutureYearProjection(year);
      setConfirmResetOpen(false);
      onSavedToast(`Proyección de ${year} restablecida en cero.`);
    } finally {
      setResetting(false);
    }
  };

  const renderQuarterColumn = (q: QuarterCode) => {
    const qd = quarterDrafts[q];
    if (!qd) return null;
    const qTotal = liveQuarterIncomeTotals[q];
    const adjustmentsTotal = Number(
      qd.adjustments
        .reduce((acc, a) => acc + parseLocaleAmount(a.amount, true), 0)
        .toFixed(2)
    );
    const isAdjOpen = Boolean(openAdjustments[q]);

    return (
      <div
        key={q}
        data-testid={`income-quarter-col-${q}`}
        className="rounded-2xl border border-slate-200/90 bg-slate-50/40 flex flex-col justify-between overflow-hidden"
      >
        <div>
          {/* Cabecera con Total arriba */}
          <div className="px-3.5 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                {q} · Total Trimestre
              </span>
              <span
                data-testid={`income-quarter-total-${q}`}
                className={`text-base font-extrabold tabular-nums ${
                  qTotal < 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {formatSignedCurrency(qTotal)}
              </span>
            </div>

            {qd.editing ? (
              <button
                type="button"
                data-testid={`save-quarter-income-${q}`}
                disabled={qd.saving}
                onClick={() => handleSaveQuarter(q)}
                className="pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold shadow-sm transition"
              >
                <Save className="w-3 h-3" />
                <span>{qd.saving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid={`edit-quarter-income-${q}`}
                onClick={() =>
                  setQuarterDrafts((prev) => ({
                    ...prev,
                    [q]: { ...prev[q], editing: true },
                  }))
                }
                className="pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition"
              >
                <Edit3 className="w-3 h-3" />
                <span>Editar</span>
              </button>
            )}
          </div>

          <div className="p-3 space-y-2.5">
            {/* 7 Filas de Ingresos (limpias, sin número de referencia) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-0.5">
                7 Ingresos del trimestre
              </span>
              {qd.units.map((u) => {
                const cellKey = `${q}-u-${u.slot_index}`;
                const isFocused = focusedIncomeCell === cellKey;
                const numVal = parseLocaleAmount(u.amount, false);

                return (
                  <div
                    key={u.slot_index}
                    className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80"
                  >
                    <span className="text-[11px] font-bold text-slate-500 flex-shrink-0">
                      Ingreso {u.slot_index}
                    </span>
                    <div className="relative flex-1 min-w-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!qd.editing}
                        value={isFocused ? u.amount : formatCurrency(numVal, false)}
                        onFocus={() => {
                          setFocusedIncomeCell(cellKey);
                          handleUnitAmountChange(
                            q,
                            u.slot_index,
                            numVal === 0 ? '' : String(numVal).replace('.', ',')
                          );
                        }}
                        onBlur={() => {
                          setFocusedIncomeCell(null);
                          handleUnitAmountChange(q, u.slot_index, formatCurrency(numVal, false));
                        }}
                        onChange={(e) => handleUnitAmountChange(q, u.slot_index, e.target.value)}
                        className="w-full pl-5 pr-2 py-1 rounded-lg border border-slate-200 focus:border-emerald-700 focus:outline-none text-right text-xs font-extrabold tabular-nums bg-white disabled:bg-slate-50/60 disabled:border-transparent disabled:text-slate-900"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tarjeta Acordeón de Ajustes (+ / -) */}
            {qd.adjustments.length > 0 && (
              <div
                data-testid={`adjustments-accordion-${q}`}
                className="rounded-xl bg-white border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenAdjustments((prev) => ({ ...prev, [q]: !prev[q] }))
                  }
                  className="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50/80 transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-extrabold text-slate-700">
                      Ajustes ({qd.adjustments.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`text-xs font-extrabold tabular-nums ${
                        adjustmentsTotal < 0 ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                    >
                      {formatSignedCurrency(adjustmentsTotal)}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isAdjOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isAdjOpen && (
                  <div className="px-2 pb-2 pt-1 border-t border-slate-100 space-y-1.5 bg-slate-50/50">
                    {qd.adjustments.map((adj, idx) => {
                      const cellKey = adj.localKey;
                      const isFocused = focusedIncomeCell === cellKey;
                      const numVal = parseLocaleAmount(adj.amount, true);

                      return (
                        <div
                          key={adj.localKey}
                          className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200/80"
                        >
                          <input
                            type="text"
                            disabled={!qd.editing}
                            value={adj.description}
                            onChange={(e) =>
                              handleUpdateAdjustment(q, adj.localKey, 'description', e.target.value)
                            }
                            placeholder={`Ajuste ${idx + 1}`}
                            className="w-24 sm:w-28 min-w-0 px-1.5 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 focus:outline-none focus:border-emerald-700 disabled:bg-transparent disabled:border-transparent truncate"
                          />
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!qd.editing}
                              value={
                                isFocused
                                  ? adj.amount
                                  : numVal < 0
                                  ? `-$ ${formatCurrency(Math.abs(numVal), false)}`
                                  : `$ ${formatCurrency(numVal, false)}`
                              }
                              onFocus={() => {
                                setFocusedIncomeCell(cellKey);
                                handleUpdateAdjustment(
                                  q,
                                  adj.localKey,
                                  'amount',
                                  numVal === 0 ? '' : String(numVal).replace('.', ',')
                                );
                              }}
                              onBlur={() => {
                                setFocusedIncomeCell(null);
                                handleUpdateAdjustment(
                                  q,
                                  adj.localKey,
                                  'amount',
                                  numVal < 0
                                    ? `-${formatCurrency(Math.abs(numVal), false)}`
                                    : formatCurrency(numVal, false)
                                );
                              }}
                              onChange={(e) =>
                                handleUpdateAdjustment(q, adj.localKey, 'amount', e.target.value)
                              }
                              placeholder="-0,00"
                              className={`w-full px-2 py-1 rounded-lg border border-slate-200 focus:border-emerald-700 focus:outline-none text-right text-xs font-extrabold tabular-nums disabled:bg-slate-50/60 disabled:border-transparent ${
                                numVal < 0 ? 'text-rose-700' : 'text-emerald-800'
                              }`}
                            />
                          </div>
                          {qd.editing && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAdjustment(q, adj.localKey)}
                              aria-label="Eliminar ajuste"
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botón Añadir Ajuste al pie */}
        <div className="p-3 pt-0">
          <button
            type="button"
            data-testid={`add-adjustment-${q}`}
            onClick={() => handleAddAdjustment(q)}
            className="pressable w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-900 text-[11px] font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir ajuste (+ / -)</span>
          </button>
        </div>
      </div>
    );
  };

  const openingDisplayVal = openingFocused
    ? openingInput
    : openingInput.trim() !== ''
    ? openingInput
    : suggestedOpening.isAvailable
    ? formatCurrency(suggestedOpening.suggestedAmount, false)
    : '0,00';

  const isOpeningApplied = incomeSummary.hasSavedOpeningBalance && !openingClearedToSuggestion;

  return (
    <div
      data-testid="budget-management-section"
      className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
    >
      {/* Cabecera principal: Título + Sub-pestañas + Total Anual (oculta cuando se fusiona en AdminOperationsCenter) */}
      {!hideHeader && (
      <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Presupuestos ({year})
            </h3>
            {isFutureProjectionYear && (
              <span
                data-testid="future-projection-badge"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-900 border border-sky-200"
              >
                <Sparkles className="w-3 h-3" />
                Año futuro · Modo proyección
              </span>
            )}
          </div>

          {/* Sub-pestañas integradas en la cabecera */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
            <button
              type="button"
              data-testid="budget-subtab-incomes"
              onClick={() => setActiveSubTab('INCOMES')}
              className={`pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition ${
                activeSubTab === 'INCOMES'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Ingresos del Año</span>
            </button>

            <button
              type="button"
              data-testid="budget-subtab-distribution"
              onClick={() => setActiveSubTab('DISTRIBUTION')}
              className={`pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition ${
                activeSubTab === 'DISTRIBUTION'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Distribución por Organización</span>
              {hasNegativeEstaca && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">
          {isFutureProjectionYear && (
            <button
              type="button"
              data-testid="reset-future-projection-btn"
              onClick={() => setConfirmResetOpen(true)}
              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-bold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar proyección</span>
            </button>
          )}

          <div className="text-left sm:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Anual Ingresado
            </span>
            <span
              data-testid="annual-income-grand-total"
              className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums"
            >
              {formatSignedCurrency(liveAnnualIncomeTotal)}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Confirmación de Limpiar Proyección (solo años futuros) */}
      {confirmResetOpen && isFutureProjectionYear && (
        <div className="px-5 py-3 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs font-bold text-rose-900">
            ¿Seguro que querés limpiar toda la proyección de {year} (saldo inicial, ingresos, ajustes y distribución)?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="confirm-reset-projection-btn"
              disabled={resetting}
              onClick={handleConfirmReset}
              className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
            >
              {resetting ? 'Limpiando...' : `Sí, limpiar ${year}`}
            </button>
          </div>
        </div>
      )}

      {/* ==================== SUB-PESTAÑA 1: INGRESOS DEL AÑO ==================== */}
      {activeSubTab === 'INCOMES' && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Opción A: Barra horizontal compacta de Saldo Inicial arriba de las 4 columnas */}
          <div
            data-testid="opening-balance-card"
            className={`px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isOpeningApplied
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Saldo Inicial {year} (se suma a T1)
                </span>
                {isOpeningApplied ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
                    <CheckCircle2 className="w-3 h-3" />
                    Aplicado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900">
                    Sin aplicar
                  </span>
                )}
              </div>

              {!isOpeningApplied && suggestedOpening.isAvailable && (
                <p className="text-[11px] text-amber-900/90">
                  Proyección en vivo desde cierre {suggestedOpening.sourceYear}:{' '}
                  <span className="font-bold tabular-nums">
                    {formatCurrency(suggestedOpening.suggestedAmount)}
                  </span>{' '}
                  (tocá Guardar para aplicar).
                  {suggestedOpening.excessOverCap > 0 && (
                    <span className="ml-1 text-rose-700 font-semibold">
                      · Incluye quita estimada 50% (-{formatCurrency(suggestedOpening.excessOverCap)})
                    </span>
                  )}
                </p>
              )}

              {!isOpeningApplied && !suggestedOpening.isAvailable && (
                <p className="text-[11px] text-slate-500">
                  Se sugerirá automáticamente al cargarse T4 de {year - 1}, o podés ingresar un monto manual.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative w-36 sm:w-40">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="opening-balance-input"
                  disabled={!openingEditing && isOpeningApplied}
                  value={openingDisplayVal}
                  onFocus={handleOpeningFocus}
                  onBlur={handleOpeningBlur}
                  onChange={(e) => handleOpeningChange(e.target.value)}
                  placeholder="0,00"
                  className={`w-full pl-6 pr-2.5 py-1.5 rounded-xl border text-right text-xs sm:text-sm font-extrabold tabular-nums transition ${
                    !openingEditing && isOpeningApplied
                      ? 'bg-white/80 border-emerald-200 text-emerald-950'
                      : 'bg-white border-slate-300 focus:border-emerald-700 focus:outline-none text-slate-900'
                  }`}
                />
              </div>

              {openingEditing || !isOpeningApplied ? (
                <button
                  type="button"
                  data-testid="save-opening-balance-btn"
                  disabled={openingSaving}
                  onClick={handleSaveOpening}
                  className="pressable inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{openingSaving ? '...' : 'Guardar'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="edit-opening-balance-btn"
                  onClick={() => setOpeningEditing(true)}
                  className="pressable inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              )}
            </div>
          </div>
          {/* Selector rápido en móvil */}
          <div className="grid grid-cols-4 gap-1.5 lg:hidden">
            {QUARTERS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setMobileQuarter(q)}
                className={`py-2 rounded-xl text-xs font-extrabold transition ${
                  mobileQuarter === q
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Vista móvil: 1 trimestre por vez */}
          <div className="lg:hidden">{renderQuarterColumn(mobileQuarter)}</div>

          {/* Vista escritorio: 4 columnas lado a lado */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-3.5">
            {QUARTERS.map((q) => renderQuarterColumn(q))}
          </div>
        </div>
      )}

      {/* ==================== SUB-PESTAÑA 2: DISTRIBUCIÓN POR ORGANIZACIÓN ==================== */}
      {activeSubTab === 'DISTRIBUTION' && (
        <div>
          {/* Barra de totales disponibles traídos de Ingresos */}
          <div className="px-5 py-3 bg-emerald-50/60 border-b border-emerald-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {QUARTERS.map((q) => (
              <div key={q} className="bg-white/90 rounded-xl px-3 py-2 border border-emerald-200/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Disponible {q}
                </span>
                <span className="font-extrabold text-slate-900 tabular-nums">
                  {formatSignedCurrency(liveQuarterIncomeTotals[q])}
                </span>
              </div>
            ))}
          </div>

          {/* Alerta roja si Estaca queda en negativo */}
          {hasNegativeEstaca && (
            <div
              data-testid="estaca-negative-alert"
              className="mx-5 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 flex items-start gap-2.5 text-xs text-rose-900"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold">
                  Guardado bloqueado: el reparto supera los ingresos en {negativeQuarters.join(', ')}.
                </p>
                <p className="text-rose-800">
                  La fila <strong>Estaca</strong> quedó en negativo. Reducí los montos asignados a las organizaciones hasta que Estaca sea igual o mayor a $ 0,00.
                </p>
              </div>
            </div>
          )}

          {/* Botón Guardar todo cuando hay cambios pendientes */}
          {anyDirtyDistribution && (
            <div className="px-5 pt-3 flex justify-end">
              <button
                type="button"
                data-testid="save-all-distribution-btn"
                disabled={hasNegativeEstaca || savingAllDistribution}
                onClick={handleSaveAllDistribution}
                className={`pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  hasNegativeEstaca
                    ? 'bg-rose-100 text-rose-400 cursor-not-allowed'
                    : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {savingAllDistribution ? 'Guardando cambios...' : 'Guardar todos los cambios'}
                </span>
              </button>
            </div>
          )}

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3">Organización</th>
                  <th className="py-3 px-1.5 text-right">T1 ($)</th>
                  <th className="py-3 px-1.5 text-right">T2 ($)</th>
                  <th className="py-3 px-1.5 text-right">T3 ($)</th>
                  <th className="py-3 px-1.5 text-right">T4 ($)</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {EDITABLE_BUDGET_ORGS.map((org) => {
                  const d = drafts[org];
                  if (!d) return null;
                  const rowTotal =
                    parseLocaleAmount(d.t1) +
                    parseLocaleAmount(d.t2) +
                    parseLocaleAmount(d.t3) +
                    parseLocaleAmount(d.t4);

                  return (
                    <tr key={org} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {ORGANIZATION_LABELS[org]}
                      </td>
                      {(['t1', 't2', 't3', 't4'] as const).map((field, idx) => {
                        const qKey = QUARTERS[idx];
                        const numVal = parseLocaleAmount(d[field]);
                        const pct = formatPercent(numVal, liveQuarterIncomeTotals[qKey]);
                        const cellKey = `${org}-${field}`;
                        const isFocused = focusedCell === cellKey;

                        return (
                          <td key={field} className="py-2 px-1">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] font-semibold text-slate-400 tabular-nums w-10 text-right">
                                {pct}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={isFocused ? d[field] : formatCurrency(numVal, false)}
                                onFocus={() => handleFieldFocus(org, field)}
                                onBlur={() => handleFieldBlur(org, field)}
                                onChange={(e) => handleFieldChange(org, field, e.target.value)}
                                className="w-20 sm:w-[88px] px-2 py-1 rounded-lg border border-slate-200 focus:border-emerald-700 focus:outline-none text-right text-xs font-semibold tabular-nums bg-white"
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatCurrency(rowTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!d.dirty || d.saving || hasNegativeEstaca}
                          onClick={() => handleSaveRow(org)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                            hasNegativeEstaca && d.dirty
                              ? 'bg-rose-100 text-rose-400 cursor-not-allowed'
                              : d.dirty
                              ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-400 cursor-default'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{d.saving ? 'Guardando' : 'Guardar'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Fila ESTACA automática (solo lectura) */}
                <tr
                  data-testid="estaca-auto-row"
                  className={hasNegativeEstaca ? 'bg-rose-50/90' : 'bg-emerald-50/40'}
                >
                  <td className="py-3 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{ORGANIZATION_LABELS.ESTACA}</span>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[9px] font-bold uppercase">
                        <Lock className="w-2.5 h-2.5" />
                        Auto
                      </span>
                    </div>
                  </td>
                  {(['t1', 't2', 't3', 't4'] as const).map((field, idx) => {
                    const qKey = QUARTERS[idx];
                    const val = estacaAuto[field];
                    const isNeg = val < 0;
                    const pct = formatPercent(val, liveQuarterIncomeTotals[qKey]);

                    return (
                      <td key={field} className="py-2.5 px-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`text-[10px] font-bold tabular-nums w-10 text-right ${
                              isNeg ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {pct}
                          </span>
                          <span
                            data-testid={`estaca-auto-${field}`}
                            className={`inline-block min-w-[82px] px-2 py-1 rounded-lg text-xs font-extrabold tabular-nums ${
                              isNeg
                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                : 'bg-white/80 text-emerald-900 border border-emerald-200/70'
                            }`}
                          >
                            {formatSignedCurrency(val)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className={`py-3 px-3 text-right font-extrabold tabular-nums whitespace-nowrap ${
                      estacaAuto.t1 + estacaAuto.t2 + estacaAuto.t3 + estacaAuto.t4 < 0
                        ? 'text-rose-700'
                        : 'text-emerald-900'
                    }`}
                  >
                    {formatSignedCurrency(
                      estacaAuto.t1 + estacaAuto.t2 + estacaAuto.t3 + estacaAuto.t4
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-[10px] font-bold text-slate-400">
                    Automático
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/90 text-xs font-extrabold text-slate-800">
                  <td className="py-3 px-3">Total del Trimestre (Ingresos)</td>
                  <td className="py-3 px-1.5 text-right tabular-nums">
                    {formatSignedCurrency(liveQuarterIncomeTotals.T1)}
                  </td>
                  <td className="py-3 px-1.5 text-right tabular-nums">
                    {formatSignedCurrency(liveQuarterIncomeTotals.T2)}
                  </td>
                  <td className="py-3 px-1.5 text-right tabular-nums">
                    {formatSignedCurrency(liveQuarterIncomeTotals.T3)}
                  </td>
                  <td className="py-3 px-1.5 text-right tabular-nums">
                    {formatSignedCurrency(liveQuarterIncomeTotals.T4)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatSignedCurrency(liveAnnualIncomeTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
