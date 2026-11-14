import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
  CheckCircle2,
  EyeOff,
  Building2,
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_ACTIVITIES, SEED_BUDGET_ALLOCATIONS, SEED_EXPENSES } from '../data/seedData';
import {
  canViewActivityBudget,
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
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
  QuarterSummary,
} from '../types/database';
import { ProposeActivityModal } from '../components/ProposeActivityModal';
import { LcrSyncButton } from '../components/LcrSyncButton';
import { syncLcrCalendarWithShield } from '../services/lcrSyncService';
import { CalendarView } from './CalendarView';
import { SuppliersView } from './SuppliersView';
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
  const { user, isSimulating } = useAuth();
  const [internalYear, setInternalYear] = useState<number>(2026);
  const activeYear = selectedYear ?? internalYear;

  const availableYears = useMemo(
    () => (user.role === 'LIDER' ? [2026, 2027] : [2025, 2026, 2027]),
    [user.role]
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
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isQuartersOpen, setIsQuartersOpen] = useState<boolean>(false);

  // Referencias para auto-enfoque suave del Calendario Anual en la próxima actividad futura
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const nextUpcomingActivityRef = useRef<HTMLDivElement | null>(null);

  // Filtros internos de acordeones
  const [quarterFilter, setQuarterFilter] = useState<'TODOS' | QuarterCode>('TODOS');
  const [calendarScope, setCalendarScope] = useState<'ORG' | 'ESTACA_ALL'>('ORG');

  // Navegación principal (Resumen, Calendario General, Proveedores) y Drawer móvil
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'CALENDAR' | 'SUPPLIERS'>('SUMMARY');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isProposeOpen, setIsProposeOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectTabAndCloseDrawer = (tab: 'SUMMARY' | 'CALENDAR' | 'SUPPLIERS') => {
    setActiveTab(tab);
    setIsMobileDrawerOpen(false);
  };

  const handleManualCalendarSync = async () => {
    const syncRes = await syncLcrCalendarWithShield({
      currentActivities: activities,
      attemptLiveFetch: true,
    });
    setActivities(syncRes.activities);
  };

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
          !e.is_reimbursable_oai &&
          e.expense_date.startsWith(String(activeYear))
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
        !e.is_reimbursable_oai &&
        e.expense_date.startsWith(String(activeYear))
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
      const q = getQuarterFromDate(exp.expense_date);
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
      orgExpenses: matchingExpenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    };
  }, [budgets, expenses, baseOrg, activeYear]);

  // Gastos filtrados por trimestre en el acordeón
  const filteredExpenses = useMemo(() => {
    if (quarterFilter === 'TODOS') return financialSummary.orgExpenses;
    return financialSummary.orgExpenses.filter(
      (exp) => getQuarterFromDate(exp.expense_date) === quarterFilter
    );
  }, [financialSummary.orgExpenses, quarterFilter]);

  // Fecha de referencia actual para separar actividades pasadas (realizadas) de las próximas futuras
  const referenceToday = '2026-11-08';

  // Determina si una actividad corresponde a la agenda propia de la organización (incluyendo Seminario y actividades conjuntas HJ/MJ)
  const isOwnOrgOrYouthJointActivity = (act: ActivityRecord): boolean => {
    if (act.organization === baseOrg) return true;
    if (canUseSeminario) {
      if (act.organization === 'SEMINARIO') return true;
      const upperTitle = act.title.toUpperCase();
      if (
        (act.organization === 'HJ' || act.organization === 'MJ') &&
        (upperTitle.includes('HJ Y MJ') ||
          upperTitle.includes('HHJJ Y MMJJ') ||
          upperTitle.includes('CONECTADOS CON PROPOSITO') ||
          upperTitle.includes('CONECTADOS CON PROPÓSITO'))
      ) {
        return true;
      }
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

  // Lista completa de actividades del año en el acordeón de Calendario Anual:
  // En vista 'ORG' incluye TODAS las actividades del año de la organización + las generales de Estaca a las que asisten.
  // En vista 'ESTACA_ALL' incluye todas las organizaciones de la Estaca (con confidencialidad de presupuestos).
  const displayedCalendarActivities = useMemo(() => {
    const baseList = activities
      .filter(
        (a) =>
          a.status !== 'CANCELADA' &&
          a.status !== 'RECHAZADA' &&
          a.event_date.startsWith(String(activeYear))
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    if (calendarScope === 'ORG') {
      return baseList.filter(
        (a) => isOwnOrgOrYouthJointActivity(a) || a.organization === 'ESTACA'
      );
    }
    return baseList;
  }, [activities, calendarScope, baseOrg, canUseSeminario, activeYear]);

  // ID de la primera actividad futura (o del día actual) para el auto-enfoque suave en el calendario
  const firstUpcomingActivityId = useMemo(() => {
    const found = displayedCalendarActivities.find((a) => a.event_date >= referenceToday);
    return found ? found.id : null;
  }, [displayedCalendarActivities]);

  // Auto-scroll suave al abrir el calendario o cambiar filtro para posicionar la vista en la próxima actividad futura
  useEffect(() => {
    if (!isCalendarOpen) return;
    const timer = setTimeout(() => {
      const container = calendarScrollRef.current;
      const target = nextUpcomingActivityRef.current;
      if (container && target) {
        // Posiciona dejando ~85px hacia arriba para que se vea la actividad pasada inmediatamente anterior con su estado "Realizada"
        const targetOffset = Math.max(0, target.offsetTop - 85);
        container.scrollTo({
          top: targetOffset,
          behavior: 'smooth',
        });
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [isCalendarOpen, calendarScope, baseOrg, activeYear, firstUpcomingActivityId]);

  const handleCreateProposal = async (proposal: {
    title: string;
    event_date: string;
    start_time: string;
    location: string;
    organization: OrganizationCode;
    estimated_cost: number;
  }) => {
    const newRecord: ActivityRecord = {
      id: Date.now(),
      ical_uid: `PROPUESTA_LIDER-${Date.now()}`,
      title: proposal.title,
      event_date: proposal.event_date,
      start_time: proposal.start_time,
      location: proposal.location,
      organization: proposal.organization,
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
        await supabase.from('activities').insert([
          {
            ical_uid: newRecord.ical_uid,
            title: proposal.title,
            event_date: proposal.event_date,
            start_time: proposal.start_time,
            location: proposal.location,
            organization: proposal.organization,
            estimated_cost: proposal.estimated_cost,
            has_budget: proposal.estimated_cost > 0,
            status: 'PROPUESTA',
          },
        ]);
      } catch {
        // Mantiene el estado optimista local si falla la red
      }
    }

    setIsCalendarOpen(true);
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
      className="min-h-[100dvh] bg-slate-100/80 flex flex-col justify-between pb-24"
    >
      {/* ==================== CABECERA INSTITUCIONAL ==================== */}
      <header
        className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Izquierda: Menú Hamburguesa (móvil) + Botón Panel (espejo) + Organización */}
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
                  {onBackToHub && (
                    <button
                      type="button"
                      data-testid="back-to-hub-btn"
                      onClick={onBackToHub}
                      className="pressable inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex-shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Panel</span>
                    </button>
                  )}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-900 text-emerald-50 tracking-wide shadow-sm truncate">
                    Estaca Montevideo Uruguay Este
                  </span>
                </div>
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                  {ORGANIZATION_LABELS[baseOrg]}
                </h1>
              </div>
            </div>

            {/* Derecha: Selector de Año Dinámico + Usuario Activo (PC) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeTab !== 'SUPPLIERS' && (
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

              <div className="hidden md:inline-flex items-center gap-2 bg-slate-100 py-1 px-3 rounded-full border border-slate-200/90 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span
                  data-testid="header-user-name"
                  className="font-bold text-slate-800 max-w-[140px] truncate"
                >
                  {user.full_name}
                </span>
              </div>
            </div>
          </div>

          {/* Barra de Navegación Escritorio (md:flex) */}
          <nav
            aria-label="Navegación principal del líder"
            className="hidden md:flex mt-3 pt-2.5 border-t border-slate-100 items-center gap-2"
          >
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
              <span>Mi Organización</span>
            </button>

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
          className="fixed inset-0 z-40 md:hidden bg-slate-950/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <aside
            data-testid="mobile-nav-drawer"
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[82vw] h-full bg-white shadow-2xl border-r border-slate-200 p-5 flex flex-col justify-between"
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
                  <span>Mi Organización</span>
                </button>

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
                  data-testid="drawer-nav-suppliers"
                  onClick={() => selectTabAndCloseDrawer('SUPPLIERS')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'SUPPLIERS'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <span>Directorio de Proveedores</span>
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
        <main className="max-w-4xl w-full mx-auto px-4 pt-4 pb-12 flex-1">
          <CalendarView
            selectedYear={activeYear}
            activitiesProp={activities}
            onActivitiesUpdate={setActivities}
            onBack={() => setActiveTab('SUMMARY')}
            embedded
          />
        </main>
      ) : activeTab === 'SUPPLIERS' ? (
        <main className="max-w-4xl w-full mx-auto px-4 pt-4 pb-12 flex-1">
          <SuppliersView
            suppliers={SEED_SUPPLIERS}
            onBack={() => setActiveTab('SUMMARY')}
            embedded
          />
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

        {/* 1. TARJETA MAESTRA "PRESUPUESTO DISPONIBLE" (Unificada con Presidencia) */}
        <section
          aria-label="Presupuesto Disponible"
          data-testid="balance-card"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 sm:p-6 text-white shadow-xl border border-slate-800"
        >
          {/* Sutil halo decorativo */}
          <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <span
                data-testid="balance-card-title"
                className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-emerald-300"
              >
                PRESUPUESTO DISPONIBLE
              </span>
              <div className="w-8 h-8 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Wallet className="w-4 h-4" />
              </div>
            </div>

            {/* Monto Principal en formato oficial $ #.##0,00 */}
            <p
              data-testid="available-balance-amount"
              className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-white mt-3"
            >
              {formatCurrency(financialSummary.availableBalance)}
            </p>

            {/* Línea sobria y legible debajo del saldo: "Gastos realizados: $ ..." */}
            <p
              data-testid="leader-spent-line"
              className="text-xs sm:text-sm text-slate-300 font-semibold mt-1.5 tabular-nums"
            >
              Gastos realizados:{' '}
              <span data-testid="total-spent-amount" className="text-white font-bold">
                {formatCurrency(financialSummary.totalSpent)}
              </span>
            </p>

            {activeYear === 2027 && financialSummary.totalAssigned === 0 && (
              <p
                data-testid="leader-pending-budget-2027"
                className="text-[11px] text-amber-300/95 font-semibold mt-1.5"
              >
                Presupuesto 2027 pendiente de asignación
              </p>
            )}

            {/* Barra de Progreso Visual */}
            <div className="mt-4 pt-3 border-t border-slate-800/90">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                <span>Uso del presupuesto</span>
                <span data-testid="budget-usage-percent" className="tabular-nums font-bold text-white">
                  {financialSummary.usagePercent}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/70">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out-expo ${progressBarColor}`}
                  style={{ width: `${financialSummary.usagePercent}%` }}
                />
              </div>
            </div>

            {/* Toggle para ver desglose acumulativo por trimestre (T1-T4) */}
            <div className="mt-3">
              <button
                type="button"
                data-testid="toggle-quarters-btn"
                onClick={() => setIsQuartersOpen((prev) => !prev)}
                className="pressable w-full py-1.5 px-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between text-[11px] font-semibold text-slate-300"
              >
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Desglose Trimestral (T1–T4)</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ease-out-expo ${
                    isQuartersOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div className="accordion-content" data-open={isQuartersOpen}>
                <div className="accordion-inner">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5">
                    {financialSummary.quarters.map((q) => (
                      <div
                        key={q.quarter}
                        data-testid={`leader-quarter-card-${q.quarter}`}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="font-extrabold text-emerald-400">{q.quarter}</span>
                        <span
                          data-testid={`leader-quarter-summary-${q.quarter}`}
                          className="text-[11px] text-slate-200 font-semibold tabular-nums"
                        >
                          Asignado: {formatCurrency(q.assigned)} | Gastos:{' '}
                          {formatCurrency(q.spent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Línea discreta al pie de la tarjeta exclusiva para Hombres Jóvenes y Mujeres Jóvenes */}
            {canUseSeminario && (
              <div
                data-testid="seminario-joint-fund-line"
                className="mt-3.5 pt-3 border-t border-slate-800/90 text-[11px] sm:text-xs text-emerald-200/95 font-medium tabular-nums"
              >
                🏛️ Fondo Seminario: {formatCurrency(seminarioAvailable)} (Fondo conjunto, no
                incluido en este presupuesto)
              </div>
            )}
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
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Próxima Actividad
                </h2>
                <p className="text-[11px] text-slate-400 truncate">Agenda oficial aprobada</p>
              </div>
            </div>

              <button
                type="button"
                data-testid="open-propose-modal-btn"
                onClick={() => setIsProposeOpen(true)}
                className="pressable inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Proponer Actividad</span>
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

        {/* 3. HISTORIAL ANUAL DE GASTOS (ACORDEÓN COLAPSABLE) */}
        <section
          aria-label="Historial Anual de Gastos"
          className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
        >
          <button
            type="button"
            data-testid="accordion-expenses-trigger"
            aria-expanded={isExpensesOpen}
            onClick={() => setIsExpensesOpen((prev) => !prev)}
            className="pressable w-full p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Historial Anual de Gastos
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                    {financialSummary.orgExpenses.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toca para {isExpensesOpen ? 'ocultar' : 'desplegar'} comprobantes y deducciones
                </p>
              </div>
            </div>

            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ease-out-expo ${
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
              <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                {/* Filtro rápido por trimestre */}
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Trimestre:
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                    {(['TODOS', 'T1', 'T2', 'T3', 'T4'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        data-testid={`filter-expense-${q}`}
                        onClick={() => setQuarterFilter(q)}
                        className={`pressable px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          quarterFilter === q
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {q === 'TODOS' ? 'Todos' : q}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredExpenses.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No se registran gastos en este período.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden">
                    {filteredExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        data-testid="expense-row"
                        className="p-3.5 bg-white hover:bg-slate-50/70 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                              {formatDate(exp.expense_date)}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {getQuarterFromDate(exp.expense_date)}
                            </span>
                            {exp.external_reimbursement > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                Multiestaca (Neto)
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                            {exp.concept}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {exp.supplier_name}
                          </p>
                        </div>

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
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4. CALENDARIO ANUAL DE ACTIVIDADES (ACORDEÓN COLAPSABLE CON REGLA DE CONFIDENCIALIDAD #9) */}
        <section
          aria-label="Calendario Anual de Actividades"
          className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
        >
          <button
            type="button"
            data-testid="accordion-calendar-trigger"
            aria-expanded={isCalendarOpen}
            onClick={() => setIsCalendarOpen((prev) => !prev)}
            className="pressable w-full p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Calendario Anual de Actividades
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                    {displayedCalendarActivities.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Agenda de tu organización y eventos generales de Estaca
                </p>
              </div>
            </div>

            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ease-out-expo ${
                isCalendarOpen ? 'rotate-180 text-slate-700' : ''
              }`}
            />
          </button>

          <div
            data-testid="accordion-calendar-content"
            className="accordion-content"
            data-open={isCalendarOpen}
          >
            <div className="accordion-inner">
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-3">
                {/* Barra de Sincronización con LCR */}
                <div className="flex items-center justify-end pt-2">
                  <LcrSyncButton onSync={handleManualCalendarSync} />
                </div>

                {/* Selector Mi Organización vs Toda la Estaca (para verificar Regla Sagrada #9) */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full">
                    <button
                      type="button"
                      data-testid="calendar-scope-org"
                      onClick={() => setCalendarScope('ORG')}
                      className={`pressable flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                        calendarScope === 'ORG'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Mi Organización ({ORGANIZATION_SHORT_LABELS[baseOrg]}
                      {canUseSeminario ? ' + Sem' : ''})
                    </button>
                    <button
                      type="button"
                      data-testid="calendar-scope-all"
                      onClick={() => setCalendarScope('ESTACA_ALL')}
                      className={`pressable flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                        calendarScope === 'ESTACA_ALL'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Agenda General Estaca
                    </button>
                  </div>
                </div>

                {calendarScope === 'ESTACA_ALL' && user.role === 'LIDER' && (
                  <div
                    data-testid="confidentiality-notice"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>
                      Por confidencialidad, los importes presupuestados de otras organizaciones permanecen ocultos.
                    </span>
                  </div>
                )}

                {displayedCalendarActivities.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No hay actividades registradas en esta vista.
                  </div>
                ) : (
                  <div
                    ref={calendarScrollRef}
                    data-testid="calendar-scroll-container"
                    className="relative max-h-96 overflow-y-auto scroll-smooth pr-1 space-y-2.5"
                  >
                    {displayedCalendarActivities.map((act) => {
                      const isPast = act.event_date < referenceToday;
                      const isFirstUpcoming = act.id === firstUpcomingActivityId;
                      const canSeeCost = canViewActivityBudget(
                        user.role,
                        baseOrg,
                        act.organization
                      );

                      return (
                        <div
                          key={act.id}
                          ref={isFirstUpcoming ? nextUpcomingActivityRef : null}
                          data-testid={`calendar-activity-${act.organization}`}
                          data-past={isPast ? 'true' : 'false'}
                          data-upcoming-anchor={isFirstUpcoming ? 'true' : 'false'}
                          className={`p-3.5 rounded-2xl border transition ${
                            isPast
                              ? 'border-slate-200/60 bg-slate-100/60 opacity-65'
                              : isFirstUpcoming
                              ? 'border-emerald-400/90 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-sm'
                              : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-800">
                                  <Building2 className="w-3 h-3" />
                                  {ORGANIZATION_SHORT_LABELS[act.organization]}
                                </span>

                                {isPast ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                                    Realizada
                                  </span>
                                ) : isFirstUpcoming ? (
                                  <span
                                    data-testid="calendar-next-upcoming-badge"
                                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-700 text-white"
                                  >
                                    Próxima actividad
                                  </span>
                                ) : act.status === 'PROPUESTA' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                    Propuesta Enviada
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                    Aprobada
                                  </span>
                                )}

                                {/* Regla Sagrada #9: Distintivo 💰 Con Presupuesto estrictamente confidencial */}
                                {canSeeCost && (act.has_budget || act.estimated_cost > 0) && (
                                  <span
                                    data-testid="confidential-budget-badge"
                                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-900 text-emerald-100"
                                  >
                                    💰 Con Presupuesto
                                  </span>
                                )}
                              </div>

                              <h3
                                className={`text-xs sm:text-sm font-extrabold mt-1.5 ${
                                  isPast ? 'text-slate-600' : 'text-slate-900'
                                }`}
                              >
                                {act.title}
                              </h3>
                            </div>

                            {/* Monto visible solo si tiene permiso (Regla Sagrada #9) */}
                            {canSeeCost && act.estimated_cost > 0 && (
                              <span
                                data-testid="confidential-budget-amount"
                                className={`text-xs font-extrabold tabular-nums px-2.5 py-1 rounded-xl border flex-shrink-0 ${
                                  isPast
                                    ? 'text-slate-600 bg-slate-200/70 border-slate-300'
                                    : 'text-emerald-900 bg-emerald-100/80 border-emerald-200'
                                }`}
                              >
                                {formatCurrency(act.estimated_cost)}
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                            <span className="font-bold text-slate-700 tabular-nums">
                              {formatDate(act.event_date)}
                            </span>
                            {act.start_time && (
                              <span className="tabular-nums">{act.start_time} hs</span>
                            )}
                            <span className="text-slate-500">{act.location}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
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
