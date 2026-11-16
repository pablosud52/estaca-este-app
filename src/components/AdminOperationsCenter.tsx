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
  parseMmddMontoShortcut,
} from '../lib/formatters';
import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  MovementType,
  SupplierRecord,
} from '../types/database';
import { BudgetManagementSection } from './BudgetManagementSection';
import {
  ExpenseFormModal,
  ExpenseGroupEditData,
  OpenWithdrawalOption,
} from './ExpenseFormModal';

const ExcelSyncPanel = lazy(() =>
  import('./ExcelSyncPanel').then((m) => ({ default: m.ExcelSyncPanel }))
);

interface AdminOperationsCenterProps {
  selectedYear?: number;
  budgets: BudgetAllocation[];
  expenses: ExpenseRecord[];
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
  onCreateWithdrawal: (withdrawal: Omit<CashWithdrawalRecord, 'id'>) => Promise<void>;
  onCloseWithdrawalInZero: (id: number, returnAmount: number, returnDate: string) => Promise<void>;
  onCreateSupplier: (supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
  onSaveBudgetAllocation?: (
    allocation: Omit<BudgetAllocation, 'id' | 'total_assigned'> & { id?: number }
  ) => Promise<void>;
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
};

export const AdminOperationsCenter: React.FC<AdminOperationsCenterProps> = ({
  selectedYear = 2026,
  budgets,
  expenses,
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
  onCloseWithdrawalInZero,
  onCreateSupplier,
  onSaveBudgetAllocation,
}) => {
  const [subTab, setSubTab] = useState<'EXPENSES' | 'WITHDRAWALS' | 'BUDGETS' | 'EXCEL_SYNC'>(
    'EXPENSES'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroupEditData | null>(null);

  // Filtros del Libro de Comprobantes y filas desplegadas (Varios)
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'PENDING_LCR' | 'PROJECTED'>('ALL');
  const [expandedSharedKeys, setExpandedSharedKeys] = useState<Record<string, boolean>>({});

  const toggleSharedRow = (key: string) => {
    setExpandedSharedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtro de la tabla unificada de Salidas (Efectivo vs Directo/Transferencia)
  const [withdrawalTypeFilter, setWithdrawalTypeFilter] = useState<'ALL' | 'EFECTIVO' | 'DIRECTO'>('ALL');

  // Nuevo Retiro + Confirmación de Cierre
  const [newWithdrawalShortcut, setNewWithdrawalShortcut] = useState('');
  const [newWithdrawalPurpose, setNewWithdrawalPurpose] = useState('');
  const [newWithdrawalResponsible, setNewWithdrawalResponsible] = useState('Pablo Lamela');
  const [closingWithdrawalId, setClosingWithdrawalId] = useState<number | null>(null);
  const [closingReturnDate, setClosingReturnDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [closingReturnAmount, setClosingReturnAmount] = useState('');

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
    const cashWithdrawalsOnly = withdrawals.filter(
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

    const withdrawalDetails = withdrawals.map((w) => {
      const mType: MovementType = w.movement_type || 'EFECTIVO';
      const renderedAmount =
        mType === 'EFECTIVO' ? renderedByRef.get(w.withdrawal_ref) || 0 : Number(w.amount);
      const rawPending =
        mType === 'EFECTIVO'
          ? Number(w.amount) - renderedAmount - Number(w.returned_amount || 0)
          : 0;
      const pendingToRender =
        w.status === 'CERRADO_EN_CERO' || mType !== 'EFECTIVO'
          ? 0
          : Math.max(0, Number(rawPending.toFixed(2)));

      return {
        ...w,
        movementType: mType,
        renderedAmount,
        pendingToRender,
      };
    });

    const openWithdrawals = withdrawalDetails.filter(
      (w) => w.movementType === 'EFECTIVO' && w.status === 'PENDIENTE_JUSTIFICAR'
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

    return {
      totalWithdrawn,
      totalRenderedInWithdrawals,
      totalReturnedDeposits,
      withdrawalDetails,
      openWithdrawals,
      totalUnjustifiedWithdrawalsAmount,
      pendingLcrExpenses,
      pendingLcrTotalAmount,
      projectedTotalAmount,
      totalPendingDifference,
      semaphoreState,
    };
  }, [withdrawals, expenses]);

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

  const filteredWithdrawals = useMemo(
    () =>
      reconciliationStats.withdrawalDetails
        .filter((w) => {
          if (withdrawalTypeFilter === 'EFECTIVO') return w.movementType === 'EFECTIVO';
          if (withdrawalTypeFilter === 'DIRECTO') return w.movementType !== 'EFECTIVO';
          return true;
        })
        .sort((a, b) => b.withdrawal_date.localeCompare(a.withdrawal_date)),
    [reconciliationStats.withdrawalDetails, withdrawalTypeFilter]
  );

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

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseMmddMontoShortcut(newWithdrawalShortcut);
    if (!parsed.isValid || !parsed.date || parsed.amount === undefined || !parsed.ref) {
      triggerToast('Usa el formato MMDD-MONTO (ej: 1105-20000).');
      return;
    }

    await onCreateWithdrawal({
      withdrawal_ref: parsed.ref,
      withdrawal_date: parsed.date,
      amount: parsed.amount,
      responsible_person: newWithdrawalResponsible.trim() || 'Pablo Lamela',
      purpose: newWithdrawalPurpose.trim() || 'Fondo para actividades',
      movement_type: 'EFECTIVO',
      status: 'PENDIENTE_JUSTIFICAR',
      return_date: null,
      returned_amount: 0,
    });

    setNewWithdrawalShortcut('');
    setNewWithdrawalPurpose('');
    triggerToast(`Retiro ${parsed.ref} (${formatCurrency(parsed.amount)}) registrado.`);
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
            <p className="text-xs text-slate-400">
              Salidas del presupuesto, gastos por actividad y conciliación LCR
            </p>
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
          <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Retirado (Efectivo)
            </span>
            <p
              data-testid="monitor-total-withdrawn"
              className="text-lg font-extrabold text-white tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.totalWithdrawn)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
              Rendido: {formatCurrency(reconciliationStats.totalRenderedInWithdrawals)}
            </p>
          </div>

          <div
            data-testid="monitor-card-unjustified-withdrawals"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Retiros sin Justificar
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 tabular-nums">
                {reconciliationStats.openWithdrawals.length} abiertos
              </span>
            </div>
            <p
              data-testid="monitor-unjustified-withdrawals-amount"
              className="text-lg font-extrabold text-amber-300 tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.totalUnjustifiedWithdrawalsAmount)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {reconciliationStats.openWithdrawals
                .slice(0, 2)
                .map((w) => w.withdrawal_ref)
                .join(' • ') || 'Todos cerrados'}
            </p>
          </div>

          <div
            data-testid="monitor-card-pending-lcr"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Sin Justificar en LCR
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
            <p className="text-[11px] text-slate-400 mt-1">
              Proyectado: {formatCurrency(reconciliationStats.projectedTotalAmount)}
            </p>
          </div>

          <div
            data-testid="monitor-card-difference-semaphore"
            className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Diferencia Estimada
            </span>
            <p
              data-testid="monitor-difference-amount"
              className={`text-lg font-extrabold tabular-nums mt-1 ${
                reconciliationStats.totalPendingDifference === 0
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {formatCurrency(reconciliationStats.totalPendingDifference)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {reconciliationStats.totalPendingDifference === 0
                ? 'Extracto y LCR 100% cuadrados'
                : 'Al asentar LCR y cerrar retiros'}
            </p>
          </div>
        </div>
      </div>

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

      {/* ==================== BLOQUE FIJO ÚNICO AL HACER SCROLL (PESTAÑAS + CONTROLES ACTIVOS) ==================== */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-slate-50 pt-1 pb-2 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
            <span>Retiros</span>
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

        {subTab === 'EXPENSES' && (
          <button
            type="button"
            data-testid="open-add-expense-modal-btn"
            onClick={() => {
              setEditingGroup(null);
              setIsExpenseModalOpen(true);
            }}
            className="pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Gasto</span>
          </button>
        )}
        </div>

        {/* Controles fijos de Gastos */}
        {subTab === 'EXPENSES' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Registro de Gastos ({filteredMovements.length})
              </h3>
              <p className="text-xs text-slate-500">
                Fecha de actividad, referencia LCR y estado
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
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
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border whitespace-nowrap transition ${
                    ledgerFilter === f.id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controles fijos de Retiros */}
        {subTab === 'WITHDRAWALS' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Retiros y Salidas ({filteredWithdrawals.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Retiros en efectivo, tarjeta y transferencias
                </p>
              </div>

              <div className="flex items-center gap-1 sm:w-80">
                {(
                  [
                    { id: 'ALL', label: 'Todos' },
                    { id: 'EFECTIVO', label: 'Efectivo' },
                    { id: 'DIRECTO', label: 'Tarjeta / Transf.' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWithdrawalTypeFilter(f.id)}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition ${
                      withdrawalTypeFilter === f.id
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleAddWithdrawal}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
            >
              <input
                type="text"
                data-testid="new-withdrawal-shortcut-input"
                placeholder="MMDD-MONTO (ej: 1105-20000)"
                value={newWithdrawalShortcut}
                onChange={(e) => setNewWithdrawalShortcut(e.target.value)}
                className="sm:col-span-3 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
              />
              <input
                type="text"
                placeholder="Propósito del retiro"
                value={newWithdrawalPurpose}
                onChange={(e) => setNewWithdrawalPurpose(e.target.value)}
                className="sm:col-span-4 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <input
                type="text"
                value={newWithdrawalResponsible}
                onChange={(e) => setNewWithdrawalResponsible(e.target.value)}
                className="sm:col-span-3 px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white"
              />
              <button
                type="submit"
                data-testid="submit-new-withdrawal-btn"
                className="sm:col-span-2 pressable px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap"
              >
                + Nuevo Retiro
              </button>
            </form>
          </div>
        )}
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
                        <th className="py-3 px-3">Propósito</th>
                        <th className="py-3 px-3 whitespace-nowrap">Proveedor</th>
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

                              {/* 1. Fecha */}
                              <td className="py-3 px-3 font-bold text-slate-800 tabular-nums whitespace-nowrap align-middle">
                                {formatDate(m.effectiveDate)}
                              </td>

                              {/* 2. N° Referencia */}
                              <td className="py-3 px-3 whitespace-nowrap align-middle">
                                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {!m.isApplied
                                    ? 'PROYECTADO'
                                    : m.primary.ref_number || 'DIRECTO'}
                                </span>
                              </td>

                              {/* 3. Organización */}
                              <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap align-middle">
                                {m.isShared
                                  ? 'Varios'
                                  : ORGANIZATION_SHORT_LABELS[m.primary.organization]}
                              </td>

                              {/* 4. Propósito (etiqueta pendiente arriba del propósito) */}
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

                              {/* 5. Proveedor */}
                              <td className="py-3 px-3 text-slate-600 align-middle">
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
                                <td colSpan={7} className="py-2.5 px-3">
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
                                    : m.primary.ref_number || 'DIRECTO'}
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
                      const isClosingThis = closingWithdrawalId === w.id;
                      const isCash = w.movementType === 'EFECTIVO';
                      const isOpen = isCash && w.status === 'PENDIENTE_JUSTIFICAR';
                      return (
                        <React.Fragment key={w.id}>
                          <tr
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
                              {isOpen && !isClosingThis ? (
                                <button
                                  type="button"
                                  data-testid={`close-withdrawal-btn-${w.withdrawal_ref}`}
                                  onClick={() => {
                                    setClosingWithdrawalId(w.id);
                                    setClosingReturnDate(new Date().toISOString().slice(0, 10));
                                    setClosingReturnAmount(w.pendingToRender.toFixed(2));
                                  }}
                                  className="pressable px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[10px] font-bold"
                                >
                                  Cerrar en $ 0,00
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Cerrado
                                </span>
                              )}
                            </td>
                          </tr>

                          {isClosingThis && (
                            <tr className="bg-amber-50/80">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span className="text-xs font-bold text-slate-700 mr-2">
                                    Confirmar devolución para cerrar {w.withdrawal_ref}:
                                  </span>
                                  <input
                                    type="date"
                                    value={closingReturnDate}
                                    onChange={(e) => setClosingReturnDate(e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white tabular-nums"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={closingReturnAmount}
                                    onChange={(e) => setClosingReturnAmount(e.target.value)}
                                    className="w-28 px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white tabular-nums text-right"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setClosingWithdrawalId(null)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200/60"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const amt = parseFloat(closingReturnAmount);
                                      await onCloseWithdrawalInZero(
                                        w.id,
                                        Number.isFinite(amt) ? amt : w.pendingToRender,
                                        closingReturnDate
                                      );
                                      setClosingWithdrawalId(null);
                                      triggerToast(
                                        `Retiro ${w.withdrawal_ref} cerrado en $ 0,00 (${formatDate(
                                          closingReturnDate
                                        )}).`
                                      );
                                    }}
                                    className="px-3 py-1 rounded-lg bg-emerald-800 text-white text-xs font-bold"
                                  >
                                    Confirmar cierre
                                  </button>
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
                {filteredWithdrawals.map((w) => {
                  const isClosingThis = closingWithdrawalId === w.id;
                  const isCash = w.movementType === 'EFECTIVO';
                  const isOpen = isCash && w.status === 'PENDIENTE_JUSTIFICAR';
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
                          {isOpen && !isClosingThis && (
                            <button
                              type="button"
                              onClick={() => {
                                setClosingWithdrawalId(w.id);
                                setClosingReturnDate(new Date().toISOString().slice(0, 10));
                                setClosingReturnAmount(w.pendingToRender.toFixed(2));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[10px] font-bold"
                            >
                              Cerrar en $ 0,00
                            </button>
                          )}
                        </div>
                      </div>

                      {isClosingThis && (
                        <div className="pt-2 border-t border-amber-200 space-y-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="date"
                              value={closingReturnDate}
                              onChange={(e) => setClosingReturnDate(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-[11px] bg-white tabular-nums"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={closingReturnAmount}
                              onChange={(e) => setClosingReturnAmount(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-[11px] bg-white tabular-nums text-right"
                            />
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setClosingWithdrawalId(null)}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const amt = parseFloat(closingReturnAmount);
                                await onCloseWithdrawalInZero(
                                  w.id,
                                  Number.isFinite(amt) ? amt : w.pendingToRender,
                                  closingReturnDate
                                );
                                setClosingWithdrawalId(null);
                                triggerToast(
                                  `Retiro ${w.withdrawal_ref} cerrado en $ 0,00 (${formatDate(
                                    closingReturnDate
                                  )}).`
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[10px] font-bold"
                            >
                              Confirmar cierre
                            </button>
                          </div>
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

      {/* ==================== PESTAÑA 2: PRESUPUESTOS ==================== */}
      {subTab === 'BUDGETS' && (
        <BudgetManagementSection
          year={selectedYear}
          budgets={budgets}
          onSaveBudgetAllocation={onSaveBudgetAllocation || (async () => {})}
          onSavedToast={triggerToast}
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
    </div>
  );
};
