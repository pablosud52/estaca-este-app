import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Banknote,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react';
import { matchesDateRange } from '../lib/calendarHelpers';
import {
  formatCurrency,
  formatDate,
  getExpenseEffectiveDate,
  getExpenseWithdrawalAllocations,
  getQuarterFromDate,
  getTodayLocalIso,
  isExpenseApplied,
  ORGANIZATION_LABELS,
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
import { useAuth } from '../context/AuthContext';
import {
  detectDuplicateGroups,
  dismissDuplicateGroupPairs,
  DuplicateGroup,
  groupExpensesIntoMovements,
  GroupedExpenseMovement,
  loadDismissedDuplicatePairs,
} from '../lib/duplicateDetection';
import { BudgetManagementSection } from './BudgetManagementSection';
import { DuplicateReviewModal } from './DuplicateReviewModal';
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
  canEdit?: boolean;
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
  onCloseActivityWithoutExpense?: (activityId: number) => Promise<void>;
  onReconcileLcrExpense: (id: number) => Promise<void>;
  onReconcileLcrExpenseGroup?: (ids: number[]) => Promise<void>;
  onCreateWithdrawal: (
    withdrawal: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => Promise<void>;
  onCloseWithdrawalInZero?: (id: number, returnAmount: number, returnDate: string) => Promise<void>;
  onDeleteWithdrawal?: (id: number) => Promise<void>;
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

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  EFECTIVO: 'Efectivo',
  DIRECTO_TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
};

export const AdminOperationsCenter: React.FC<AdminOperationsCenterProps> = ({
  selectedYear = 2026,
  canEdit = true,
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
  onCloseActivityWithoutExpense,
  onReconcileLcrExpense,
  onReconcileLcrExpenseGroup,
  onCreateWithdrawal,
  onCloseWithdrawalInZero,
  onDeleteWithdrawal,
  onCreateSupplier,
  onSaveBudgetAllocation,
  onSaveOpeningBalance,
  onSaveQuarterIncomes,
  onResetFutureYearProjection,
}) => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<'EXPENSES' | 'WITHDRAWALS' | 'BUDGETS' | 'EXCEL_SYNC'>(
    'EXPENSES'
  );
  const [budgetSubTab, setBudgetSubTab] = useState<'INCOMES' | 'DISTRIBUTION'>('INCOMES');
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmWithdrawalAction, setConfirmWithdrawalAction] = useState<{
    id: number;
    type: 'close' | 'delete';
  } | null>(null);
  const [confirmResetProjection, setConfirmResetProjection] = useState(false);

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
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [dismissedDuplicatePairs, setDismissedDuplicatePairs] = useState<Set<string>>(() =>
    loadDismissedDuplicatePairs()
  );

  // Filtros y orden del Libro de Comprobantes (Gastos) y filas desplegadas (Varios)
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'PENDING_LCR' | 'PROJECTED'>('ALL');
  const [ledgerSortDir, setLedgerSortDir] = useState<'desc' | 'asc'>('desc');
  const [showLedgerDateFilter, setShowLedgerDateFilter] = useState(false);
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');

  // Orden y rango de fechas de Movimientos
  const [withdrawalSortDir, setWithdrawalSortDir] = useState<'desc' | 'asc'>('desc');
  const [showWithdrawalDateFilter, setShowWithdrawalDateFilter] = useState(false);
  const [withdrawalDateFrom, setWithdrawalDateFrom] = useState('');
  const [withdrawalDateTo, setWithdrawalDateTo] = useState('');
  const [expandedSharedKeys, setExpandedSharedKeys] = useState<Record<string, boolean>>({});
  const [selectedLcrKeys, setSelectedLcrKeys] = useState<string[]>([]);
  const [isBatchReconciling, setIsBatchReconciling] = useState(false);
  const [isQuarterChecklistOpen, setIsQuarterChecklistOpen] = useState(false);

  const toggleSharedRow = (key: string) => {
    setExpandedSharedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filtros de la tabla de Movimientos (Retiros, Tarjeta, Transferencias, Depósitos)
  const [withdrawalTypeFilter, setWithdrawalTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

  const todayStr = useMemo(() => getTodayLocalIso(), []);

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text: msg, type });
    setTimeout(() => setToastMsg(null), type === 'error' ? 6000 : 4500);
  };

  // =========================================================================
  // 1. CÁLCULOS EN VIVO DEL MONITOR DE CONCILIACIÓN LCR (CON SOPORTE DE 2 RETIROS)
  // =========================================================================
  const reconciliationStats = useMemo(() => {
    const appliedExpenses = expenses.filter((e) => isExpenseApplied(e));
    const allAppliedExpenses = (allExpenses ?? expenses).filter((e) => isExpenseApplied(e));

    // Sumar cuánto consumió cada retiro usando `withdrawal_allocations` (soporta hasta 2 retiros por gasto y arrastre entre años)
    const renderedByRef = new Map<string, number>();
    allAppliedExpenses.forEach((exp) => {
      const allocs = getExpenseWithdrawalAllocations(exp);
      allocs.forEach((a) => {
        renderedByRef.set(
          a.withdrawal_ref,
          Number(((renderedByRef.get(a.withdrawal_ref) || 0) + a.amount).toFixed(2))
        );
      });
    });

    const yearStartStr = `${selectedYear}-01-01`;
    const relevantWithdrawals = withdrawals.filter((w) => {
      if (w.withdrawal_date.startsWith(String(selectedYear))) return true;
      // Mantener visibles retiros de efectivo abiertos de años anteriores (ej. diciembre del año previo)
      const isCash = !w.movement_type || w.movement_type === 'EFECTIVO';
      if (!isCash || w.withdrawal_date >= yearStartStr || w.status === 'CERRADO_EN_CERO') return false;
      const spent = renderedByRef.get(w.withdrawal_ref) || 0;
      const pending = Number((Number(w.amount) - spent - Number(w.returned_amount || 0)).toFixed(2));
      return pending > 0;
    });

    const cashWithdrawalsOnly = relevantWithdrawals.filter(
      (w) => !w.movement_type || w.movement_type === 'EFECTIVO'
    );

    const totalWithdrawn = cashWithdrawalsOnly.reduce((acc, w) => acc + Number(w.amount), 0);
    const totalReturnedDeposits = cashWithdrawalsOnly.reduce(
      (acc, w) => acc + Number(w.returned_amount || 0),
      0
    );

    const withdrawalDetails = relevantWithdrawals.map((w) => {
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
  }, [withdrawals, expenses, allExpenses, budgets, selectedYear]);

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
  const groupedMovements = useMemo<GroupedExpenseMovement[]>(
    () => groupExpensesIntoMovements(expenses),
    [expenses]
  );

  const projectedMovements = useMemo<GroupedExpenseMovement[]>(() => {
    const baseProjected = groupedMovements.filter((m) => !m.isApplied);
    const coveredActivityIds = new Set<number>();
    expenses.forEach((e) => {
      if (e.activity_id != null) coveredActivityIds.add(e.activity_id);
    });

    const yearStr = String(selectedYear);
    const virtualCalendarMovements: GroupedExpenseMovement[] = activities
      .filter(
        (act) =>
          act.status !== 'RECHAZADA' &&
          act.status !== 'CANCELADA' &&
          !act.ical_uid?.startsWith('ACT-2026-') &&
          Boolean(act.event_date) &&
          act.event_date.startsWith(yearStr) &&
          Number(act.estimated_cost || 0) > 0 &&
          !coveredActivityIds.has(act.id)
      )
      .map((act) => {
        const estimated = Number(act.estimated_cost);
        const syntheticRecord: ExpenseRecord = {
          id: -act.id,
          ref_number: null,
          expense_date: act.event_date,
          activity_date: act.event_date,
          activity_id: act.id,
          shared_group_id: null,
          expense_type: 'PROYECTADO_ACTIVIDAD',
          is_applied: false,
          withdrawal_allocations: [],
          organization: act.organization,
          supplier_name: 'Por definir',
          concept: act.title,
          gross_amount: estimated,
          external_reimbursement: 0,
          net_amount: estimated,
          is_reimbursable_oai: false,
          status: 'PENDIENTE_LCR',
          withdrawal_ref: null,
        };
        return {
          key: `virtual-act-${act.id}`,
          ids: [],
          records: [syntheticRecord],
          primary: syntheticRecord,
          totalGross: estimated,
          totalNet: estimated,
          totalExternalReimb: 0,
          isApplied: false,
          isPendingLcr: false,
          isShared: false,
          accountingDate: act.event_date,
          effectiveDate: act.event_date,
        };
      });

    return [...baseProjected, ...virtualCalendarMovements].sort((a, b) => {
      const aOverdue = a.effectiveDate <= todayStr ? 0 : 1;
      const bOverdue = b.effectiveDate <= todayStr ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return a.effectiveDate.localeCompare(b.effectiveDate);
    });
  }, [groupedMovements, expenses, activities, selectedYear, todayStr]);

  const duplicateGroups = useMemo<DuplicateGroup[]>(
    () => detectDuplicateGroups(groupedMovements, dismissedDuplicatePairs),
    [groupedMovements, dismissedDuplicatePairs]
  );

  // Actividades proyectadas cuya fecha ya llegó o pasó -> Alerta "Pendiente de rendir"
  const dueProjectedMovements = useMemo(
    () =>
      projectedMovements.filter(
        (m) =>
          !m.isApplied &&
          m.primary.expense_type === 'PROYECTADO_ACTIVIDAD' &&
          m.effectiveDate <= todayStr
      ),
    [projectedMovements, todayStr]
  );

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    const sourceList =
      ledgerFilter === 'PROJECTED'
        ? projectedMovements
        : groupedMovements.filter((m) => {
            if (ledgerFilter === 'PENDING_LCR' && !m.isPendingLcr) return false;
            return true;
          });

    return sourceList
      .filter((m) => {
        if (
          (ledgerDateFrom || ledgerDateTo) &&
          !matchesDateRange(m.accountingDate, ledgerDateFrom, ledgerDateTo)
        ) {
          return false;
        }
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
      })
      .sort((a, b) => {
        // Pendientes de LCR siempre arriba
        if (a.isPendingLcr && !b.isPendingLcr) return -1;
        if (!a.isPendingLcr && b.isPendingLcr) return 1;
        // Orden por fecha contable / LCR
        return ledgerSortDir === 'desc'
          ? b.accountingDate.localeCompare(a.accountingDate)
          : a.accountingDate.localeCompare(b.accountingDate);
      });
  }, [
    groupedMovements,
    projectedMovements,
    ledgerSearch,
    ledgerFilter,
    ledgerDateFrom,
    ledgerDateTo,
    ledgerSortDir,
  ]);

  const handleOpenPassToExpense = (m: GroupedExpenseMovement) => {
    setEditingGroup({
      ids: m.ids,
      records: m.records,
      forceRealMode: true,
      originalProjectedAmount: m.totalGross,
    });
    setIsExpenseModalOpen(true);
  };

  const handleCloseProjectedWithoutExpense = async (m: GroupedExpenseMovement) => {
    if (m.primary.activity_id && onCloseActivityWithoutExpense) {
      await onCloseActivityWithoutExpense(m.primary.activity_id);
      return;
    }
    if (m.ids.length > 0 && onDeleteExpenseGroup) {
      await onDeleteExpenseGroup(m.ids);
    }
  };

  const filteredWithdrawals = useMemo(() => {
    const q = withdrawalSearch.trim().toLowerCase();
    const numericQ = q.replace(/[$.\s]/g, '').replace(',', '.');

    return reconciliationStats.withdrawalDetails
      .filter((w) => {
        if (withdrawalTypeFilter !== 'ALL' && w.movementType !== withdrawalTypeFilter) {
          return false;
        }
        if (
          (withdrawalDateFrom || withdrawalDateTo) &&
          !matchesDateRange(w.withdrawal_date, withdrawalDateFrom, withdrawalDateTo)
        ) {
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
      .sort((a, b) =>
        withdrawalSortDir === 'desc'
          ? b.withdrawal_date.localeCompare(a.withdrawal_date)
          : a.withdrawal_date.localeCompare(b.withdrawal_date)
      );
  }, [
    reconciliationStats.withdrawalDetails,
    withdrawalTypeFilter,
    withdrawalSearch,
    withdrawalDateFrom,
    withdrawalDateTo,
    withdrawalSortDir,
  ]);

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

  const pendingLcrCount = useMemo(
    () => groupedMovements.filter((m) => m.isPendingLcr).length,
    [groupedMovements]
  );

  const quarterCloseStats = useMemo(() => {
    const currentQuarter = getQuarterFromDate(todayStr);
    const overdueProjectedCount = dueProjectedMovements.length;
    const openWithdrawalsCount = reconciliationStats.openWithdrawals.length;
    const totalPending = overdueProjectedCount + openWithdrawalsCount + pendingLcrCount;
    return {
      currentQuarter,
      overdueProjectedCount,
      openWithdrawalsCount,
      pendingLcrCount,
      totalPending,
    };
  }, [todayStr, dueProjectedMovements.length, reconciliationStats.openWithdrawals.length, pendingLcrCount]);

  const visiblePendingLcrMovements = useMemo(
    () => filteredMovements.filter((m) => m.isPendingLcr),
    [filteredMovements]
  );

  const selectedPendingMovements = useMemo(
    () => visiblePendingLcrMovements.filter((m) => selectedLcrKeys.includes(m.key)),
    [visiblePendingLcrMovements, selectedLcrKeys]
  );

  const toggleSelectLcrKey = (key: string) => {
    setSelectedLcrKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAllVisibleLcr = () => {
    const visibleKeys = visiblePendingLcrMovements.map((m) => m.key);
    const allSelected =
      visibleKeys.length > 0 && visibleKeys.every((k) => selectedLcrKeys.includes(k));
    if (allSelected) {
      setSelectedLcrKeys((prev) => prev.filter((k) => !visibleKeys.includes(k)));
    } else {
      setSelectedLcrKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  const handleBatchReconcileLcr = async () => {
    if (selectedPendingMovements.length === 0 || isBatchReconciling) return;
    setIsBatchReconciling(true);
    try {
      const allIds = selectedPendingMovements.flatMap((m) => m.ids);
      const count = selectedPendingMovements.length;
      if (onReconcileLcrExpenseGroup) {
        await onReconcileLcrExpenseGroup(allIds);
      } else {
        for (const id of allIds) {
          await onReconcileLcrExpense(id);
        }
      }
      setSelectedLcrKeys([]);
      triggerToast(
        count === 1
          ? '1 comprobante marcado como registrado en LCR.'
          : `${count} comprobantes marcados como registrados en LCR.`
      );
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'No se pudieron conciliar los comprobantes en LCR.',
        'error'
      );
    } finally {
      setIsBatchReconciling(false);
    }
  };

  const handleReconcileGroup = async (movement: GroupedExpenseMovement) => {
    try {
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
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'No se pudo conciliar el comprobante en LCR.',
        'error'
      );
    }
  };

  const handleDeleteDuplicateMovement = async (movement: GroupedExpenseMovement) => {
    if (!onDeleteExpenseGroup) return;
    try {
      await onDeleteExpenseGroup(movement.ids);
      triggerToast(
        `Gasto duplicado "${movement.primary.concept}" (${formatCurrency(
          movement.totalGross
        )}) eliminado.`
      );
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'No se pudo eliminar el gasto duplicado.',
        'error'
      );
    }
  };

  const handleCloseWithdrawalRow = async (w: {
    id: number;
    withdrawal_ref: string;
    pendingToRender: number;
  }) => {
    if (!onCloseWithdrawalInZero) return;
    try {
      await onCloseWithdrawalInZero(w.id, w.pendingToRender, todayStr);
      setConfirmWithdrawalAction(null);
      triggerToast(
        `Retiro ${w.withdrawal_ref} cerrado en 0,00 (devolución registrada: ${formatCurrency(
          w.pendingToRender
        )}).`
      );
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'No se pudo cerrar el retiro en cero.',
        'error'
      );
    }
  };

  const handleDeleteWithdrawalRow = async (w: {
    id: number;
    withdrawal_ref: string;
    movementType: MovementType;
  }) => {
    if (!onDeleteWithdrawal) return;
    const hasLinkedExpenses = (allExpenses ?? expenses).some((exp) => {
      if (exp.withdrawal_ref === w.withdrawal_ref) return true;
      return getExpenseWithdrawalAllocations(exp).some((a) => a.withdrawal_ref === w.withdrawal_ref);
    });
    if (hasLinkedExpenses) {
      setConfirmWithdrawalAction(null);
      triggerToast(
        `No se puede eliminar ${w.withdrawal_ref} porque tiene gastos vinculados. Edita o elimina esos gastos primero.`,
        'error'
      );
      return;
    }
    try {
      await onDeleteWithdrawal(w.id);
      setConfirmWithdrawalAction(null);
      triggerToast(`Movimiento ${w.withdrawal_ref} eliminado.`);
    } catch (err) {
      triggerToast(
        err instanceof Error ? err.message : 'No se pudo eliminar el movimiento.',
        'error'
      );
    }
  };

  const handleIgnoreDuplicateGroup = (group: DuplicateGroup) => {
    const next = dismissDuplicateGroupPairs(
      group.movements.map((m) => m.key),
      dismissedDuplicatePairs
    );
    setDismissedDuplicatePairs(next);
    triggerToast('Alerta marcada como válida (no es duplicado).');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ==================== MONITOR DE CONCILIACIÓN LCR ==================== */}
      <div className="bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] rounded-3xl p-5 text-white shadow-xl border border-white/10">
        {!canEdit && (
          <div
            data-testid="finance-readonly-banner"
            className="mb-3 rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2 text-xs font-semibold text-sky-100 flex items-center justify-between gap-2"
          >
            <span>👁️ Vista de solo lectura — Solo Administradores y Secretario Financiero pueden editar finanzas.</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/12">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div
            data-testid="monitor-card-global-budget"
            className="p-3.5 rounded-2xl bg-white/10 border border-white/15"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200">
              Presupuesto Global
            </span>
            <p
              data-testid="monitor-global-budget-amount"
              className="text-lg font-extrabold text-white tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.globalBudgetAvailable)}
            </p>
          </div>

          <div
            data-testid="monitor-card-cash-on-hand"
            className="p-3.5 rounded-2xl bg-white/10 border border-white/15"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
              Monto en Efectivo
            </span>
            <p
              data-testid="monitor-cash-on-hand-amount"
              className={`text-lg font-extrabold tabular-nums mt-1 ${
                reconciliationStats.cashOnHand < 0 ? 'text-rose-200' : 'text-white'
              }`}
            >
              {formatCurrency(reconciliationStats.cashOnHand)}
            </p>
          </div>

          <div
            data-testid="monitor-card-pending-lcr"
            className="p-3.5 rounded-2xl bg-white/10 border border-white/15"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-200">
                Pendientes en LCR
              </span>
              <span
                data-testid="monitor-pending-lcr-count"
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-100 tabular-nums"
              >
                {reconciliationStats.pendingLcrExpenses.length} en mano
              </span>
            </div>
            <p
              data-testid="monitor-pending-lcr-amount"
              className="text-lg font-extrabold text-rose-200 tabular-nums mt-1"
            >
              {formatCurrency(reconciliationStats.pendingLcrTotalAmount)}
            </p>
            <p
              data-testid="monitor-cash-after-pending-lcr"
              className={`text-[11px] mt-1 tabular-nums font-semibold ${
                reconciliationStats.cashAfterPendingLcr < 0
                  ? 'text-rose-200'
                  : 'text-sky-100/80'
              }`}
            >
              Efectivo − Pend. LCR:{' '}
              {formatCurrency(reconciliationStats.cashAfterPendingLcr)}
            </p>
          </div>
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

      {/* Control de cierre de trimestre (desplegable, cerrado por defecto) */}
      <div
        data-testid="quarter-close-checklist"
        className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden"
      >
        <button
          type="button"
          data-testid="quarter-checklist-toggle"
          aria-expanded={isQuarterChecklistOpen}
          onClick={() => setIsQuarterChecklistOpen((prev) => !prev)}
          className="pressable w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition"
        >
          <span className="text-xs font-extrabold text-slate-900">
            Control de cierre {quarterCloseStats.currentQuarter} ({selectedYear})
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span
              data-testid="quarter-checklist-status"
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full tabular-nums ${
                quarterCloseStats.totalPending === 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              {quarterCloseStats.totalPending === 0
                ? 'Listo para cerrar'
                : quarterCloseStats.totalPending === 1
                ? '1 pendiente'
                : `${quarterCloseStats.totalPending} pendientes`}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ease-out-expo ${
                isQuarterChecklistOpen ? 'rotate-180 text-slate-700' : ''
              }`}
            />
          </span>
        </button>

        <div className="accordion-content" data-open={isQuarterChecklistOpen}>
          <div className="accordion-inner">
            <div
              data-testid="quarter-checklist-body"
              className="border-t border-slate-100 divide-y divide-slate-100 text-xs"
            >
              {/* 1. Actividades vencidas sin rendir */}
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {quarterCloseStats.overdueProjectedCount === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800">
                    Actividades vencidas sin rendir
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    {quarterCloseStats.overdueProjectedCount}
                  </span>
                  {quarterCloseStats.overdueProjectedCount > 0 && (
                    <button
                      type="button"
                      data-testid="checklist-go-projected"
                      onClick={() => {
                        setSubTab('EXPENSES');
                        setLedgerFilter('PROJECTED');
                      }}
                      className="pressable px-2.5 py-1 rounded-xl bg-[#072B52] hover:bg-[#083563] text-white text-[11px] font-bold"
                    >
                      Ir a Proyectados
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Retiros de efectivo sin cerrar */}
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {quarterCloseStats.openWithdrawalsCount === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Banknote className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800">
                    Retiros de efectivo sin cerrar
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    {quarterCloseStats.openWithdrawalsCount}
                  </span>
                  {quarterCloseStats.openWithdrawalsCount > 0 && (
                    <button
                      type="button"
                      data-testid="checklist-go-withdrawals"
                      onClick={() => setSubTab('WITHDRAWALS')}
                      className="pressable px-2.5 py-1 rounded-xl bg-[#072B52] hover:bg-[#083563] text-white text-[11px] font-bold"
                    >
                      Ir a Retiros
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Comprobantes pendientes de LCR */}
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {quarterCloseStats.pendingLcrCount === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800">
                    Comprobantes pendientes de LCR
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-extrabold text-slate-900 tabular-nums">
                    {quarterCloseStats.pendingLcrCount}
                  </span>
                  {quarterCloseStats.pendingLcrCount > 0 && (
                    <button
                      type="button"
                      data-testid="checklist-go-pending-lcr"
                      onClick={() => {
                        setSubTab('EXPENSES');
                        setLedgerFilter('PENDING_LCR');
                      }}
                      className="pressable px-2.5 py-1 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold"
                    >
                      Ir a Pend. LCR
                    </button>
                  )}
                </div>
              </div>
            </div>
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
                onClick={() => handleOpenPassToExpense(m)}
                className="px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-[11px] font-extrabold"
              >
                Rendir: {m.primary.concept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de posibles pagos duplicados (Doble revisión) */}
      {duplicateGroups.length > 0 && (
        <div
          data-testid="duplicate-payments-alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 text-xs text-rose-950 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0" />
            <span>
              {duplicateGroups.length === 1
                ? 'Se detectó 1 posible pago duplicado para doble revisión.'
                : `Se detectaron ${duplicateGroups.length} posibles pagos duplicados para doble revisión.`}
            </span>
          </div>
          <button
            type="button"
            data-testid="open-duplicate-review-btn"
            onClick={() => setIsDuplicateModalOpen(true)}
            className="pressable px-3.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-extrabold self-start sm:self-auto transition"
          >
            Revisar y comparar
          </button>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          data-testid="admin-ops-toast"
          role={toastMsg.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-2xl text-white text-xs font-bold shadow-sm flex items-center gap-2 ${
            toastMsg.type === 'error'
              ? 'bg-rose-700 border border-rose-600'
              : 'bg-emerald-900'
          }`}
        >
          {toastMsg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-200 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* ==================== BLOQUE FIJO ÚNICO AL HACER SCROLL (PESTAÑAS + CONTROLES EN UNA SOLA CAJA) ==================== */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-slate-100/95 pt-1 pb-2">
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              data-testid="ops-subtab-load"
              onClick={() => setSubTab('EXPENSES')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'EXPENSES'
                  ? 'bg-[#072B52] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${subTab === 'EXPENSES' ? 'text-sky-300' : 'text-[#083563]'}`} />
              <span>Gastos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-withdrawals"
              onClick={() => setSubTab('WITHDRAWALS')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'WITHDRAWALS'
                  ? 'bg-[#072B52] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Banknote className={`w-3.5 h-3.5 ${subTab === 'WITHDRAWALS' ? 'text-sky-300' : 'text-[#083563]'}`} />
              <span>Movimientos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-budgets"
              onClick={() => setSubTab('BUDGETS')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'BUDGETS'
                  ? 'bg-[#072B52] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className={`w-3.5 h-3.5 ${subTab === 'BUDGETS' ? 'text-sky-300' : 'text-[#083563]'}`} />
              <span>Presupuestos</span>
            </button>

            <button
              type="button"
              data-testid="ops-subtab-excel"
              onClick={() => setSubTab('EXCEL_SYNC')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                subTab === 'EXCEL_SYNC'
                  ? 'bg-[#072B52] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${subTab === 'EXCEL_SYNC' ? 'text-sky-300' : 'text-[#083563]'}`} />
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
                <div className="inline-flex items-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden divide-x divide-slate-200">
                  {(
                    [
                      { id: 'ALL', label: 'Todos' },
                      {
                        id: 'PENDING_LCR',
                        label: pendingLcrCount > 0 ? `Pend. LCR (${pendingLcrCount})` : 'Pend. LCR',
                      },
                      {
                        id: 'PROJECTED',
                        label:
                          projectedMovements.length > 0
                            ? `Proyectados (${projectedMovements.length})`
                            : 'Proyectados',
                      },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLedgerFilter(f.id)}
                      className={`px-2.5 py-1.5 rounded-none text-[11px] font-bold whitespace-nowrap transition ${
                        ledgerFilter === f.id
                          ? 'bg-[#072B52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:flex-none sm:w-52 md:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por propósito, proveedor o ref..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-base sm:text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#072B52]/20 focus:border-[#072B52] transition"
                  />
                </div>

                <button
                  type="button"
                  data-testid="ledger-date-filter-toggle"
                  onClick={() => setShowLedgerDateFilter((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                    ledgerDateFrom || ledgerDateTo || showLedgerDateFilter
                      ? 'bg-sky-50 border-[#072B52] text-[#072B52]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Filtrar por rango de fecha contable LCR"
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Fechas</span>
                  {(ledgerDateFrom || ledgerDateTo) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#083563]" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="ledger-date-sort-mobile"
                  onClick={() => setLedgerSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
                  title="Alternar orden por fecha contable"
                >
                  <span>Fecha</span>
                  {ledgerSortDir === 'desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-[#072B52]" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-[#072B52]" />
                  )}
                </button>

                {canEdit && (
                  <button
                    type="button"
                    data-testid="open-add-expense-modal-btn"
                    onClick={() => {
                      setEditingGroup(null);
                      setIsExpenseModalOpen(true);
                    }}
                    className="pressable inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#083563] hover:bg-[#072B52] text-white text-xs font-extrabold shadow-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Añadir Gasto</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {subTab === 'EXPENSES' && (showLedgerDateFilter || ledgerDateFrom || ledgerDateTo) && (
            <div
              data-testid="ledger-date-range-bar"
              className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="text-[11px] font-bold text-slate-500">Fecha contable LCR:</span>
              <label className="inline-flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-600">Desde</span>
                  <input
                    type="date"
                    data-testid="ledger-date-from"
                    value={ledgerDateFrom}
                    onChange={(e) => setLedgerDateFrom(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#072B52]/20"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Hasta</span>
                  <input
                    type="date"
                    data-testid="ledger-date-to"
                    value={ledgerDateTo}
                    onChange={(e) => setLedgerDateTo(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#072B52]/20"
                  />
              </label>
              {(ledgerDateFrom || ledgerDateTo) && (
                <button
                  type="button"
                  data-testid="ledger-date-clear"
                  onClick={() => {
                    setLedgerDateFrom('');
                    setLedgerDateTo('');
                  }}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-[#072B52] bg-sky-50 border border-sky-200 hover:bg-sky-100 transition"
                >
                  Limpiar fechas
                </button>
              )}
            </div>
          )}

          {/* Controles fijos de Movimientos */}
          {subTab === 'WITHDRAWALS' && (
            <div className="border-t border-slate-200 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Movimientos de Efectivo y Salidas Directas</span>
                  <span className="text-xs font-bold text-slate-400 tabular-nums">
                    {filteredWithdrawals.length}
                  </span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto max-w-full divide-x divide-slate-200">
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
                      className={`px-2.5 py-1.5 rounded-none text-[11px] font-bold whitespace-nowrap transition ${
                        withdrawalTypeFilter === f.id
                          ? 'bg-[#072B52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:flex-none sm:w-52 md:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por ref., propósito o monto..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-base sm:text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#072B52]/20 focus:border-[#072B52] transition"
                  />
                </div>

                <button
                  type="button"
                  data-testid="withdrawal-date-filter-toggle"
                  onClick={() => setShowWithdrawalDateFilter((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition whitespace-nowrap ${
                    withdrawalDateFrom || withdrawalDateTo || showWithdrawalDateFilter
                      ? 'bg-sky-50 border-[#072B52] text-[#072B52]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Filtrar movimientos por rango de fechas"
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Fechas</span>
                  {(withdrawalDateFrom || withdrawalDateTo) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#083563]" />
                  )}
                </button>

                <button
                  type="button"
                  data-testid="withdrawal-date-sort-mobile"
                  onClick={() =>
                    setWithdrawalSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                  }
                  className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition whitespace-nowrap"
                  title="Alternar orden por fecha"
                >
                  <span>Fecha</span>
                  {withdrawalSortDir === 'desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-[#072B52]" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-[#072B52]" />
                  )}
                </button>

                {canEdit && (
                  <button
                    type="button"
                    data-testid="open-add-movement-modal-btn"
                    onClick={() => setIsMovementModalOpen(true)}
                    className="pressable inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#083563] hover:bg-[#072B52] text-white text-xs font-extrabold shadow-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Movimiento</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {subTab === 'WITHDRAWALS' &&
            (showWithdrawalDateFilter || withdrawalDateFrom || withdrawalDateTo) && (
              <div
                data-testid="withdrawal-date-range-bar"
                className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 flex flex-wrap items-center gap-2 text-xs"
              >
                <span className="text-[11px] font-bold text-slate-500">Rango de fechas:</span>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Desde</span>
                  <input
                    type="date"
                    data-testid="withdrawal-date-from"
                    value={withdrawalDateFrom}
                    onChange={(e) => setWithdrawalDateFrom(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#072B52]/20"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">Hasta</span>
                  <input
                    type="date"
                    data-testid="withdrawal-date-to"
                    value={withdrawalDateTo}
                    onChange={(e) => setWithdrawalDateTo(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#072B52]/20"
                  />
                </label>
                {(withdrawalDateFrom || withdrawalDateTo) && (
                  <button
                    type="button"
                    data-testid="withdrawal-date-clear"
                    onClick={() => {
                      setWithdrawalDateFrom('');
                      setWithdrawalDateTo('');
                    }}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-[#072B52] bg-sky-50 border border-sky-200 hover:bg-sky-100 transition"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>
            )}

          {/* Controles fijos de Presupuestos (fusionados con la barra superior como Gastos y Movimientos) */}
          {subTab === 'BUDGETS' && (
            <div className="border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
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

                <div className="inline-flex items-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden divide-x divide-slate-200">
                  <button
                    type="button"
                    data-testid="budget-subtab-incomes"
                    onClick={() => setBudgetSubTab('INCOMES')}
                    className={`px-3 py-1.5 rounded-none text-[11px] font-bold whitespace-nowrap transition ${
                      budgetSubTab === 'INCOMES'
                        ? 'bg-[#072B52] text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    1. Ingresos del Año
                  </button>
                  <button
                    type="button"
                    data-testid="budget-subtab-distribution"
                    onClick={() => setBudgetSubTab('DISTRIBUTION')}
                    className={`px-3 py-1.5 rounded-none text-[11px] font-bold whitespace-nowrap transition ${
                      budgetSubTab === 'DISTRIBUTION'
                        ? 'bg-[#072B52] text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    2. Distribución por Organización
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  data-testid="annual-income-grand-total"
                  className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-extrabold text-[#072B52] tabular-nums"
                >
                  Total anual: {formatCurrency(budgetYearSummary.annualTotalAvailable)}
                </div>

                {canEdit &&
                  selectedYear > new Date().getFullYear() &&
                  onResetFutureYearProjection &&
                  (confirmResetProjection ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="confirm-reset-future-projection-btn"
                        onClick={async () => {
                          try {
                            await onResetFutureYearProjection(selectedYear);
                            setConfirmResetProjection(false);
                            triggerToast(`Proyección del año ${selectedYear} restablecida.`);
                          } catch (err) {
                            setConfirmResetProjection(false);
                            triggerToast(
                              err instanceof Error
                                ? err.message
                                : `No se pudo restablecer la proyección de ${selectedYear}.`,
                              'error'
                            );
                          }
                        }}
                        className="pressable px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold transition"
                      >
                        Confirmar limpieza {selectedYear}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetProjection(false)}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="reset-future-projection-btn"
                      onClick={() => setConfirmResetProjection(true)}
                      className="pressable px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-extrabold transition"
                    >
                      Limpiar proyección
                    </button>
                  ))}
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
                {/* Barra compacta de conciliación en lote (solo visible si hay pendientes LCR en pantalla) */}
                {canEdit && visiblePendingLcrMovements.length > 0 && (
                  <div
                    data-testid="lcr-batch-toolbar"
                    className="px-4 py-2.5 bg-rose-50/80 border-b border-rose-200/80 flex flex-wrap items-center justify-between gap-2"
                  >
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-950 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        data-testid="select-all-lcr-checkbox"
                        checked={
                          visiblePendingLcrMovements.length > 0 &&
                          visiblePendingLcrMovements.every((m) => selectedLcrKeys.includes(m.key))
                        }
                        onChange={toggleSelectAllVisibleLcr}
                        className="w-4 h-4 rounded border-rose-300 text-rose-700 focus:ring-rose-500"
                      />
                      <span>
                        Seleccionar pendientes LCR ({visiblePendingLcrMovements.length})
                      </span>
                    </label>

                    {selectedPendingMovements.length > 0 && (
                      <button
                        type="button"
                        data-testid="batch-reconcile-lcr-btn"
                        disabled={isBatchReconciling}
                        onClick={() => void handleBatchReconcileLcr()}
                        className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-extrabold shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isBatchReconciling
                            ? 'Marcando...'
                            : `Marcar ${selectedPendingMovements.length} en LCR`}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* VISTA ESCRITORIO: TABLA ALINEADA */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3 pl-3 pr-1 w-8" aria-label="Desplegar" />
                        <th className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            data-testid="ledger-date-sort-header"
                            onClick={() =>
                              setLedgerSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                            }
                            className="inline-flex items-center gap-1 uppercase tracking-wider font-bold text-[#072B52] hover:text-[#083563] transition cursor-pointer select-none"
                            title={
                              ledgerSortDir === 'desc'
                                ? 'Ordenado de más reciente a más antiguo (clic para invertir)'
                                : 'Ordenado de más antiguo a más reciente (clic para invertir)'
                            }
                          >
                            <span>Fecha</span>
                            {ledgerSortDir === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </th>
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
                              {/* Casilla LCR (si pendiente) y flecha desplegable si son Varios */}
                              <td className="py-3 pl-3 pr-1 align-middle">
                                <div className="inline-flex items-center gap-1">
                                  {canEdit && m.isPendingLcr && (
                                    <input
                                      type="checkbox"
                                      aria-label={`Seleccionar ${m.primary.concept} para conciliar en LCR`}
                                      data-testid={`select-lcr-checkbox-${m.primary.id}`}
                                      checked={selectedLcrKeys.includes(m.key)}
                                      onChange={() => toggleSelectLcrKey(m.key)}
                                      className="w-4 h-4 rounded border-rose-300 text-rose-700 focus:ring-rose-500 cursor-pointer"
                                    />
                                  )}
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
                                </div>
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
                                  {canEdit && m.isPendingLcr && (
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

                              {/* Acciones / Editar (siempre alineado a la derecha al final de la fila) */}
                              <td className="py-3 pr-4 pl-1 text-right align-middle">
                                {canEdit && (
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    {!m.isApplied && (
                                      <>
                                        <button
                                          type="button"
                                          title="Pasar a gasto real"
                                          data-testid={`pass-projected-btn-${m.primary.id}`}
                                          onClick={() => handleOpenPassToExpense(m)}
                                          className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#083563] hover:bg-[#072B52] text-white text-[11px] font-bold whitespace-nowrap shadow-2xs"
                                        >
                                          <Receipt className="w-3 h-3" />
                                          <span>Pasar a gasto</span>
                                        </button>
                                        <button
                                          type="button"
                                          title="Cerrar reserva sin gasto (mantiene la actividad en el calendario)"
                                          data-testid={`close-projected-btn-${m.primary.id}`}
                                          onClick={() => void handleCloseProjectedWithoutExpense(m)}
                                          className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-bold whitespace-nowrap"
                                        >
                                          <Ban className="w-3 h-3" />
                                          <span>Cerrar sin gasto</span>
                                        </button>
                                      </>
                                    )}
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
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* Sub-filas desplegables con el mismo esquema de columnas */}
                            {m.isShared &&
                              isExpanded &&
                              m.records.map((r) => (
                                <tr
                                  key={r.id}
                                  className="bg-slate-50/80 text-xs border-t border-slate-100/80"
                                >
                                  {/* Flecha */}
                                  <td />
                                  {/* Fecha */}
                                  <td />
                                  {/* Referencia */}
                                  <td />
                                  {/* Organización */}
                                  <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap align-middle">
                                    {ORGANIZATION_LABELS[r.organization]}
                                  </td>
                                  {/* Fecha Act. */}
                                  <td />
                                  {/* Propósito (en gris, ya cargado arriba) */}
                                  <td className="py-2.5 px-3 text-slate-400 align-middle">
                                    {r.concept}
                                  </td>
                                  {/* Proveedor */}
                                  <td />
                                  {/* Monto */}
                                  <td className="py-2.5 pl-3 pr-2 text-right font-bold text-slate-700 tabular-nums whitespace-nowrap align-middle">
                                    {formatCurrency(r.gross_amount)}
                                  </td>
                                  {/* Editar */}
                                  <td />
                                </tr>
                              ))}
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
                            {canEdit && m.isPendingLcr && (
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${m.primary.concept} para conciliar en LCR`}
                                data-testid={`mob-select-lcr-checkbox-${m.primary.id}`}
                                checked={selectedLcrKeys.includes(m.key)}
                                onChange={() => toggleSelectLcrKey(m.key)}
                                className="w-4 h-4 mt-0.5 rounded border-rose-300 text-rose-700 focus:ring-rose-500 cursor-pointer shrink-0"
                              />
                            )}
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
                                  {formatDate(m.accountingDate)}
                                </span>
                                {m.effectiveDate !== m.accountingDate && (
                                  <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                                    (Act: {formatDate(m.effectiveDate)})
                                  </span>
                                )}
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
                              {canEdit && m.isPendingLcr && (
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

                            {canEdit && (
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
                            )}
                          </div>
                        </div>

                        {canEdit && !m.isApplied && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              data-testid={`mob-pass-projected-btn-${m.primary.id}`}
                              onClick={() => handleOpenPassToExpense(m)}
                              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#083563] hover:bg-[#072B52] text-white text-[11px] font-bold"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Pasar a gasto</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`mob-close-projected-btn-${m.primary.id}`}
                              onClick={() => void handleCloseProjectedWithoutExpense(m)}
                              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-bold"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cerrar sin gasto</span>
                            </button>
                          </div>
                        )}

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
                      <th className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          data-testid="withdrawal-date-sort-header"
                          onClick={() =>
                            setWithdrawalSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                          }
                          className="inline-flex items-center gap-1 uppercase tracking-wider font-bold text-[#072B52] hover:text-[#083563] transition cursor-pointer select-none"
                          title={
                            withdrawalSortDir === 'desc'
                              ? 'Ordenado de más reciente a más antiguo (clic para invertir)'
                              : 'Ordenado de más antiguo a más reciente (clic para invertir)'
                          }
                        >
                          <span>Fecha</span>
                          {withdrawalSortDir === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-3 whitespace-nowrap">Referencia</th>
                      <th className="py-3 px-3 whitespace-nowrap">Tipo</th>
                      <th className="py-3 px-3">Propósito</th>
                      <th className="py-3 px-3 whitespace-nowrap">Responsable</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">Pendiente</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Monto</th>
                      <th className="py-3 pr-4 text-right whitespace-nowrap">Estado</th>
                      {canEdit && (
                        <th className="py-3 pr-4 text-right whitespace-nowrap">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredWithdrawals.map((w) => {
                      const isCash = w.movementType === 'EFECTIVO';
                      const isOpen = isCash && w.pendingToRender > 0;
                      const isConfirmingClose =
                        confirmWithdrawalAction?.id === w.id && confirmWithdrawalAction.type === 'close';
                      const isConfirmingDelete =
                        confirmWithdrawalAction?.id === w.id && confirmWithdrawalAction.type === 'delete';
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
                          {canEdit && (
                            <td className="py-3 pr-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {isConfirmingClose ? (
                                  <>
                                    <button
                                      type="button"
                                      data-testid={`confirm-close-withdrawal-${w.withdrawal_ref}`}
                                      onClick={() => handleCloseWithdrawalRow(w)}
                                      className="pressable px-2.5 py-1 rounded-lg bg-[#072B52] hover:bg-[#051E3B] text-white text-[10px] font-extrabold"
                                    >
                                      Confirmar 0,00
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmWithdrawalAction(null)}
                                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : isConfirmingDelete ? (
                                  <>
                                    <button
                                      type="button"
                                      data-testid={`confirm-delete-withdrawal-${w.withdrawal_ref}`}
                                      onClick={() => handleDeleteWithdrawalRow(w)}
                                      className="pressable px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold"
                                    >
                                      Eliminar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmWithdrawalAction(null)}
                                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {isOpen && onCloseWithdrawalInZero && (
                                      <button
                                        type="button"
                                        data-testid={`close-withdrawal-btn-${w.withdrawal_ref}`}
                                        onClick={() =>
                                          setConfirmWithdrawalAction({ id: w.id, type: 'close' })
                                        }
                                        className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-[#072B52] border border-sky-200 text-[10px] font-extrabold"
                                        title="Registrar devolución del saldo pendiente y cerrar en 0,00"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Cerrar en 0</span>
                                      </button>
                                    )}
                                    {onDeleteWithdrawal && (
                                      <button
                                        type="button"
                                        data-testid={`delete-withdrawal-btn-${w.withdrawal_ref}`}
                                        onClick={() =>
                                          setConfirmWithdrawalAction({ id: w.id, type: 'delete' })
                                        }
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                        title="Eliminar movimiento"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          )}
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
                  const isConfirmingClose =
                    confirmWithdrawalAction?.id === w.id && confirmWithdrawalAction.type === 'close';
                  const isConfirmingDelete =
                    confirmWithdrawalAction?.id === w.id && confirmWithdrawalAction.type === 'delete';
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

                      {canEdit && (isOpen || onDeleteWithdrawal) && (
                        <div className="pt-2 border-t border-slate-200/70 flex items-center justify-end gap-2">
                          {isConfirmingClose ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCloseWithdrawalRow(w)}
                                className="pressable px-3 py-1.5 rounded-lg bg-[#072B52] text-white text-[11px] font-extrabold"
                              >
                                Confirmar cierre en 0,00
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawalAction(null)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : isConfirmingDelete ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteWithdrawalRow(w)}
                                className="pressable px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold"
                              >
                                Confirmar eliminar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawalAction(null)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-100"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              {isOpen && onCloseWithdrawalInZero && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmWithdrawalAction({ id: w.id, type: 'close' })
                                  }
                                  className="pressable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 text-[#072B52] border border-sky-200 text-[11px] font-extrabold"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Cerrar en 0</span>
                                </button>
                              )}
                              {onDeleteWithdrawal && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmWithdrawalAction({ id: w.id, type: 'delete' })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              )}
                            </>
                          )}
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
          readOnly={!canEdit}
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
        existingExpenses={expenses}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingGroup(null);
        }}
        onSave={handleSaveModalExpense}
        onDelete={onDeleteExpenseGroup}
        onCreateSupplier={onCreateSupplier}
      />

      {/* ==================== MODAL DE DOBLE REVISIÓN DE DUPLICADOS ==================== */}
      <DuplicateReviewModal
        isOpen={isDuplicateModalOpen}
        groups={duplicateGroups}
        canEdit={canEdit}
        onClose={() => setIsDuplicateModalOpen(false)}
        onDeleteMovement={handleDeleteDuplicateMovement}
        onIgnoreGroup={handleIgnoreDuplicateGroup}
      />

      {/* ==================== MODAL DE NUEVO MOVIMIENTO ==================== */}
      <NewMovementModal
        isOpen={isMovementModalOpen}
        defaultResponsible={user.full_name || 'Administrador'}
        openWithdrawals={openWithdrawalOptions}
        existingRefs={withdrawals.map((w) => w.withdrawal_ref)}
        onClose={() => setIsMovementModalOpen(false)}
        onSave={handleSaveNewMovement}
      />
    </div>
  );
};
