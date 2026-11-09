import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  FileEdit,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  INITIAL_OPENING_BALANCE_2026,
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
  'SS',
  'PRIMARIA',
  'JAS',
  'AS',
  'CFS',
  'ESTACA',
];

const OPEN_ORG_BUTTON_LABELS: Record<OrganizationCode, string> = {
  MJ: 'ABRIR MUJERES JÓVENES',
  HJ: 'ABRIR HOMBRES JÓVENES',
  SEMINARIO: 'ABRIR SEMINARIO',
  SS: 'ABRIR SOCIEDAD DE SOCORRO',
  PRIMARIA: 'ABRIR PRIMARIA',
  JAS: 'ABRIR JÓVENES ADULTOS SOLTEROS',
  AS: 'ABRIR ADULTOS SOLTEROS',
  CFS: 'ABRIR CENTRO FAMILYSEARCH',
  ESTACA: 'ABRIR ESTACA',
  TODAS: 'ABRIR ORGANIZACIÓN',
};

const SESSION_PROPOSALS_KEY = 'estaca_session_proposals_v1';

const loadSessionProposals = (): ActivityRecord[] => {
  try {
    const raw = sessionStorage.getItem(SESSION_PROPOSALS_KEY);
    return raw ? (JSON.parse(raw) as ActivityRecord[]) : [];
  } catch {
    return [];
  }
};

const saveSessionProposals = (list: ActivityRecord[]) => {
  try {
    const proposalsOnly = list.filter((a) => a.origin === 'propuesta_lider');
    sessionStorage.setItem(SESSION_PROPOSALS_KEY, JSON.stringify(proposalsOnly));
  } catch {
    // Ignorar errores de almacenamiento
  }
};

export const PresidencyHub: React.FC = () => {
  const { user, isSimulating } = useAuth();

  // Sub-vista activa: DASHBOARD | APPROVALS | USERS | OPERATIONS
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'APPROVALS' | 'USERS' | 'OPERATIONS'>(
    'DASHBOARD'
  );
  // Menú Drawer móvil (hamburguesa ☰ -> cruz ✕)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Año fiscal seleccionado: Presidencia y Admin pueden elegir 2025, 2026 y 2027; Líderes 2026 y 2027
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const availableYears = useMemo(
    () => (user.role === 'LIDER' ? [2026, 2027] : [2025, 2026, 2027]),
    [user.role]
  );

  // Si el usuario entra a inspeccionar una organización en Modo Espejo
  const [inspectedOrg, setInspectedOrg] = useState<OrganizationCode | null>(null);

  const [budgets, setBudgets] = useState<BudgetAllocation[]>(SEED_BUDGET_ALLOCATIONS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [activities, setActivities] = useState<ActivityRecord[]>(() => [
    ...SEED_ACTIVITIES,
    ...loadSessionProposals(),
  ]);
  const [withdrawals, setWithdrawals] = useState<CashWithdrawalRecord[]>(SEED_CASH_WITHDRAWALS);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(SEED_SUPPLIERS);

  // Sincronización en tiempo real con Supabase con fallback a SEED_DATA auditado
  useEffect(() => {
    let active = true;

    async function fetchExecutiveData() {
      try {
        const [budgetRes, expenseRes, activityRes, withdrawalRes, supplierRes] = await Promise.all([
          supabase.from('budget_allocations').select('*'),
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
            origin: a.ical_uid?.startsWith('PROPUESTA_LIDER')
              ? 'propuesta_lider'
              : a.status === 'PROPUESTA'
              ? 'propuesta_lider'
              : 'lcr',
          })) as ActivityRecord[];

          const existingTitles = new Set(remoteActivities.map((a) => a.title));
          const mergedRemoteAndSeed = [
            ...remoteActivities,
            ...SEED_ACTIVITIES.filter((s) => !existingTitles.has(s.title)),
          ];

          setActivities((prev) => {
            const sessionProps = loadSessionProposals();
            const localProposals = [...prev, ...sessionProps].filter(
              (p) =>
                p.origin === 'propuesta_lider' &&
                !mergedRemoteAndSeed.some(
                  (m) => m.title === p.title && m.event_date === p.event_date
                )
            );
            const uniqueLocal = Array.from(
              new Map(localProposals.map((p) => [`${p.title}-${p.event_date}`, p])).values()
            );
            const prevById = new Map(prev.map((item) => [item.id, item]));

            return [
              ...mergedRemoteAndSeed.map((item) => prevById.get(item.id) || item),
              ...uniqueLocal,
            ].sort((a, b) => a.event_date.localeCompare(b.event_date));
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

  // Cálculos Globales y por Organización exactos según Ejemplo_DB_Finanzas.xlsx para el año seleccionado
  const executiveMetrics = useMemo(() => {
    const yearBudgets = budgets.filter((b) => Number(b.year) === selectedYear);
    const yearExpenses = expenses.filter((e) =>
      e.expense_date.startsWith(String(selectedYear))
    );

    const nonReimbursableExpenses = yearExpenses.filter((e) => !e.is_reimbursable_oai);
    const pendingRenderExpenses = yearExpenses.filter((e) => e.status === 'PENDIENTE_LCR');
    const pendingRenderTotal = pendingRenderExpenses.reduce(
      (acc, e) => acc + Number(e.gross_amount),
      0
    );

    // Consolidado contable total (Organizaciones + Remanente Estaca = $ 419.773,09 en 2026)
    const totalConsolidatedAssigned = yearBudgets.reduce(
      (acc, b) =>
        acc +
        Number(b.t1_assigned) +
        Number(b.t2_assigned) +
        Number(b.t3_assigned) +
        Number(b.t4_assigned),
      0
    );

    // Total Gastos Realizados No Reembolsables ($ 305.605,00 en 2026)
    const totalConsolidatedSpent = nonReimbursableExpenses.reduce(
      (acc, e) => acc + Number(e.net_amount),
      0
    );

    // Presupuesto Disponible Real ($ 114.168,09 en 2026)
    const consolidatedAvailable = totalConsolidatedAssigned - totalConsolidatedSpent;

    // Resumen por trimestre (T1 - T4)
    // En 2026: T1 Total Disponible ($ 194.468,69) = Remanente inicial 2025 ($ 123.027,89) + Ingreso T1 ($ 71.440,80)
    const qTotalAssigned: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    yearBudgets.forEach((b) => {
      qTotalAssigned.T1 += Number(b.t1_assigned);
      qTotalAssigned.T2 += Number(b.t2_assigned);
      qTotalAssigned.T3 += Number(b.t3_assigned);
      qTotalAssigned.T4 += Number(b.t4_assigned);
    });

    const qSpent: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    nonReimbursableExpenses.forEach((e) => {
      const q = getQuarterFromDate(e.expense_date);
      qSpent[q] += Number(e.net_amount);
    });

    const t1CarryOver =
      selectedYear === 2026 && qTotalAssigned.T1 >= INITIAL_OPENING_BALANCE_2026
        ? INITIAL_OPENING_BALANCE_2026
        : 0;
    const t1Income = Math.max(0, Number((qTotalAssigned.T1 - t1CarryOver).toFixed(2)));
    const a1 = qTotalAssigned.T1; // $ 194.468,69
    const r1 = Number((a1 - qSpent.T1).toFixed(2)); // $ 41.622,69

    const a2 = Number((qTotalAssigned.T2 + r1).toFixed(2)); // $ 117.514,09
    const r2 = Number((a2 - qSpent.T2).toFixed(2)); // $ 49.778,09

    const a3 = Number((qTotalAssigned.T3 + r2).toFixed(2)); // $ 127.923,69
    const r3 = Number((a3 - qSpent.T3).toFixed(2)); // $ 83.070,69

    const a4 = Number((qTotalAssigned.T4 + r3).toFixed(2)); // $ 154.338,09
    const r4 = Number((a4 - qSpent.T4).toFixed(2)); // $ 114.168,09

    const quarters: QuarterSummary[] = [
      {
        quarter: 'T1',
        assigned: t1Income,
        carryOverIn: t1CarryOver,
        available: a1,
        spent: qSpent.T1,
        remaining: r1,
      },
      {
        quarter: 'T2',
        assigned: qTotalAssigned.T2,
        carryOverIn: r1,
        available: a2,
        spent: qSpent.T2,
        remaining: r2,
      },
      {
        quarter: 'T3',
        assigned: qTotalAssigned.T3,
        carryOverIn: r2,
        available: a3,
        spent: qSpent.T3,
        remaining: r3,
      },
      {
        quarter: 'T4',
        assigned: qTotalAssigned.T4,
        carryOverIn: r3,
        available: a4,
        spent: qSpent.T4,
        remaining: r4,
      },
    ];

    // Estadísticas individuales de las organizaciones + Seminario + Estaca
    const orgStats: OrgSummaryStat[] = ALL_HUB_ORGS.map((orgCode) => {
      const b = yearBudgets.find((item) => item.organization === orgCode);
      const t1 = b ? Number(b.t1_assigned) : 0;
      const t2 = b ? Number(b.t2_assigned) : 0;
      const t3 = b ? Number(b.t3_assigned) : 0;
      const t4 = b ? Number(b.t4_assigned) : 0;
      const assigned = Number((t1 + t2 + t3 + t4).toFixed(2));

      const spent = nonReimbursableExpenses
        .filter((e) => e.organization === orgCode)
        .reduce((acc, e) => acc + Number(e.net_amount), 0);

      const available = Number((assigned - spent).toFixed(2));
      const usagePercent =
        assigned > 0
          ? Math.min(100, Math.round((spent / assigned) * 100))
          : spent > 0
          ? 100
          : 0;

      const shareOfPoolPercent =
        totalConsolidatedAssigned > 0
          ? Number(((assigned / totalConsolidatedAssigned) * 100).toFixed(1))
          : 0;

      return {
        organization: orgCode,
        t1_assigned: t1,
        t2_assigned: t2,
        t3_assigned: t3,
        t4_assigned: t4,
        assigned,
        spent,
        available,
        usagePercent,
        shareOfPoolPercent,
      };
    });

    return {
      totalConsolidatedAssigned,
      totalConsolidatedSpent,
      consolidatedAvailable,
      pendingRenderCount: pendingRenderExpenses.length,
      pendingRenderTotal,
      quarters,
      orgStats,
    };
  }, [budgets, expenses, selectedYear]);

  // Regla sagrada de aprobación: solo propuestas de líderes locales (origin === 'propuesta_lider' y status === 'PROPUESTA')
  const pendingProposalsCount = useMemo(
    () =>
      activities.filter(
        (a) => a.origin === 'propuesta_lider' && a.status === 'PROPUESTA'
      ).length,
    [activities]
  );

  // Handlers de la Bandeja de Aprobación
  const handleApproveActivity = async (id: number) => {
    setActivities((prev) => {
      const updated = prev.map((a) =>
        a.id === id ? { ...a, status: 'APROBADA' as const } : a
      );
      saveSessionProposals(updated);
      return updated;
    });
    if (!isSimulating) {
      try {
        await supabase.from('activities').update({ status: 'APROBADA' }).eq('id', id);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleRejectActivity = async (id: number, reason?: string) => {
    setActivities((prev) => {
      const updated = prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'RECHAZADA' as const,
              description: reason
                ? `${a.description || ''} [Motivo: ${reason}]`.trim()
                : a.description,
            }
          : a
      );
      saveSessionProposals(updated);
      return updated;
    });
    if (!isSimulating) {
      try {
        await supabase.from('activities').update({ status: 'RECHAZADA' }).eq('id', id);
      } catch {
        // Estado local ya actualizado
      }
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
    setActivities((prev) => {
      const updated = prev.map((a) =>
        a.id === id
          ? {
              ...a,
              ...updates,
              has_budget: updates.estimated_cost > 0,
              status: 'APROBADA' as const,
            }
          : a
      );
      saveSessionProposals(updated);
      return updated;
    });
    if (!isSimulating) {
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
    }
  };

  // =========================================================================
  // HANDLERS EXCLUSIVOS DEL PANEL DE ADMINISTRADOR (Paso 6.4)
  // =========================================================================
  const handleCreateExpense = async (newExpense: Omit<ExpenseRecord, 'id'>) => {
    const tempId = Date.now();
    const record: ExpenseRecord = { ...newExpense, id: tempId };
    setExpenses((prev) => [record, ...prev]);

    if (!isSimulating) {
      try {
        await supabase.from('expenses').insert([newExpense]);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleCreateMultipleExpenses = async (
    expensesList: Array<Omit<ExpenseRecord, 'id'>>
  ) => {
    const baseId = Date.now();
    const records: ExpenseRecord[] = expensesList.map((item, idx) => ({
      ...item,
      id: baseId + idx,
    }));
    setExpenses((prev) => [...records, ...prev]);

    if (!isSimulating) {
      try {
        await supabase.from('expenses').insert(expensesList);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleReconcileLcrExpense = async (id: number) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'REGISTRADO_LCR' } : e))
    );
    if (!isSimulating) {
      try {
        await supabase.from('expenses').update({ status: 'REGISTRADO_LCR' }).eq('id', id);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleCreateWithdrawal = async (
    newWithdrawal: Omit<CashWithdrawalRecord, 'id'>
  ) => {
    const record: CashWithdrawalRecord = { ...newWithdrawal, id: Date.now() };
    setWithdrawals((prev) => [record, ...prev]);

    if (!isSimulating) {
      try {
        await supabase.from('cash_withdrawals').insert([newWithdrawal]);
      } catch {
        // Estado local ya actualizado
      }
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
    if (!isSimulating) {
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
    }
  };

  const handleCreateSupplier = async (newSupplier: Omit<SupplierRecord, 'id'>) => {
    const record: SupplierRecord = { ...newSupplier, id: Date.now() };
    setSuppliers((prev) => [...prev, record]);

    if (!isSimulating) {
      try {
        await supabase.from('suppliers').insert([newSupplier]);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const selectTabAndCloseDrawer = (
    tab: 'DASHBOARD' | 'APPROVALS' | 'USERS' | 'OPERATIONS'
  ) => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
  };

  // Si el usuario seleccionó una organización para verla en Modo Espejo (idéntica a la vista del líder)
  if (inspectedOrg) {
    return (
      <LeaderView
        inspectedOrg={inspectedOrg}
        onBackToHub={() => setInspectedOrg(null)}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
      />
    );
  }

  return (
    <div
      data-testid="presidency-hub-view"
      className="min-h-[100dvh] bg-slate-100/90 flex flex-col justify-between pb-24"
    >
      {/* ==================== CABECERA LIMPIA Y NAVEGACIÓN ==================== */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Izquierda: Estaca + Selector de Año Dinámico [ Año 2026 ▾ ] */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="inline-flex items-center px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-extrabold bg-emerald-900 text-emerald-50 tracking-wide shadow-sm truncate">
                Estaca Montevideo Uruguay Este
              </span>

              <div className="relative inline-flex items-center flex-shrink-0">
                <select
                  aria-label="Seleccionar año fiscal"
                  data-testid="year-selector-dropdown"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 rounded-lg pl-2.5 pr-6 py-1 text-[11px] sm:text-xs font-extrabold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Año {yr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 pointer-events-none absolute right-1.5" />
              </div>
            </div>

            {/* Derecha: Usuario Activo + Botón Menú Hamburguesa (☰ -> ✕) en móvil */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-slate-100 py-1 px-2.5 sm:px-3 rounded-full border border-slate-200/90 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 flex-shrink-0" />
                <span
                  data-testid="hub-user-name"
                  className="font-extrabold text-slate-800 max-w-[85px] sm:max-w-none truncate"
                >
                  {user.full_name}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-900 text-white">
                  {user.role}
                </span>
              </div>

              {/* Botón Hamburguesa Móvil (☰ que se transforma suavemente en ✕) */}
              <button
                type="button"
                data-testid="mobile-menu-toggle"
                aria-label={isMobileDrawerOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
                aria-expanded={isMobileDrawerOpen}
                onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
                className="pressable md:hidden relative w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm flex-shrink-0"
              >
                <div className="w-4 h-4 relative flex items-center justify-center">
                  <span
                    className={`absolute h-0.5 w-4 bg-white rounded-full transition-all duration-200 ${
                      isMobileDrawerOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'
                    }`}
                  />
                  <span
                    className={`absolute h-0.5 w-4 bg-white rounded-full transition-all duration-200 ${
                      isMobileDrawerOpen ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  <span
                    className={`absolute h-0.5 w-4 bg-white rounded-full transition-all duration-200 ${
                      isMobileDrawerOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'
                    }`}
                  />
                </div>
                {pendingProposalsCount > 0 && !isMobileDrawerOpen && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>

          {/* Barra de Navegación Escritorio (md:flex, sin scroll horizontal) */}
          <nav
            aria-label="Navegación principal del panel"
            className="hidden md:flex mt-3 pt-2.5 border-t border-slate-100 items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              {/* Botón 1: Panel */}
              <button
                type="button"
                data-testid="hub-nav-dashboard"
                onClick={() => setActiveTab('DASHBOARD')}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Panel</span>
              </button>

              {/* Botón 2: Aprobación de Actividades */}
              <button
                type="button"
                data-testid="hub-nav-approvals"
                onClick={() => setActiveTab('APPROVALS')}
                className={`pressable relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
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

            {/* Botones Exclusivos de Administrador */}
            {user.role === 'ADMIN' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="hub-admin-users-btn"
                  onClick={() => setActiveTab('USERS')}
                  className={`pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
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
                  className={`pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
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
          </nav>
        </div>
      </header>

      {/* ==================== DRAWER LATERAL MÓVIL (CON BACKDROP BLUR) ==================== */}
      {isMobileDrawerOpen && (
        <div
          data-testid="mobile-nav-drawer-backdrop"
          className="fixed inset-0 z-40 md:hidden bg-slate-950/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <aside
            data-testid="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[82vw] h-full bg-white shadow-2xl border-r border-slate-200 p-5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Secciones
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  data-testid="drawer-nav-dashboard"
                  onClick={() => selectTabAndCloseDrawer('DASHBOARD')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'DASHBOARD'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Panel</span>
                </button>

                <button
                  type="button"
                  data-testid="drawer-nav-approvals"
                  onClick={() => selectTabAndCloseDrawer('APPROVALS')}
                  className={`pressable w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'APPROVALS'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Aprobación de Actividades</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500 text-slate-950 tabular-nums">
                    {pendingProposalsCount}
                  </span>
                </button>

                {user.role === 'ADMIN' && (
                  <>
                    <button
                      type="button"
                      data-testid="drawer-admin-users-btn"
                      onClick={() => selectTabAndCloseDrawer('USERS')}
                      className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                        activeTab === 'USERS'
                          ? 'bg-emerald-900 text-white shadow-sm'
                          : 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                      }`}
                    >
                      <Users className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Gestión de Usuarios</span>
                    </button>

                    <button
                      type="button"
                      data-testid="drawer-admin-operations-btn"
                      onClick={() => selectTabAndCloseDrawer('OPERATIONS')}
                      className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                        activeTab === 'OPERATIONS'
                          ? 'bg-emerald-900 text-white shadow-sm'
                          : 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                      }`}
                    >
                      <FileEdit className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Centro de Edición y Carga</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-semibold">
              Estaca Montevideo Uruguay Este • {selectedYear}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== CONTENIDO PRINCIPAL ==================== */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-6 flex-1">
        {activeTab === 'USERS' && user.role === 'ADMIN' ? (
          <UserManagementPanel />
        ) : activeTab === 'OPERATIONS' && user.role === 'ADMIN' ? (
          <AdminOperationsCenter
            budgets={budgets.filter((b) => Number(b.year) === selectedYear)}
            expenses={expenses.filter((e) =>
              e.expense_date.startsWith(String(selectedYear))
            )}
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
            {/* 1. TARJETA MAESTRA DE FONDOS (KPI PRINCIPAL) */}
            <section aria-label="Presupuesto Disponible">
              <div
                data-testid="kpi-available-balance-card"
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-300">
                    PRESUPUESTO DISPONIBLE
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>

                <p
                  data-testid="kpi-consolidated-available-amount"
                  className="text-3xl sm:text-5xl font-extrabold tracking-tight tabular-nums mt-3 text-white"
                >
                  {formatCurrency(executiveMetrics.consolidatedAvailable)}
                </p>

                {selectedYear === 2027 &&
                executiveMetrics.totalConsolidatedAssigned === 0 ? (
                  <p
                    data-testid="pending-budget-2027-legend"
                    className="text-xs sm:text-sm text-amber-300/95 font-semibold mt-2"
                  >
                    Presupuesto 2027 pendiente de asignación
                  </p>
                ) : (
                  <p
                    data-testid="kpi-consolidated-assigned-amount"
                    className="text-xs sm:text-sm text-slate-300 font-semibold mt-2 tabular-nums"
                  >
                    Asignado {selectedYear}:{' '}
                    {formatCurrency(executiveMetrics.totalConsolidatedAssigned)}
                  </p>
                )}

                {/* Alerta de pendientes de rendir (sin mencionar siglas técnicas) */}
                {executiveMetrics.pendingRenderTotal > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-800/90 space-y-1.5">
                    <button
                      type="button"
                      data-testid="kpi-pending-render-alert"
                      onClick={() => {
                        if (user.role === 'ADMIN') {
                          setActiveTab('OPERATIONS');
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs sm:text-sm font-extrabold tabular-nums ${
                        user.role === 'ADMIN'
                          ? 'hover:bg-amber-500/25 cursor-pointer pressable'
                          : 'cursor-default'
                      }`}
                    >
                      <span>
                        ⚠️ {formatCurrency(executiveMetrics.pendingRenderTotal)} pendientes de
                        rendir
                      </span>
                    </button>
                    <p
                      data-testid="kpi-pending-render-note"
                      className="text-[11px] sm:text-xs text-slate-300/90 block"
                    >
                      ℹ️ Este importe ya está contemplado en el presupuesto disponible mostrado
                      arriba.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 2. SECCIÓN "Resumen por trimestre" */}
            <section
              aria-label="Resumen por trimestre"
              data-testid="quarterly-rollover-section"
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
            >
              <h2 className="text-base font-extrabold text-slate-900 mb-4">
                Resumen por trimestre
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {executiveMetrics.quarters.map((q) => (
                  <div
                    key={q.quarter}
                    data-testid={`hub-quarter-card-${q.quarter}`}
                    className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between"
                  >
                    <div>
                      <span className="inline-block text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-900 text-white">
                        {q.quarter}
                      </span>

                      <p
                        data-testid={`hub-quarter-available-${q.quarter}`}
                        className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums mt-3"
                      >
                        {formatCurrency(q.available)}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Ingreso del trimestre:</span>
                        <span
                          data-testid={`hub-quarter-income-${q.quarter}`}
                          className="font-bold text-slate-800 tabular-nums"
                        >
                          {formatCurrency(q.assigned)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Remanente anterior:</span>
                        <span
                          data-testid={`hub-quarter-carryover-${q.quarter}`}
                          className="font-bold text-slate-800 tabular-nums"
                        >
                          {formatCurrency(q.carryOverIn)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Gastos del período:</span>
                        <span
                          data-testid={`hub-quarter-spent-${q.quarter}`}
                          className="font-bold text-rose-700 tabular-nums"
                        >
                          {formatCurrency(q.spent)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. GRÁFICA: "Asignación de fondos a cada organización" */}
            <OrgDistributionChart orgStats={executiveMetrics.orgStats} />

            {/* 4. SECCIÓN: "Estado por Organización" */}
            <section
              aria-label="Estado por Organización"
              data-testid="organizations-grid-section"
              className="space-y-4"
            >
              <h2 className="text-base font-extrabold text-slate-900">
                Estado por Organización
              </h2>

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

                  return (
                    <article
                      key={stat.organization}
                      data-testid={`org-card-${stat.organization}`}
                      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 hover:border-slate-300 transition flex flex-col justify-between gap-4"
                    >
                      <div>
                        {/* Nombre de la organización */}
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {ORGANIZATION_LABELS[stat.organization]}
                        </h3>

                        {/* Saldo disponible en grande */}
                        <p
                          data-testid={`org-card-available-${stat.organization}`}
                          className={`text-2xl font-extrabold tabular-nums mt-2 ${
                            stat.available < 0 ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(stat.available)}
                        </p>

                        {/* Próxima actividad (con ícono 💰 si tiene costo estimado) */}
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                          {nextAct ? (
                            <div className="flex items-center justify-between gap-2 text-slate-600">
                              <span className="inline-flex items-center gap-1.5 truncate font-medium">
                                <Calendar className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                                <span className="truncate">
                                  {nextAct.estimated_cost > 0 ? '💰 ' : ''}
                                  {nextAct.title}
                                </span>
                              </span>
                              <span className="text-[11px] font-bold text-slate-700 tabular-nums flex-shrink-0">
                                {formatDate(nextAct.event_date)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Sin próxima actividad agendada
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botón plano y sobrio sin íconos: "ABRIR [ORGANIZACIÓN]" */}
                      <button
                        type="button"
                        data-testid={`inspect-org-${stat.organization}`}
                        onClick={() => setInspectedOrg(stat.organization)}
                        className="pressable w-full py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-900 text-slate-900 hover:text-white text-xs font-extrabold tracking-wide transition text-center"
                      >
                        {OPEN_ORG_BUTTON_LABELS[stat.organization]}
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
