import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_ACTIVITIES, SEED_BUDGET_ALLOCATIONS, SEED_EXPENSES } from '../data/seedData';
import { isSharedYouthActivity } from '../lib/activityFilters';
import {
  consolidateLeaderExpenses,
  formatCurrency,
  formatDate,
  getExpenseEffectiveDate,
  getQuarterFromDate,
  isExpenseApplied,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import { supabase } from '../lib/supabase';
import {
  ActivityRecord,
  BudgetAllocation,
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
  QuarterSummary,
} from '../types/database';
import { ProposeActivityModal } from '../components/ProposeActivityModal';
import {
  isActivityPendingLcr,
  syncLcrCalendarWithShield,
} from '../services/lcrSyncService';
import { CalendarView } from './CalendarView';
import { SuppliersView } from './SuppliersView';
import { LeadersDirectoryView } from './LeadersDirectoryView';
import { SEED_SUPPLIERS } from '../data/seedData';

interface LeaderViewProps {
  /** Si Presidencia o Admin inspecciona una organización en modo espejo */
  inspectedOrg?: OrganizationCode;
  onBackToHub?: () => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
}

const SESSION_PROPOSALS_KEY = 'estaca_session_proposals_v1';

const loadSessionProposals = (): ActivityRecord[] => {
  try {
    const raw = sessionStorage.getItem(SESSION_PROPOSALS_KEY);
    return raw ? (JSON.parse(raw) as ActivityRecord[]) : [];
  } catch {
    return [];
  }
};

export const LeaderView: React.FC<LeaderViewProps> = ({
  inspectedOrg,
  onBackToHub,
  selectedYear,
  onYearChange,
}) => {
  const { user, isSimulating, signOut, realAuthEmail } = useAuth();
  const currentYear = new Date().getFullYear();
  const [internalYear, setInternalYear] = useState<number>(currentYear);
  const activeYear = selectedYear ?? internalYear;

  const availableYears = useMemo(
    () =>
      user.role === 'LIDER'
        ? [currentYear, currentYear + 1]
        : [currentYear - 1, currentYear, currentYear + 1],
    [user.role, currentYear]
  );

  const handleYearSelect = (yr: number) => {
    setInternalYear(yr);
    if (onYearChange) onYearChange(yr);
  };

  // Organización base del líder o la organización inspeccionada por Presidencia/Admin
  const baseOrg: OrganizationCode = useMemo(() => {
    if (inspectedOrg) return inspectedOrg;
    if (user.organization === 'TODAS') return 'MJ';
    return user.organization;
  }, [inspectedOrg, user.organization]);

  // Regla Especial de Seminario (ADR-003): Exclusivo para Hombres Jóvenes (HJ) y Mujeres Jóvenes (MJ)
  const canUseSeminario = baseOrg === 'MJ' || baseOrg === 'HJ';

  const [budgets, setBudgets] = useState<BudgetAllocation[]>(SEED_BUDGET_ALLOCATIONS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [activities, setActivities] = useState<ActivityRecord[]>(() => [
    ...SEED_ACTIVITIES,
    ...loadSessionProposals(),
  ]);

  // Estado de secciones colapsables (desplegables) — cerradas por defecto para mantener pantalla limpia
  const [isExpensesOpen, setIsExpensesOpen] = useState<boolean>(false);
  const [isQuartersOpen, setIsQuartersOpen] = useState<boolean>(false);

  // Filtros internos de acordeones
  const [quarterFilter, setQuarterFilter] = useState<'TODOS' | QuarterCode>('TODOS');

  // Navegación principal (Resumen, Calendario General, Proveedores) y Drawer móvil
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'CALENDAR' | 'SUPPLIERS' | 'DIRECTORY'>('SUMMARY');
  const [calendarOnlyPendingLcr, setCalendarOnlyPendingLcr] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isProposeOpen, setIsProposeOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const myPendingLcrCount = useMemo(
    () =>
      activities.filter((act) => {
        if (!isActivityPendingLcr(act)) return false;
        if (act.organization === baseOrg) return true;
        if (canUseSeminario && act.organization === 'SEMINARIO') return true;
        return false;
      }).length,
    [activities, baseOrg, canUseSeminario]
  );

  const selectTabAndCloseDrawer = (tab: 'SUMMARY' | 'CALENDAR' | 'SUPPLIERS' | 'DIRECTORY') => {
    setCalendarOnlyPendingLcr(false);
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
  };

  // Posicionar la vista siempre al inicio de la página al entrar a una organización o cambiar de sección
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [baseOrg, activeTab]);

  // Sincronización con Supabase en tiempo real con fallback resiliente a SEED
  useEffect(() => {
    let active = true;

    async function fetchSupabaseData() {
      try {
        const [budgetRes, expenseRes, activityRes] = await Promise.all([
          supabase.from('budget_allocations').select('*'),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('activities').select('*').order('event_date', { ascending: true }),
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
          setExpenses(
            expenseRes.data.map((e) => ({
              ...e,
              gross_amount: Number(e.gross_amount),
              external_reimbursement: Number(e.external_reimbursement),
              net_amount: Number(e.net_amount),
            })) as ExpenseRecord[]
          );
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

          // Preferir los registros auditados de SEED_ACTIVITIES como base canónica y sumar cualquier actividad nueva de Supabase
          const seedTitles = new Set(SEED_ACTIVITIES.map((s) => s.title.trim().toLowerCase()));
          const mergedActivities = [
            ...SEED_ACTIVITIES,
            ...remoteActivities.filter(
              (r) => !seedTitles.has(r.title.trim().toLowerCase())
            ),
          ];

          // Sincronización silenciosa con el Doble Escudo LCR al montar la app
          const syncResult = await syncLcrCalendarWithShield({
            currentActivities: mergedActivities,
          });

          if (!active) return;

          setActivities((prev) => {
            const sessionProps = loadSessionProposals();
            const localProposals = [...prev, ...sessionProps].filter(
              (p) =>
                p.origin === 'propuesta_lider' &&
                !syncResult.activities.some(
                  (m) => m.title === p.title && m.event_date === p.event_date
                )
            );
            const uniqueLocal = Array.from(
              new Map(localProposals.map((p) => [`${p.title}-${p.event_date}`, p])).values()
            );
            return [...syncResult.activities, ...uniqueLocal].sort((a, b) =>
              a.event_date.localeCompare(b.event_date)
            );
          });
        } else {
          // Sincronización silenciosa con el Doble Escudo LCR al montar la app (sobre SEED_ACTIVITIES)
          const syncResult = await syncLcrCalendarWithShield({
            currentActivities: SEED_ACTIVITIES,
          });
          if (active) {
            setActivities((prev) => {
              const sessionProps = loadSessionProposals();
              const localProposals = [...prev, ...sessionProps].filter(
                (p) =>
                  p.origin === 'propuesta_lider' &&
                  !syncResult.activities.some(
                    (m) => m.title === p.title && m.event_date === p.event_date
                  )
              );
              const uniqueLocal = Array.from(
                new Map(localProposals.map((p) => [`${p.title}-${p.event_date}`, p])).values()
              );
              return [...syncResult.activities, ...uniqueLocal].sort((a, b) =>
                a.event_date.localeCompare(b.event_date)
              );
            });
          }
        }
      } catch {
        // Mantiene datos semilla auditados en caso de estar offline
      }
    }

    fetchSupabaseData();
    return () => {
      active = false;
    };
  }, []);

  // Saldo disponible de Seminario (Fondo conjunto para HJ y MJ, no incluido en el presupuesto individual)
  const seminarioAvailable = useMemo(() => {
    const sem = budgets.find(
      (b) => b.organization === 'SEMINARIO' && Number(b.year) === activeYear
    );
    const assigned = sem
      ? Number(sem.t1_assigned) +
        Number(sem.t2_assigned) +
        Number(sem.t3_assigned) +
        Number(sem.t4_assigned)
      : 0;
    const spent = expenses
      .filter(
        (e) =>
          e.organization === 'SEMINARIO' &&
          isExpenseApplied(e) &&
          !e.is_reimbursable_oai &&
          getExpenseEffectiveDate(e).startsWith(String(activeYear))
      )
      .reduce((acc, e) => acc + Number(e.net_amount), 0);
    return Number((assigned - spent).toFixed(2));
  }, [budgets, expenses, activeYear]);

  // Cálculo Financiero exclusivo de la Organización base (ADR-007: excluye reembolsables OAI; ADR-013: usa net_amount)
  const financialSummary = useMemo(() => {
    const matchingBudgets = budgets.filter(
      (b) => b.organization === baseOrg && Number(b.year) === activeYear
    );
    const matchingExpenses = expenses.filter(
      (e) =>
        e.organization === baseOrg &&
        isExpenseApplied(e) &&
        !e.is_reimbursable_oai &&
        getExpenseEffectiveDate(e).startsWith(String(activeYear))
    );

    const t1Assigned = matchingBudgets.reduce((acc, b) => acc + Number(b.t1_assigned), 0);
    const t2Assigned = matchingBudgets.reduce((acc, b) => acc + Number(b.t2_assigned), 0);
    const t3Assigned = matchingBudgets.reduce((acc, b) => acc + Number(b.t3_assigned), 0);
    const t4Assigned = matchingBudgets.reduce((acc, b) => acc + Number(b.t4_assigned), 0);
    const totalAssigned = t1Assigned + t2Assigned + t3Assigned + t4Assigned;

    const spentByQuarter: Record<QuarterCode, number> = {
      T1: 0,
      T2: 0,
      T3: 0,
      T4: 0,
    };

    matchingExpenses.forEach((exp) => {
      const q = getQuarterFromDate(getExpenseEffectiveDate(exp));
      spentByQuarter[q] += Number(exp.net_amount);
    });

    const totalSpent =
      spentByQuarter.T1 + spentByQuarter.T2 + spentByQuarter.T3 + spentByQuarter.T4;
    const availableBalance = totalAssigned - totalSpent;
    const usagePercent =
      totalAssigned > 0 ? Math.min(100, Math.round((totalSpent / totalAssigned) * 100)) : 0;

    // Regla de Acumulación Trimestral (PROJECT_CONTEXT.md §5.2): El remanente no ejecutado se arrastra al siguiente trimestre
    const q1Rem = t1Assigned - spentByQuarter.T1;
    const q2Avail = t2Assigned + q1Rem;
    const q2Rem = q2Avail - spentByQuarter.T2;
    const q3Avail = t3Assigned + q2Rem;
    const q3Rem = q3Avail - spentByQuarter.T3;
    const q4Avail = t4Assigned + q3Rem;
    const q4Rem = q4Avail - spentByQuarter.T4;

    const quarters: QuarterSummary[] = [
      {
        quarter: 'T1',
        assigned: t1Assigned,
        carryOverIn: 0,
        available: t1Assigned,
        spent: spentByQuarter.T1,
        remaining: q1Rem,
      },
      {
        quarter: 'T2',
        assigned: t2Assigned,
        carryOverIn: q1Rem,
        available: q2Avail,
        spent: spentByQuarter.T2,
        remaining: q2Rem,
      },
      {
        quarter: 'T3',
        assigned: t3Assigned,
        carryOverIn: q2Rem,
        available: q3Avail,
        spent: spentByQuarter.T3,
        remaining: q3Rem,
      },
      {
        quarter: 'T4',
        assigned: t4Assigned,
        carryOverIn: q3Rem,
        available: q4Avail,
        spent: spentByQuarter.T4,
        remaining: q4Rem,
      },
    ];

    return {
      totalAssigned,
      totalSpent,
      availableBalance,
      usagePercent,
      quarters,
      orgExpenses: matchingExpenses.sort((a, b) =>
        getExpenseEffectiveDate(b).localeCompare(getExpenseEffectiveDate(a))
      ),
    };
  }, [budgets, expenses, baseOrg, activeYear]);

  // Monto comprometido en actividades de esta organización (misma regla que Presidencia)
  const orgReservedMetrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const currentQuarter = getQuarterFromDate(todayStr);
    const targetQuarter: QuarterCode =
      activeYear === currentYear
        ? currentQuarter
        : activeYear < currentYear
        ? 'T4'
        : 'T1';

    const yearStr = String(activeYear);
    const appliedActivityIds = new Set<number>();
    const projectedActivityIds = new Set<number>();

    expenses.forEach((exp) => {
      if (exp.activity_id == null) return;
      if (!getExpenseEffectiveDate(exp).startsWith(yearStr)) return;
      if (isExpenseApplied(exp)) {
        appliedActivityIds.add(exp.activity_id);
      } else if (exp.expense_type === 'PROYECTADO_ACTIVIDAD') {
        projectedActivityIds.add(exp.activity_id);
      }
    });

    let reservedTotal = 0;

    // 1. Gastos proyectados abiertos de esta organización
    expenses.forEach((exp) => {
      if (exp.organization !== baseOrg) return;
      if (exp.expense_type !== 'PROYECTADO_ACTIVIDAD') return;
      if (exp.is_reimbursable_oai) return;
      const effDate = getExpenseEffectiveDate(exp);
      if (!effDate.startsWith(yearStr)) return;
      const isOverdueOpen = activeYear === currentYear && effDate <= todayStr;
      if (!isOverdueOpen && getQuarterFromDate(effDate) !== targetQuarter) return;
      const amount = Number(exp.net_amount ?? exp.gross_amount ?? 0);
      if (amount > 0) reservedTotal += amount;
    });

    // 2. Actividades del calendario con presupuesto de esta organización aún sin cerrar
    activities.forEach((act) => {
      if (act.organization !== baseOrg) return;
      if (act.status === 'RECHAZADA' || act.status === 'CANCELADA') return;
      if (act.ical_uid?.startsWith('ACT-2026-')) return;
      if (!act.event_date || !act.event_date.startsWith(yearStr)) return;
      const isOverdueOpen = activeYear === currentYear && act.event_date <= todayStr;
      if (!isOverdueOpen && getQuarterFromDate(act.event_date) !== targetQuarter) return;
      if (projectedActivityIds.has(act.id) || appliedActivityIds.has(act.id)) return;
      const estimated = Number(act.estimated_cost || 0);
      if (estimated > 0) reservedTotal += estimated;
    });

    reservedTotal = Number(reservedTotal.toFixed(2));
    const estimatedFreeBalance = Number(
      (financialSummary.availableBalance - reservedTotal).toFixed(2)
    );

    return {
      targetQuarter,
      reservedTotal,
      estimatedFreeBalance,
    };
  }, [expenses, activities, baseOrg, activeYear, financialSummary.availableBalance]);

  // Gastos filtrados por trimestre en el acordeón, consolidando múltiples comprobantes de una misma actividad en 1 fila
  const filteredExpenses = useMemo(() => {
    const baseList =
      quarterFilter === 'TODOS'
        ? financialSummary.orgExpenses
        : financialSummary.orgExpenses.filter(
            (exp) => getQuarterFromDate(getExpenseEffectiveDate(exp)) === quarterFilter
          );
    return consolidateLeaderExpenses(baseList, activities);
  }, [financialSummary.orgExpenses, quarterFilter, activities]);

  // Fecha de referencia actual para separar actividades pasadas (realizadas) de las próximas futuras
  const referenceToday = new Date().toISOString().slice(0, 10);

  // Determina si una actividad corresponde a la agenda propia de la organización (incluyendo Seminario, MeetUP y actividades conjuntas HJ/MJ)
  const isOwnOrgOrYouthJointActivity = (act: ActivityRecord): boolean => {
    if (act.organization === baseOrg) return true;
    if (canUseSeminario && isSharedYouthActivity(act)) {
      return true;
    }
    return false;
  };

  // Próxima Actividad Programada (de la organización o general de Estaca)
  const nextUpcomingActivity = useMemo(() => {
    const orgActs = activities
      .filter(
        (a) =>
          (isOwnOrgOrYouthJointActivity(a) || a.organization === 'ESTACA') &&
          a.status !== 'RECHAZADA' &&
          a.status !== 'CANCELADA' &&
          a.event_date.startsWith(String(activeYear))
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    // Prioriza la próxima actividad propia de la organización desde hoy; si no hay, la próxima de Estaca
    const nextOwn = orgActs.find(
      (a) => isOwnOrgOrYouthJointActivity(a) && a.event_date >= referenceToday
    );
    const nextAny = orgActs.find((a) => a.event_date >= referenceToday);
    return nextOwn || nextAny || orgActs[orgActs.length - 1] || null;
  }, [activities, baseOrg, canUseSeminario, activeYear]);

  const handleCreateProposal = async (proposal: {
    title: string;
    event_date: string;
    start_time: string;
    end_time?: string;
    location: string;
    organization: OrganizationCode;
    estimated_cost: number;
    description?: string;
  }) => {
    const tempId = Date.now();
    const newRecord: ActivityRecord = {
      id: tempId,
      ical_uid: `PROPUESTA_LIDER-${tempId}`,
      title: proposal.title,
      event_date: proposal.event_date,
      start_time: proposal.start_time,
      end_time: proposal.end_time || null,
      location: proposal.location,
      organization: proposal.organization,
      description: proposal.description || null,
      estimated_cost: proposal.estimated_cost,
      has_budget: proposal.estimated_cost > 0,
      origin: 'propuesta_lider',
      status: 'PROPUESTA',
    };

    // Actualización optimista inmediata con deduplicación por título y fecha
    setActivities((prev) => {
      const withoutDup = prev.filter(
        (item) => !(item.title === newRecord.title && item.event_date === newRecord.event_date)
      );
      const updated = [...withoutDup, newRecord].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      );

      // Persistir en sessionStorage para sincronización inmediata entre roles en la sesión
      try {
        const currentSession = loadSessionProposals().filter(
          (item) => !(item.title === newRecord.title && item.event_date === newRecord.event_date)
        );
        sessionStorage.setItem(
          SESSION_PROPOSALS_KEY,
          JSON.stringify([...currentSession, newRecord])
        );
      } catch {
        // Ignorar errores de almacenamiento
      }

      return updated;
    });

    // Solo persistir en Supabase cuando no es simulación de desarrollo ni prueba automatizada con sufijo numérico
    if (!isSimulating && !/\d{4}$/.test(proposal.title.trim())) {
      try {
        const { data: inserted } = await supabase
          .from('activities')
          .insert([
            {
              ical_uid: newRecord.ical_uid,
              title: proposal.title,
              event_date: proposal.event_date,
              start_time: proposal.start_time,
              end_time: proposal.end_time || null,
              location: proposal.location,
              organization: proposal.organization,
              description: proposal.description || null,
              estimated_cost: proposal.estimated_cost,
              has_budget: proposal.estimated_cost > 0,
              origin: 'propuesta_lider',
              status: 'PROPUESTA',
            },
          ])
          .select('id')
          .single();

        if (inserted && typeof inserted.id === 'number') {
          setActivities((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, id: inserted.id } : item))
          );
        }
      } catch {
        // Mantiene el estado optimista local si falla la red
      }
    }

    setToastMessage(
      proposal.organization === 'SEMINARIO'
        ? `Propuesta "${proposal.title}" vinculada a Seminario (MJ y HJ).`
        : `Propuesta "${proposal.title}" enviada a la Presidencia de Estaca.`
    );
    setTimeout(() => setToastMessage(null), 4500);
  };

  const progressBarColor =
    financialSummary.usagePercent > 90
      ? 'bg-rose-500'
      : financialSummary.usagePercent > 75
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <div
      data-testid="leader-view"
      className={`min-h-[100dvh] bg-slate-100/80 flex flex-col justify-between ${
        activeTab === 'SUMMARY' ? 'pb-24' : 'pb-2'
      }`}
    >
      {/* ==================== CABECERA INSTITUCIONAL ==================== */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Izquierda: Menú Hamburguesa (móvil) + Estaca + Organización */}
            <div className="flex items-center gap-2.5 min-w-0">
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
              </button>

              <div className="flex flex-col space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-900 text-emerald-50 tracking-wide shadow-sm truncate">
                    Estaca Montevideo Uruguay Este
                  </span>
                </div>
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                  {ORGANIZATION_LABELS[baseOrg]}
                </h1>
              </div>
            </div>

            {/* Derecha: Selector de Año Dinámico (solo Resumen financiero y Calendario) + Usuario Activo (PC) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(activeTab === 'SUMMARY' || activeTab === 'CALENDAR') && (
                <div className="relative inline-flex items-center">
                  <select
                    aria-label="Seleccionar año fiscal"
                    data-testid="year-selector-dropdown"
                    value={activeYear}
                    onChange={(e) => handleYearSelect(Number(e.target.value))}
                    className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 rounded-lg pl-2.5 pr-6 py-1 text-[11px] sm:text-xs font-extrabold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Año {yr}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-1.5" />
                </div>
              )}

              <div
                title={realAuthEmail ? `Conectado como ${realAuthEmail}` : undefined}
                className="hidden md:inline-flex items-center gap-2 bg-slate-100 py-1 px-3 rounded-full border border-slate-200/90 text-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span
                  data-testid="header-user-name"
                  className="font-bold text-slate-800 max-w-[140px] truncate"
                >
                  {user.full_name}
                </span>
              </div>

              {!onBackToHub && (
                <button
                  type="button"
                  data-testid="leader-signout-btn"
                  title={realAuthEmail ? `Salir (${realAuthEmail})` : 'Salir'}
                  onClick={() => signOut()}
                  className="pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Navegación Escritorio (md:flex) */}
          <nav
            aria-label="Navegación principal del líder"
            className="hidden md:flex mt-3 pt-2.5 border-t border-slate-100 items-center gap-2"
          >
            {onBackToHub ? (
              <button
                type="button"
                data-testid="back-to-hub-btn"
                onClick={onBackToHub}
                className="pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition bg-slate-100 text-slate-700 hover:bg-slate-200/80"
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                <span>Panel</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="leader-nav-summary"
                onClick={() => setActiveTab('SUMMARY')}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'SUMMARY'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span>Panel</span>
              </button>
            )}

            <button
              type="button"
              data-testid="leader-nav-calendar"
              onClick={() => setActiveTab('CALENDAR')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'CALENDAR'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>Calendario</span>
            </button>

            <button
              type="button"
              data-testid="leader-nav-directory"
              onClick={() => setActiveTab('DIRECTORY')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'DIRECTORY'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Directorio</span>
            </button>

            <button
              type="button"
              data-testid="leader-nav-suppliers"
              onClick={() => setActiveTab('SUPPLIERS')}
              className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'SUPPLIERS'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Building2 className="w-4 h-4 text-sky-500" />
              <span>Proveedores</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ==================== DRAWER LATERAL MÓVIL (CON BACKDROP BLUR) ==================== */}
      {isMobileDrawerOpen && (
        <div
          data-testid="mobile-nav-drawer-backdrop"
          className="fixed inset-0 z-40 md:hidden bg-slate-950/40 backdrop-blur-sm transition-opacity overscroll-contain"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <aside
            data-testid="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[82vw] h-full overflow-y-auto overscroll-contain bg-white shadow-2xl border-r border-slate-200 p-5 flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Identidad del usuario conectado en el Drawer móvil */}
              <div className="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200/90 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span
                      data-testid="drawer-user-name"
                      className="text-xs font-extrabold text-slate-900 truncate"
                    >
                      {user.full_name}
                    </span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-900 text-white flex-shrink-0">
                    {ORGANIZATION_SHORT_LABELS[baseOrg]}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 truncate pl-5">
                  {user.calling}
                </p>
              </div>

              <div className="pb-2 border-b border-slate-100">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Secciones
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {onBackToHub ? (
                  <button
                    type="button"
                    data-testid="drawer-back-to-hub-btn"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onBackToHub();
                    }}
                    className="pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition bg-slate-100 text-slate-800 hover:bg-slate-200/70"
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Panel</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="drawer-nav-summary"
                    onClick={() => selectTabAndCloseDrawer('SUMMARY')}
                    className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                      activeTab === 'SUMMARY'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Panel</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="drawer-nav-calendar"
                  onClick={() => selectTabAndCloseDrawer('CALENDAR')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'CALENDAR'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Calendario</span>
                </button>

                <button
                  type="button"
                  data-testid="drawer-nav-directory"
                  onClick={() => selectTabAndCloseDrawer('DIRECTORY')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'DIRECTORY'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>Directorio</span>
                </button>

                <button
                  type="button"
                  data-testid="drawer-nav-suppliers"
                  onClick={() => selectTabAndCloseDrawer('SUPPLIERS')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'SUPPLIERS'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span>Proveedores</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-semibold">
              Estaca Montevideo Uruguay Este • {activeYear}
            </div>
          </aside>
        </div>
      )}

      {/* ==================== CONTENIDO MÓVIL DEL LÍDER ==================== */}
      {activeTab === 'CALENDAR' ? (
        <main className="max-w-4xl w-full mx-auto px-4 pt-2 pb-2 flex-1">
          <CalendarView
            selectedYear={activeYear}
            activitiesProp={activities}
            onActivitiesUpdate={setActivities}
            onBack={() => setActiveTab('SUMMARY')}
            onProposeActivity={() => setIsProposeOpen(true)}
            onlyPendingLcr={calendarOnlyPendingLcr}
            onClearPendingLcrFilter={() => setCalendarOnlyPendingLcr(false)}
            embedded
          />
        </main>
      ) : activeTab === 'SUPPLIERS' ? (
        <main className="max-w-4xl w-full mx-auto px-4 pt-2 pb-2 flex-1">
          <SuppliersView
            suppliers={SEED_SUPPLIERS}
            onBack={() => setActiveTab('SUMMARY')}
            embedded
          />
        </main>
      ) : activeTab === 'DIRECTORY' ? (
        <main className="max-w-4xl w-full mx-auto px-4 pt-2 pb-2 flex-1">
          <LeadersDirectoryView />
        </main>
      ) : (
      <main className="max-w-lg w-full mx-auto px-4 pt-4 space-y-4 flex-1">
        {/* Toast / Confirmación de Propuesta */}
        {toastMessage && (
          <div
            data-testid="proposal-toast"
            role="status"
            className="p-3.5 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-lg border border-emerald-700 flex items-center gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Aviso limpio si hay actividades aprobadas de su organización pendientes de cargar en LCR */}
        {myPendingLcrCount > 0 && (
          <button
            type="button"
            data-testid="leader-pending-lcr-banner"
            onClick={() => {
              setCalendarOnlyPendingLcr(true);
              setActiveTab('CALENDAR');
            }}
            className="pressable w-full text-left rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
          >
            <span className="text-xs font-bold text-slate-800">
              {myPendingLcrCount === 1
                ? '1 actividad aprobada pendiente de cargar en LCR'
                : `${myPendingLcrCount} actividades aprobadas pendientes de cargar en LCR`}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        )}

        {/* 1. TARJETA MAESTRA DE PRESUPUESTO (Liviana y sobria, igual que Presidencia) */}
        <section
          aria-label="Saldo libre estimado y presupuesto"
          data-testid="balance-card"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] p-5 sm:p-6 text-white shadow-xl border border-white/10"
        >
          <div className="divide-y divide-white/12">
            {/* Protagonista: Saldo libre estimado */}
            <div className="pb-3.5">
              <p
                data-testid="leader-estimated-free-amount"
                className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums leading-none ${
                  orgReservedMetrics.estimatedFreeBalance < 0
                    ? 'text-rose-300'
                    : 'text-white'
                }`}
              >
                {formatCurrency(orgReservedMetrics.estimatedFreeBalance)}
              </p>
              <p
                data-testid="balance-card-title"
                className={`text-xs sm:text-sm font-medium mt-1.5 ${
                  orgReservedMetrics.estimatedFreeBalance < 0
                    ? 'text-rose-200/90'
                    : 'text-sky-100/75'
                }`}
              >
                Saldo libre estimado
              </p>

              {activeYear === 2027 && financialSummary.totalAssigned === 0 && (
                <p
                  data-testid="leader-pending-budget-2027"
                  className="text-[11px] text-sky-200/90 font-medium mt-1.5"
                >
                  Presupuesto 2027 pendiente de asignación
                </p>
              )}
            </div>

            {/* Disponible actual y Comprometido en actividades */}
            <div className="pt-3 grid grid-cols-2 gap-4 divide-x divide-white/12">
              <div>
                <p
                  data-testid="available-balance-amount"
                  className="text-lg sm:text-xl font-bold tracking-tight tabular-nums text-white leading-tight"
                >
                  {formatCurrency(financialSummary.availableBalance)}
                </p>
                <p className="text-[11px] sm:text-xs font-medium text-sky-100/70 mt-0.5">
                  Disponible actual
                </p>
              </div>

              <div className="pl-4">
                <p
                  data-testid="leader-reserved-amount"
                  className="text-lg sm:text-xl font-bold tracking-tight tabular-nums text-white leading-tight"
                >
                  {formatCurrency(orgReservedMetrics.reservedTotal)}
                </p>
                <p className="text-[11px] sm:text-xs font-medium text-sky-100/70 mt-0.5">
                  Comprometido {orgReservedMetrics.targetQuarter}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Franja discreta de Fondo Seminario (exclusiva para Hombres Jóvenes y Mujeres Jóvenes) */}
        {canUseSeminario && (
          <div
            data-testid="seminario-joint-fund-line"
            className="rounded-2xl bg-white border border-slate-200/90 shadow-sm px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900">Fondo Seminario</p>
              <p className="text-[11px] text-slate-500">Fondo conjunto (aparte de este presupuesto)</p>
            </div>
            <p className="text-sm font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
              {formatCurrency(seminarioAvailable)}
            </p>
          </div>
        )}

        {/* Desplegables financieros en tarjetas blancas limpias */}
        <section className="space-y-2.5" aria-label="Detalle financiero">
          {/* Desglose Trimestral (T1-T4) */}
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
            <button
              type="button"
              data-testid="toggle-quarters-btn"
              onClick={() => setIsQuartersOpen((prev) => !prev)}
              className="pressable w-full px-4 py-3 flex items-center justify-between gap-2 text-xs font-extrabold text-slate-800 hover:bg-slate-50 transition"
            >
              <span>Desglose Trimestral (T1–T4)</span>
              <span className="flex items-center gap-2 shrink-0">
                <span
                  data-testid="leader-spent-line"
                  className="text-[11px] font-medium text-slate-500 tabular-nums"
                >
                  Gastado:{' '}
                  <span data-testid="total-spent-amount" className="font-bold text-slate-700">
                    {formatCurrency(financialSummary.totalSpent)}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ease-out-expo ${
                    isQuartersOpen ? 'rotate-180 text-slate-700' : ''
                  }`}
                />
              </span>
            </button>

            <div className="accordion-content" data-open={isQuartersOpen}>
              <div className="accordion-inner">
                <div className="px-4 pb-3.5 pt-1 border-t border-slate-100">
                  <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-2 px-3">Trim.</th>
                          <th className="py-2 px-3 text-right">Asignado</th>
                          <th className="py-2 px-3 text-right">Gastos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs tabular-nums">
                        {financialSummary.quarters.map((q) => (
                          <tr
                            key={q.quarter}
                            data-testid={`leader-quarter-card-${q.quarter}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="py-2 px-3 font-extrabold text-slate-900">
                              {q.quarter}
                            </td>
                            <td
                              data-testid={`leader-quarter-assigned-${q.quarter}`}
                              className="py-2 px-3 text-right text-[11px] text-slate-700 font-semibold"
                            >
                              {formatCurrency(q.assigned)}
                            </td>
                            <td
                              data-testid={`leader-quarter-spent-${q.quarter}`}
                              className="py-2 px-3 text-right text-[11px] text-slate-700 font-semibold"
                            >
                              {formatCurrency(q.spent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historial Anual de Gastos */}
          <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
            <button
              type="button"
              data-testid="accordion-expenses-trigger"
              aria-expanded={isExpensesOpen}
              onClick={() => setIsExpensesOpen((prev) => !prev)}
              className="pressable w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold text-slate-800 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <span>Historial Anual de Gastos</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                  {financialSummary.orgExpenses.length}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ease-out-expo ${
                  isExpensesOpen ? 'rotate-180 text-slate-700' : ''
                }`}
              />
            </button>

            <div
              data-testid="accordion-expenses-content"
              className="accordion-content"
              data-open={isExpensesOpen}
            >
              <div className="accordion-inner">
                <div className="px-4 pb-3.5 pt-2 border-t border-slate-100">
                  {/* Filtro rápido por trimestre */}
                  <div className="flex items-center justify-between gap-2 pb-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Trimestre:
                    </span>
                    <div className="inline-flex items-center bg-slate-100 rounded-xl border border-slate-200/80 overflow-hidden divide-x divide-slate-200/80">
                      {(['TODOS', 'T1', 'T2', 'T3', 'T4'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          data-testid={`filter-expense-${q}`}
                          onClick={() => setQuarterFilter(q)}
                          className={`pressable px-2.5 py-1 rounded-none text-[11px] font-bold transition ${
                            quarterFilter === q
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                          }`}
                        >
                          {q === 'TODOS' ? 'Todos' : q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredExpenses.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-400">
                      No se registran gastos en este período.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      {filteredExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          data-testid="expense-row"
                          className="p-3 bg-white hover:bg-slate-50/70 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                                {formatDate(getExpenseEffectiveDate(exp))}
                              </span>
                              {exp.external_reimbursement > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                  Multiestaca (Neto)
                                </span>
                              )}
                            </div>

                            <span
                              data-testid="expense-row-quarter"
                              className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 flex-shrink-0"
                            >
                              {getQuarterFromDate(getExpenseEffectiveDate(exp))}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-bold text-slate-900 leading-snug min-w-0 flex-1">
                              {exp.concept}
                            </p>

                            <div className="text-right flex-shrink-0">
                              <p
                                data-testid="expense-row-amount"
                                className="text-xs sm:text-sm font-extrabold text-slate-900 tabular-nums"
                              >
                                {formatCurrency(exp.net_amount)}
                              </p>
                              {exp.external_reimbursement > 0 && (
                                <p className="text-[10px] text-slate-400 tabular-nums">
                                  Factura: {formatCurrency(exp.gross_amount)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. TARJETA DE PRÓXIMA ACTIVIDAD PROGRAMADA + BOTÓN PROPONER */}
        <section
          aria-label="Próxima Actividad Programada"
          data-testid="next-activity-card"
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  Próxima Actividad
                </h2>
                <p className="text-[11px] text-slate-400 truncate">Agenda oficial aprobada</p>
              </div>
            </div>

              <button
                type="button"
                data-testid="open-propose-modal-btn"
                onClick={() => setIsProposeOpen(true)}
                className="pressable inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex flex-col sm:flex-row sm:gap-1 items-start sm:items-center leading-tight text-left">
                  <span>Proponer</span>
                  <span>Actividad</span>
                </span>
              </button>
          </div>

          {nextUpcomingActivity ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {ORGANIZATION_SHORT_LABELS[nextUpcomingActivity.organization]}
                    </span>
                    {nextUpcomingActivity.status === 'PROPUESTA' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                        Pendiente de Aprobación
                      </span>
                    )}
                  </div>
                  <h3
                    data-testid="next-activity-title"
                    className="text-sm font-extrabold text-slate-900 mt-1.5"
                  >
                    {nextUpcomingActivity.title}
                  </h3>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800 tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span data-testid="next-activity-date">
                    {formatDate(nextUpcomingActivity.event_date)}
                  </span>
                </span>
                {nextUpcomingActivity.start_time && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{nextUpcomingActivity.start_time} hs</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{nextUpcomingActivity.location}</span>
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Costo estimado:</span>
                {nextUpcomingActivity.estimated_cost > 0 ? (
                  <span
                    data-testid="next-activity-cost"
                    className="font-extrabold text-emerald-800 tabular-nums bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200"
                  >
                    💰 {formatCurrency(nextUpcomingActivity.estimated_cost)}
                  </span>
                ) : (
                  <span
                    data-testid="next-activity-cost"
                    className="font-medium text-slate-500 italic"
                  >
                    Sin costo presupuestado
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-center text-xs text-slate-500">
              No hay próximas actividades programadas. Usa el botón superior para proponer una nueva actividad.
            </div>
          )}
        </section>
      </main>
      )}

      {/* Modal Nativo <dialog> para Proponer Actividad */}
      <ProposeActivityModal
        isOpen={isProposeOpen}
        onClose={() => setIsProposeOpen(false)}
        userOrg={baseOrg}
        canUseSeminario={canUseSeminario}
        onSubmitProposal={handleCreateProposal}
      />
    </div>
  );
};
