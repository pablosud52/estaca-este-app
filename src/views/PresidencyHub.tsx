import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  Eye,
  FileEdit,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SEED_ACTIVITIES,
  SEED_BUDGET_ALLOCATIONS,
  SEED_CASH_WITHDRAWALS,
  SEED_EXPENSES,
  SEED_SUPPLIERS,
} from '../data/seedData';
import {
  formatCurrency,
  formatDate,
  getQuarterFromDate,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import { supabase } from '../lib/supabase';
import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
  QuarterSummary,
  SupplierRecord,
} from '../types/database';
import { OrgDistributionChart, OrgSummaryStat } from '../components/OrgDistributionChart';
import { ActivityApprovalTray } from '../components/ActivityApprovalTray';
import { UserManagementPanel } from '../components/UserManagementPanel';
import { AdminOperationsCenter } from '../components/AdminOperationsCenter';
import { LeaderView } from './LeaderView';

const ALL_HUB_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'SEMINARIO',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'ESTACA',
];

export const PresidencyHub: React.FC = () => {
  const { user } = useAuth();

  // Sub-vista activa: DASHBOARD | APPROVALS | USERS | OPERATIONS
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'APPROVALS' | 'USERS' | 'OPERATIONS'>(
    'DASHBOARD'
  );
  // Si el usuario entra a inspeccionar una organización en Modo Espejo
  const [inspectedOrg, setInspectedOrg] = useState<OrganizationCode | null>(null);

  const [budgets, setBudgets] = useState<BudgetAllocation[]>(SEED_BUDGET_ALLOCATIONS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [activities, setActivities] = useState<ActivityRecord[]>(SEED_ACTIVITIES);
  const [withdrawals, setWithdrawals] = useState<CashWithdrawalRecord[]>(SEED_CASH_WITHDRAWALS);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(SEED_SUPPLIERS);

  // Sincronización en tiempo real con Supabase con fallback a SEED_DATA
  useEffect(() => {
    let active = true;

    async function fetchExecutiveData() {
      try {
        const [budgetRes, expenseRes, activityRes, withdrawalRes, supplierRes] = await Promise.all([
          supabase.from('budget_allocations').select('*').eq('year', 2026),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('activities').select('*').order('event_date', { ascending: true }),
          supabase.from('cash_withdrawals').select('*').order('withdrawal_date', { ascending: false }),
          supabase.from('suppliers').select('*').order('commercial_name', { ascending: true }),
        ]);

        if (!active) return;

        if (!budgetRes.error && budgetRes.data && budgetRes.data.length > 0) {
          setBudgets(
            budgetRes.data.map((b) => ({
              ...b,
              t1_assigned: Number(b.t1_assigned),
              t2_assigned: Number(b.t2_assigned),
              t3_assigned: Number(b.t3_assigned),
              t4_assigned: Number(b.t4_assigned),
              total_assigned: Number(b.total_assigned),
            })) as BudgetAllocation[]
          );
        }

        if (!expenseRes.error && expenseRes.data && expenseRes.data.length > 0) {
          const remoteExpenses = expenseRes.data.map((e) => ({
            ...e,
            gross_amount: Number(e.gross_amount),
            external_reimbursement: Number(e.external_reimbursement),
            net_amount: Number(e.net_amount),
          })) as ExpenseRecord[];

          setExpenses((prev) => {
            const prevById = new Map(prev.map((item) => [item.id, item]));
            const localNewOnly = prev.filter(
              (item) => !remoteExpenses.some((r) => r.id === item.id)
            );
            return [
              ...localNewOnly,
              ...remoteExpenses.map((item) => prevById.get(item.id) || item),
            ];
          });
        }

        if (!activityRes.error && activityRes.data && activityRes.data.length > 0) {
          const remoteActivities = activityRes.data.map((a) => ({
            ...a,
            estimated_cost: Number(a.estimated_cost || 0),
          })) as ActivityRecord[];

          const existingTitles = new Set(remoteActivities.map((a) => a.title));
          const mergedRemoteAndSeed = [
            ...remoteActivities,
            ...SEED_ACTIVITIES.filter((s) => !existingTitles.has(s.title)),
          ];

          setActivities((prev) => {
            // Conservar cambios de estado o ediciones ya realizadas localmente en la sesión
            const prevById = new Map(prev.map((item) => [item.id, item]));
            return mergedRemoteAndSeed
              .map((item) => prevById.get(item.id) || item)
              .sort((a, b) => a.event_date.localeCompare(b.event_date));
          });
        }

        if (!withdrawalRes.error && withdrawalRes.data && withdrawalRes.data.length > 0) {
          const remoteWithdrawals = withdrawalRes.data.map((w) => ({
            ...w,
            amount: Number(w.amount),
            returned_amount: Number(w.returned_amount || 0),
          })) as CashWithdrawalRecord[];

          setWithdrawals((prev) => {
            const prevById = new Map(prev.map((item) => [item.id, item]));
            const localNewOnly = prev.filter(
              (item) => !remoteWithdrawals.some((r) => r.id === item.id)
            );
            return [
              ...localNewOnly,
              ...remoteWithdrawals.map((item) => prevById.get(item.id) || item),
            ];
          });
        }

        if (!supplierRes.error && supplierRes.data && supplierRes.data.length > 0) {
          setSuppliers((prev) => {
            const remoteNames = new Set(supplierRes.data.map((s) => s.commercial_name));
            const localNewOnly = prev.filter((item) => !remoteNames.has(item.commercial_name));
            return [...(supplierRes.data as SupplierRecord[]), ...localNewOnly];
          });
        }
      } catch {
        // Fallback silencioso a SEED_DATA auditado
      }
    }

    fetchExecutiveData();
    return () => {
      active = false;
    };
  }, []);

  // Cálculos Globales y por Organización
  const executiveMetrics = useMemo(() => {
    const nonReimbursableExpenses = expenses.filter((e) => !e.is_reimbursable_oai);
    const pendingLcrExpenses = expenses.filter((e) => e.status === 'PENDIENTE_LCR');
    const pendingLcrTotal = pendingLcrExpenses.reduce((acc, e) => acc + Number(e.gross_amount), 0);

    // Pool asignado a las 8 organizaciones operativas + Seminario ($ 484.000,00 en 2026)
    const orgBudgetsOnly = budgets.filter((b) => b.organization !== 'ESTACA');
    const totalOrgsAssigned = orgBudgetsOnly.reduce(
      (acc, b) =>
        acc +
        Number(b.t1_assigned) +
        Number(b.t2_assigned) +
        Number(b.t3_assigned) +
        Number(b.t4_assigned),
      0
    );

    // Consolidado contable total incluyendo la cuenta central ESTACA ($ 444.773,09)
    const totalConsolidatedAssigned = budgets.reduce(
      (acc, b) =>
        acc +
        Number(b.t1_assigned) +
        Number(b.t2_assigned) +
        Number(b.t3_assigned) +
        Number(b.t4_assigned),
      0
    );

    // Gastos de las organizaciones operativas vs Gastos totales incluyendo Estaca
    const orgsSpent = nonReimbursableExpenses
      .filter((e) => e.organization !== 'ESTACA')
      .reduce((acc, e) => acc + Number(e.net_amount), 0);

    const totalConsolidatedSpent = nonReimbursableExpenses.reduce(
      (acc, e) => acc + Number(e.net_amount),
      0
    );

    const orgsAvailable = totalOrgsAssigned - orgsSpent;
    const consolidatedAvailable = totalConsolidatedAssigned - totalConsolidatedSpent;
    const globalUsagePercent =
      totalOrgsAssigned > 0 ? Math.min(100, Math.round((orgsSpent / totalOrgsAssigned) * 100)) : 0;

    // Evolución Trimestral Acumulativa de las Organizaciones (T1-T4)
    const qAssigned: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    orgBudgetsOnly.forEach((b) => {
      qAssigned.T1 += Number(b.t1_assigned);
      qAssigned.T2 += Number(b.t2_assigned);
      qAssigned.T3 += Number(b.t3_assigned);
      qAssigned.T4 += Number(b.t4_assigned);
    });

    const qSpent: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    nonReimbursableExpenses
      .filter((e) => e.organization !== 'ESTACA')
      .forEach((e) => {
        const q = getQuarterFromDate(e.expense_date);
        qSpent[q] += Number(e.net_amount);
      });

    const r1 = qAssigned.T1 - qSpent.T1;
    const a2 = qAssigned.T2 + r1;
    const r2 = a2 - qSpent.T2;
    const a3 = qAssigned.T3 + r2;
    const r3 = a3 - qSpent.T3;
    const a4 = qAssigned.T4 + r3;
    const r4 = a4 - qSpent.T4;

    const quarters: QuarterSummary[] = [
      { quarter: 'T1', assigned: qAssigned.T1, carryOverIn: 0, available: qAssigned.T1, spent: qSpent.T1, remaining: r1 },
      { quarter: 'T2', assigned: qAssigned.T2, carryOverIn: r1, available: a2, spent: qSpent.T2, remaining: r2 },
      { quarter: 'T3', assigned: qAssigned.T3, carryOverIn: r2, available: a3, spent: qSpent.T3, remaining: r3 },
      { quarter: 'T4', assigned: qAssigned.T4, carryOverIn: r3, available: a4, spent: qSpent.T4, remaining: r4 },
    ];

    // Estadísticas individuales de las 8 organizaciones + Seminario + Estaca
    const orgStats: OrgSummaryStat[] = ALL_HUB_ORGS.map((orgCode) => {
      const b = budgets.find((item) => item.organization === orgCode);
      const assigned = b
        ? Number(b.t1_assigned) +
          Number(b.t2_assigned) +
          Number(b.t3_assigned) +
          Number(b.t4_assigned)
        : orgCode === 'ESTACA'
        ? 129468.69
        : 0;

      // Para ESTACA tomamos su apertura anual ($ 129.468,69) como referencia visual de su tarjeta operativa
      const effectiveAssigned = orgCode === 'ESTACA' && b ? Number(b.t1_assigned) : assigned;

      const spent = nonReimbursableExpenses
        .filter((e) => e.organization === orgCode)
        .reduce((acc, e) => acc + Number(e.net_amount), 0);

      const available = effectiveAssigned - spent;
      const usagePercent =
        effectiveAssigned > 0
          ? Math.min(100, Math.round((spent / effectiveAssigned) * 100))
          : spent > 0
          ? 100
          : 0;

      const shareOfPoolPercent =
        orgCode !== 'ESTACA' && totalOrgsAssigned > 0
          ? Number(((effectiveAssigned / totalOrgsAssigned) * 100).toFixed(1))
          : 0;

      return {
        organization: orgCode,
        assigned: effectiveAssigned,
        spent,
        available,
        usagePercent,
        shareOfPoolPercent,
      };
    });

    return {
      totalOrgsAssigned,
      orgsSpent,
      orgsAvailable,
      totalConsolidatedAssigned,
      totalConsolidatedSpent,
      consolidatedAvailable,
      globalUsagePercent,
      pendingLcrCount: pendingLcrExpenses.length,
      pendingLcrTotal,
      quarters,
      orgStats,
    };
  }, [budgets, expenses]);

  const pendingProposalsCount = useMemo(
    () => activities.filter((a) => a.status === 'PROPUESTA').length,
    [activities]
  );

  // Handlers de la Bandeja de Aprobación
  const handleApproveActivity = async (id: number) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'APROBADA' } : a))
    );
    try {
      await supabase.from('activities').update({ status: 'APROBADA' }).eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleRejectActivity = async (id: number, reason?: string) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'RECHAZADA',
              description: reason ? `${a.description || ''} [Motivo: ${reason}]`.trim() : a.description,
            }
          : a
      )
    );
    try {
      await supabase.from('activities').update({ status: 'RECHAZADA' }).eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleEditAndApproveActivity = async (
    id: number,
    updates: {
      title: string;
      event_date: string;
      start_time: string;
      location: string;
      description: string;
      estimated_cost: number;
    }
  ) => {
    setActivities((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...updates,
              has_budget: updates.estimated_cost > 0,
              status: 'APROBADA',
            }
          : a
      )
    );
    try {
      await supabase
        .from('activities')
        .update({
          title: updates.title,
          event_date: updates.event_date,
          start_time: updates.start_time,
          location: updates.location,
          description: updates.description,
          estimated_cost: updates.estimated_cost,
          has_budget: updates.estimated_cost > 0,
          status: 'APROBADA',
        })
        .eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  // =========================================================================
  // HANDLERS EXCLUSIVOS DEL PANEL DE ADMINISTRADOR (Paso 6.4)
  // =========================================================================
  const handleCreateExpense = async (newExpense: Omit<ExpenseRecord, 'id'>) => {
    const tempId = Date.now();
    const record: ExpenseRecord = { ...newExpense, id: tempId };
    setExpenses((prev) => [record, ...prev]);

    try {
      await supabase.from('expenses').insert([newExpense]);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleCreateMultipleExpenses = async (expensesList: Array<Omit<ExpenseRecord, 'id'>>) => {
    const baseId = Date.now();
    const records: ExpenseRecord[] = expensesList.map((item, idx) => ({
      ...item,
      id: baseId + idx,
    }));
    setExpenses((prev) => [...records, ...prev]);

    try {
      await supabase.from('expenses').insert(expensesList);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleReconcileLcrExpense = async (id: number) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'REGISTRADO_LCR' } : e))
    );
    try {
      await supabase.from('expenses').update({ status: 'REGISTRADO_LCR' }).eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleCreateWithdrawal = async (newWithdrawal: Omit<CashWithdrawalRecord, 'id'>) => {
    const record: CashWithdrawalRecord = { ...newWithdrawal, id: Date.now() };
    setWithdrawals((prev) => [record, ...prev]);

    try {
      await supabase.from('cash_withdrawals').insert([newWithdrawal]);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleCloseWithdrawalInZero = async (
    id: number,
    returnAmount: number,
    returnDate: string
  ) => {
    setWithdrawals((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              returned_amount: Number(w.returned_amount || 0) + returnAmount,
              return_date: returnAmount > 0 ? returnDate : w.return_date,
              status: 'CERRADO_EN_CERO',
            }
          : w
      )
    );
    try {
      await supabase
        .from('cash_withdrawals')
        .update({
          returned_amount: returnAmount,
          return_date: returnAmount > 0 ? returnDate : null,
          status: 'CERRADO_EN_CERO',
        })
        .eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const handleCreateSupplier = async (newSupplier: Omit<SupplierRecord, 'id'>) => {
    const record: SupplierRecord = { ...newSupplier, id: Date.now() };
    setSuppliers((prev) => [...prev, record]);

    try {
      await supabase.from('suppliers').insert([newSupplier]);
    } catch {
      // Estado local ya actualizado
    }
  };

  // Si el usuario seleccionó una organización para verla en Modo Espejo (idéntica a la vista del líder)
  if (inspectedOrg) {
    return (
      <LeaderView
        inspectedOrg={inspectedOrg}
        onBackToHub={() => setInspectedOrg(null)}
      />
    );
  }

  return (
    <div
      data-testid="presidency-hub-view"
      className="min-h-[100dvh] bg-slate-100/90 flex flex-col justify-between pb-24"
    >
      {/* ==================== CABECERA EJECUTIVA Y NAVEGACIÓN DEL HUB ==================== */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-900 text-emerald-50 tracking-wide shadow-sm">
                    Estaca Montevideo Uruguay Este
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    Año Fiscal 2026
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight mt-1">
                  Hub Ejecutivo de {user.role === 'ADMIN' ? 'Administración y Presidencia' : 'Presidencia de Estaca'}
                </h1>
              </div>
            </div>

            {/* Badge de Usuario Activo + Regla Sagrada #1 (Administrador Permanente Inmutable) */}
            <div className="flex flex-col sm:items-end">
              <div className="inline-flex items-center gap-2 bg-slate-100 py-1 px-3 rounded-full border border-slate-200/90 text-xs self-start sm:self-end">
                <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span data-testid="hub-user-name" className="font-extrabold text-slate-800">
                  {user.full_name}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-900 text-white">
                  {user.role}
                </span>
              </div>

              {user.is_permanent_admin && (
                <span
                  data-testid="permanent-admin-badge"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 mt-1"
                >
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Administrador Permanente Inmutable ({user.calling})</span>
                </span>
              )}
            </div>
          </div>

          {/* Barra de Botones del Hub (Dashboard | Bandeja de Aprobación Pulsante | Botones Admin) */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
              {/* Botón 1: Dashboard Ejecutivo */}
              <button
                type="button"
                data-testid="hub-nav-dashboard"
                onClick={() => setActiveTab('DASHBOARD')}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Dashboard Ejecutivo</span>
              </button>

              {/* Botón 2: Bandeja de Aprobación con Indicador Parpadeante/Pulsante cuando hay pendientes */}
              <button
                type="button"
                data-testid="hub-nav-approvals"
                onClick={() => setActiveTab('APPROVALS')}
                className={`pressable relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  activeTab === 'APPROVALS'
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-amber-400/70'
                    : pendingProposalsCount > 0
                    ? 'bg-amber-50 text-amber-950 border-2 border-amber-400 shadow-sm hover:bg-amber-100/80'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <Bell className="w-4 h-4 text-amber-600" />
                  {pendingProposalsCount > 0 && (
                    <span
                      data-testid="pending-proposals-pulse"
                      className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                  )}
                </span>
                <span>Aprobación de Actividades</span>
                <span
                  data-testid="nav-pending-count"
                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                    pendingProposalsCount > 0
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {pendingProposalsCount}
                </span>
              </button>
            </div>

            {/* Botones Exclusivos de Administrador (PROJECT_CONTEXT.md §3.3 y §4.3) */}
            {user.role === 'ADMIN' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="hub-admin-users-btn"
                  onClick={() => setActiveTab('USERS')}
                  className={`pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                    activeTab === 'USERS'
                      ? 'bg-emerald-900 text-white shadow-sm ring-2 ring-emerald-400/60'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  <Users
                    className={`w-3.5 h-3.5 ${
                      activeTab === 'USERS' ? 'text-emerald-300' : 'text-emerald-700'
                    }`}
                  />
                  <span>Gestión de Usuarios</span>
                </button>

                <button
                  type="button"
                  data-testid="hub-admin-operations-btn"
                  onClick={() => setActiveTab('OPERATIONS')}
                  className={`pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                    activeTab === 'OPERATIONS'
                      ? 'bg-emerald-900 text-white shadow-sm ring-2 ring-emerald-400/60'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  <FileEdit
                    className={`w-3.5 h-3.5 ${
                      activeTab === 'OPERATIONS' ? 'text-emerald-300' : 'text-emerald-700'
                    }`}
                  />
                  <span>Centro de Edición y Carga</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==================== CONTENIDO PRINCIPAL DEL HUB ==================== */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-6 flex-1">
        {activeTab === 'USERS' && user.role === 'ADMIN' ? (
          <UserManagementPanel />
        ) : activeTab === 'OPERATIONS' && user.role === 'ADMIN' ? (
          <AdminOperationsCenter
            budgets={budgets}
            expenses={expenses}
            withdrawals={withdrawals}
            activities={activities}
            suppliers={suppliers}
            onCreateExpense={handleCreateExpense}
            onCreateMultipleExpenses={handleCreateMultipleExpenses}
            onReconcileLcrExpense={handleReconcileLcrExpense}
            onCreateWithdrawal={handleCreateWithdrawal}
            onCloseWithdrawalInZero={handleCloseWithdrawalInZero}
            onCreateSupplier={handleCreateSupplier}
          />
        ) : activeTab === 'APPROVALS' ? (
          <ActivityApprovalTray
            activities={activities}
            canApprove={user.can_approve_activities || user.role === 'ADMIN'}
            userFullName={user.full_name}
            userCalling={user.calling}
            onApproveActivity={handleApproveActivity}
            onRejectActivity={handleRejectActivity}
            onEditAndApproveActivity={handleEditAndApproveActivity}
          />
        ) : (
          <>
            {/* 1. TARJETAS KPI EJECUTIVAS DE ALTO IMPACTO */}
            <section
              aria-label="Indicadores Globales de Estaca"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              {/* KPI 1: Presupuesto Total Asignado a Organizaciones */}
              <div
                data-testid="kpi-total-budget-card"
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 sm:p-6 text-white shadow-xl border border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    Presupuesto Organizaciones
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <p
                  data-testid="kpi-orgs-assigned-amount"
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums mt-3"
                >
                  {formatCurrency(executiveMetrics.totalOrgsAssigned)}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  8 Organizaciones + Seminario (2026)
                </p>
                <div className="mt-4 pt-3 border-t border-slate-800/90 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Consolidado c/ Bolsón Estaca:</span>
                  <span
                    data-testid="kpi-consolidated-assigned-amount"
                    className="font-bold text-white tabular-nums"
                  >
                    {formatCurrency(executiveMetrics.totalConsolidatedAssigned)}
                  </span>
                </div>
              </div>

              {/* KPI 2: Total Ejecutado / Gastado */}
              <div
                data-testid="kpi-total-spent-card"
                className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Total Ejecutado (Orgs)
                    </span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 tabular-nums">
                      {executiveMetrics.globalUsagePercent}% consumido
                    </span>
                  </div>
                  <p
                    data-testid="kpi-orgs-spent-amount"
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums mt-3"
                  >
                    {formatCurrency(executiveMetrics.orgsSpent)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gastos netos imputados a organizaciones
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Ejecutado Global (+ Estaca):</span>
                  <span
                    data-testid="kpi-consolidated-spent-amount"
                    className="font-extrabold text-slate-800 tabular-nums"
                  >
                    {formatCurrency(executiveMetrics.totalConsolidatedSpent)}
                  </span>
                </div>
              </div>

              {/* KPI 3: Saldo Disponible Global + Alerta LCR */}
              <div
                data-testid="kpi-available-balance-card"
                className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                      Saldo Disponible (Orgs)
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <p
                    data-testid="kpi-orgs-available-amount"
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-800 tabular-nums mt-3"
                  >
                    {formatCurrency(executiveMetrics.orgsAvailable)}
                  </p>
                  <div className="mt-2.5 w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden border border-emerald-200">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-300"
                      style={{ width: `${executiveMetrics.globalUsagePercent}%` }}
                    />
                  </div>
                </div>

                {executiveMetrics.pendingLcrCount > 0 && (
                  <div
                    data-testid="kpi-lcr-alert-badge"
                    className="mt-4 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{executiveMetrics.pendingLcrCount} pendientes en LCR</span>
                    </span>
                    <span className="font-extrabold tabular-nums text-rose-700">
                      {formatCurrency(executiveMetrics.pendingLcrTotal)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* 2. APERTURA ANUAL + INGRESOS TRIMESTRALES ACUMULADOS (Q1 - Q4) */}
            <section
              aria-label="Evolución de Fondos Trimestrales Acumulados"
              data-testid="quarterly-rollover-section"
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Apertura Anual + Ingresos Trimestrales Acumulativos (Q1–Q4)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Regla de acumulación: el saldo no ejecutado de cada trimestre se arrastra automáticamente al siguiente
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {executiveMetrics.quarters.map((q) => (
                  <div
                    key={q.quarter}
                    data-testid={`hub-quarter-card-${q.quarter}`}
                    className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-emerald-900 text-white">
                          {q.quarter === 'T1' ? 'T1 • Apertura + Q1' : q.quarter}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                          +{formatCurrency(q.assigned)}
                        </span>
                      </div>

                      {q.quarter !== 'T1' && (
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Arrastre anterior:</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">
                            {formatCurrency(q.carryOverIn)}
                          </span>
                        </div>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-slate-200/70">
                        <p className="text-[11px] font-semibold text-slate-500">
                          Disponible Acumulado {q.quarter}
                        </p>
                        <p className="text-base font-extrabold text-slate-900 tabular-nums mt-0.5">
                          {formatCurrency(q.available)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Ritmo Gasto Real:</span>
                        <span className="font-bold text-amber-700 tabular-nums">
                          -{formatCurrency(q.spent)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700">Remanente {q.quarter}:</span>
                        <span
                          className={`font-extrabold tabular-nums ${
                            q.remaining < 0 ? 'text-rose-600' : 'text-emerald-800'
                          }`}
                        >
                          {formatCurrency(q.remaining)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. GRÁFICO INTERACTIVO DE DISTRIBUCIÓN Y EJECUCIÓN (CHART.JS) */}
            <OrgDistributionChart orgStats={executiveMetrics.orgStats} />

            {/* 4. GRID DE TARJETAS DE LAS 8 ORGANIZACIONES + SEMINARIO CON MODO ESPEJO */}
            <section
              aria-label="Estado por Organización y Modo Espejo"
              data-testid="organizations-grid-section"
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Estado por Organización (8 Organizaciones + Seminario)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Barra de progreso verde con llenado semafórico según consumo • Toca cualquier organización para abrir su Modo Espejo
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {executiveMetrics.orgStats.map((stat) => {
                  const nextAct = activities
                    .filter(
                      (a) =>
                        a.organization === stat.organization &&
                        a.status === 'APROBADA' &&
                        a.event_date >= '2026-11-01'
                    )
                    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];

                  const fillBarColor =
                    stat.usagePercent > 90
                      ? 'bg-rose-600'
                      : stat.usagePercent > 75
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                  return (
                    <article
                      key={stat.organization}
                      data-testid={`org-card-${stat.organization}`}
                      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 hover:border-emerald-600/60 transition flex flex-col justify-between gap-4"
                    >
                      <div>
                        {/* Header Organización */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-xs flex-shrink-0">
                              {ORGANIZATION_SHORT_LABELS[stat.organization].slice(0, 3)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-extrabold text-slate-900 truncate">
                                {ORGANIZATION_LABELS[stat.organization]}
                              </h3>
                              <span className="text-[11px] font-semibold text-slate-400">
                                {stat.organization === 'ESTACA'
                                  ? 'Apertura Central Estaca'
                                  : `${stat.shareOfPoolPercent}% del presupuesto anual`}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full tabular-nums ${
                              stat.usagePercent > 90
                                ? 'bg-rose-100 text-rose-800'
                                : stat.usagePercent > 75
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {stat.usagePercent}% uso
                          </span>
                        </div>

                        {/* Saldo Disponible y Asignado vs Ejecutado */}
                        <div className="mt-4 flex items-baseline justify-between">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Saldo Actual
                            </p>
                            <p
                              data-testid={`org-card-available-${stat.organization}`}
                              className={`text-xl font-extrabold tabular-nums mt-0.5 ${
                                stat.available < 0 ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {formatCurrency(stat.available)}
                            </p>
                          </div>

                          <div className="text-right text-xs">
                            <p className="text-slate-500">
                              Asig:{' '}
                              <strong className="text-slate-800 tabular-nums">
                                {formatCurrency(stat.assigned)}
                              </strong>
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              Gastado:{' '}
                              <strong className="text-rose-700 tabular-nums">
                                {formatCurrency(stat.spent)}
                              </strong>
                            </p>
                          </div>
                        </div>

                        {/* Barra de Progreso Visual: Largo total en verde con llenado en rojo según consumo ejecutado (PROJECT_CONTEXT.md §4.2) */}
                        <div className="mt-3.5">
                          <div className="w-full h-3 bg-emerald-500/25 border border-emerald-500/40 rounded-full overflow-hidden flex">
                            <div
                              data-testid={`org-progress-bar-${stat.organization}`}
                              className={`h-full ${fillBarColor} transition-all duration-300 ease-out-expo`}
                              style={{ width: `${stat.usagePercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                            <span className="text-rose-600">Ejecutado ({stat.usagePercent}%)</span>
                            <span className="text-emerald-700">
                              Disponible ({Math.max(0, 100 - stat.usagePercent)}%)
                            </span>
                          </div>
                        </div>

                        {/* Próxima actividad de la organización */}
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                          {nextAct ? (
                            <div className="flex items-center justify-between gap-2 text-slate-600">
                              <span className="inline-flex items-center gap-1.5 truncate font-medium">
                                <Calendar className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                                <span className="truncate">{nextAct.title}</span>
                              </span>
                              <span className="text-[11px] font-bold text-slate-700 tabular-nums flex-shrink-0">
                                {formatDate(nextAct.event_date)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Sin actividad futura agendada
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botón Modo Espejo */}
                      <button
                        type="button"
                        data-testid={`inspect-org-${stat.organization}`}
                        onClick={() => setInspectedOrg(stat.organization)}
                        className="pressable w-full py-2.5 px-3.5 rounded-2xl bg-slate-900 hover:bg-emerald-950 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Eye className="w-4 h-4 text-emerald-400" />
                        <span>Ver como Líder (Modo Espejo)</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};
