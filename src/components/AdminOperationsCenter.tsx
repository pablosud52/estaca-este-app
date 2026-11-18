import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getExpenseEffectiveDate,
  getExpenseWithdrawalAllocations,
  isExpenseApplied,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import {
  ActivityRecord,
  BudgetAllocation,
  BudgetIncomeEntry,
  CashWithdrawalRecord,
  ExpenseRecord,
  MovementType,
  QuarterCode,
  SupplierRecord,
} from '../types/database';
import { computeClosingCapStats, computeYearIncomeSummary } from '../lib/budgetUtils';
import { BudgetManagementSection } from './BudgetManagementSection';
import {
  ExpenseFormModal,
  ExpenseGroupEditData,
  OpenWithdrawalOption,
} from './ExpenseFormModal';
import { NewMovementModal } from './NewMovementModal';

const ExcelSyncPanel = lazy(() =>
  import('./ExcelSyncPanel').then((m) => ({ default: m.ExcelSyncPanel }))
);

interface AdminOperationsCenterProps {
  selectedYear?: number;
  budgets: BudgetAllocation[];
  budgetIncomes?: BudgetIncomeEntry[];
  expenses: ExpenseRecord[];
  allExpenses?: ExpenseRecord[];
  withdrawals: CashWithdrawalRecord[];
  activities: ActivityRecord[];
  suppliers: SupplierRecord[];
  onCreateExpense: (expense: Omit<ExpenseRecord, 'id'>) => Promise<void>;
  onCreateMultipleExpenses: (expensesList: Array<Omit<ExpenseRecord, 'id'>>) => Promise<void>;
  onSaveExpenseGroup?: (
    records: Array<Omit<ExpenseRecord, 'id'>>,
    existingIds?: number[]
  ) => Promise<void>;
  onDeleteExpenseGroup?: (ids: number[]) => Promise<void>;
  onReconcileLcrExpense: (id: number) => Promise<void>;
  onReconcileLcrExpenseGroup?: (ids: number[]) => Promise<void>;
  onCreateWithdrawal: (
    withdrawal: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => Promise<void>;
  onCloseWithdrawalInZero?: (id: number, returnAmount: number, returnDate: string) => Promise<void>;
  onCreateSupplier: (supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
  onSaveBudgetAllocation?: (
    allocation: Omit<BudgetAllocation, 'id' | 'total_assigned'> & { id?: number }
  ) => Promise<void>;
  onSaveOpeningBalance?: (year: number, amount: number, lcrRef?: string) => Promise<void>;
  onSaveQuarterIncomes?: (
    year: number,
    quarter: QuarterCode,
    unitRows: Array<{ slot_index: number; amount: number; lcr_ref: string }>,
    adjustments: Array<{ id?: number; amount: number; description: string; lcr_ref: string }>
  ) => Promise<void>;
  onResetFutureYearProjection?: (year: number) => Promise<void>;
}

interface GroupedExpenseMovement {
  key: string;
  ids: number[];
  records: ExpenseRecord[];
  primary: ExpenseRecord;
  totalGross: number;
  totalExternalReimb: number;
  totalNet: number;
  isPendingLcr: boolean;
  isApplied: boolean;
  isShared: boolean;
  effectiveDate: string;
  accountingDate: string;
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  EFECTIVO: 'Efectivo',
  DIRECTO_TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
};

export const AdminOperationsCenter: React.FC<AdminOperationsCenterProps> = ({
  selectedYear = 2026,
  budgets,
  budgetIncomes = [],
  expenses,
  allExpenses,
  withdrawals,
  activities,
  suppliers,
  onCreateExpense,
  onCreateMultipleExpenses,
  onSaveExpenseGroup,
  onDeleteExpenseGroup,
  onReconcileLcrExpense,
  onReconcileLcrExpenseGroup,
  onCreateWithdrawal,
  onCreateSupplier,
  onSaveBudgetAllocation,
  onSaveOpeningBalance,
  onSaveQuarterIncomes,
  onResetFutureYearProjection,
}) => {
  const [subTab, setSubTab] = useState<'EXPENSES' | 'WITHDRAWALS' | 'BUDGETS' | 'EXCEL_SYNC'>(
    'EXPENSES'
  );
  const [budgetSubTab, setBudgetSubTab] = useState<'INCOMES' | 'DISTRIBUTION'>('INCOMES');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const budgetYearSummary = useMemo(
    () => computeYearIncomeSummary(budgetIncomes, selectedYear),
    [budgetIncomes, selectedYear]
  );

  const closingCapStats = useMemo(
    () => computeClosingCapStats(budgetIncomes, expenses, selectedYear),
    [budgetIncomes, expenses, selectedYear]
  );

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroupEditData | null>(null);

  // Filtros del Libro de Comprobantes y filas desplegadas (Varios)
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'PENDING_LCR' | 'PROJECTED'>('ALL');
  const [expandedSharedKeys, setExpandedSharedKeys] = useState<Record<string, boolean>>({});

  const toggleSharedRow = (key: string) => {
    setExpandedSharedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtros de la tabla de Movimientos (Retiros, Tarjeta, Transferencias, Depósitos)
  const [withdrawalTypeFilter, setWithdrawalTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // =========================================================================
  // 1. CÁLCULOS EN VIVO DEL MONITOR DE CONCILIACIÓN LCR (CON SOPORTE DE 2 RETIROS)
  // =========================================================================
  const reconciliationStats = useMemo(() => {
    const appliedExpenses = expenses.filter((e) => isExpenseApplied(e));
    const yearWithdrawals = withdrawals.filter((w) =>
      w.withdrawal_date.startsWith(String(selectedYear))
    );
    const cashWithdrawalsOnly = yearWithdrawals.filter(
      (w) => !w.movement_type || w.movement_type === 'EFECTIVO'
    );

    const totalWithdrawn = cashWithdrawalsOnly.reduce((acc, w) => acc + Number(w.amount), 0);
    const totalReturnedDeposits = cashWithdrawalsOnly.reduce(
      (acc, w) => acc + Number(w.returned_amount || 0),
      0
    );

    // Sumar cuánto consumió cada retiro usando `withdrawal_allocations` (soporta hasta 2 retiros por gasto)
    const renderedByRef = new Map<string, number>();
    appliedExpenses.forEach((exp) => {
      const allocs = getExpenseWithdrawalAllocations(exp);
      allocs.forEach((a) => {
        renderedByRef.set(
          a.withdrawal_ref,
          Number(((renderedByRef.get(a.withdrawal_ref) || 0) + a.amount).toFixed(2))
        );
      });
    });

    const withdrawalDetails = yearWithdrawals.map((w) => {
      const mType: MovementType = w.movement_type || 'EFECTIVO';
      const renderedAmount =
        mType === 'EFECTIVO' ? renderedByRef.get(w.withdrawal_ref) || 0 : Number(w.amount);
      const rawPending =
        mType === 'EFECTIVO'
          ? Number(w.amount) - renderedAmount - Number(w.returned_amount || 0)
          : 0;
      const pendingToRender =
        mType !== 'EFECTIVO' ? 0 : Math.max(0, Number(rawPending.toFixed(2)));

      return {
        ...w,
        movementType: mType,
        renderedAmount,
        pendingToRender,
      };
    });

    const openWithdrawals = withdrawalDetails.filter(
      (w) => w.movementType === 'EFECTIVO' && w.pendingToRender > 0
    );
    const totalUnjustifiedWithdrawalsAmount = openWithdrawals.reduce(
      (acc, w) => acc + w.pendingToRender,
      0
    );

    const totalRenderedInWithdrawals = totalWithdrawn - totalUnjustifiedWithdrawalsAmount;
    const pendingLcrExpenses = appliedExpenses.filter((e) => e.status === 'PENDIENTE_LCR');
    const pendingLcrTotalAmount = pendingLcrExpenses.reduce(
      (acc, e) => acc + Number(e.gross_amount),
      0
    );

    const projectedTotalAmount = expenses
      .filter((e) => !isExpenseApplied(e))
      .reduce((acc, e) => acc + Number(e.gross_amount), 0);

    const totalPendingDifference = totalUnjustifiedWithdrawalsAmount + pendingLcrTotalAmount;
    const semaphoreState: 'VERDE' | 'AMBAR' | 'ROJO' =
      totalPendingDifference === 0
        ? 'VERDE'
        : pendingLcrTotalAmount > 50000
        ? 'ROJO'
        : 'AMBAR';

    // Presupuesto Global disponible del año seleccionado
    const yearBudgets = budgets.filter((b) => Number(b.year) === selectedYear);
    const totalAssigned = yearBudgets.reduce(
      (acc, b) =>
        acc +
        Number(b.t1_assigned) +
        Number(b.t2_assigned) +
        Number(b.t3_assigned) +
        Number(b.t4_assigned),
      0
    );
    const appliedNonReimbursableSpent = appliedExpenses
      .filter(
        (e) =>
          !e.is_reimbursable_oai &&
          getExpenseEffectiveDate(e).startsWith(String(selectedYear))
      )
      .reduce((acc, e) => acc + Number(e.net_amount), 0);
    const globalBudgetAvailable = Number(
      (totalAssigned - appliedNonReimbursableSpent).toFixed(2)
    );

    // Monto en efectivo: total retirado en efectivo menos gastos en efectivo y depósitos/devoluciones
    const cashWithdrawalRefs = new Set(cashWithdrawalsOnly.map((w) => w.withdrawal_ref));
    let totalCashExpenses = 0;
    cashWithdrawalRefs.forEach((ref) => {
      totalCashExpenses += renderedByRef.get(ref) || 0;
    });
    const totalCashDeposits = Number(totalReturnedDeposits.toFixed(2));
    const cashOnHand = Number(
      (totalWithdrawn - totalCashExpenses - totalCashDeposits).toFixed(2)
    );
    const cashAfterPendingLcr = Number((cashOnHand - pendingLcrTotalAmount).toFixed(2));

    return {
      totalWithdrawn,
      totalRenderedInWithdrawals,
      totalReturnedDeposits,
      totalCashExpenses,
      totalCashDeposits,
      cashOnHand,
      cashAfterPendingLcr,
      totalAssigned,
      appliedNonReimbursableSpent,
      globalBudgetAvailable,
      withdrawalDetails,
      openWithdrawals,
      totalUnjustifiedWithdrawalsAmount,
      pendingLcrExpenses,
      pendingLcrTotalAmount,
      projectedTotalAmount,
      totalPendingDifference,
      semaphoreState,
    };
  }, [withdrawals, expenses, budgets, selectedYear]);

  const openWithdrawalOptions: OpenWithdrawalOption[] = useMemo(
    () =>
      reconciliationStats.openWithdrawals.map((w) => ({
        id: w.id,
        withdrawal_ref: w.withdrawal_ref,
        withdrawal_date: w.withdrawal_date,
        amount: Number(w.amount),
        pendingToRender: w.pendingToRender,
        purpose: w.purpose,
      })),
    [reconciliationStats.openWithdrawals]
  );

  // =========================================================================
  // 2. AGRUPACIÓN DE MOVIMIENTOS Y ALERTAS DE ACTIVIDADES PENDIENTES DE RENDIR
  // =========================================================================
  const groupedMovements = useMemo<GroupedExpenseMovement[]>(() => {
    const groups = new Map<string, ExpenseRecord[]>();
    expenses.forEach((exp) => {
      const key = exp.shared_group_id ? `grp:${exp.shared_group_id}` : `single:${exp.id}`;
      const list = groups.get(key) || [];
      list.push(exp);
      groups.set(key, list);
    });

    const result: GroupedExpenseMovement[] = [];
    groups.forEach((records, key) => {
      const primary = records[0];
      const totalGross = Number(
        records.reduce((acc, r) => acc + Number(r.gross_amount), 0).toFixed(2)
      );
      const totalExternalReimb = Number(
        records.reduce((acc, r) => acc + Number(r.external_reimbursement || 0), 0).toFixed(2)
      );
      const totalNet = Number(
        records.reduce((acc, r) => acc + Number(r.net_amount), 0).toFixed(2)
      );
      const applied = isExpenseApplied(primary);

      result.push({
        key,
        ids: records.map((r) => r.id),
        records,
        primary,
        totalGross,
        totalExternalReimb,
        totalNet,
        isPendingLcr: applied && records.some((r) => r.status === 'PENDIENTE_LCR'),
        isApplied: applied,
        isShared: records.length > 1,
        effectiveDate: getExpenseEffectiveDate(primary),
        accountingDate: primary.expense_date,
      });
    });

    return result.sort((a, b) => {
      if (a.isPendingLcr && !b.isPendingLcr) return -1;
      if (!a.isPendingLcr && b.isPendingLcr) return 1;
      return b.effectiveDate.localeCompare(a.effectiveDate);
    });
  }, [expenses]);

  // Actividades proyectadas cuya fecha ya llegó o pasó -> Alerta "Pendiente de rendir"
  const dueProjectedMovements = useMemo(
    () =>
      groupedMovements.filter(
        (m) =>
          !m.isApplied &&
          m.primary.expense_type === 'PROYECTADO_ACTIVIDAD' &&
          m.effectiveDate <= todayStr
      ),
    [groupedMovements, todayStr]
  );

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return groupedMovements.filter((m) => {
      if (ledgerFilter === 'PENDING_LCR' && !m.isPendingLcr) return false;
      if (ledgerFilter === 'PROJECTED' && m.isApplied) return false;
      if (!q) return true;
      const orgNames = m.records
        .map((r) => ORGANIZATION_SHORT_LABELS[r.organization].toLowerCase())
        .join(' ');
      return (
        m.primary.concept.toLowerCase().includes(q) ||
        m.primary.supplier_name.toLowerCase().includes(q) ||
        (m.primary.ref_number || '').toLowerCase().includes(q) ||
        orgNames.includes(q)
      );
    });
  }, [groupedMovements, ledgerSearch, ledgerFilter]);

  const filteredWithdrawals = useMemo(() => {
    const q = withdrawalSearch.trim().toLowerCase();
    const numericQ = q.replace(/[$.\s]/g, '').replace(',', '.');

    return reconciliationStats.withdrawalDetails
      .filter((w) => {
        if (withdrawalTypeFilter !== 'ALL' && w.movementType !== withdrawalTypeFilter) {
          return false;
        }
        if (!q) return true;

        const matchesText =
          w.withdrawal_ref.toLowerCase().includes(q) ||
          (w.purpose || '').toLowerCase().includes(q);
        const matchesAmount =
          numericQ.length > 0 &&
          /^\d+(\.\d+)?$/.test(numericQ) &&
          (String(w.amount).includes(numericQ) ||
            w.amount.toFixed(2).includes(numericQ) ||
            String(Math.round(w.amount)).includes(numericQ));

        return matchesText || matchesAmount;
      })
      .sort((a, b) => b.withdrawal_date.localeCompare(a.withdrawal_date));
  }, [reconciliationStats.withdrawalDetails, withdrawalTypeFilter, withdrawalSearch]);

  // =========================================================================
  // 3. HANDLERS
  // =========================================================================
  const handleSaveModalExpense = async (
    records: Array<Omit<ExpenseRecord, 'id'>>,
    existingIds?: number[]
  ) => {
    if (onSaveExpenseGroup) {
      await onSaveExpenseGroup(records, existingIds);
    } else if (records.length === 1) {
      await onCreateExpense(records[0]);
    } else {
      await onCreateMultipleExpenses(records);
    }

    const totalAmt = records.reduce((acc, r) => acc + Number(r.gross_amount), 0);
    triggerToast(
      existingIds?.length
        ? `Movimiento "${records[0].concept}" actualizado (${formatCurrency(totalAmt)}).`
        : records.length > 1
        ? `Movimiento compartido registrado entre ${records.length} organizaciones (${formatCurrency(totalAmt)}).`
        : `Movimiento "${records[0].concept}" registrado (${formatCurrency(totalAmt)}).`
    );
  };

  const handleSaveNewMovement = async (
    movement: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => {
    await onCreateWithdrawal(movement, targetWithdrawalRef);
    triggerToast(
      `${MOVEMENT_TYPE_LABELS[movement.movement_type || 'EFECTIVO']} ${movement.withdrawal_ref} (${formatCurrency(
        movement.amount
      )}) registrado.`
    );
  };

  const handleReconcileGroup = async (movement: GroupedExpenseMovement) => {
    if (onReconcileLcrExpenseGroup) {
      await onReconcileLcrExpenseGroup(movement.ids);
    } else {
      for (const id of movement.ids) {
        await onReconcileLcrExpense(id);
      }
    }
    triggerToast(
      `Comprobante "${movement.primary.concept}" (${formatCurrency(
        movement.totalGross
      )}) marcado como registrado en LCR.`
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ==================== MONITOR DE CONCILIACIÓN LCR ==================== */}
      <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              Administración de Finanzas
            </h2>
          </div>

          <div
            data-testid="lcr-semaphore-badge"
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-extrabold border ${
              reconciliationStats.semaphoreState === 'VERDE'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : reconciliationStats.semaphoreState === 'AMBAR'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                reconciliationStats.semaphoreState === 'VERDE'
                  ? 'bg-emerald-400'
                  : reconciliationStats.semaphoreState === 'AMBAR'
                  ? 'bg-amber-400'
                  : 'bg-rose-400 animate-pulse'
              }`}
            />
            <span>
              {reconciliationStats.semaphoreState === 'VERDE'
                ? 'LCR Cuadrado en $ 0,00'
                : 'Pendientes de Conciliación'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          <div
            data-testid="monitor-card-global-budget"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Presupuesto Global
            </span>
            <p
              data-testid="monitor-global-budget-amount"
              className="text-lg font-extrabold text-emerald-300 tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.globalBudgetAvailable)}
            </p>
          </div>

          <div
            data-testid="monitor-card-cash-on-hand"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
              Monto en Efectivo
            </span>
            <p
              data-testid="monitor-cash-on-hand-amount"
              className={`text-lg font-extrabold tabular-nums mt-1 ${
                reconciliationStats.cashOnHand < 0 ? 'text-rose-300' : 'text-white'
              }`}
            >
              {formatCurrency(reconciliationStats.cashOnHand)}
            </p>
          </div>

          <div
            data-testid="monitor-card-pending-lcr"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Pendientes en LCR
              </span>
              <span
                data-testid="monitor-pending-lcr-count"
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 tabular-nums"
              >
                {reconciliationStats.pendingLcrExpenses.length} en mano
              </span>
            </div>
            <p
              data-testid="monitor-pending-lcr-amount"
              className="text-lg font-extrabold text-rose-300 tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.pendingLcrTotalAmount)}
            </p>
            <p
              data-testid="monitor-cash-after-pending-lcr"
              className={`text-[11px] mt-1 tabular-nums font-semibold ${
                reconciliationStats.cashAfterPendingLcr < 0
                  ? 'text-rose-300'
                  : 'text-slate-400'
              }`}
            >
              Efectivo − Pend. LCR:{' '}
              {formatCurrency(reconciliationStats.cashAfterPendingLcr)}
            </p>
          </div>

          <div
            data-testid="monitor-card-placeholder"
            aria-hidden="true"
            className="p-3.5 rounded-2xl bg-slate-800/40 border border-dashed border-slate-700/70 min-h-[92px]"
          />
        </div>
      </div>

      {/* Monitor de Quita al Cierre (Regla del 50%) — exclusivo en Finanzas */}
      {closingCapStats.annualIncomesOnly > 0 && (
        <div
          data-testid="closing-cap-50-monitor"
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            closingCapStats.hasRisk
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {closingCapStats.hasRisk ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 text-xs">
              <p className="font-extrabold">
                {closingCapStats.hasRisk
                  ? `Alerta de quita al cierre (${selectedYear}): riesgo de descuento de ${formatCurrency(
                      closingCapStats.excessOverCap
                    )}`
                  : `Regla del 50% al cierre (${selectedYear}): sin riesgo de quita`}
              </p>
              <p className="text-[11px] opacity-90">
                {closingCapStats.hasRisk
                  ? `Conviene ejecutar al menos ${formatCurrency(
                      closingCapStats.excessOverCap
                    )} antes del 31/12 para no perder fondos en el cierre.`
                  : 'El saldo disponible actual está dentro del tope permitido del 50% de los 4 ingresos del año.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs tabular-nums flex-shrink-0">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block">
                Tope 50%
              </span>
              <span className="font-extrabold">{formatCurrency(closingCapStats.cap50)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block">
                Saldo actual
              </span>
              <span
                className={`font-extrabold ${
                  closingCapStats.hasRisk ? 'text-rose-700' : 'text-emerald-800'
                }`}
              >
                {formatCurrency(closingCapStats.remainingBalance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Alerta visual de actividades proyectadas cuya fecha ya llegó (Pendientes de rendir) */}
      {dueProjectedMovements.length > 0 && (
        <div
          data-testid="due-projected-alert"
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2 text-xs text-amber-950 font-bold">
            <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              {dueProjectedMovements.length === 1
                ? `Actividad pendiente de rendir: "${dueProjectedMovements[0].primary.concept}" (${formatDate(
                    dueProjectedMovements[0].effectiveDate
                  )})`
                : `${dueProjectedMovements.length} actividades proyectadas ya cumplieron su fecha y están pendientes de rendir.`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {dueProjectedMovements.slice(0, 2).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setEditingGroup({ ids: m.ids, records: m.records });
                  setIsExpenseModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-extrabold"
              >
                Rendir: {m.primary.concept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          data-testid="admin-ops-toast"
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-sm flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ==================== BLOQUE FIJO ÚNICO AL HACER SCROLL (PESTAÑAS + CONTROLES EN UNA SOLA CAJA) ==================== */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-slate-50 pt-1 pb-2">
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-testid="ops-subtab-load"
              onClick={() => setSubTab('EXPENSES')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'EXPENSES'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gastos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-withdrawals"
              onClick={() => setSubTab('WITHDRAWALS')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'WITHDRAWALS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
              <span>Movimientos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-budgets"
              onClick={() => setSubTab('BUDGETS')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'BUDGETS'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Presupuestos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-excel"
              onClick={() => setSubTab('EXCEL_SYNC')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'EXCEL_SYNC'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>

          {/* Controles fijos de Gastos */}
          {subTab === 'EXPENSES' && (
            <div className="border-t border-slate-200 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Registro de Gastos</span>
                  <span className="text-xs font-bold text-slate-400 tabular-nums">
                    {filteredMovements.length}
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-0.5">
                  {(
                    [
                      { id: 'ALL', label: 'Todos' },
                      { id: 'PENDING_LCR', label: 'Pend. LCR' },
                      { id: 'PROJECTED', label: 'Proyectados' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLedgerFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                        ledgerFilter === f.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:flex-none sm:w-56 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por propósito, proveedor o ref..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
                  />
                </div>

                <button
                  type="button"
                  data-testid="open-add-expense-modal-btn"
                  onClick={() => {
                    setEditingGroup(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="pressable inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir Gasto</span>
                </button>
              </div>
            </div>
          )}

          {/* Controles fijos de Movimientos */}
          {subTab === 'WITHDRAWALS' && (
            <div className="border-t border-slate-200 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Movimientos Tarjeta y Transferencias</span>
                  <span className="text-xs font-bold text-slate-400 tabular-nums">
                    {filteredWithdrawals.length}
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-0.5 overflow-x-auto max-w-full">
                  {(
                    [
                      { id: 'ALL', label: 'Todos' },
                      { id: 'EFECTIVO', label: 'Retiros' },
                      { id: 'DIRECTO_TARJETA', label: 'Tarjeta' },
                      { id: 'TRANSFERENCIA', label: 'Transf.' },
                      { id: 'DEPOSITO', label: 'Depósitos' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setWithdrawalTypeFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                        withdrawalTypeFilter === f.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:flex-none sm:w-56 md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por ref., propósito o monto..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
                  />
                </div>

                <button
                  type="button"
                  data-testid="open-add-movement-modal-btn"
                  onClick={() => setIsMovementModalOpen(true)}
                  className="pressable inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Movimiento</span>
                </button>
              </div>
            </div>
          )}

          {/* Controles fijos de Presupuestos (fusionados con la barra superior como Gastos y Movimientos) */}
          {subTab === 'BUDGETS' && (
            <div className="border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-start gap-6 sm:gap-8">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Presupuestos ({selectedYear})</span>
                </h3>
                {selectedYear > new Date().getFullYear() && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-900 border border-sky-200">
                    Modo proyección
                  </span>
                )}
              </div>

              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-0.5">
                <button
                  type="button"
                  data-testid="budget-subtab-incomes"
                  onClick={() => setBudgetSubTab('INCOMES')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                    budgetSubTab === 'INCOMES'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  1. Ingresos del Año
                </button>
                <button
                  type="button"
                  data-testid="budget-subtab-distribution"
                  onClick={() => setBudgetSubTab('DISTRIBUTION')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                    budgetSubTab === 'DISTRIBUTION'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  2. Distribución por Organización
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== PESTAÑA 1: GASTOS (FLUJO CONTINUO SIN DOBLE SCROLL) ==================== */}
      {subTab === 'EXPENSES' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
            {filteredMovements.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No se encontraron registros con ese filtro.
              </div>
            ) : (
              <>
                {/* VISTA ESCRITORIO: TABLA ALINEADA */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3 pl-3 pr-1 w-8" aria-label="Desplegar" />
                        <th className="py-3 px-3 whitespace-nowrap">Fecha</th>
                        <th className="py-3 px-3 whitespace-nowrap">Referencia</th>
                        <th className="py-3 px-3 whitespace-nowrap">Organización</th>
                        <th className="py-3 px-3 whitespace-nowrap">Fecha Act.</th>
                        <th className="py-3 px-3">Propósito</th>
                        <th className="py-3 px-3 whitespace-nowrap w-40 max-w-[160px]">Proveedor</th>
                        <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Monto</th>
                        <th className="py-3 pr-4 w-10 text-right" aria-label="Editar" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredMovements.map((m) => {
                        const isDueProjected =
                          !m.isApplied &&
                          m.primary.expense_type === 'PROYECTADO_ACTIVIDAD' &&
                          m.effectiveDate <= todayStr;
                        const isExpanded = Boolean(expandedSharedKeys[m.key]);

                        return (
                          <React.Fragment key={m.key}>
                            <tr
                              data-testid={`admin-expense-row-${m.primary.id}`}
                              className={`transition ${
                                isDueProjected
                                  ? 'bg-amber-50/70 hover:bg-amber-50'
                                  : m.isPendingLcr
                                  ? 'bg-rose-50/50 hover:bg-rose-50/80'
                                  : !m.isApplied
                                  ? 'bg-slate-50/50 hover:bg-slate-50'
                                  : 'hover:bg-slate-50/70'
                              }`}
                            >
                              {/* Flecha desplegable si son Varios */}
                              <td className="py-3 pl-3 pr-1 align-middle">
                                {m.isShared && (
                                  <button
                                    type="button"
                                    onClick={() => toggleSharedRow(m.key)}
                                    data-testid={`expand-shared-${m.primary.id}`}
                                    aria-label="Ver detalle de organizaciones"
                                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </td>

                              {/* 1. Fecha Contable */}
                              <td className="py-3 px-3 font-bold text-slate-800 tabular-nums whitespace-nowrap align-middle">
                                {formatDate(m.accountingDate)}
                              </td>

                              {/* 2. N° Referencia */}
                              <td className="py-3 px-3 whitespace-nowrap align-middle">
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {!m.isApplied
                                    ? 'PROYECTADO'
                                    : m.primary.ref_number
                                    ? m.primary.ref_number.replace(/\s*\+\s*/g, ' ')
                                    : 'DIRECTO'}
                                </span>
                              </td>

                              {/* 3. Organización */}
                              <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap align-middle">
                                {m.isShared
                                  ? 'Varios'
                                  : ORGANIZATION_SHORT_LABELS[m.primary.organization]}
                              </td>

                              {/* 4. Fecha Actividad (en gris) */}
                              <td className="py-3 px-3 text-slate-400 tabular-nums whitespace-nowrap align-middle">
                                {formatDate(m.effectiveDate)}
                              </td>

                              {/* 5. Propósito (etiqueta pendiente arriba del propósito) */}
                              <td className="py-3 px-3 align-middle">
                                <div className="flex flex-col items-start gap-1">
                                  {isDueProjected ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 whitespace-nowrap">
                                      <Clock className="w-3 h-3" />
                                      <span>Pendiente de rendir</span>
                                    </span>
                                  ) : !m.isApplied ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 whitespace-nowrap">
                                      Pendiente de rendir
                                    </span>
                                  ) : m.isPendingLcr ? (
                                    <span
                                      data-testid={`pending-lcr-pill-${m.primary.id}`}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 whitespace-nowrap"
                                    >
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>Pendiente LCR</span>
                                    </span>
                                  ) : null}
                                  <span className="font-semibold text-slate-900">
                                    {m.primary.concept}
                                  </span>
                                </div>
                              </td>

                              {/* 6. Proveedor */}
                              <td className="py-3 px-3 text-slate-600 align-middle max-w-[160px] truncate" title={m.isApplied ? m.primary.supplier_name : undefined}>
                                {m.isApplied ? m.primary.supplier_name : '—'}
                              </td>

                              {/* 6. Monto (con botón Conciliar encima si está pendiente LCR) */}
                              <td className="py-3 pl-3 pr-2 text-right whitespace-nowrap align-middle">
                                <div className="inline-flex flex-col items-end gap-1">
                                  {m.isPendingLcr && (
                                    <button
                                      type="button"
                                      data-testid={`reconcile-lcr-btn-${m.primary.id}`}
                                      onClick={() => handleReconcileGroup(m)}
                                      className="pressable inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[10px] font-bold"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Conciliar</span>
                                    </button>
                                  )}
                                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums">
                                    {formatCurrency(m.totalGross)}
                                  </span>
                                  {m.totalExternalReimb > 0 && (
                                    <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                      Neto: {formatCurrency(m.totalNet)}
                                    </span>
                                  )}
                                  {m.primary.is_reimbursable_oai && (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      Reembolsable
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Editar (ícono siempre alineado a la derecha al final de la fila) */}
                              <td className="py-3 pr-4 pl-1 text-right align-middle">
                                <button
                                  type="button"
                                  title="Editar movimiento"
                                  data-testid={`edit-expense-btn-${m.primary.id}`}
                                  onClick={() => {
                                    setEditingGroup({ ids: m.ids, records: m.records });
                                    setIsExpenseModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>

                            {/* Sub-fila desplegable con el aporte de cada organización */}
                            {m.isShared && isExpanded && (
                              <tr className="bg-slate-50/90">
                                <td />
                                <td colSpan={8} className="py-2.5 px-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 mr-1">
                                      Detalle por organización:
                                    </span>
                                    {m.records.map((r) => (
                                      <span
                                        key={r.id}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-800 tabular-nums"
                                      >
                                        <span>{ORGANIZATION_SHORT_LABELS[r.organization]}</span>
                                        <span className="text-slate-500">·</span>
                                        <span>{formatCurrency(r.gross_amount)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* VISTA MÓVIL: LECTURA COMPACTA VERTICAL */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredMovements.map((m) => {
                    const isDueProjected =
                      !m.isApplied &&
                      m.primary.expense_type === 'PROYECTADO_ACTIVIDAD' &&
                      m.effectiveDate <= todayStr;
                    const isExpanded = Boolean(expandedSharedKeys[m.key]);

                    return (
                      <div
                        key={`mob-${m.key}`}
                        className={`p-4 space-y-2 ${
                          isDueProjected
                            ? 'bg-amber-50/70'
                            : m.isPendingLcr
                            ? 'bg-rose-50/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            {m.isShared && (
                              <button
                                type="button"
                                onClick={() => toggleSharedRow(m.key)}
                                className="p-0.5 mt-0.5 rounded text-slate-500"
                                aria-label="Ver detalle de organizaciones"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap text-xs">
                                <span className="font-bold text-slate-800 tabular-nums">
                                  {formatDate(m.effectiveDate)}
                                </span>
                                <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {!m.isApplied
                                    ? 'PROYECTADO'
                                    : m.primary.ref_number
                                    ? m.primary.ref_number.replace(/\s*\+\s*/g, ' ')
                                    : 'DIRECTO'}
                                </span>
                                <span className="font-bold text-slate-700">
                                  {m.isShared
                                    ? 'Varios'
                                    : ORGANIZATION_SHORT_LABELS[m.primary.organization]}
                                </span>
                              </div>

                              <div className="flex flex-col items-start gap-1">
                                {(isDueProjected || !m.isApplied) && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950">
                                    Pendiente de rendir
                                  </span>
                                )}
                                {m.isPendingLcr && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                    Pendiente LCR
                                  </span>
                                )}
                                <p className="text-xs font-bold text-slate-900">
                                  {m.primary.concept}
                                </p>
                              </div>

                              {m.isApplied && (
                                <p className="text-[11px] text-slate-500">
                                  {m.primary.supplier_name}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex flex-col items-end gap-1">
                              {m.isPendingLcr && (
                                <button
                                  type="button"
                                  onClick={() => handleReconcileGroup(m)}
                                  className="px-2 py-0.5 rounded-lg bg-rose-700 text-white text-[10px] font-bold"
                                >
                                  Conciliar
                                </button>
                              )}
                              <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                                {formatCurrency(m.totalGross)}
                              </span>
                              {m.totalExternalReimb > 0 && (
                                <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                                  Neto: {formatCurrency(m.totalNet)}
                                </span>
                              )}
                              {m.primary.is_reimbursable_oai && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Reembolsable
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              title="Editar movimiento"
                              onClick={() => {
                                setEditingGroup({ ids: m.ids, records: m.records });
                                setIsExpenseModalOpen(true);
                              }}
                              className="p-1.5 rounded-xl border border-slate-200 text-slate-500 bg-white"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {m.isShared && isExpanded && (
                          <div className="pl-5 pt-1 flex flex-wrap gap-1.5">
                            {m.records.map((r) => (
                              <span
                                key={r.id}
                                className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 tabular-nums"
                              >
                                {ORGANIZATION_SHORT_LABELS[r.organization]}:{' '}
                                {formatCurrency(r.gross_amount)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
        </div>
      )}

      {/* ==================== PESTAÑA 2: RETIROS (FORMATO TABLA ORDENADA POR FECHA) ==================== */}
      {subTab === 'WITHDRAWALS' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
          {filteredWithdrawals.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No se encontraron retiros o salidas con ese filtro.
            </div>
          ) : (
            <>
              {/* VISTA ESCRITORIO: TABLA ALINEADA */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Fecha</th>
                      <th className="py-3 px-3 whitespace-nowrap">Referencia</th>
                      <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                      <th className="py-3 px-3">Propósito</th>
                      <th className="py-3 px-3 whitespace-nowrap">Responsable</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Pendiente</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Monto</th>
                      <th className="py-3 pr-4 text-right whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredWithdrawals.map((w) => {
                      const isCash = w.movementType === 'EFECTIVO';
                      const isOpen = isCash && w.pendingToRender > 0;
                      return (
                        <tr
                          key={w.id}
                          data-testid={`withdrawal-row-${w.withdrawal_ref}`}
                          className={`transition ${
                            isOpen ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-800 tabular-nums whitespace-nowrap">
                            {formatDate(w.withdrawal_date)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {w.withdrawal_ref}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {MOVEMENT_TYPE_LABELS[w.movementType]}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {w.purpose || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {w.responsible_person}
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                            {isCash ? (
                              <span className={w.pendingToRender > 0 ? 'text-amber-700' : 'text-slate-400'}>
                                {formatCurrency(w.pendingToRender)}
                              </span>
                            ) : (
                              <span className="text-slate-400">$ 0,00</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatCurrency(w.amount)}
                          </td>
                          <td className="py-3 pr-4 text-right whitespace-nowrap">
                            {isOpen ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Abierto
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400">
                                Cerrado
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISTA MÓVIL: LECTURA COMPACTA VERTICAL */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredWithdrawals.map((w) => {
                  const isCash = w.movementType === 'EFECTIVO';
                  const isOpen = isCash && w.pendingToRender > 0;
                  return (
                    <div
                      key={`mob-w-${w.id}`}
                      className={`p-4 space-y-2 text-xs ${isOpen ? 'bg-amber-50/50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 tabular-nums">
                              {formatDate(w.withdrawal_date)}
                            </span>
                            <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {w.withdrawal_ref}
                            </span>
                            <span className="font-semibold text-slate-600">
                              {MOVEMENT_TYPE_LABELS[w.movementType]}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900">{w.purpose || '—'}</p>
                          <p className="text-[11px] text-slate-500">{w.responsible_person}</p>
                        </div>

                        <div className="text-right flex-shrink-0 space-y-1">
                          <p className="font-extrabold text-slate-900 tabular-nums">
                            {formatCurrency(w.amount)}
                          </p>
                          {isCash && (
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Pend: <strong>{formatCurrency(w.pendingToRender)}</strong>
                            </p>
                          )}
                          {isOpen ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Abierto
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400 block">
                              Cerrado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== PESTAÑA 2: PRESUPUESTOS ==================== */}
      {subTab === 'BUDGETS' && (
        <BudgetManagementSection
          year={selectedYear}
          budgets={budgets}
          budgetIncomes={budgetIncomes}
          expenses={allExpenses ?? expenses}
          onSaveBudgetAllocation={onSaveBudgetAllocation || (async () => {})}
          onSaveOpeningBalance={onSaveOpeningBalance || (async () => {})}
          onSaveQuarterIncomes={onSaveQuarterIncomes || (async () => {})}
          onResetFutureYearProjection={onResetFutureYearProjection || (async () => {})}
          onSavedToast={triggerToast}
          controlledSubTab={budgetSubTab}
          onControlledSubTabChange={setBudgetSubTab}
          hideHeader
        />
      )}

      {/* ==================== PESTAÑA 3: EXCEL ==================== */}
      {subTab === 'EXCEL_SYNC' && (
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl p-8 text-center text-xs font-bold text-slate-500 border border-slate-200/90">
              Cargando módulo Excel...
            </div>
          }
        >
          <ExcelSyncPanel
            budgets={budgets}
            expenses={expenses}
            withdrawals={withdrawals}
            activities={activities}
            suppliers={suppliers}
          />
        </Suspense>
      )}

      {/* ==================== MODAL ÚNICO DE GASTO ==================== */}
      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        editGroup={editingGroup}
        activities={activities}
        suppliers={suppliers}
        openWithdrawals={openWithdrawalOptions}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingGroup(null);
        }}
        onSave={handleSaveModalExpense}
        onDelete={onDeleteExpenseGroup}
        onCreateSupplier={onCreateSupplier}
      />

      {/* ==================== MODAL DE NUEVO MOVIMIENTO ==================== */}
      <NewMovementModal
        isOpen={isMovementModalOpen}
        defaultResponsible="Pablo Lamela"
        openWithdrawals={openWithdrawalOptions}
        onClose={() => setIsMovementModalOpen(false)}
        onSave={handleSaveNewMovement}
      />
    </div>
  );
};
