import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Plus,
  Receipt,
  Share2,
  Sparkles,
  Zap,
  Check,
  Store,
} from 'lucide-react';
import {
  buildMmddMontoRef,
  formatCurrency,
  formatDate,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
  parseMmddMontoShortcut,
} from '../lib/formatters';
import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  OrganizationCode,
  SupplierRecord,
} from '../types/database';

const ExcelSyncPanel = lazy(() =>
  import('./ExcelSyncPanel').then((m) => ({ default: m.ExcelSyncPanel }))
);

const DISTRIBUTABLE_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'SEMINARIO',
];

const EXPENSE_TARGET_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'SEMINARIO',
  'ESTACA',
];

interface AdminOperationsCenterProps {
  budgets: BudgetAllocation[];
  expenses: ExpenseRecord[];
  withdrawals: CashWithdrawalRecord[];
  activities: ActivityRecord[];
  suppliers: SupplierRecord[];
  onCreateExpense: (expense: Omit<ExpenseRecord, 'id'>) => Promise<void>;
  onCreateMultipleExpenses: (expensesList: Array<Omit<ExpenseRecord, 'id'>>) => Promise<void>;
  onReconcileLcrExpense: (id: number) => Promise<void>;
  onCreateWithdrawal: (withdrawal: Omit<CashWithdrawalRecord, 'id'>) => Promise<void>;
  onCloseWithdrawalInZero: (id: number, returnAmount: number, returnDate: string) => Promise<void>;
  onCreateSupplier: (supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
}

export const AdminOperationsCenter: React.FC<AdminOperationsCenterProps> = ({
  budgets,
  expenses,
  withdrawals,
  activities,
  suppliers,
  onCreateExpense,
  onCreateMultipleExpenses,
  onReconcileLcrExpense,
  onCreateWithdrawal,
  onCloseWithdrawalInZero,
  onCreateSupplier,
}) => {
  const [subTab, setSubTab] = useState<'LOAD_AND_RETIROS' | 'DISTRIBUTE_STAKE' | 'EXCEL_SYNC'>(
    'LOAD_AND_RETIROS'
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

    // Gastos vinculados a retiros de efectivo vs gastos totales
    const withdrawalDetails = withdrawals.map((w) => {
      const linkedExpenses = expenses.filter((e) => e.withdrawal_ref === w.withdrawal_ref);
      const renderedAmount = linkedExpenses.reduce((acc, e) => acc + Number(e.gross_amount), 0);
      const rawPending = Number(w.amount) - renderedAmount - Number(w.returned_amount || 0);
      // Si el retiro ya está marcado CERRADO_EN_CERO en la auditoría histórica, su saldo a rendir es 0
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

    // Semáforo dinámico de diferencia estimada (Verde en $ 0,00 / Ámbar si hay pendientes / Rojo si hay descuadre)
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
      openWithdrawals,
      totalUnjustifiedWithdrawalsAmount,
      pendingLcrExpenses,
      pendingLcrTotalAmount,
      totalPendingDifference,
      semaphoreState,
      withdrawalDetails,
    };
  }, [withdrawals, expenses]);

  // =========================================================================
  // 2. ESTADO DEL FORMULARIO DE CARGA RÁPIDA DE GASTOS ("MMDD-MONTO")
  // =========================================================================
  const [shortcutInput, setShortcutInput] = useState('');
  const [shortcutAppliedBadge, setShortcutAppliedBadge] = useState<string | null>(null);
  const [isDirectExpense, setIsDirectExpense] = useState(false);
  const [expDate, setExpDate] = useState('2026-10-28');
  const [expGrossAmount, setExpGrossAmount] = useState('');
  const [expExternalReimbursement, setExpExternalReimbursement] = useState('');
  const [expRefNumber, setExpRefNumber] = useState('');
  const [expOrg, setExpOrg] = useState<OrganizationCode>('PRIMARIA');
  const [expSupplier, setExpSupplier] = useState(suppliers[0]?.commercial_name || 'Mosca');
  const [expConcept, setExpConcept] = useState('');
  const [expIsReimbursableOai, setExpIsReimbursableOai] = useState(false);
  const [expStatusLcr, setExpStatusLcr] = useState<'REGISTRADO_LCR' | 'PENDIENTE_LCR'>(
    'REGISTRADO_LCR'
  );

  // Alta rápida de proveedor inline
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRut, setNewSupplierRut] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('Comercio General');

  // Manejo del atajo inteligente MMDD-MONTO (ej. "0315-1250" -> 15/03/2026 y $ 1.250,00)
  const handleShortcutChange = (val: string) => {
    setShortcutInput(val);
    const parsed = parseMmddMontoShortcut(val, 2026);
    if (parsed.isValid && parsed.date && parsed.amount !== undefined && parsed.ref) {
      setExpDate(parsed.date);
      setExpGrossAmount(String(parsed.amount));
      if (!isDirectExpense) {
        setExpRefNumber(parsed.ref);
      }
      setShortcutAppliedBadge(
        `Fecha: ${formatDate(parsed.date)} • Importe: ${formatCurrency(parsed.amount)}`
      );
    } else {
      setShortcutAppliedBadge(null);
    }
  };

  // Autogeneración de código MMDD-MONTO cuando no es Gasto Directo y se cambia fecha/monto manualmente
  const handleManualDateOrAmountChange = (nextDate: string, nextAmount: string) => {
    setExpDate(nextDate);
    setExpGrossAmount(nextAmount);
    if (!isDirectExpense && !shortcutInput.trim()) {
      const autoRef = buildMmddMontoRef(nextDate, Number(nextAmount));
      if (autoRef) {
        setExpRefNumber(autoRef);
      }
    }
  };

  const calculatedNetAmount = useMemo(() => {
    const gross = Number(String(expGrossAmount).replace(',', '.')) || 0;
    const reimb = Number(String(expExternalReimbursement).replace(',', '.')) || 0;
    return Math.max(0, gross - reimb);
  }, [expGrossAmount, expExternalReimbursement]);

  const handleSaveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Number(String(expGrossAmount).replace(',', '.')) || 0;
    const reimb = Number(String(expExternalReimbursement).replace(',', '.')) || 0;
    if (gross <= 0 || !expConcept.trim()) return;

    const finalRef = isDirectExpense
      ? expRefNumber.trim() || `POS-${Date.now().toString().slice(-5)}`
      : expRefNumber.trim() || buildMmddMontoRef(expDate, gross) || '1012-25000';

    await onCreateExpense({
      ref_number: finalRef,
      expense_date: expDate,
      organization: expOrg,
      supplier_name: expSupplier,
      concept: expConcept.trim(),
      gross_amount: gross,
      external_reimbursement: reimb,
      net_amount: Math.max(0, gross - reimb),
      is_reimbursable_oai: expIsReimbursableOai,
      status: expIsReimbursableOai ? 'REEMBOLSADO_OAI' : expStatusLcr,
      withdrawal_ref: isDirectExpense ? null : finalRef,
    });

    setShortcutInput('');
    setShortcutAppliedBadge(null);
    setExpGrossAmount('');
    setExpExternalReimbursement('');
    setExpConcept('');
    triggerToast(
      `Comprobante registrado en ${ORGANIZATION_SHORT_LABELS[expOrg]} por ${formatCurrency(
        Math.max(0, gross - reimb)
      )} (${formatDate(expDate)}).`
    );
  };

  const handleQuickAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    await onCreateSupplier({
      commercial_name: newSupplierName.trim(),
      legal_name: newSupplierName.trim(),
      rut: newSupplierRut.trim() || '210000000019',
      category: newSupplierCategory.trim() || 'Proveedores Estaca',
      official_invoice: true,
      rating: 5,
    });
    setExpSupplier(newSupplierName.trim());
    setNewSupplierName('');
    setNewSupplierRut('');
    setIsAddingSupplier(false);
    triggerToast(`Proveedor "${newSupplierName.trim()}" incorporado al directorio.`);
  };

  // =========================================================================
  // 3. ESTADO DE RETIROS DE EFECTIVO
  // =========================================================================
  const [newWithdrawalShortcut, setNewWithdrawalShortcut] = useState('');
  const [newWithdrawalPurpose, setNewWithdrawalPurpose] = useState('');
  const [newWithdrawalResponsible, setNewWithdrawalResponsible] = useState('Pablo Lamela');

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseMmddMontoShortcut(newWithdrawalShortcut, 2026);
    if (!parsed.isValid || !parsed.date || !parsed.amount || !parsed.ref) return;

    await onCreateWithdrawal({
      withdrawal_ref: parsed.ref,
      withdrawal_date: parsed.date,
      amount: parsed.amount,
      responsible_person: newWithdrawalResponsible.trim() || 'Pablo Lamela',
      purpose: newWithdrawalPurpose.trim() || 'Retiro operativo Estaca',
      status: 'PENDIENTE_JUSTIFICAR',
      return_date: null,
      returned_amount: 0,
    });

    setNewWithdrawalShortcut('');
    setNewWithdrawalPurpose('');
    triggerToast(
      `Retiro ${parsed.ref} (${formatCurrency(parsed.amount)}) registrado el ${formatDate(
        parsed.date
      )}.`
    );
  };

  // =========================================================================
  // 4. HERRAMIENTA "DISTRIBUIR GASTO DE ACTIVIDAD DE ESTACA" (OPCIÓN B — ADR-011)
  // =========================================================================
  const [stakeEventName, setStakeEventName] = useState('');
  const [stakeEventDate, setStakeEventDate] = useState('2026-11-14');
  const [stakeEventTotal, setStakeEventTotal] = useState('');
  const [stakeEventSupplier, setStakeEventSupplier] = useState('Disco Uruguay SA');
  const [stakeSelectedOrgs, setStakeSelectedOrgs] = useState<OrganizationCode[]>([
    'MJ',
    'HJ',
    'PRIMARIA',
  ]);
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'CUSTOM'>('EQUAL');
  const [customAmounts, setCustomAmounts] = useState<Partial<Record<OrganizationCode, string>>>({});

  const toggleStakeOrgSelection = (org: OrganizationCode) => {
    setStakeSelectedOrgs((prev) =>
      prev.includes(org)
        ? prev.length > 1
          ? prev.filter((item) => item !== org)
          : prev
        : [...prev, org]
    );
  };

  const distributionPreview = useMemo(() => {
    const total = Number(String(stakeEventTotal).replace(',', '.')) || 0;
    const count = stakeSelectedOrgs.length;
    if (count === 0 || total <= 0) return [];

    if (splitMode === 'EQUAL') {
      const baseShare = Math.floor((total / count) * 100) / 100;
      const remainder = Number((total - baseShare * count).toFixed(2));
      return stakeSelectedOrgs.map((org, idx) => ({
        organization: org,
        amount: idx === 0 ? Number((baseShare + remainder).toFixed(2)) : baseShare,
      }));
    }

    return stakeSelectedOrgs.map((org) => ({
      organization: org,
      amount: Number(String(customAmounts[org] || '0').replace(',', '.')) || 0,
    }));
  }, [stakeEventTotal, stakeSelectedOrgs, splitMode, customAmounts]);

  const handleConfirmDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeEventName.trim() || distributionPreview.length === 0) return;

    const standardLabel = `Actividad General de Estaca: ${stakeEventName.trim()}`;
    const refCode = buildMmddMontoRef(
      stakeEventDate,
      Number(String(stakeEventTotal).replace(',', '.')) || 0
    );

    const newEntries: Array<Omit<ExpenseRecord, 'id'>> = distributionPreview
      .filter((item) => item.amount > 0)
      .map((item) => ({
        ref_number: refCode || 'ESTACA-PRORRATEO',
        expense_date: stakeEventDate,
        organization: item.organization,
        supplier_name: stakeEventSupplier,
        concept: standardLabel,
        gross_amount: item.amount,
        external_reimbursement: 0,
        net_amount: item.amount,
        is_reimbursable_oai: false,
        status: 'REGISTRADO_LCR',
        withdrawal_ref: null,
      }));

    if (newEntries.length === 0) return;

    await onCreateMultipleExpenses(newEntries);
    setStakeEventName('');
    setStakeEventTotal('');
    setSubTab('LOAD_AND_RETIROS');
    triggerToast(
      `Gasto "${standardLabel}" prorrateado en ${newEntries.length} organizaciones sin alterar su presupuesto original.`
    );
  };

  return (
    <section
      aria-label="Centro de Edición y Carga Operativa"
      data-testid="admin-operations-center"
      className="space-y-6"
    >
      {/* ==================== 1. MONITOR DE CONCILIACIÓN EN VIVO CON LCR ==================== */}
      <div
        data-testid="lcr-reconciliation-monitor"
        className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-slate-800 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/90 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Monitor de Conciliación en Vivo con LCR
              </h2>
              <p className="text-xs text-slate-300">
                Cuadratura de retiros en efectivo (`MMDD-MONTO`), devoluciones bancarias y comprobantes en mano
              </p>
            </div>
          </div>

          {/* Indicador Semáforo Global */}
          <div
            data-testid={`reconciliation-semaphore-${reconciliationStats.semaphoreState}`}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold border self-start sm:self-center ${
              reconciliationStats.semaphoreState === 'VERDE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                : reconciliationStats.semaphoreState === 'AMBAR'
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                reconciliationStats.semaphoreState === 'VERDE'
                  ? 'bg-emerald-400'
                  : reconciliationStats.semaphoreState === 'AMBAR'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 animate-ping'
              }`}
            />
            <span>
              {reconciliationStats.semaphoreState === 'VERDE'
                ? 'Conciliado en Cero ($ 0,00)'
                : `Pendiente de Conciliar: ${formatCurrency(
                    reconciliationStats.totalPendingDifference
                  )}`}
            </span>
          </div>
        </div>

        {/* 4 Tarjetas de Cuadratura Contable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Retirado vs Total Rendido */}
          <div
            data-testid="monitor-card-withdrawn-vs-rendered"
            className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Total Retirado vs. Rendido
            </span>
            <p
              data-testid="monitor-total-withdrawn"
              className="text-xl font-extrabold text-white tabular-nums mt-2"
            >
              {formatCurrency(reconciliationStats.totalWithdrawn)}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-700/80 space-y-1 text-[11px]">
              <div className="flex justify-between text-emerald-300">
                <span>Rendido / Cerrado:</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(reconciliationStats.totalRenderedInWithdrawals)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Redepósitos Sobrantes:</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(reconciliationStats.totalReturnedDeposits)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Retiros sin Justificar (con Responsables) */}
          <div
            data-testid="monitor-card-unjustified-withdrawals"
            className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Retiros sin Justificar
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 tabular-nums">
                {reconciliationStats.openWithdrawals.length} abiertos
              </span>
            </div>
            <p
              data-testid="monitor-unjustified-withdrawals-amount"
              className="text-xl font-extrabold text-amber-300 tabular-nums mt-2"
            >
              {formatCurrency(reconciliationStats.totalUnjustifiedWithdrawalsAmount)}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300 space-y-0.5">
              {reconciliationStats.openWithdrawals.slice(0, 2).map((w) => (
                <p key={w.id} className="truncate tabular-nums">
                  • <strong>{w.withdrawal_ref}</strong> ({w.responsible_person})
                </p>
              ))}
            </div>
          </div>

          {/* Card 3: Total sin Justificar LCR (Gastos en Mano) */}
          <div
            data-testid="monitor-card-pending-lcr"
            className="p-4 rounded-2xl bg-slate-800/80 border border-rose-500/40 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Sin Justificar en LCR
              </span>
              <span
                data-testid="monitor-pending-lcr-count"
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 tabular-nums"
              >
                {reconciliationStats.pendingLcrExpenses.length} en mano
              </span>
            </div>
            <p
              data-testid="monitor-pending-lcr-amount"
              className="text-xl font-extrabold text-rose-300 tabular-nums mt-2"
            >
              {formatCurrency(reconciliationStats.pendingLcrTotalAmount)}
            </p>
            <p className="mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300">
              Comprobantes físicos pendientes de asentar en LCR
            </p>
          </div>

          {/* Card 4: Diferencia Estimada y Semáforo */}
          <div
            data-testid="monitor-card-difference-semaphore"
            className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col justify-between"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Diferencia Estimada LCR
            </span>
            <p
              data-testid="monitor-difference-amount"
              className={`text-xl font-extrabold tabular-nums mt-2 ${
                reconciliationStats.totalPendingDifference === 0
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {formatCurrency(reconciliationStats.totalPendingDifference)}
            </p>
            <p className="mt-2 pt-2 border-t border-slate-700/80 text-[11px] text-slate-300">
              {reconciliationStats.totalPendingDifference === 0
                ? '✓ Extracto y LCR 100% cuadrados'
                : 'Se reduce a $ 0,00 al asentar en LCR y cerrar retiros'}
            </p>
          </div>
        </div>
      </div>

      {/* Toast Operativo */}
      {toastMsg && (
        <div
          data-testid="admin-ops-toast"
          role="status"
          className="p-4 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-md border border-emerald-700 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ==================== BARRA DE SUB-MÓDULOS OPERATIVOS ==================== */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
        <button
          type="button"
          data-testid="ops-subtab-load"
          onClick={() => setSubTab('LOAD_AND_RETIROS')}
          className={`pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
            subTab === 'LOAD_AND_RETIROS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>Carga Rápida (MMDD-MONTO), LCR y Retiros</span>
        </button>

        <button
          type="button"
          data-testid="ops-subtab-distribute"
          onClick={() => setSubTab('DISTRIBUTE_STAKE')}
          className={`pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
            subTab === 'DISTRIBUTE_STAKE'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
          <span>Distribuir Gasto de Actividad de Estaca</span>
        </button>

        <button
          type="button"
          data-testid="ops-subtab-excel"
          onClick={() => setSubTab('EXCEL_SYNC')}
          className={`pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
            subTab === 'EXCEL_SYNC'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Sincronización Excel (Exportar / Importar)</span>
        </button>
      </div>

      {/* ==================== SUB-MÓDULO 1: CARGA RÁPIDA + CONCILIACIÓN LCR + RETIROS ==================== */}
      {subTab === 'LOAD_AND_RETIROS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMNA IZQUIERDA (7 cols): FORMULARIO INTELIGENTE DE GASTOS CON ATAJO MMDD-MONTO */}
            <form
              onSubmit={handleSaveQuickExpense}
              data-testid="quick-expense-form"
              className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Carga Rápida de Comprobante de Gasto
                    </h3>
                    <p className="text-xs text-slate-500">
                      Autocompletado inteligente `MMDD-MONTO` o Gasto Directo con Tarjeta
                    </p>
                  </div>
                </div>
              </div>

              {/* Input de Atajo Rápido MMDD-MONTO */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/5 border border-emerald-800/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="mmdd-shortcut-input"
                    className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Atajo Rápido "MMDD-MONTO" (Ej: 0315-1250)</span>
                  </label>
                  {shortcutAppliedBadge && (
                    <span
                      data-testid="shortcut-parsed-preview"
                      className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-800 text-white tabular-nums"
                    >
                      {shortcutAppliedBadge}
                    </span>
                  )}
                </div>
                <input
                  id="mmdd-shortcut-input"
                  data-testid="mmdd-shortcut-input"
                  type="text"
                  placeholder="Escribe MMDD-MONTO (ej. 0315-1250 para 15/03/2026 y $ 1.250,00)"
                  value={shortcutInput}
                  onChange={(e) => handleShortcutChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-600/40 bg-white text-sm font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Casilla [ ] Gasto Directo (Tarjeta / Transferencia) */}
              <label
                htmlFor="direct-expense-checkbox"
                data-testid="direct-expense-label"
                className={`pressable flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                  isDirectExpense
                    ? 'bg-sky-50 border-sky-300 text-sky-950'
                    : 'bg-slate-50 border-slate-200/90 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    id="direct-expense-checkbox"
                    data-testid="direct-expense-checkbox"
                    type="checkbox"
                    checked={isDirectExpense}
                    onChange={(e) => setIsDirectExpense(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-700"
                  />
                  <div className="text-xs">
                    <span className="font-extrabold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-sky-700" />
                      <span>Gasto Directo (Tarjeta / Transferencia / IROP)</span>
                    </span>
                    <p className="text-[11px] text-slate-500">
                      No descuenta de un retiro de efectivo previo; habilita referencia libre de cupón o transferencia
                    </p>
                  </div>
                </div>
              </label>

              {/* Campos Fecha, Monto Factura, Reintegro Externo y Referencia */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha Comprobante *
                  </label>
                  <input
                    type="date"
                    required
                    data-testid="expense-date-input"
                    value={expDate}
                    onChange={(e) => handleManualDateOrAmountChange(e.target.value, expGrossAmount)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums"
                  />
                  <p
                    data-testid="expense-date-formatted-hint"
                    className="text-[10px] font-bold text-emerald-800 mt-1 tabular-nums"
                  >
                    Formato oficial: {formatDate(expDate)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto Factura LCR ($) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    required
                    data-testid="expense-gross-amount-input"
                    placeholder="0,00"
                    value={expGrossAmount}
                    onChange={(e) => handleManualDateOrAmountChange(expDate, e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold tabular-nums"
                  />
                  <p
                    data-testid="expense-amount-formatted-hint"
                    className="text-[10px] font-bold text-emerald-800 mt-1 tabular-nums"
                  >
                    Neto Org: {formatCurrency(calculatedNetAmount)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isDirectExpense ? 'N° Cupón / Ref. Directa' : 'Ref. Retiro (MMDD-MONTO)'}
                  </label>
                  <input
                    type="text"
                    data-testid="expense-ref-input"
                    placeholder={isDirectExpense ? 'Ej: 1095082 o TX-401' : 'Autogenerado MMDD-MONTO'}
                    value={expRefNumber}
                    onChange={(e) => setExpRefNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              {/* Organización y Proveedor (con Alta Rápida de los 17 proveedores) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Organización Imputada *
                  </label>
                  <select
                    data-testid="expense-org-select"
                    value={expOrg}
                    onChange={(e) => setExpOrg(e.target.value as OrganizationCode)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white font-semibold"
                  >
                    {EXPENSE_TARGET_ORGS.map((org) => (
                      <option key={org} value={org}>
                        {ORGANIZATION_LABELS[org]} ({ORGANIZATION_SHORT_LABELS[org]})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Proveedor ({suppliers.length} registrados) *
                    </label>
                    <button
                      type="button"
                      data-testid="toggle-quick-supplier-btn"
                      onClick={() => setIsAddingSupplier((prev) => !prev)}
                      className="text-[11px] font-extrabold text-emerald-800 hover:underline"
                    >
                      {isAddingSupplier ? 'Cancelar' : '+ Alta Rápida'}
                    </button>
                  </div>
                  <select
                    data-testid="expense-supplier-select"
                    value={expSupplier}
                    onChange={(e) => setExpSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
                  >
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.commercial_name}>
                        {sup.commercial_name} {sup.rut ? `(RUT ${sup.rut})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mini-formulario de Alta Rápida de Proveedor */}
              {isAddingSupplier && (
                <div
                  data-testid="quick-supplier-form"
                  className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-400">
                    <Store className="w-3.5 h-3.5" />
                    <span>Nuevo Proveedor Oficial</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      data-testid="new-supplier-name-input"
                      placeholder="Nombre comercial *"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="RUT (12 dígitos)"
                      value={newSupplierRut}
                      onChange={(e) => setNewSupplierRut(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white tabular-nums"
                    />
                    <input
                      type="text"
                      placeholder="Rubro"
                      value={newSupplierCategory}
                      onChange={(e) => setNewSupplierCategory(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-testid="save-quick-supplier-btn"
                      onClick={handleQuickAddSupplier}
                      className="pressable px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
                    >
                      Incorporar Proveedor
                    </button>
                  </div>
                </div>
              )}

              {/* Concepto + Opciones Multiestaca y Estado LCR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Propósito / Detalle de la Actividad *
                </label>
                <input
                  type="text"
                  required
                  data-testid="expense-concept-input"
                  placeholder="Ej: Insumos y refrigerios para actividad de organización"
                  value={expConcept}
                  onChange={(e) => setExpConcept(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Reintegro Otras Estacas ($)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="0,00"
                    value={expExternalReimbursement}
                    onChange={(e) => setExpExternalReimbursement(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Estado en Sistema LCR
                  </label>
                  <select
                    data-testid="expense-lcr-status-select"
                    value={expStatusLcr}
                    onChange={(e) =>
                      setExpStatusLcr(e.target.value as 'REGISTRADO_LCR' | 'PENDIENTE_LCR')
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white font-bold"
                  >
                    <option value="REGISTRADO_LCR">✓ Registrado en LCR</option>
                    <option value="PENDIENTE_LCR">⚠️ Pendiente asentar LCR</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pb-1.5">
                    <input
                      type="checkbox"
                      checked={expIsReimbursableOai}
                      onChange={(e) => setExpIsReimbursableOai(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-700"
                    />
                    <span>Reembolsable OAI (No descuenta)</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  data-testid="submit-quick-expense-btn"
                  className="pressable inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs sm:text-sm font-extrabold shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Comprobante</span>
                </button>
              </div>
            </form>

            {/* COLUMNA DERECHA (5 cols): CONTROL DE RETIROS DE EFECTIVO */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Módulo de Retiros de Efectivo ({withdrawals.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trazabilidad hasta remanente cero (`$ 0,00`) y registro de devoluciones
                </p>

                {/* Formulario rápido de Nuevo Retiro */}
                <form onSubmit={handleAddWithdrawal} className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <p className="text-xs font-extrabold text-slate-800">
                    + Registrar Nuevo Retiro (MMDD-MONTO)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      data-testid="new-withdrawal-shortcut-input"
                      placeholder="Ej: 1105-20000"
                      value={newWithdrawalShortcut}
                      onChange={(e) => setNewWithdrawalShortcut(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Propósito del retiro"
                      value={newWithdrawalPurpose}
                      onChange={(e) => setNewWithdrawalPurpose(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={newWithdrawalResponsible}
                      onChange={(e) => setNewWithdrawalResponsible(e.target.value)}
                      className="px-3 py-1 rounded-xl border border-slate-200 text-[11px] bg-white flex-1"
                    />
                    <button
                      type="submit"
                      data-testid="submit-new-withdrawal-btn"
                      className="pressable px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Cargar Retiro
                    </button>
                  </div>
                </form>

                {/* Lista de Retiros con foco en los abiertos */}
                <div className="mt-3.5 space-y-2 max-h-80 overflow-y-auto pr-1">
                  {reconciliationStats.withdrawalDetails.map((w) => (
                    <div
                      key={w.id}
                      data-testid={`withdrawal-row-${w.withdrawal_ref}`}
                      className={`p-3 rounded-2xl border text-xs ${
                        w.status === 'PENDIENTE_JUSTIFICAR'
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-slate-50/60 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-extrabold text-slate-900">
                          {w.withdrawal_ref}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            w.status === 'CERRADO_EN_CERO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-200 text-amber-950'
                          }`}
                        >
                          {w.status === 'CERRADO_EN_CERO' ? 'Cerrado en Cero' : 'Saldo por Rendir'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                        <span>
                          {formatDate(w.withdrawal_date)} • {w.responsible_person}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          Retiro: {formatCurrency(w.amount)}
                        </span>
                      </div>

                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 tabular-nums">
                          Pendiente: <strong>{formatCurrency(w.pendingToRender)}</strong>
                        </span>
                        {w.status === 'PENDIENTE_JUSTIFICAR' && (
                          <button
                            type="button"
                            data-testid={`close-withdrawal-btn-${w.withdrawal_ref}`}
                            onClick={() => {
                              onCloseWithdrawalInZero(w.id, w.pendingToRender, '2026-11-09');
                              triggerToast(
                                `Retiro ${w.withdrawal_ref} conciliado y cerrado en $ 0,00.`
                              );
                            }}
                            className="pressable px-2.5 py-1 rounded-lg bg-emerald-800 text-white text-[10px] font-extrabold"
                          >
                            Cerrar en $ 0,00
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TABLA DE CONCILIACIÓN DE COMPROBANTES EN VIVO (CON ALERTA ROJA EN PENDIENTES LCR) */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Libro Mayor de Comprobantes y Conciliación LCR ({expenses.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Los comprobantes pendientes de asentar en LCR aparecen destacados en primer lugar con acción directa
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {[...expenses]
                .sort((a, b) => {
                  if (a.status === 'PENDIENTE_LCR' && b.status !== 'PENDIENTE_LCR') return -1;
                  if (a.status !== 'PENDIENTE_LCR' && b.status === 'PENDIENTE_LCR') return 1;
                  return b.expense_date.localeCompare(a.expense_date);
                })
                .map((exp) => {
                  const isPendingLcr = exp.status === 'PENDIENTE_LCR';
                  return (
                    <div
                      key={exp.id}
                      data-testid={`admin-expense-row-${exp.id}`}
                      className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        isPendingLcr ? 'bg-rose-50/80 hover:bg-rose-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-800">
                            {exp.ref_number || 'DIRECTO'}
                          </span>
                          <span className="text-xs font-bold text-slate-600 tabular-nums">
                            {formatDate(exp.expense_date)}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-900 text-white">
                            {ORGANIZATION_SHORT_LABELS[exp.organization]}
                          </span>
                          {isPendingLcr ? (
                            <span
                              data-testid={`pending-lcr-pill-${exp.id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Pendiente asentar en LCR</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              ✓ Conciliado LCR
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
                          {exp.concept}
                        </p>
                        <p className="text-[11px] text-slate-500">{exp.supplier_name}</p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums">
                            {formatCurrency(exp.gross_amount)}
                          </p>
                          {exp.external_reimbursement > 0 && (
                            <p className="text-[10px] font-bold text-emerald-800 tabular-nums">
                              Neto Org: {formatCurrency(exp.net_amount)}
                            </p>
                          )}
                        </div>

                        {isPendingLcr && (
                          <button
                            type="button"
                            data-testid={`reconcile-lcr-btn-${exp.id}`}
                            onClick={() => {
                              onReconcileLcrExpense(exp.id);
                              triggerToast(
                                `Comprobante "${exp.concept}" (${formatCurrency(
                                  exp.gross_amount
                                )}) marcado como registrado en LCR.`
                              );
                            }}
                            className="pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-extrabold shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Conciliar LCR</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-MÓDULO 2: DISTRIBUIR GASTO DE ACTIVIDAD DE ESTACA (OPCIÓN B) ==================== */}
      {subTab === 'DISTRIBUTE_STAKE' && (
        <form
          onSubmit={handleConfirmDistribution}
          data-testid="distribute-stake-expense-form"
          className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-5"
        >
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center flex-shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Distribuir Gasto de Actividad de Estaca (Opción B — ADR-011)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Prorratea un gasto general entre las organizaciones participantes bajo la etiqueta oficial{' '}
                <strong className="text-slate-700">
                  "Actividad General de Estaca: [Nombre Evento]"
                </strong>{' '}
                sin alterar su presupuesto asignado original.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre del Evento General de Estaca *
              </label>
              <input
                type="text"
                required
                data-testid="stake-event-name-input"
                placeholder="Ej: Conferencia y Baile de la Juventud"
                value={stakeEventName}
                onChange={(e) => setStakeEventName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha del Gasto *
              </label>
              <input
                type="date"
                required
                data-testid="stake-event-date-input"
                value={stakeEventDate}
                onChange={(e) => setStakeEventDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Importe Total a Prorratear ($) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                required
                data-testid="stake-event-total-input"
                placeholder="Ej: 9000"
                value={stakeEventTotal}
                onChange={(e) => setStakeEventTotal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold tabular-nums"
              />
            </div>
          </div>

          {/* Selección de Organizaciones Participantes y Modo de Prorrateo */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Organizaciones Participantes ({stakeSelectedOrgs.length} seleccionadas)
              </label>

              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  data-testid="split-mode-equal"
                  onClick={() => setSplitMode('EQUAL')}
                  className={`pressable px-3 py-1 rounded-lg font-bold ${
                    splitMode === 'EQUAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Partes Iguales
                </button>
                <button
                  type="button"
                  data-testid="split-mode-custom"
                  onClick={() => setSplitMode('CUSTOM')}
                  className={`pressable px-3 py-1 rounded-lg font-bold ${
                    splitMode === 'CUSTOM' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Montos Personalizados
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DISTRIBUTABLE_ORGS.map((org) => {
                const isSelected = stakeSelectedOrgs.includes(org);
                return (
                  <button
                    key={org}
                    type="button"
                    data-testid={`toggle-dist-org-${org}`}
                    onClick={() => toggleStakeOrgSelection(org)}
                    className={`pressable p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-900 text-white border-emerald-950 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">
                        {ORGANIZATION_SHORT_LABELS[org]}
                      </p>
                      <p
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-emerald-200' : 'text-slate-400'
                        }`}
                      >
                        {ORGANIZATION_LABELS[org]}
                      </p>
                    </div>
                    <Building2 className="w-4 h-4 flex-shrink-0 opacity-70" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vista Previa de Asientos por Organización */}
          {distributionPreview.length > 0 && (
            <div
              data-testid="distribution-preview-box"
              className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5"
            >
              <p className="text-xs font-extrabold text-emerald-400">
                Vista Previa de Asientos Transparentes: "Actividad General de Estaca:{' '}
                {stakeEventName.trim() || '[Nombre Evento]'}"
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {distributionPreview.map((item) => (
                  <div
                    key={item.organization}
                    data-testid={`dist-preview-card-${item.organization}`}
                    className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold">
                      {ORGANIZATION_SHORT_LABELS[item.organization]}
                    </span>
                    {splitMode === 'CUSTOM' ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        value={customAmounts[item.organization] || ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [item.organization]: e.target.value,
                          }))
                        }
                        placeholder="0,00"
                        className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-right text-xs font-bold tabular-nums text-white"
                      />
                    ) : (
                      <span
                        data-testid={`dist-preview-amount-${item.organization}`}
                        className="text-xs font-extrabold text-emerald-300 tabular-nums"
                      >
                        {formatCurrency(item.amount)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              data-testid="confirm-distribute-stake-btn"
              className="pressable inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs sm:text-sm font-extrabold shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Generar Asientos Prorrateados</span>
            </button>
          </div>
        </form>
      )}

      {/* ==================== SUB-MÓDULO 3: SINCRONIZACIÓN BIDIRECCIONAL CON EXCEL ==================== */}
      {subTab === 'EXCEL_SYNC' && (
        <Suspense
          fallback={
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center text-xs font-bold text-slate-500">
              Cargando motor de hojas de cálculo Excel...
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
    </section>
  );
};
