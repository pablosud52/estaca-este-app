import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
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
  ORGANIZATION_SHORT_LABELS,
  parseMmddMontoShortcut,
} from '../lib/formatters';
import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  SupplierRecord,
} from '../types/database';
import { BudgetManagementSection } from './BudgetManagementSection';
import { ExpenseFormModal, ExpenseGroupEditData } from './ExpenseFormModal';

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
  isShared: boolean;
  effectiveDate: string;
  accountingDate: string;
}

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
  const [subTab, setSubTab] = useState<'LOAD_AND_RETIROS' | 'BUDGETS' | 'EXCEL_SYNC'>(
    'LOAD_AND_RETIROS'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal de Añadir / Editar Gasto
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroupEditData | null>(null);

  // Filtros del Libro de Comprobantes
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [onlyPendingLcr, setOnlyPendingLcr] = useState(false);

  // Nuevo Retiro + Confirmación de Cierre con fecha real
  const [newWithdrawalShortcut, setNewWithdrawalShortcut] = useState('');
  const [newWithdrawalPurpose, setNewWithdrawalPurpose] = useState('');
  const [newWithdrawalResponsible, setNewWithdrawalResponsible] = useState('Pablo Lamela');
  const [closingWithdrawalId, setClosingWithdrawalId] = useState<number | null>(null);
  const [closingReturnDate, setClosingReturnDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [closingReturnAmount, setClosingReturnAmount] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  // =========================================================================
  // 1. CÁLCULOS EN VIVO DEL MONITOR DE CONCILIACIÓN LCR
  // =========================================================================
  const reconciliationStats = useMemo(() => {
    const totalWithdrawn = withdrawals.reduce((acc, w) => acc + Number(w.amount), 0);
    const totalReturnedDeposits = withdrawals.reduce(
      (acc, w) => acc + Number(w.returned_amount || 0),
      0
    );

    const withdrawalDetails = withdrawals.map((w) => {
      const linkedExpenses = expenses.filter((e) => e.withdrawal_ref === w.withdrawal_ref);
      const renderedAmount = linkedExpenses.reduce((acc, e) => acc + Number(e.gross_amount), 0);
      const rawPending = Number(w.amount) - renderedAmount - Number(w.returned_amount || 0);
      const pendingToRender =
        w.status === 'CERRADO_EN_CERO' ? 0 : Math.max(0, Number(rawPending.toFixed(2)));

      return {
        ...w,
        renderedAmount,
        pendingToRender,
      };
    });

    const openWithdrawals = withdrawalDetails.filter((w) => w.status === 'PENDIENTE_JUSTIFICAR');
    const totalUnjustifiedWithdrawalsAmount = openWithdrawals.reduce(
      (acc, w) => acc + w.pendingToRender,
      0
    );

    const totalRenderedInWithdrawals = totalWithdrawn - totalUnjustifiedWithdrawalsAmount;
    const pendingLcrExpenses = expenses.filter((e) => e.status === 'PENDIENTE_LCR');
    const pendingLcrTotalAmount = pendingLcrExpenses.reduce(
      (acc, e) => acc + Number(e.gross_amount),
      0
    );

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
      totalPendingDifference,
      semaphoreState,
    };
  }, [withdrawals, expenses]);

  // =========================================================================
  // 2. AGRUPACIÓN DE MOVIMIENTOS LCR (PARA MOSTRAR COMPARTIDOS COMO 1 SOLO)
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

      result.push({
        key,
        ids: records.map((r) => r.id),
        records,
        primary,
        totalGross,
        totalExternalReimb,
        totalNet,
        isPendingLcr: records.some((r) => r.status === 'PENDIENTE_LCR'),
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

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return groupedMovements.filter((m) => {
      if (onlyPendingLcr && !m.isPendingLcr) return false;
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
  }, [groupedMovements, ledgerSearch, onlyPendingLcr]);

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
        ? `Comprobante "${records[0].concept}" actualizado (${formatCurrency(totalAmt)}).`
        : records.length > 1
        ? `Gasto compartido registrado entre ${records.length} organizaciones (${formatCurrency(totalAmt)}).`
        : `Comprobante "${records[0].concept}" registrado (${formatCurrency(totalAmt)}).`
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
              Control de retiros, gastos por actividad y conciliación LCR
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
              Total Retirado
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
              Pendientes de asentar en LCR
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

      {/* ==================== PESTAÑAS SIMPLIFICADAS ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            data-testid="ops-subtab-load"
            onClick={() => setSubTab('LOAD_AND_RETIROS')}
            className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
              subTab === 'LOAD_AND_RETIROS'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Gastos y Retiros</span>
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

        {subTab === 'LOAD_AND_RETIROS' && (
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

      {/* ==================== PESTAÑA 1: GASTOS Y RETIROS ==================== */}
      {subTab === 'LOAD_AND_RETIROS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* COLUMNA PRINCIPAL (8 cols): LIBRO MAYOR DE COMPROBANTES */}
          <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Comprobantes de Gasto ({filteredMovements.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Muestra fecha de actividad y estado LCR
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOnlyPendingLcr((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap transition ${
                    onlyPendingLcr
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Pendientes LCR
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[34rem] overflow-y-auto">
              {filteredMovements.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No se encontraron comprobantes con ese filtro.
                </div>
              ) : (
                filteredMovements.map((m) => (
                  <div
                    key={m.key}
                    data-testid={`admin-expense-row-${m.primary.id}`}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      m.isPendingLcr ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {m.primary.ref_number || 'DIRECTO'}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800 tabular-nums">
                          {formatDate(m.effectiveDate)}
                        </span>
                        {m.accountingDate !== m.effectiveDate && (
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            (LCR: {formatDate(m.accountingDate)})
                          </span>
                        )}
                        {m.isPendingLcr ? (
                          <span
                            data-testid={`pending-lcr-pill-${m.primary.id}`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Pendiente LCR</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            ✓ LCR
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">
                        {m.primary.concept}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[11px] text-slate-500 mr-1">
                          {m.primary.supplier_name}
                        </span>
                        {m.records.map((r) => (
                          <span
                            key={r.id}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 tabular-nums"
                          >
                            {ORGANIZATION_SHORT_LABELS[r.organization]}
                            {m.isShared ? `: ${formatCurrency(r.gross_amount)}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums">
                          {formatCurrency(m.totalGross)}
                        </p>
                        {m.totalExternalReimb > 0 && (
                          <p className="text-[10px] font-bold text-emerald-700 tabular-nums">
                            Neto: {formatCurrency(m.totalNet)}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        title="Editar movimiento"
                        data-testid={`edit-expense-btn-${m.primary.id}`}
                        onClick={() => {
                          setEditingGroup({ ids: m.ids, records: m.records });
                          setIsExpenseModalOpen(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {m.isPendingLcr && (
                        <button
                          type="button"
                          data-testid={`reconcile-lcr-btn-${m.primary.id}`}
                          onClick={() => handleReconcileGroup(m)}
                          className="pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Conciliar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA (4 cols): RETIROS DE EFECTIVO */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Retiros de Efectivo ({withdrawals.length})
              </h3>
              <p className="text-xs text-slate-500">
                Control de efectivo hasta cierre en $ 0,00
              </p>
            </div>

            <form
              onSubmit={handleAddWithdrawal}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
            >
              <p className="text-xs font-bold text-slate-800">+ Nuevo Retiro</p>
              <input
                type="text"
                data-testid="new-withdrawal-shortcut-input"
                placeholder="MMDD-MONTO (ej: 1105-20000)"
                value={newWithdrawalShortcut}
                onChange={(e) => setNewWithdrawalShortcut(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
              />
              <input
                type="text"
                placeholder="Propósito"
                value={newWithdrawalPurpose}
                onChange={(e) => setNewWithdrawalPurpose(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newWithdrawalResponsible}
                  onChange={(e) => setNewWithdrawalResponsible(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white flex-1 min-w-0"
                />
                <button
                  type="submit"
                  data-testid="submit-new-withdrawal-btn"
                  className="pressable px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap"
                >
                  Cargar
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
              {reconciliationStats.withdrawalDetails.map((w) => {
                const isClosingThis = closingWithdrawalId === w.id;
                return (
                  <div
                    key={w.id}
                    data-testid={`withdrawal-row-${w.withdrawal_ref}`}
                    className={`p-3 rounded-2xl border text-xs ${
                      w.status === 'PENDIENTE_JUSTIFICAR'
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-50/60 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-slate-900">
                        {w.withdrawal_ref}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          w.status === 'CERRADO_EN_CERO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-200/80 text-amber-950'
                        }`}
                      >
                        {w.status === 'CERRADO_EN_CERO' ? 'Cerrado' : 'Por rendir'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                      <span>
                        {formatDate(w.withdrawal_date)} • {w.responsible_person}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatCurrency(w.amount)}
                      </span>
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 tabular-nums">
                        Pendiente: <strong>{formatCurrency(w.pendingToRender)}</strong>
                      </span>
                      {w.status === 'PENDIENTE_JUSTIFICAR' && !isClosingThis && (
                        <button
                          type="button"
                          data-testid={`close-withdrawal-btn-${w.withdrawal_ref}`}
                          onClick={() => {
                            setClosingWithdrawalId(w.id);
                            setClosingReturnDate(new Date().toISOString().slice(0, 10));
                            setClosingReturnAmount(w.pendingToRender.toFixed(2));
                          }}
                          className="pressable px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[10px] font-bold"
                        >
                          Cerrar en $ 0,00
                        </button>
                      )}
                    </div>

                    {isClosingThis && (
                      <div className="mt-2 pt-2 border-t border-amber-200 space-y-2">
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
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-200/60"
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
          </div>
        </div>
      )}

      {/* ==================== PESTAÑA 2: PRESUPUESTOS ==================== */}
      {subTab === 'BUDGETS' && (
        <BudgetManagementSection
          year={selectedYear}
          budgets={budgets}
          onSaveBudgetAllocation={
            onSaveBudgetAllocation || (async () => {})
          }
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
