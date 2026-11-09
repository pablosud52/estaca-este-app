import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
  CheckCircle2,
  EyeOff,
  Building2,
  ArrowLeft,
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

interface LeaderViewProps {
  /** Si Presidencia o Admin inspecciona una organización en modo espejo */
  inspectedOrg?: OrganizationCode;
  onBackToHub?: () => void;
}

export const LeaderView: React.FC<LeaderViewProps> = ({ inspectedOrg, onBackToHub }) => {
  const { user } = useAuth();

  // Organización base del líder o la organización inspeccionada por Presidencia/Admin
  const baseOrg: OrganizationCode = useMemo(() => {
    if (inspectedOrg) return inspectedOrg;
    if (user.organization === 'TODAS') return 'MJ';
    return user.organization;
  }, [inspectedOrg, user.organization]);

  // Regla Especial de Seminario (ADR-003): Líderes de MJ y HJ disponen del checkbox "Seminario"
  const canUseSeminario = baseOrg === 'MJ' || baseOrg === 'HJ';
  const [includeSeminario, setIncludeSeminario] = useState<boolean>(false);

  // Resetear toggle de Seminario cuando cambia la organización base
  useEffect(() => {
    setIncludeSeminario(false);
  }, [baseOrg]);

  const [budgets, setBudgets] = useState<BudgetAllocation[]>(SEED_BUDGET_ALLOCATIONS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [activities, setActivities] = useState<ActivityRecord[]>(SEED_ACTIVITIES);

  // Estado de secciones colapsables (desplegables) — cerradas por defecto para mantener pantalla limpia
  const [isExpensesOpen, setIsExpensesOpen] = useState<boolean>(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isQuartersOpen, setIsQuartersOpen] = useState<boolean>(false);

  // Filtros internos de acordeones
  const [quarterFilter, setQuarterFilter] = useState<'TODOS' | QuarterCode>('TODOS');
  const [calendarScope, setCalendarScope] = useState<'ORG' | 'ESTACA_ALL'>('ORG');

  // Modal de propuesta de actividad y banner de confirmación
  const [isProposeOpen, setIsProposeOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sincronización con Supabase en tiempo real con fallback resiliente a SEED
  useEffect(() => {
    let active = true;

    async function fetchSupabaseData() {
      try {
        const [budgetRes, expenseRes, activityRes] = await Promise.all([
          supabase.from('budget_allocations').select('*').eq('year', 2026),
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
          })) as ActivityRecord[];

          const existingTitles = new Set(remoteActivities.map((a) => a.title));
          const mergedActivities = [
            ...remoteActivities,
            ...SEED_ACTIVITIES.filter((s) => !existingTitles.has(s.title)),
          ];

          setActivities((prev) => {
            const localProposals = prev.filter(
              (p) => !mergedActivities.some((m) => m.title === p.title && m.event_date === p.event_date)
            );
            return [...mergedActivities, ...localProposals].sort((a, b) =>
              a.event_date.localeCompare(b.event_date)
            );
          });
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

  // Organizaciones activas según el checkbox de Seminario
  const activeOrgs: OrganizationCode[] = useMemo(() => {
    if (canUseSeminario && includeSeminario) {
      return [baseOrg, 'SEMINARIO'];
    }
    return [baseOrg];
  }, [baseOrg, canUseSeminario, includeSeminario]);

  // Cálculo Financiero de la Organización (ADR-007: excluye reembolsables OAI; ADR-013: usa net_amount)
  const financialSummary = useMemo(() => {
    const matchingBudgets = budgets.filter((b) => activeOrgs.includes(b.organization));
    const matchingExpenses = expenses.filter(
      (e) => activeOrgs.includes(e.organization) && !e.is_reimbursable_oai
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
  }, [budgets, expenses, activeOrgs]);

  // Gastos filtrados por trimestre en el acordeón
  const filteredExpenses = useMemo(() => {
    if (quarterFilter === 'TODOS') return financialSummary.orgExpenses;
    return financialSummary.orgExpenses.filter(
      (exp) => getQuarterFromDate(exp.expense_date) === quarterFilter
    );
  }, [financialSummary.orgExpenses, quarterFilter]);

  // Actividades visibles para la organización (incluye Seminario automáticamente si es MJ o HJ según PROJECT_CONTEXT §4.1)
  const orgRelevantOrgs: OrganizationCode[] = useMemo(() => {
    if (canUseSeminario) {
      return [baseOrg, 'SEMINARIO'];
    }
    return [baseOrg];
  }, [baseOrg, canUseSeminario]);

  // Próxima Actividad Programada de la Organización
  const nextUpcomingActivity = useMemo(() => {
    const orgActs = activities
      .filter(
        (a) =>
          orgRelevantOrgs.includes(a.organization) &&
          a.status !== 'RECHAZADA' &&
          a.status !== 'CANCELADA'
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    // Buscar desde noviembre 2026 en adelante o la primera disponible
    return orgActs.find((a) => a.event_date >= '2026-11-01') || orgActs[0] || null;
  }, [activities, orgRelevantOrgs]);

  // Lista de actividades en el acordeón de Calendario Anual
  const displayedCalendarActivities = useMemo(() => {
    const baseList = activities.filter((a) => a.status !== 'CANCELADA');
    if (calendarScope === 'ORG') {
      return baseList.filter((a) => orgRelevantOrgs.includes(a.organization));
    }
    return baseList;
  }, [activities, calendarScope, orgRelevantOrgs]);

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
      title: proposal.title,
      event_date: proposal.event_date,
      start_time: proposal.start_time,
      location: proposal.location,
      organization: proposal.organization,
      estimated_cost: proposal.estimated_cost,
      has_budget: proposal.estimated_cost > 0,
      status: 'PROPUESTA',
    };

    // Actualización optimista inmediata con deduplicación por título y fecha
    setActivities((prev) => {
      const withoutDup = prev.filter(
        (item) => !(item.title === newRecord.title && item.event_date === newRecord.event_date)
      );
      return [...withoutDup, newRecord].sort((a, b) => a.event_date.localeCompare(b.event_date));
    });

    // Intento de persistencia en Supabase
    try {
      await supabase.from('activities').insert([
        {
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
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex flex-col space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              {onBackToHub && (
                <button
                  type="button"
                  data-testid="back-to-hub-btn"
                  onClick={onBackToHub}
                  className="pressable inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Hub</span>
                </button>
              )}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-900 text-emerald-50 tracking-wide shadow-sm truncate">
                Estaca Montevideo Uruguay Este
              </span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                {ORGANIZATION_LABELS[baseOrg]}
              </h1>
              {includeSeminario && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  + Seminario
                </span>
              )}
            </div>
          </div>

          {/* Usuario Activo Badge */}
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-100 py-1 px-2.5 rounded-full border border-slate-200/90 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span
                data-testid="header-user-name"
                className="font-bold text-slate-800 max-w-[115px] truncate"
              >
                {user.full_name}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5 pr-1">
              Año Fiscal 2026
            </span>
          </div>
        </div>

        {/* Regla Especial de Seminario: Checkbox en barra superior para MJ y HJ (PROJECT_CONTEXT.md §4.1) */}
        {canUseSeminario && (
          <div className="bg-emerald-950/5 border-t border-emerald-900/10 px-4 py-2">
            <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                <span className="font-semibold">Fondo común juventud:</span>
              </div>

              <label
                htmlFor="header-seminario-toggle"
                data-testid="header-seminario-toggle-label"
                className={`pressable inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold cursor-pointer border whitespace-nowrap transition ${
                  includeSeminario
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  id="header-seminario-toggle"
                  data-testid="header-seminario-checkbox"
                  type="checkbox"
                  checked={includeSeminario}
                  onChange={(e) => setIncludeSeminario(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-700 focus:ring-0"
                />
                <span className="tabular-nums">Seminario ($ 10.000,00)</span>
              </label>
            </div>
          </div>
        )}
      </header>

      {/* ==================== CONTENIDO MÓVIL DEL LÍDER ==================== */}
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

        {/* 1. TARJETA DE SALDO ACTUAL (Estilo Billetera Digital) */}
        <section
          aria-label="Saldo Disponible Actual"
          data-testid="balance-card"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 sm:p-6 text-white shadow-xl border border-slate-800"
        >
          {/* Sutil halo decorativo */}
          <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Wallet className="w-4 h-4" />
                </div>
                <span
                  data-testid="balance-card-title"
                  className="text-xs font-extrabold uppercase tracking-wider text-slate-300"
                >
                  SALDO ACTUAL • {ORGANIZATION_SHORT_LABELS[baseOrg]}
                  {includeSeminario ? ' + SEM' : ''}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-emerald-300 border border-slate-700">
                2026
              </span>
            </div>

            {/* Monto Principal en formato oficial $ #.##0,00 */}
            <div className="mt-3 flex items-baseline gap-2">
              <p
                data-testid="available-balance-amount"
                className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-white"
              >
                {formatCurrency(financialSummary.availableBalance)}
              </p>
            </div>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Disponible para utilizar
            </p>

            {/* Sub-tarjetas Anual Asignado vs Gastos Realizados */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3">
                <p className="text-[11px] text-slate-300 font-medium">Anual Asignado</p>
                <p
                  data-testid="total-assigned-amount"
                  className="text-sm sm:text-base font-extrabold text-white tabular-nums mt-0.5"
                >
                  {formatCurrency(financialSummary.totalAssigned)}
                </p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3">
                <p className="text-[11px] text-slate-300 font-medium">Gastos Realizados</p>
                <p
                  data-testid="total-spent-amount"
                  className="text-sm sm:text-base font-extrabold text-amber-300 tabular-nums mt-0.5"
                >
                  {formatCurrency(financialSummary.totalSpent)}
                </p>
              </div>
            </div>

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
                  <span>Desglose Trimestral Acumulativo (T1–T4)</span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ease-out-expo ${
                    isQuartersOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div className="accordion-content" data-open={isQuartersOpen}>
                <div className="accordion-inner">
                  <div className="grid grid-cols-2 gap-2 pt-2.5">
                    {financialSummary.quarters.map((q) => (
                      <div
                        key={q.quarter}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-emerald-400">{q.quarter}</span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            Asig: {formatCurrency(q.assigned)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white tabular-nums mt-1">
                          Disp: {formatCurrency(q.remaining)}
                        </p>
                        <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                          Gastado: {formatCurrency(q.spent)}
                        </p>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-2.5">
                    {displayedCalendarActivities.map((act) => {
                      const canSeeCost = canViewActivityBudget(
                        user.role,
                        baseOrg,
                        act.organization
                      );

                      return (
                        <div
                          key={act.id}
                          data-testid={`calendar-activity-${act.organization}`}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-800">
                                  <Building2 className="w-3 h-3" />
                                  {ORGANIZATION_SHORT_LABELS[act.organization]}
                                </span>

                                {act.status === 'PROPUESTA' ? (
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

                              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1.5">
                                {act.title}
                              </h3>
                            </div>

                            {/* Monto visible solo si tiene permiso (Regla Sagrada #9) */}
                            {canSeeCost && act.estimated_cost > 0 && (
                              <span
                                data-testid="confidential-budget-amount"
                                className="text-xs font-extrabold text-emerald-900 tabular-nums bg-emerald-100/80 px-2.5 py-1 rounded-xl border border-emerald-200 flex-shrink-0"
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
