import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  FileEdit,
  History,
  LayoutDashboard,
  LogOut,
  Shield,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  canApproveCalendar,
  canEditFinances,
  canManageUsers,
  canViewLogs,
} from '../lib/permissions';
import { AuditLogsPanel } from '../components/AuditLogsPanel';
import { recordAuditLog } from '../services/auditLogService';
import {
  INITIAL_OPENING_BALANCE_2026,
  isSuperAdminEmail,
  SEED_ACTIVITIES,
  SEED_BUDGET_ALLOCATIONS,
  SEED_BUDGET_INCOMES,
  SEED_CASH_WITHDRAWALS,
  SEED_EXPENSES,
  SEED_SUPPLIERS,
} from '../data/seedData';
import {
  formatCurrency,
  formatDate,
  getExpenseEffectiveDate,
  getExpenseWithdrawalAllocations,
  getQuarterFromDate,
  isExpenseApplied,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import { supabase } from '../lib/supabase';
import {
  ActivityRecord,
  BudgetAllocation,
  BudgetIncomeEntry,
  CashWithdrawalRecord,
  ExpenseRecord,
  OrganizationCode,
  QuarterCode,
  QuarterSummary,
  SupplierRecord,
} from '../types/database';
import { OrgDistributionChart, OrgSummaryStat } from '../components/OrgDistributionChart';
import { ProposeActivityModal } from '../components/ProposeActivityModal';
import { ActivityEditPayload } from '../components/ActivityEditModal';
import {
  findMatchingLcrEvent,
  isLcrLinkedActivity,
  mergeLocalWithLcrActivity,
} from '../lib/calendarHelpers';
import {
  isActivityPendingLcr,
  syncLcrCalendarWithShield,
} from '../services/lcrSyncService';
import { AdminOperationsCenter } from '../components/AdminOperationsCenter';
import { FinancialInfoSection } from '../components/FinancialInfoSection';
import { computeYearIncomeSummary } from '../lib/budgetUtils';
import { CalendarManageFilter, CalendarView } from './CalendarView';
import { SuppliersView } from './SuppliersView';
import { LeaderView } from './LeaderView';
import { LeadersDirectoryView } from './LeadersDirectoryView';

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
  CHURCHWIDE: 'ABRIR CHURCHWIDE EVENTS',
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
  const { user, isSimulating, incompleteContactsCount, signOut, realAuthEmail } = useAuth();
  const userIsSuperAdmin = Boolean(user.email && isSuperAdminEmail(user.email));

  // Sub-vista activa: DASHBOARD | CALENDAR | SUPPLIERS | DIRECTORY | OPERATIONS | LOGS | INFO
  const [activeTab, setActiveTab] = useState<
    | 'DASHBOARD'
    | 'CALENDAR'
    | 'SUPPLIERS'
    | 'DIRECTORY'
    | 'OPERATIONS'
    | 'LOGS'
    | 'INFO'
  >('DASHBOARD');
  const [openUsersWithIncompleteFilter, setOpenUsersWithIncompleteFilter] = useState<boolean>(false);
  const [calendarOnlyPendingLcr, setCalendarOnlyPendingLcr] = useState<boolean>(false);
  const [calendarInitialManageMode, setCalendarInitialManageMode] = useState<boolean>(false);
  const [calendarInitialFilter, setCalendarInitialFilter] = useState<CalendarManageFilter>('ALL');
  // Menú Drawer móvil (hamburguesa ☰ -> cruz ✕)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  // Menú desplegable Administración en escritorio
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState<boolean>(false);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(e.target as Node)) {
        setIsAdminMenuOpen(false);
      }
    };
    if (isAdminMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAdminMenuOpen]);

  // Año fiscal seleccionado: Presidencia y Admin ven año anterior, actual y siguiente; Líderes actual y siguiente
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const availableYears = useMemo(
    () =>
      user.role === 'LIDER'
        ? [currentYear, currentYear + 1]
        : [currentYear - 1, currentYear, currentYear + 1],
    [user.role, currentYear]
  );

  // Si el usuario entra a inspeccionar una organización en Modo Espejo
  const [inspectedOrg, setInspectedOrg] = useState<OrganizationCode | null>(null);

  // Acordeón móvil para "Resumen por trimestre" (cerrado por defecto en móvil)
  const [isQuarterSummaryOpen, setIsQuarterSummaryOpen] = useState<boolean>(false);

  // Modal interactivo de gastos por trimestre (T1 | T2 | T3 | T4 | null)
  const [selectedQuarterModal, setSelectedQuarterModal] = useState<QuarterCode | null>(null);

  // Acordeones móviles individuales para "Estado por Organización" (contraídos por defecto en móvil)
  const [expandedOrgs, setExpandedOrgs] = useState<Partial<Record<OrganizationCode, boolean>>>({});

  const toggleOrgAccordion = (org: OrganizationCode) => {
    setExpandedOrgs((prev) => ({
      ...prev,
      [org]: !prev[org],
    }));
  };

  const [budgets, setBudgets] = useState<BudgetAllocation[]>(SEED_BUDGET_ALLOCATIONS);
  const [budgetIncomes, setBudgetIncomes] = useState<BudgetIncomeEntry[]>(SEED_BUDGET_INCOMES);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(SEED_EXPENSES);
  const [activities, setActivities] = useState<ActivityRecord[]>(() => [
    ...SEED_ACTIVITIES,
    ...loadSessionProposals(),
  ]);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [withdrawals, setWithdrawals] = useState<CashWithdrawalRecord[]>(SEED_CASH_WITHDRAWALS);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(SEED_SUPPLIERS);
  const [savedSupplierCategories, setSavedSupplierCategories] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'supplier_categories')
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.value) return;
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed)) {
            setSavedSupplierCategories(parsed.filter((item): item is string => typeof item === 'string'));
          }
        } catch {
          // Ignorar formato inválido
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Sincronización en tiempo real con Supabase con fallback a SEED_DATA auditado
  useEffect(() => {
    let active = true;

    async function fetchExecutiveData() {
      try {
        const [budgetRes, incomeRes, expenseRes, activityRes, withdrawalRes, supplierRes] =
          await Promise.all([
            supabase.from('budget_allocations').select('*'),
            supabase.from('budget_incomes').select('*').order('id', { ascending: true }),
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

        if (!incomeRes.error && incomeRes.data && incomeRes.data.length > 0) {
          setBudgetIncomes(
            incomeRes.data.map((i) => ({
              ...i,
              year: Number(i.year),
              slot_index: i.slot_index !== null && i.slot_index !== undefined ? Number(i.slot_index) : null,
              amount: Number(i.amount),
            })) as BudgetIncomeEntry[]
          );
        }

        if (!expenseRes.error && expenseRes.data && expenseRes.data.length > 0) {
          const remoteExpenses = expenseRes.data.map((e) => ({
            ...e,
            gross_amount: Number(e.gross_amount),
            external_reimbursement: Number(e.external_reimbursement),
            net_amount: Number(e.net_amount),
          })) as ExpenseRecord[];

          setExpenses(remoteExpenses);
        }

        if (!activityRes.error && activityRes.data && activityRes.data.length > 0) {
          const remoteActivities = activityRes.data.map((a) => ({
            ...a,
            estimated_cost: Number(a.estimated_cost || 0),
            origin:
              a.ical_uid?.startsWith('PROPUESTA_LIDER') ||
              a.ical_uid?.startsWith('PENDIENTE_LCR') ||
              a.status === 'PROPUESTA'
                ? 'propuesta_lider'
                : 'lcr',
          })) as ActivityRecord[];

          // Usar únicamente los registros reales de Supabase (sin inyectar SEED_ACTIVITIES)
          const syncResult = await syncLcrCalendarWithShield({
            currentActivities: remoteActivities,
          });

          if (!active) return;

          setActivities((prev) => {
            const sessionProps = isSimulating ? loadSessionProposals() : [];
            const localProposals = [...(isSimulating ? prev : []), ...sessionProps].filter(
              (p) =>
                p.origin === 'propuesta_lider' &&
                !syncResult.activities.some(
                  (m) => m.title === p.title && m.event_date === p.event_date
                )
            );
            const uniqueLocal = Array.from(
              new Map(localProposals.map((p) => [`${p.title}-${p.event_date}`, p])).values()
            );

            return [
              ...syncResult.activities,
              ...uniqueLocal,
            ].sort((a, b) => a.event_date.localeCompare(b.event_date));
          });
        } else {
          // Sincronización silenciosa sobre SEED_ACTIVITIES si no hay tabla remota
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
              const prevById = new Map(prev.map((item) => [item.id, item]));

              return [
                ...syncResult.activities.map((item) => prevById.get(item.id) || item),
                ...uniqueLocal,
              ].sort((a, b) => a.event_date.localeCompare(b.event_date));
            });
          }
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
          const isMigrated = supplierRes.data.some(
            (s) => Boolean((s as SupplierRecord).updated_at)
          );
          if (isMigrated) {
            setSuppliers(supplierRes.data as SupplierRecord[]);
          }
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
    const yearExpenses = expenses.filter(
      (e) =>
        isExpenseApplied(e) &&
        getExpenseEffectiveDate(e).startsWith(String(selectedYear))
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

    // Resumen por trimestre (T1 - T4) conectado a budget_incomes (con fallback a budget_allocations)
    const yearIncomeRows = budgetIncomes.filter((i) => Number(i.year) === selectedYear);
    const hasIncomeEntries = yearIncomeRows.length > 0;
    const incomeSummary = computeYearIncomeSummary(budgetIncomes, selectedYear);

    const qTotalAssigned: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    if (hasIncomeEntries) {
      qTotalAssigned.T1 = incomeSummary.quarterTotals.T1;
      qTotalAssigned.T2 = incomeSummary.quarterTotals.T2;
      qTotalAssigned.T3 = incomeSummary.quarterTotals.T3;
      qTotalAssigned.T4 = incomeSummary.quarterTotals.T4;
    } else {
      yearBudgets.forEach((b) => {
        qTotalAssigned.T1 += Number(b.t1_assigned);
        qTotalAssigned.T2 += Number(b.t2_assigned);
        qTotalAssigned.T3 += Number(b.t3_assigned);
        qTotalAssigned.T4 += Number(b.t4_assigned);
      });
    }

    const qSpent: Record<QuarterCode, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    nonReimbursableExpenses.forEach((e) => {
      const q = getQuarterFromDate(getExpenseEffectiveDate(e));
      qSpent[q] += Number(e.net_amount);
    });

    const t1CarryOver = hasIncomeEntries
      ? incomeSummary.appliedOpeningBalance
      : selectedYear === 2026 && qTotalAssigned.T1 >= INITIAL_OPENING_BALANCE_2026
      ? INITIAL_OPENING_BALANCE_2026
      : 0;
    const t1Income = hasIncomeEntries
      ? incomeSummary.quarterIncomesOnly.T1
      : Math.max(0, Number((qTotalAssigned.T1 - t1CarryOver).toFixed(2)));
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

      const orgExpenses = nonReimbursableExpenses.filter(
        (e) => e.organization === orgCode
      );

      const t1_spent = Number(
        orgExpenses
          .filter((e) => getQuarterFromDate(getExpenseEffectiveDate(e)) === 'T1')
          .reduce((acc, e) => acc + Number(e.net_amount), 0)
          .toFixed(2)
      );
      const t2_spent = Number(
        orgExpenses
          .filter((e) => getQuarterFromDate(getExpenseEffectiveDate(e)) === 'T2')
          .reduce((acc, e) => acc + Number(e.net_amount), 0)
          .toFixed(2)
      );
      const t3_spent = Number(
        orgExpenses
          .filter((e) => getQuarterFromDate(getExpenseEffectiveDate(e)) === 'T3')
          .reduce((acc, e) => acc + Number(e.net_amount), 0)
          .toFixed(2)
      );
      const t4_spent = Number(
        orgExpenses
          .filter((e) => getQuarterFromDate(getExpenseEffectiveDate(e)) === 'T4')
          .reduce((acc, e) => acc + Number(e.net_amount), 0)
          .toFixed(2)
      );

      const spent = Number((t1_spent + t2_spent + t3_spent + t4_spent).toFixed(2));
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
        t1_spent,
        t2_spent,
        t3_spent,
        t4_spent,
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
      nonReimbursableExpenses,
    };
  }, [budgets, expenses, selectedYear]);

  // Gastos filtrados para el modal interactivo del trimestre seleccionado
  const selectedQuarterExpenses = useMemo(() => {
    if (!selectedQuarterModal) return [];
    return executiveMetrics.nonReimbursableExpenses
      .filter((e) => getQuarterFromDate(getExpenseEffectiveDate(e)) === selectedQuarterModal)
      .sort((a, b) => getExpenseEffectiveDate(b).localeCompare(getExpenseEffectiveDate(a)));
  }, [executiveMetrics.nonReimbursableExpenses, selectedQuarterModal]);

  const selectedQuarterSummary = useMemo(
    () =>
      selectedQuarterModal
        ? executiveMetrics.quarters.find((q) => q.quarter === selectedQuarterModal) ?? null
        : null,
    [executiveMetrics.quarters, selectedQuarterModal]
  );

  // Regla sagrada de aprobación: solo propuestas de líderes locales (origin === 'propuesta_lider' y status === 'PROPUESTA')
  const pendingProposalsCount = useMemo(
    () =>
      activities.filter(
        (a) => a.origin === 'propuesta_lider' && a.status === 'PROPUESTA'
      ).length,
    [activities]
  );

  const pendingLcrCount = useMemo(
    () => activities.filter(isActivityPendingLcr).length,
    [activities]
  );

  // Permisos efectivos del usuario actual en Presidencia / Admin
  const userCanManageUsers = canManageUsers(user);
  const userCanEditFinances = canEditFinances(user);
  const userCanApproveCalendar = canApproveCalendar(user);
  const userCanViewLogs = canViewLogs(user);

  // Indicadores unificados de alertas (Calendario unificado + Proveedores + Administración)
  const pendingSuppliersCount = useMemo(
    () => suppliers.filter((s) => s.status === 'PENDIENTE').length,
    [suppliers]
  );
  const userCanManageSuppliers = user.role === 'ADMIN' || userIsSuperAdmin;
  const hasCalendarAlert = userCanApproveCalendar && (pendingProposalsCount > 0 || pendingLcrCount > 0);
  const hasDirectoryAlert = userCanManageUsers && incompleteContactsCount > 0;
  const hasFinanceAlert = userCanEditFinances && executiveMetrics.pendingRenderTotal > 0;
  const hasAnyAdminAlert = hasFinanceAlert;
  const hasAnyMobileAlert = hasCalendarAlert || hasDirectoryAlert || hasAnyAdminAlert;

  // Monto reservado en actividades del trimestre actual (se descuenta al cargar el gasto real vinculado)
  const reservedMetrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const todayStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const currentQuarter = getQuarterFromDate(todayStr);
    const targetQuarter: QuarterCode =
      selectedYear === currentYear
        ? currentQuarter
        : selectedYear < currentYear
        ? 'T4'
        : 'T1';

    const yearStr = String(selectedYear);
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

    const orgTotals = new Map<OrganizationCode, number>();

    // 1. Gastos proyectados y planificados abiertos (incluye vencidos sin rendir de trimestres anteriores y remanentes de pagos parciales)
    expenses.forEach((exp) => {
      if (
        exp.expense_type !== 'PROYECTADO_ACTIVIDAD' &&
        exp.expense_type !== 'PLANIFICADO_SIN_FECHA'
      ) {
        return;
      }
      if (exp.is_reimbursable_oai) return;
      const effDate = getExpenseEffectiveDate(exp);
      if (!effDate.startsWith(yearStr)) return;
      const isOverdueOpen = selectedYear === currentYear && effDate <= todayStr;
      if (!isOverdueOpen && getQuarterFromDate(effDate) !== targetQuarter) return;
      const amount = Number(exp.net_amount ?? exp.gross_amount ?? 0);
      if (amount <= 0) return;
      const targetOrg: OrganizationCode = ALL_HUB_ORGS.includes(exp.organization)
        ? exp.organization
        : 'ESTACA';
      orgTotals.set(
        targetOrg,
        Number(((orgTotals.get(targetOrg) || 0) + amount).toFixed(2))
      );
    });

    // 2. Actividades del calendario con presupuesto estimado que aún no tienen gasto proyectado ni gasto real cerrado
    activities.forEach((act) => {
      if (act.status === 'RECHAZADA' || act.status === 'CANCELADA') return;
      // Excluir actividades históricas importadas del Excel Ene-Oct 2026 (ya rendidas en gastos reales)
      if (act.ical_uid?.startsWith('ACT-2026-')) return;
      if (!act.event_date || !act.event_date.startsWith(yearStr)) return;
      const isOverdueOpen = selectedYear === currentYear && act.event_date <= todayStr;
      if (!isOverdueOpen && getQuarterFromDate(act.event_date) !== targetQuarter) return;
      if (projectedActivityIds.has(act.id) || appliedActivityIds.has(act.id)) return;
      const estimated = Number(act.estimated_cost || 0);
      if (estimated <= 0) return;

      const targetOrg: OrganizationCode = ALL_HUB_ORGS.includes(act.organization)
        ? act.organization
        : 'ESTACA';
      orgTotals.set(
        targetOrg,
        Number(((orgTotals.get(targetOrg) || 0) + estimated).toFixed(2))
      );
    });

    const reservedByOrg = ALL_HUB_ORGS.filter((org) => (orgTotals.get(org) || 0) > 0).map(
      (org) => ({
        organization: org,
        // En esta columna compacta "Soc. Socorro" empujaría la línea divisoria y partiría "RESERVADO ACTIVIDADES T4" en móvil
        shortLabel: org === 'SS' ? 'Soc. Soc.' : ORGANIZATION_SHORT_LABELS[org],
        amount: orgTotals.get(org) || 0,
      })
    );

    const reservedQuarterTotal = Number(
      reservedByOrg.reduce((acc, item) => acc + item.amount, 0).toFixed(2)
    );
    const estimatedFreeBalance = Number(
      (executiveMetrics.consolidatedAvailable - reservedQuarterTotal).toFixed(2)
    );

    return {
      targetQuarter,
      reservedQuarterTotal,
      estimatedFreeBalance,
      reservedByOrg,
    };
  }, [expenses, activities, selectedYear, executiveMetrics.consolidatedAvailable]);

  // Sincronización automática: si se reprograma una actividad en el calendario, actualiza la fecha de sus gastos proyectados enlazados
  useEffect(() => {
    const actMap = new Map(activities.map((a) => [a.id, a]));
    const toUpdate: Array<{ id: number; newDate: string }> = [];
    expenses.forEach((exp) => {
      if (
        exp.expense_type === 'PROYECTADO_ACTIVIDAD' &&
        exp.activity_id &&
        actMap.has(exp.activity_id)
      ) {
        const act = actMap.get(exp.activity_id)!;
        if (act.event_date && exp.activity_date !== act.event_date) {
          toUpdate.push({ id: exp.id, newDate: act.event_date });
        }
      }
    });
    if (toUpdate.length === 0) return;

    const updateMap = new Map(toUpdate.map((u) => [u.id, u.newDate]));
    setExpenses((prev) =>
      prev.map((e) =>
        updateMap.has(e.id)
          ? { ...e, activity_date: updateMap.get(e.id)!, expense_date: updateMap.get(e.id)! }
          : e
      )
    );
    if (!isSimulating) {
      toUpdate.forEach(({ id, newDate }) => {
        supabase
          .from('expenses')
          .update({ activity_date: newDate, expense_date: newDate })
          .eq('id', id)
          .then(() => {});
      });
    }
  }, [activities, expenses, isSimulating]);

  // Handlers de la Bandeja de Aprobación
  const createProjectedForActivity = async (act: ActivityRecord) => {
    if (!act || Number(act.estimated_cost || 0) <= 0) return;
    const alreadyExists = expenses.some(
      (e) => e.activity_id === act.id && e.expense_type === 'PROYECTADO_ACTIVIDAD'
    );
    if (alreadyExists) return;

    await handleSaveExpenseGroup([
      {
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
        gross_amount: Number(act.estimated_cost),
        external_reimbursement: 0,
        net_amount: Number(act.estimated_cost),
        is_reimbursable_oai: false,
        status: 'PENDIENTE_LCR',
        withdrawal_ref: null,
      },
    ]);
  };

  const handleApproveActivity = async (id: number) => {
    const targetAct = activities.find((a) => a.id === id);
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
    if (targetAct && Number(targetAct.estimated_cost || 0) > 0) {
      await createProjectedForActivity({ ...targetAct, status: 'APROBADA' });
    }
    void recordAuditLog({
      actor: user,
      actionType: 'APPROVE',
      section: 'CALENDARIO',
      summary: `Aprobó actividad: ${targetAct?.title || `#${id}`}`,
    });
  };

  const handleRejectActivity = async (id: number, reason?: string) => {
    const targetAct = activities.find((a) => a.id === id);
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
    void recordAuditLog({
      actor: user,
      actionType: 'REJECT',
      section: 'CALENDARIO',
      summary: `Rechazó actividad: ${targetAct?.title || `#${id}`}${reason ? ` (${reason})` : ''}`,
    });
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
    const targetAct = activities.find((a) => a.id === id);
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
    if (targetAct && updates.estimated_cost > 0) {
      await createProjectedForActivity({
        ...targetAct,
        ...updates,
        has_budget: true,
        status: 'APROBADA',
      });
    }
  };

  // Handlers del Calendario unificado (Presidencia, Secretarios y Admin)
  const handleLinkWithLcrEvent = async (pendingActivityId: number, lcrActivityId: number) => {
    const pendingAct = activities.find((a) => a.id === pendingActivityId);
    const lcrAct = activities.find((a) => a.id === lcrActivityId);
    if (!pendingAct || !lcrAct || !lcrAct.ical_uid) return;

    // Conservar siempre el registro real de LCR (lcrAct.id) y transferirle los datos complementarios de la app
    const mergedRecord: ActivityRecord = {
      ...mergeLocalWithLcrActivity(pendingAct, lcrAct),
      id: lcrAct.id,
    };

    setActivities((prev) => {
      const next = prev
        .filter((a) => a.id !== pendingActivityId)
        .map((a) => (a.id === lcrActivityId ? mergedRecord : a));
      saveSessionProposals(next);
      return next;
    });

    // Reapuntar gastos/reservas vinculados al evento temporal hacia el ID real de LCR
    setExpenses((prev) =>
      prev.map((e) =>
        e.activity_id === pendingActivityId
          ? {
              ...e,
              activity_id: lcrAct.id,
              activity_date: mergedRecord.event_date,
              expense_date:
                e.expense_type === 'PROYECTADO_ACTIVIDAD'
                  ? mergedRecord.event_date
                  : e.expense_date,
            }
          : e
      )
    );

    if (!isSimulating) {
      try {
        // 1. Enriquecer la fila real de LCR en Supabase (por ical_uid o id)
        await supabase
          .from('activities')
          .update({
            organization: mergedRecord.organization,
            estimated_cost: mergedRecord.estimated_cost,
            has_budget: mergedRecord.has_budget,
            app_notes: mergedRecord.app_notes,
          })
          .eq('ical_uid', lcrAct.ical_uid);

        // 2. Reapuntar cualquier gasto vinculado al ID real de LCR
        if (pendingActivityId > 0 && pendingActivityId < 2_000_000_000) {
          await supabase
            .from('expenses')
            .update({ activity_id: lcrAct.id })
            .eq('activity_id', pendingActivityId);

          // 3. Eliminar la fila temporal pendiente en Supabase
          await supabase.from('activities').delete().eq('id', pendingActivityId);
        }
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleMarkNoLcrRequired = async (activityId: number) => {
    const noLcrUid = `NO_LCR_${activityId}`;
    setActivities((prev) => {
      const next = prev.map((a) => (a.id === activityId ? { ...a, ical_uid: noLcrUid } : a));
      saveSessionProposals(next);
      return next;
    });
    if (!isSimulating && activityId > 0 && activityId < 2_000_000_000) {
      try {
        await supabase.from('activities').update({ ical_uid: noLcrUid }).eq('id', activityId);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    setActivities((prev) => {
      const next = prev.filter((a) => a.id !== activityId);
      saveSessionProposals(next);
      return next;
    });
    if (!isSimulating && activityId > 0 && activityId < 2_000_000_000) {
      try {
        await supabase.from('activities').delete().eq('id', activityId);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleCancelActivity = async (activityId: number) => {
    setActivities((prev) => {
      const next = prev.map((a) =>
        a.id === activityId ? { ...a, status: 'CANCELADA' as const } : a
      );
      saveSessionProposals(next);
      return next;
    });
    if (!isSimulating && activityId > 0 && activityId < 2_000_000_000) {
      try {
        await supabase.from('activities').update({ status: 'CANCELADA' }).eq('id', activityId);
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleManualCalendarSync = async () => {
    const result = await syncLcrCalendarWithShield({
      currentActivities: activities,
      attemptLiveFetch: true,
      bypassDbShield: true,
    });
    setActivities(result.activities);
  };

  const handleUpdateApprovedActivity = async (
    id: number,
    updates: ActivityEditPayload
  ): Promise<{ autoLinked?: boolean; linkedTitle?: string } | void> => {
    const existingAct = activities.find((a) => a.id === id);
    if (!existingAct) return;

    const updatedLocal: ActivityRecord = {
      ...existingAct,
      title: updates.title,
      event_date: updates.event_date,
      start_time: updates.start_time,
      end_time: updates.end_time ?? null,
      location: updates.location,
      organization: updates.organization,
      description: isLcrLinkedActivity(existingAct)
        ? existingAct.description ?? null
        : updates.description || null,
      app_notes: updates.app_notes || null,
      estimated_cost: updates.estimated_cost,
      has_budget: updates.estimated_cost > 0,
    };

    // Si es un evento local aún no vinculado a LCR, comprobar si ahora coincide por fecha + nombre normalizado con uno de LCR
    const matchingLcr = !isLcrLinkedActivity(existingAct)
      ? findMatchingLcrEvent(updatedLocal, activities)
      : null;

    if (matchingLcr && matchingLcr.ical_uid) {
      const mergedRecord: ActivityRecord = {
        ...mergeLocalWithLcrActivity(updatedLocal, matchingLcr),
        id: matchingLcr.id,
      };

      setActivities((prev) => {
        const next = prev
          .filter((a) => a.id !== id)
          .map((a) => (a.id === matchingLcr.id ? mergedRecord : a));
        saveSessionProposals(next);
        return next;
      });

      if (!isSimulating) {
        const { error } = await supabase
          .from('activities')
          .update({
            organization: mergedRecord.organization,
            estimated_cost: mergedRecord.estimated_cost,
            has_budget: mergedRecord.has_budget,
            app_notes: mergedRecord.app_notes,
          })
          .eq('ical_uid', matchingLcr.ical_uid);
        if (error) {
          throw new Error('No se pudo guardar la vinculación en el servidor.');
        }

        if (id > 0 && id < 2_000_000_000) {
          await supabase
            .from('expenses')
            .update({ activity_id: matchingLcr.id })
            .eq('activity_id', id);
          await supabase.from('activities').delete().eq('id', id);
        }
      }

      // Sincronizar reserva presupuestaria con los datos finales fusionados
      await syncProjectedExpenseForActivity(matchingLcr.id, mergedRecord);
      return { autoLinked: true, linkedTitle: mergedRecord.title };
    }

    setActivities((prev) => {
      const next = prev.map((a) => (a.id === id ? updatedLocal : a));
      saveSessionProposals(next);
      return next;
    });

    if (!isSimulating) {
      const dbPayload: Record<string, unknown> = {
        organization: updatedLocal.organization,
        estimated_cost: updatedLocal.estimated_cost,
        has_budget: updatedLocal.has_budget,
        app_notes: updatedLocal.app_notes,
      };
      // En eventos no vinculados a LCR se persisten también todos los datos editados
      if (!isLcrLinkedActivity(existingAct)) {
        dbPayload.title = updatedLocal.title;
        dbPayload.event_date = updatedLocal.event_date;
        dbPayload.start_time = updatedLocal.start_time;
        dbPayload.end_time = updatedLocal.end_time;
        dbPayload.location = updatedLocal.location;
        dbPayload.description = updatedLocal.description;
      }

      const query = existingAct.ical_uid && isLcrLinkedActivity(existingAct)
        ? supabase.from('activities').update(dbPayload).eq('ical_uid', existingAct.ical_uid)
        : supabase.from('activities').update(dbPayload).eq('id', id);

      const { error } = await query;
      if (error) {
        throw new Error('No se pudieron guardar los cambios en el servidor.');
      }
    }

    await syncProjectedExpenseForActivity(id, updatedLocal);
  };

  const syncProjectedExpenseForActivity = async (
    id: number,
    updatedAct: ActivityRecord
  ) => {
    const existingProjected = expenses.find(
      (e) => e.activity_id === id && e.expense_type === 'PROYECTADO_ACTIVIDAD'
    );
    if (existingProjected) {
      if (updatedAct.estimated_cost <= 0) {
        setExpenses((prev) => prev.filter((e) => e.id !== existingProjected.id));
        if (!isSimulating) {
          try {
            await supabase.from('expenses').delete().eq('id', existingProjected.id);
          } catch {
            // Silencioso
          }
        }
      } else {
        const nextConcept = `Reserva actividad: ${updatedAct.title}`;
        setExpenses((prev) =>
          prev.map((e) =>
            e.id === existingProjected.id
              ? {
                  ...e,
                  activity_date: updatedAct.event_date,
                  expense_date: updatedAct.event_date,
                  organization: updatedAct.organization,
                  concept: nextConcept,
                  gross_amount: updatedAct.estimated_cost,
                  net_amount: updatedAct.estimated_cost,
                }
              : e
          )
        );
        if (!isSimulating) {
          try {
            await supabase
              .from('expenses')
              .update({
                activity_date: updatedAct.event_date,
                expense_date: updatedAct.event_date,
                organization: updatedAct.organization,
                concept: nextConcept,
                gross_amount: updatedAct.estimated_cost,
                net_amount: updatedAct.estimated_cost,
              })
              .eq('id', existingProjected.id);
          } catch {
            // Silencioso
          }
        }
      }
    } else if (updatedAct.estimated_cost > 0 && updatedAct.status === 'APROBADA') {
      await createProjectedForActivity({
        ...updatedAct,
        has_budget: true,
        status: 'APROBADA',
      });
    }
  };

  const handleCreateDirectActivity = async (proposal: {
    title: string;
    event_date: string;
    start_time: string;
    end_time?: string;
    location: string;
    organization: OrganizationCode;
    estimated_cost: number;
    description?: string;
    requires_lcr?: boolean;
  }) => {
    const tempId = Date.now();
    const uid =
      proposal.requires_lcr === false
        ? `NO_LCR_${tempId}`
        : `PENDIENTE_LCR-${tempId}`;
    let createdRecord: ActivityRecord = {
      id: tempId,
      ical_uid: uid,
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
      status: 'APROBADA',
    };

    setActivities((prev) => {
      const updated = [...prev, createdRecord].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      );
      saveSessionProposals(updated);
      return updated;
    });

    if (!isSimulating) {
      try {
        const { data: inserted } = await supabase
          .from('activities')
          .insert([
            {
              ical_uid: uid,
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
              status: 'APROBADA',
            },
          ])
          .select('id')
          .single();

        if (inserted && typeof inserted.id === 'number') {
          createdRecord = { ...createdRecord, id: inserted.id };
          setActivities((prev) =>
            prev.map((a) => (a.id === tempId ? { ...a, id: inserted.id } : a))
          );
        }
      } catch {
        // Estado local ya actualizado
      }
    }

    if (createdRecord.estimated_cost > 0) {
      await createProjectedForActivity(createdRecord);
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
    void recordAuditLog({
      actor: user,
      actionType: 'CREATE',
      section: 'FINANZAS',
      summary: `Registró gasto "${newExpense.concept}" por ${formatCurrency(newExpense.gross_amount)} en ${ORGANIZATION_SHORT_LABELS[newExpense.organization]}`,
    });
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
    if (expensesList.length > 0) {
      const total = expensesList.reduce((acc, item) => acc + Number(item.gross_amount || 0), 0);
      void recordAuditLog({
        actor: user,
        actionType: 'CREATE',
        section: 'FINANZAS',
        summary: `Registró gasto compartido "${expensesList[0].concept}" por ${formatCurrency(total)} (${expensesList.length} organizaciones)`,
      });
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
    void recordAuditLog({
      actor: user,
      actionType: 'RECONCILE',
      section: 'FINANZAS',
      summary: `Concilió comprobante en LCR (#${id})`,
    });
  };

  const handleReconcileLcrExpenseGroup = async (ids: number[]) => {
    if (ids.length === 0) return;
    setExpenses((prev) =>
      prev.map((e) => (ids.includes(e.id) ? { ...e, status: 'REGISTRADO_LCR' } : e))
    );
    if (!isSimulating) {
      try {
        await supabase.from('expenses').update({ status: 'REGISTRADO_LCR' }).in('id', ids);
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'RECONCILE',
      section: 'FINANZAS',
      summary: `Concilió movimiento en LCR (${ids.length} registro${ids.length > 1 ? 's' : ''})`,
    });
  };

  const handleSaveExpenseGroup = async (
    records: Array<Omit<ExpenseRecord, 'id'>>,
    existingIds?: number[]
  ) => {
    const baseId = Date.now();
    const first = records[0];
    const totalGross = Number(
      records.reduce((acc, r) => acc + Number(r.gross_amount), 0).toFixed(2)
    );

    // Detectar si requiere salida directa auto-cerrada en cash_withdrawals (DIRECTO_TARJETA o TRANSFERENCIA formal)
    const isDirectMovement =
      first &&
      first.is_applied !== false &&
      (first.expense_type === 'DIRECTO_TARJETA' || first.expense_type === 'TRANSFERENCIA');

    const prevRecords = existingIds?.length
      ? expenses.filter((e) => existingIds.includes(e.id))
      : [];
    const prevDirectRef =
      prevRecords[0] &&
      (prevRecords[0].expense_type === 'DIRECTO_TARJETA' ||
        prevRecords[0].expense_type === 'TRANSFERENCIA')
        ? prevRecords[0].withdrawal_ref
        : null;

    let assignedDirectRef: string | null = null;
    let normalizedRecords = records;

    if (isDirectMovement) {
      assignedDirectRef =
        first.ref_number?.trim() ||
        prevDirectRef ||
        `${first.expense_type === 'TRANSFERENCIA' ? 'TRF' : 'DIR'}-${baseId}`;
      normalizedRecords = records.map((r) =>
        r.is_applied !== false
          ? {
              ...r,
              withdrawal_ref: assignedDirectRef,
              withdrawal_allocations: [],
            }
          : r
      );
    }

    const localRecords: ExpenseRecord[] = normalizedRecords.map((item, idx) => ({
      ...item,
      id: baseId + idx,
    }));

    setExpenses((prev) => {
      const remaining = existingIds?.length
        ? prev.filter((e) => !existingIds.includes(e.id))
        : prev;
      return [...localRecords, ...remaining];
    });

    // Sincronizar salida directa en cash_withdrawals
    if (prevDirectRef && prevDirectRef !== assignedDirectRef) {
      setWithdrawals((prev) => prev.filter((w) => w.withdrawal_ref !== prevDirectRef));
      if (!isSimulating) {
        supabase
          .from('cash_withdrawals')
          .delete()
          .eq('withdrawal_ref', prevDirectRef)
          .then(() => {});
      }
    }

    if (isDirectMovement && assignedDirectRef) {
      const autoWithdrawal: Omit<CashWithdrawalRecord, 'id'> = {
        withdrawal_ref: assignedDirectRef,
        withdrawal_date: first.expense_date,
        amount: totalGross,
        responsible_person: user.full_name || 'Administrador',
        purpose: first.concept,
        movement_type: first.expense_type === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'DIRECTO_TARJETA',
        status: 'CERRADO_EN_CERO',
        return_date: null,
        returned_amount: 0,
      };

      setWithdrawals((prev) => {
        const exists = prev.some((w) => w.withdrawal_ref === assignedDirectRef);
        if (exists) {
          return prev.map((w) =>
            w.withdrawal_ref === assignedDirectRef ? { ...w, ...autoWithdrawal } : w
          );
        }
        return [{ ...autoWithdrawal, id: baseId + 999 }, ...prev];
      });

      if (!isSimulating) {
        try {
          const { data: existingW } = await supabase
            .from('cash_withdrawals')
            .select('id')
            .eq('withdrawal_ref', assignedDirectRef)
            .maybeSingle();
          if (existingW?.id) {
            await supabase
              .from('cash_withdrawals')
              .update(autoWithdrawal)
              .eq('id', existingW.id);
          } else {
            await supabase.from('cash_withdrawals').insert([autoWithdrawal]);
          }
        } catch {
          // Estado local ya actualizado
        }
      }
    }

    if (!isSimulating) {
      try {
        if (existingIds && existingIds.length > 0) {
          await supabase.from('expenses').delete().in('id', existingIds);
        }
        const dbPayloads = normalizedRecords.map(({ net_amount: _ignored, ...rest }) => rest);
        const { data } = await supabase.from('expenses').insert(dbPayloads).select();
        if (data && data.length > 0) {
          const inserted = data.map((e) => ({
            ...e,
            gross_amount: Number(e.gross_amount),
            external_reimbursement: Number(e.external_reimbursement),
            net_amount: Number(e.net_amount),
          })) as ExpenseRecord[];
          const tempIds = new Set(localRecords.map((r) => r.id));
          setExpenses((prev) => [
            ...inserted,
            ...prev.filter((e) => !tempIds.has(e.id)),
          ]);
        }
      } catch {
        // Estado local ya actualizado
      }
    }
    if (normalizedRecords.length > 0) {
      const total = normalizedRecords.reduce((acc, r) => acc + Number(r.gross_amount || 0), 0);
      const isEdit = Boolean(existingIds && existingIds.length > 0);
      void recordAuditLog({
        actor: user,
        actionType: isEdit ? 'UPDATE' : 'CREATE',
        section: 'FINANZAS',
        summary: `${isEdit ? 'Editó' : 'Registró'} gasto "${normalizedRecords[0].concept}" por ${formatCurrency(total)}`,
      });
    }
  };

  const handleCloseActivityWithoutExpense = async (activityId: number) => {
    const projectedIds = expenses
      .filter((e) => e.activity_id === activityId && e.expense_type === 'PROYECTADO_ACTIVIDAD')
      .map((e) => e.id);

    if (projectedIds.length > 0) {
      setExpenses((prev) => prev.filter((e) => !projectedIds.includes(e.id)));
      if (!isSimulating) {
        try {
          await supabase.from('expenses').delete().in('id', projectedIds);
        } catch {
          // Estado local ya actualizado
        }
      }
    }

    const targetAct = activities.find((a) => a.id === activityId);
    setActivities((prev) =>
      prev.map((a) =>
        a.id === activityId ? { ...a, has_budget: false, estimated_cost: 0 } : a
      )
    );
    if (!isSimulating) {
      try {
        await supabase
          .from('activities')
          .update({ has_budget: false, estimated_cost: 0 })
          .eq('id', activityId);
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'FINANZAS',
      summary: `Cerró reserva sin gasto para actividad: ${targetAct?.title || `#${activityId}`}`,
    });
  };

  const handleDeleteExpenseGroup = async (ids: number[]) => {
    if (ids.length === 0) return;
    const deletedRows = expenses.filter((e) => ids.includes(e.id));

    setExpenses((prev) => prev.filter((e) => !ids.includes(e.id)));

    // Si se elimina un PROYECTADO_ACTIVIDAD, desmarcar presupuesto en la actividad del calendario
    const projectedActIds = deletedRows
      .filter((r) => r.expense_type === 'PROYECTADO_ACTIVIDAD' && r.activity_id)
      .map((r) => r.activity_id as number);

    if (projectedActIds.length > 0) {
      setActivities((prev) =>
        prev.map((a) =>
          projectedActIds.includes(a.id)
            ? { ...a, has_budget: false, estimated_cost: 0 }
            : a
        )
      );
      if (!isSimulating) {
        try {
          await supabase
            .from('activities')
            .update({ has_budget: false, estimated_cost: 0 })
            .in('id', projectedActIds);
        } catch {
          // Estado local ya actualizado
        }
      }
    }

    // Si se elimina un DIRECTO_TARJETA / TRANSFERENCIA, limpiar su salida directa vinculada
    const directRefs = deletedRows
      .filter(
        (r) =>
          (r.expense_type === 'DIRECTO_TARJETA' || r.expense_type === 'TRANSFERENCIA') &&
          r.withdrawal_ref
      )
      .map((r) => r.withdrawal_ref as string);

    if (directRefs.length > 0) {
      setWithdrawals((prev) => prev.filter((w) => !directRefs.includes(w.withdrawal_ref)));
      if (!isSimulating) {
        try {
          await supabase
            .from('cash_withdrawals')
            .delete()
            .in('withdrawal_ref', directRefs);
        } catch {
          // Estado local ya actualizado
        }
      }
    }

    if (!isSimulating) {
      try {
        await supabase.from('expenses').delete().in('id', ids);
      } catch {
        // Estado local ya actualizado
      }
    }
    if (deletedRows.length > 0) {
      void recordAuditLog({
        actor: user,
        actionType: 'DELETE',
        section: 'FINANZAS',
        summary: `Eliminó gasto "${deletedRows[0].concept}" (${deletedRows.length} registro${deletedRows.length > 1 ? 's' : ''})`,
      });
    }
  };

  const handleSaveBudgetAllocation = async (
    allocation: Omit<BudgetAllocation, 'id' | 'total_assigned'> & { id?: number }
  ) => {
    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'PRESUPUESTOS',
      summary: `Guardó presupuesto ${allocation.year} de ${ORGANIZATION_SHORT_LABELS[allocation.organization]}`,
    });
    const total = Number(
      (
        Number(allocation.t1_assigned) +
        Number(allocation.t2_assigned) +
        Number(allocation.t3_assigned) +
        Number(allocation.t4_assigned)
      ).toFixed(2)
    );

    const existing = budgets.find(
      (b) =>
        (allocation.id && b.id === allocation.id) ||
        (Number(b.year) === Number(allocation.year) && b.organization === allocation.organization)
    );

    if (existing) {
      const updated: BudgetAllocation = {
        ...existing,
        ...allocation,
        total_assigned: total,
      };
      setBudgets((prev) => prev.map((b) => (b.id === existing.id ? updated : b)));

      if (!isSimulating) {
        try {
          await supabase
            .from('budget_allocations')
            .update({
              t1_assigned: allocation.t1_assigned,
              t2_assigned: allocation.t2_assigned,
              t3_assigned: allocation.t3_assigned,
              t4_assigned: allocation.t4_assigned,
              notes: allocation.notes ?? null,
            })
            .eq('id', existing.id);
        } catch {
          // Estado local ya actualizado
        }
      }
    } else {
      const tempId = Date.now();
      const created: BudgetAllocation = {
        id: tempId,
        year: allocation.year,
        organization: allocation.organization,
        t1_assigned: allocation.t1_assigned,
        t2_assigned: allocation.t2_assigned,
        t3_assigned: allocation.t3_assigned,
        t4_assigned: allocation.t4_assigned,
        total_assigned: total,
        notes: allocation.notes,
      };
      setBudgets((prev) => [...prev, created]);

      if (!isSimulating) {
        try {
          const { data } = await supabase
            .from('budget_allocations')
            .insert([
              {
                year: allocation.year,
                organization: allocation.organization,
                t1_assigned: allocation.t1_assigned,
                t2_assigned: allocation.t2_assigned,
                t3_assigned: allocation.t3_assigned,
                t4_assigned: allocation.t4_assigned,
                notes: allocation.notes ?? null,
              },
            ])
            .select();
          if (data && data[0]) {
            const realRow = {
              ...data[0],
              t1_assigned: Number(data[0].t1_assigned),
              t2_assigned: Number(data[0].t2_assigned),
              t3_assigned: Number(data[0].t3_assigned),
              t4_assigned: Number(data[0].t4_assigned),
              total_assigned: Number(data[0].total_assigned),
            } as BudgetAllocation;
            setBudgets((prev) => prev.map((b) => (b.id === tempId ? realRow : b)));
          }
        } catch {
          // Estado local ya actualizado
        }
      }
    }
  };

  const handleSaveOpeningBalance = async (year: number, amount: number, lcrRef?: string) => {
    const existing = budgetIncomes.find(
      (i) => Number(i.year) === year && i.entry_type === 'SALDO_INICIAL'
    );
    if (existing) {
      const updated: BudgetIncomeEntry = {
        ...existing,
        amount,
        lcr_ref: lcrRef ?? existing.lcr_ref,
      };
      setBudgetIncomes((prev) => prev.map((i) => (i.id === existing.id ? updated : i)));
      if (!isSimulating) {
        try {
          await supabase
            .from('budget_incomes')
            .update({ amount, lcr_ref: updated.lcr_ref ?? null })
            .eq('id', existing.id);
        } catch {
          // Estado local actualizado
        }
      }
    } else {
      const tempId = Date.now();
      const created: BudgetIncomeEntry = {
        id: tempId,
        year,
        quarter: 'T1',
        entry_type: 'SALDO_INICIAL',
        slot_index: 0,
        lcr_ref: lcrRef || `APERTURA-${year}`,
        description: `Saldo Inicial ${year}`,
        amount,
      };
      setBudgetIncomes((prev) => [...prev, created]);
      if (!isSimulating) {
        try {
          const { data } = await supabase
            .from('budget_incomes')
            .insert([
              {
                year,
                quarter: 'T1',
                entry_type: 'SALDO_INICIAL',
                slot_index: 0,
                lcr_ref: created.lcr_ref,
                description: created.description,
                amount,
              },
            ])
            .select();
          if (data && data[0]) {
            const realRow = { ...data[0], amount: Number(data[0].amount) } as BudgetIncomeEntry;
            setBudgetIncomes((prev) => prev.map((i) => (i.id === tempId ? realRow : i)));
          }
        } catch {
          // Estado local actualizado
        }
      }
    }
  };

  const handleSaveQuarterIncomes = async (
    year: number,
    quarter: QuarterCode,
    unitRows: Array<{ slot_index: number; amount: number; lcr_ref: string }>,
    adjustments: Array<{ id?: number; amount: number; description: string; lcr_ref: string }>
  ) => {
    const baseTime = Date.now();
    const newEntries: BudgetIncomeEntry[] = [
      ...unitRows.map((u, idx) => ({
        id: baseTime + idx,
        year,
        quarter,
        entry_type: 'INGRESO_UNIDAD' as const,
        slot_index: u.slot_index,
        lcr_ref: u.lcr_ref || null,
        description: `Ingreso ${u.slot_index} - ${quarter}`,
        amount: u.amount,
      })),
      ...adjustments.map((a, idx) => ({
        id: baseTime + 100 + idx,
        year,
        quarter,
        entry_type: 'AJUSTE' as const,
        slot_index: null,
        lcr_ref: a.lcr_ref || null,
        description: a.description,
        amount: a.amount,
      })),
    ];

    setBudgetIncomes((prev) => [
      ...prev.filter(
        (i) =>
          !(
            Number(i.year) === year &&
            i.quarter === quarter &&
            (i.entry_type === 'INGRESO_UNIDAD' || i.entry_type === 'AJUSTE')
          )
      ),
      ...newEntries,
    ]);

    if (!isSimulating) {
      try {
        await supabase
          .from('budget_incomes')
          .delete()
          .eq('year', year)
          .eq('quarter', quarter)
          .in('entry_type', ['INGRESO_UNIDAD', 'AJUSTE']);

        const payload = newEntries.map(({ id: _omit, ...rest }) => rest);
        const { data } = await supabase.from('budget_incomes').insert(payload).select();
        if (data && data.length > 0) {
          const synced = data.map((row) => ({
            ...row,
            year: Number(row.year),
            slot_index:
              row.slot_index !== null && row.slot_index !== undefined
                ? Number(row.slot_index)
                : null,
            amount: Number(row.amount),
          })) as BudgetIncomeEntry[];
          setBudgetIncomes((prev) => [
            ...prev.filter(
              (i) =>
                !(
                  Number(i.year) === year &&
                  i.quarter === quarter &&
                  (i.entry_type === 'INGRESO_UNIDAD' || i.entry_type === 'AJUSTE')
                )
            ),
            ...synced,
          ]);
        }
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleResetFutureYearProjection = async (year: number) => {
    if (year <= new Date().getFullYear()) return;
    setBudgetIncomes((prev) => prev.filter((i) => Number(i.year) !== year));
    setBudgets((prev) => prev.filter((b) => Number(b.year) !== year));

    if (!isSimulating) {
      try {
        await Promise.all([
          supabase.from('budget_incomes').delete().eq('year', year),
          supabase.from('budget_allocations').delete().eq('year', year),
        ]);
      } catch {
        // Estado local limpiado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'DELETE',
      section: 'PRESUPUESTOS',
      summary: `Restableció proyección de presupuestos ${year}`,
    });
  };

  const handleCreateWithdrawal = async (
    newWithdrawal: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => {
    const record: CashWithdrawalRecord = { ...newWithdrawal, id: Date.now() };

    // Si es un Depósito, aplicarlo al retiro seleccionado (o en orden FIFO a los retiros abiertos del año)
    const depositUpdates: Array<{
      id: number;
      returned_amount: number;
      return_date: string;
      status: 'CERRADO_EN_CERO' | 'PENDIENTE_JUSTIFICAR';
    }> = [];

    if (newWithdrawal.movement_type === 'DEPOSITO' && Number(newWithdrawal.amount) > 0) {
      const yearPrefix = newWithdrawal.withdrawal_date.slice(0, 4);
      const renderedByRef = new Map<string, number>();
      expenses
        .filter((e) => isExpenseApplied(e) && getExpenseEffectiveDate(e).startsWith(yearPrefix))
        .forEach((exp) => {
          getExpenseWithdrawalAllocations(exp).forEach((a) => {
            renderedByRef.set(
              a.withdrawal_ref,
              Number(((renderedByRef.get(a.withdrawal_ref) || 0) + a.amount).toFixed(2))
            );
          });
        });

      const candidates = withdrawals
        .filter(
          (w) =>
            (!w.movement_type || w.movement_type === 'EFECTIVO') &&
            w.withdrawal_date.startsWith(yearPrefix)
        )
        .map((w) => {
          const spent = renderedByRef.get(w.withdrawal_ref) || 0;
          const pending = Math.max(
            0,
            Number((Number(w.amount) - spent - Number(w.returned_amount || 0)).toFixed(2))
          );
          return { w, pending };
        })
        .filter((item) => item.pending > 0)
        .sort((a, b) => a.w.withdrawal_date.localeCompare(b.w.withdrawal_date));

      const orderedTargets =
        targetWithdrawalRef && targetWithdrawalRef !== 'AUTO'
          ? [
              ...candidates.filter((c) => c.w.withdrawal_ref === targetWithdrawalRef),
              ...candidates.filter((c) => c.w.withdrawal_ref !== targetWithdrawalRef),
            ]
          : candidates;

      let remainingDeposit = Number(newWithdrawal.amount);
      for (const item of orderedTargets) {
        if (remainingDeposit <= 0) break;
        const applyAmt = Number(Math.min(remainingDeposit, item.pending).toFixed(2));
        remainingDeposit = Number((remainingDeposit - applyAmt).toFixed(2));
        const nextReturned = Number(
          (Number(item.w.returned_amount || 0) + applyAmt).toFixed(2)
        );
        const nextPending = Number((item.pending - applyAmt).toFixed(2));
        depositUpdates.push({
          id: item.w.id,
          returned_amount: nextReturned,
          return_date: newWithdrawal.withdrawal_date,
          status: nextPending <= 0 ? 'CERRADO_EN_CERO' : 'PENDIENTE_JUSTIFICAR',
        });
      }
    }

    setWithdrawals((prev) => {
      const updated = prev.map((w) => {
        const match = depositUpdates.find((u) => u.id === w.id);
        return match ? { ...w, ...match } : w;
      });
      return [record, ...updated];
    });

    if (!isSimulating) {
      try {
        await supabase.from('cash_withdrawals').insert([newWithdrawal]);
        await Promise.all(
          depositUpdates.map((u) =>
            supabase
              .from('cash_withdrawals')
              .update({
                returned_amount: u.returned_amount,
                return_date: u.return_date,
                status: u.status,
              })
              .eq('id', u.id)
          )
        );
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'CREATE',
      section: 'FINANZAS',
      summary: `Registró movimiento "${newWithdrawal.withdrawal_ref}" por ${formatCurrency(newWithdrawal.amount)}`,
    });
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
    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'FINANZAS',
      summary: `Cerró retiro #${id} en $ 0,00 (devolución: ${formatCurrency(returnAmount)})`,
    });
  };

  const handleCreateSupplier = async (newSupplier: Omit<SupplierRecord, 'id'>) => {
    const tempId = Date.now();
    const record: SupplierRecord = { ...newSupplier, id: tempId };
    setSuppliers((prev) => [...prev, record]);

    if (!isSimulating) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .insert([newSupplier])
          .select()
          .single();

        if (error) {
          // Fallback si la columna `status` aún no fue migrada en Supabase
          const { status: _status, ...withoutStatus } = newSupplier;
          const retry = await supabase
            .from('suppliers')
            .insert([withoutStatus])
            .select()
            .single();
          if (retry.data) {
            setSuppliers((prev) =>
              prev.map((s) => (s.id === tempId ? ({ ...retry.data, status: newSupplier.status } as SupplierRecord) : s))
            );
          }
        } else if (data) {
          setSuppliers((prev) =>
            prev.map((s) => (s.id === tempId ? (data as SupplierRecord) : s))
          );
        }
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'CREATE',
      section: 'PROVEEDORES',
      summary: `Agregó proveedor "${newSupplier.commercial_name}" (${newSupplier.category || 'Varios'})`,
    });
  };

  const handleUpdateSupplier = async (id: number, updated: Omit<SupplierRecord, 'id'>) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...updated, id } : s))
    );

    if (!isSimulating) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .update(updated)
          .eq('id', id);

        if (error) {
          const { status: _status, ...withoutStatus } = updated;
          await supabase.from('suppliers').update(withoutStatus).eq('id', id);
        }
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'PROVEEDORES',
      summary: `Actualizó proveedor "${updated.commercial_name}"`,
    });
  };

  const handleDeleteSupplier = async (id: number) => {
    const target = suppliers.find((s) => s.id === id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));

    if (!isSimulating) {
      try {
        await supabase.from('suppliers').delete().eq('id', id);
      } catch {
        // Estado local ya actualizado
      }
    }
    void recordAuditLog({
      actor: user,
      actionType: 'DELETE',
      section: 'PROVEEDORES',
      summary: `Eliminó proveedor "${target?.commercial_name || `#${id}`}"`,
    });
  };

  const persistSupplierCategories = async (nextList: string[]) => {
    const sorted = Array.from(new Set(nextList.map((c) => c.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    setSavedSupplierCategories(sorted);
    if (!isSimulating) {
      try {
        await supabase.from('app_config').upsert(
          [
            {
              key: 'supplier_categories',
              value: JSON.stringify(sorted),
              description: 'Catálogo oficial de rubros de proveedores',
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'key' }
        );
      } catch {
        // Estado local ya actualizado
      }
    }
  };

  const handleAddSupplierCategory = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    await persistSupplierCategories([...savedSupplierCategories, clean]);
  };

  const handleRenameSupplierCategory = async (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew || cleanNew === oldName) return;

    const affected = suppliers.filter((s) => s.category === oldName);
    setSuppliers((prev) =>
      prev.map((s) => (s.category === oldName ? { ...s, category: cleanNew } : s))
    );

    if (!isSimulating && affected.length > 0) {
      try {
        await supabase
          .from('suppliers')
          .update({ category: cleanNew })
          .eq('category', oldName);
      } catch {
        // Estado local ya actualizado
      }
    }

    const base = savedSupplierCategories.filter((c) => c !== oldName);
    await persistSupplierCategories([...base, cleanNew]);
  };

  const handleDeleteSupplierCategory = async (name: string, moveToCategory: string) => {
    const targetCat = moveToCategory.trim() || 'Varios';
    const affected = suppliers.filter((s) => s.category === name);
    if (affected.length > 0) {
      setSuppliers((prev) =>
        prev.map((s) => (s.category === name ? { ...s, category: targetCat } : s))
      );
      if (!isSimulating) {
        try {
          await supabase
            .from('suppliers')
            .update({ category: targetCat })
            .eq('category', name);
        } catch {
          // Estado local ya actualizado
        }
      }
    }

    const remaining = savedSupplierCategories.filter((c) => c !== name);
    await persistSupplierCategories(affected.length > 0 ? [...remaining, targetCat] : remaining);
  };

  const selectTabAndCloseDrawer = (
    tab:
      | 'DASHBOARD'
      | 'CALENDAR'
      | 'SUPPLIERS'
      | 'DIRECTORY'
      | 'OPERATIONS'
      | 'LOGS'
      | 'INFO'
  ) => {
    if (tab === 'CALENDAR') {
      setCalendarInitialManageMode(false);
      setCalendarInitialFilter('ALL');
      setCalendarOnlyPendingLcr(false);
    }
    if (tab === 'DIRECTORY') {
      setOpenUsersWithIncompleteFilter(false);
    }
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
            {/* Izquierda: Botón Menú Hamburguesa (siempre a la izquierda en móvil) + Estaca Montevideo Uruguay Este */}
            <div className="flex items-center gap-2 min-w-0">
              {/* Botón Hamburguesa Móvil (☰ que se transforma suavemente en ✕) - Siempre a la izquierda */}
              <button
                type="button"
                data-testid="mobile-menu-toggle"
                aria-label={isMobileDrawerOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
                aria-expanded={isMobileDrawerOpen}
                onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
                className="pressable md:hidden relative w-9 h-9 rounded-xl bg-[#072B52] text-white flex items-center justify-center shadow-sm flex-shrink-0"
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
                {hasAnyMobileAlert && !isMobileDrawerOpen && (
                  <span
                    data-testid="mobile-menu-alert-dot"
                    className="absolute -top-1 -right-1 flex h-3 w-3"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 ring-2 ring-white" />
                  </span>
                )}
              </button>

              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-extrabold bg-[#083563] text-white tracking-wide shadow-sm whitespace-nowrap truncate">
                Estaca Montevideo Uruguay Este
              </span>
            </div>

            {/* Derecha: Selector de Año (solo secciones con datos financieros o calendario) + Usuario Activo */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {(activeTab === 'DASHBOARD' ||
                activeTab === 'OPERATIONS' ||
                activeTab === 'CALENDAR') && (
                <div className="relative inline-flex items-center flex-shrink-0">
                  <select
                    aria-label="Seleccionar año fiscal"
                    data-testid="year-selector-dropdown"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="appearance-none bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 rounded-lg pl-2.5 pr-6 py-1 text-[11px] sm:text-xs font-extrabold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#083563] transition"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Año {yr}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 pointer-events-none absolute right-1.5" />
                </div>
              )}

              <div
                title={realAuthEmail ? `Conectado como ${realAuthEmail}` : undefined}
                className="hidden md:inline-flex items-center gap-2 bg-slate-100 py-1 px-3 rounded-full border border-slate-200/90 text-xs"
              >
                <ShieldCheck className="w-4 h-4 text-[#083563] flex-shrink-0" />
                <span
                  data-testid="hub-user-name"
                  className="font-extrabold text-slate-800"
                >
                  {user.full_name}
                </span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#083563] text-white">
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                data-testid="hub-signout-btn"
                title={realAuthEmail ? `Salir (${realAuthEmail})` : 'Salir'}
                onClick={() => signOut()}
                className="pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Barra de Navegación Escritorio (md:flex, sin scroll horizontal) */}
          <nav
            aria-label="Navegación principal del panel"
            className="hidden md:flex mt-3 pt-2.5 border-t border-slate-100 items-center justify-between gap-2"
          >
            {/* Secciones Generales: Panel, Calendario, Directorio, Proveedores */}
            <div className="flex items-center gap-2">
              {/* Botón 1: Panel */}
              <button
                type="button"
                data-testid="hub-nav-dashboard"
                onClick={() => {
                  setActiveTab('DASHBOARD');
                  setIsAdminMenuOpen(false);
                }}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-[#072B52] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${activeTab === 'DASHBOARD' ? 'text-sky-300' : 'text-[#083563]'}`} />
                <span>Panel</span>
              </button>

              {/* Botón 2: Calendario */}
              <button
                type="button"
                data-testid="hub-nav-calendar"
                onClick={() => {
                  setCalendarInitialManageMode(false);
                  setCalendarInitialFilter('ALL');
                  setCalendarOnlyPendingLcr(false);
                  setActiveTab('CALENDAR');
                  setIsAdminMenuOpen(false);
                }}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'CALENDAR'
                    ? 'bg-[#072B52] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <Calendar className={`w-4 h-4 ${activeTab === 'CALENDAR' ? 'text-sky-300' : 'text-[#083563]'}`} />
                <span>Calendario</span>
                {hasCalendarAlert && (
                  <span className="inline-flex items-center gap-1">
                    {pendingProposalsCount + pendingLcrCount > 0 && (
                      <span
                        data-testid="nav-pending-count"
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 tabular-nums"
                      >
                        {pendingProposalsCount + pendingLcrCount}
                      </span>
                    )}
                    <span
                      data-testid="admin-calendar-alert-dot"
                      className="relative flex h-2 w-2"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  </span>
                )}
              </button>

              {/* Botón 3: Directorio unificado */}
              <button
                type="button"
                data-testid="hub-nav-directory"
                onClick={() => {
                  setOpenUsersWithIncompleteFilter(false);
                  setActiveTab('DIRECTORY');
                  setIsAdminMenuOpen(false);
                }}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'DIRECTORY'
                    ? 'bg-[#072B52] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'DIRECTORY' ? 'text-sky-300' : 'text-indigo-500'}`} />
                <span>Directorio</span>
                {hasDirectoryAlert && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      data-testid="nav-directory-incomplete-count"
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums"
                    >
                      {incompleteContactsCount}
                    </span>
                    <span
                      data-testid="admin-directory-alert-dot"
                      className="relative flex h-2 w-2"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  </span>
                )}
              </button>

              {/* Botón 4: Proveedores */}
              <button
                type="button"
                data-testid="hub-nav-suppliers"
                onClick={() => {
                  setActiveTab('SUPPLIERS');
                  setIsAdminMenuOpen(false);
                }}
                className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                  activeTab === 'SUPPLIERS'
                    ? 'bg-[#072B52] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <Building2 className={`w-4 h-4 ${activeTab === 'SUPPLIERS' ? 'text-sky-300' : 'text-sky-500'}`} />
                <span>Proveedores</span>
                {userCanManageSuppliers && pendingSuppliersCount > 0 && (
                  <span
                    data-testid="nav-suppliers-pending-count"
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums"
                  >
                    {pendingSuppliersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Desplegable de Administración exclusivo para Presidencia y Admin */}
            {(user.role === 'ADMIN' || user.role === 'PRESIDENCIA') && (
              <div ref={adminMenuRef} className="relative">
                <button
                  type="button"
                  data-testid="hub-admin-menu-trigger"
                  aria-expanded={isAdminMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                  className={`pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
                    activeTab === 'OPERATIONS' ||
                    activeTab === 'LOGS' ||
                    activeTab === 'INFO'
                      ? 'bg-[#083563] text-white shadow-sm ring-2 ring-sky-300/60'
                      : 'bg-sky-50 hover:bg-sky-100 text-[#083563] border border-sky-200/90'
                  }`}
                >
                  <Shield
                    className={`w-3.5 h-3.5 ${
                      activeTab === 'OPERATIONS' ||
                      activeTab === 'LOGS' ||
                      activeTab === 'INFO'
                        ? 'text-sky-300'
                        : 'text-[#083563]'
                    }`}
                  />
                  <span>Administración</span>
                  {hasAnyAdminAlert && (
                    <span
                      data-testid="admin-menu-alert-dot"
                      className="relative flex h-2.5 w-2.5"
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 ring-2 ring-white" />
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isAdminMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isAdminMenuOpen && (
                  <div
                    data-testid="admin-menu-dropdown"
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-fade-in divide-y divide-slate-100"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Secciones de Administración
                    </div>
                    <div className="p-1 space-y-0.5">
                      {/* 1. Finanzas (Centro de Edición y Carga) */}
                      <button
                        type="button"
                        data-testid="hub-admin-operations-btn"
                        onClick={() => {
                          setActiveTab('OPERATIONS');
                          setIsAdminMenuOpen(false);
                        }}
                        className={`pressable w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition text-left ${
                          activeTab === 'OPERATIONS'
                            ? 'bg-[#072B52] text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <FileEdit className={`w-4 h-4 ${activeTab === 'OPERATIONS' ? 'text-sky-300' : 'text-[#083563]'}`} />
                          <span>Finanzas</span>
                        </span>
                        {hasFinanceAlert && (
                          <span
                            data-testid="admin-finance-alert-dot"
                            className="relative flex h-2 w-2"
                          >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                      </button>

                      {/* 5. Historial / Logs (exclusivo Admins) */}
                      {userCanViewLogs && (
                        <button
                          type="button"
                          data-testid="hub-admin-logs-btn"
                          onClick={() => {
                            setActiveTab('LOGS');
                            setIsAdminMenuOpen(false);
                          }}
                          className={`pressable w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition text-left ${
                            activeTab === 'LOGS'
                              ? 'bg-[#072B52] text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <History className="w-4 h-4 text-slate-600" />
                            <span>Historial / Logs</span>
                          </span>
                        </button>
                      )}

                      {/* 6. Información / Normativas (oculta temporalmente, solo visible para Super Admin) */}
                      {userIsSuperAdmin && (
                        <button
                          type="button"
                          data-testid="hub-admin-info-btn"
                          onClick={() => {
                            setActiveTab('INFO');
                            setIsAdminMenuOpen(false);
                          }}
                          className={`pressable w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition text-left ${
                            activeTab === 'INFO'
                              ? 'bg-[#072B52] text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span>Información / Normativas</span>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
              {/* Identidad del usuario conectado en el Drawer móvil (Opción B) */}
              <div className="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200/90 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-[#083563] flex-shrink-0" />
                    <span
                      data-testid="drawer-user-name"
                      className="text-xs font-extrabold text-slate-900 truncate"
                    >
                      {user.full_name}
                    </span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#083563] text-white flex-shrink-0">
                    {user.role}
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
                {/* 1. Panel */}
                <button
                  type="button"
                  data-testid="drawer-nav-dashboard"
                  onClick={() => selectTabAndCloseDrawer('DASHBOARD')}
                  className={`pressable w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'DASHBOARD'
                      ? 'bg-[#072B52] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'DASHBOARD' ? 'text-sky-300' : 'text-[#083563]'}`} />
                  <span>Panel</span>
                </button>

                {/* 2. Calendario unificado */}
                <button
                  type="button"
                  data-testid="drawer-nav-calendar"
                  onClick={() => selectTabAndCloseDrawer('CALENDAR')}
                  className={`pressable w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'CALENDAR'
                      ? 'bg-[#072B52] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Calendar className={`w-4 h-4 flex-shrink-0 ${activeTab === 'CALENDAR' ? 'text-sky-300' : 'text-[#083563]'}`} />
                    <span>Calendario</span>
                  </span>
                  {hasCalendarAlert && (
                    <span className="inline-flex items-center gap-1.5">
                      {pendingProposalsCount + pendingLcrCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 tabular-nums">
                          {pendingProposalsCount + pendingLcrCount}
                        </span>
                      )}
                      <span
                        data-testid="drawer-calendar-alert-dot"
                        className="relative flex h-2 w-2"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    </span>
                  )}
                </button>

                {/* 3. Directorio unificado */}
                <button
                  type="button"
                  data-testid="drawer-nav-directory"
                  onClick={() => selectTabAndCloseDrawer('DIRECTORY')}
                  className={`pressable w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'DIRECTORY'
                      ? 'bg-[#072B52] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Users className={`w-4 h-4 flex-shrink-0 ${activeTab === 'DIRECTORY' ? 'text-sky-300' : 'text-indigo-500'}`} />
                    <span>Directorio</span>
                  </span>
                  {hasDirectoryAlert && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                        {incompleteContactsCount}
                      </span>
                      <span
                        data-testid="drawer-directory-alert-dot"
                        className="relative flex h-2 w-2"
                      >
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    </span>
                  )}
                </button>

                {/* 4. Proveedores */}
                <button
                  type="button"
                  data-testid="drawer-nav-suppliers"
                  onClick={() => selectTabAndCloseDrawer('SUPPLIERS')}
                  className={`pressable w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                    activeTab === 'SUPPLIERS'
                      ? 'bg-[#072B52] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <Building2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'SUPPLIERS' ? 'text-sky-300' : 'text-sky-500'}`} />
                    <span>Proveedores</span>
                  </span>
                  {userCanManageSuppliers && pendingSuppliersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                      {pendingSuppliersCount}
                    </span>
                  )}
                </button>

                {/* Bloque: ADMINISTRACIÓN (exclusivo para Presidencia y Admin) */}
                {(user.role === 'ADMIN' || user.role === 'PRESIDENCIA') && (
                  <div className="pt-2.5 mt-1 border-t border-slate-100">
                    <p className="px-1 mb-2 text-[10px] font-black uppercase tracking-wider text-[#083563]">
                      Administración
                    </p>

                    <div className="space-y-1.5">
                      {/* 1. Finanzas (Operaciones y Carga) */}
                      <button
                        type="button"
                        data-testid="drawer-admin-operations-btn"
                        onClick={() => selectTabAndCloseDrawer('OPERATIONS')}
                        className={`pressable w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                          activeTab === 'OPERATIONS'
                            ? 'bg-[#083563] text-white shadow-sm'
                            : 'bg-sky-50/80 text-[#083563] border border-sky-200/80 hover:bg-sky-100/70'
                        }`}
                      >
                        <span className="inline-flex items-center gap-3">
                          <FileEdit className={`w-4 h-4 flex-shrink-0 ${activeTab === 'OPERATIONS' ? 'text-sky-300' : 'text-[#083563]'}`} />
                          <span>Finanzas</span>
                        </span>
                        {hasFinanceAlert && (
                          <span
                            data-testid="drawer-finance-alert-dot"
                            className="relative flex h-2 w-2"
                          >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                        )}
                      </button>

                      {/* 5. Historial / Logs (exclusivo Admins) */}
                      {userCanViewLogs && (
                        <button
                          type="button"
                          data-testid="drawer-admin-logs-btn"
                          onClick={() => selectTabAndCloseDrawer('LOGS')}
                          className={`pressable w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                            activeTab === 'LOGS'
                              ? 'bg-[#083563] text-white shadow-sm'
                              : 'bg-sky-50/80 text-[#083563] border border-sky-200/80 hover:bg-sky-100/70'
                          }`}
                        >
                          <History className={`w-4 h-4 flex-shrink-0 ${activeTab === 'LOGS' ? 'text-sky-300' : 'text-[#083563]'}`} />
                          <span>Historial / Logs</span>
                        </button>
                      )}

                      {/* 6. Información / Normativas (oculta temporalmente, solo visible para Super Admin) */}
                      {userIsSuperAdmin && (
                        <button
                          type="button"
                          data-testid="drawer-admin-info-btn"
                          onClick={() => selectTabAndCloseDrawer('INFO')}
                          className={`pressable w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-extrabold text-left transition ${
                            activeTab === 'INFO'
                              ? 'bg-[#083563] text-white shadow-sm'
                              : 'bg-sky-50/80 text-[#083563] border border-sky-200/80 hover:bg-sky-100/70'
                          }`}
                        >
                          <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>Información / Normativas</span>
                        </button>
                      )}
                    </div>
                  </div>
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
      <main
        className={`max-w-6xl w-full mx-auto px-4 sm:px-6 flex-1 ${
          activeTab === 'CALENDAR' || activeTab === 'SUPPLIERS' || activeTab === 'DIRECTORY'
            ? 'pt-2 pb-2'
            : 'pt-5 space-y-6'
        }`}
      >
        {activeTab === 'LOGS' && userCanViewLogs ? (
          <AuditLogsPanel />
        ) : activeTab === 'DIRECTORY' ? (
          <LeadersDirectoryView
            canManage={userCanManageUsers}
            initialManageMode={openUsersWithIncompleteFilter}
            initialFilterIncomplete={openUsersWithIncompleteFilter}
          />
        ) : activeTab === 'INFO' && userIsSuperAdmin ? (
          <FinancialInfoSection />
        ) : activeTab === 'OPERATIONS' && (user.role === 'ADMIN' || user.role === 'PRESIDENCIA') ? (
          <AdminOperationsCenter
            selectedYear={selectedYear}
            canEdit={userCanEditFinances}
            budgets={budgets.filter((b) => Number(b.year) === selectedYear)}
            budgetIncomes={budgetIncomes}
            expenses={expenses.filter(
              (e) =>
                getExpenseEffectiveDate(e).startsWith(String(selectedYear)) ||
                e.expense_date.startsWith(String(selectedYear))
            )}
            allExpenses={expenses}
            withdrawals={withdrawals}
            activities={activities}
            suppliers={suppliers}
            onCreateExpense={handleCreateExpense}
            onCreateMultipleExpenses={handleCreateMultipleExpenses}
            onSaveExpenseGroup={handleSaveExpenseGroup}
            onDeleteExpenseGroup={handleDeleteExpenseGroup}
            onCloseActivityWithoutExpense={handleCloseActivityWithoutExpense}
            onReconcileLcrExpense={handleReconcileLcrExpense}
            onReconcileLcrExpenseGroup={handleReconcileLcrExpenseGroup}
            onCreateWithdrawal={handleCreateWithdrawal}
            onCloseWithdrawalInZero={handleCloseWithdrawalInZero}
            onCreateSupplier={handleCreateSupplier}
            onSaveBudgetAllocation={handleSaveBudgetAllocation}
            onSaveOpeningBalance={handleSaveOpeningBalance}
            onSaveQuarterIncomes={handleSaveQuarterIncomes}
            onResetFutureYearProjection={handleResetFutureYearProjection}
          />
        ) : activeTab === 'CALENDAR' ? (
          <CalendarView
            selectedYear={selectedYear}
            activitiesProp={activities}
            expenses={expenses}
            onActivitiesUpdate={setActivities}
            onlyPendingLcr={calendarOnlyPendingLcr}
            onClearPendingLcrFilter={() => {
              setCalendarOnlyPendingLcr(false);
              setCalendarInitialFilter('ALL');
            }}
            canManage={userCanApproveCalendar}
            isSuperAdmin={userIsSuperAdmin}
            initialManageMode={calendarInitialManageMode}
            initialStatusFilter={calendarInitialFilter}
            onOpenCreateModal={() => setIsCreateEventOpen(true)}
            onApproveActivity={handleApproveActivity}
            onRejectActivity={handleRejectActivity}
            onUpdateActivity={handleUpdateApprovedActivity}
            onLinkWithLcrEvent={handleLinkWithLcrEvent}
            onMarkNoLcrRequired={handleMarkNoLcrRequired}
            onDeleteActivity={handleDeleteActivity}
            onCancelActivity={handleCancelActivity}
            embedded
          />
        ) : activeTab === 'SUPPLIERS' ? (
          <SuppliersView
            suppliers={suppliers}
            savedCategories={savedSupplierCategories}
            canManage={user.role === 'ADMIN' || Boolean(user.email && isSuperAdminEmail(user.email))}
            onCreateSupplier={handleCreateSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddCategory={handleAddSupplierCategory}
            onRenameCategory={handleRenameSupplierCategory}
            onDeleteCategory={handleDeleteSupplierCategory}
            onBack={() => setActiveTab('DASHBOARD')}
            embedded
          />
        ) : (
          <>
            {/* 1. TARJETA MAESTRA DE FONDOS (KPI PRINCIPAL) */}
            <section aria-label="Saldo libre estimado y presupuesto">
              <div
                data-testid="kpi-available-balance-card"
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] p-5 sm:p-7 text-white shadow-xl border border-white/10"
              >
                <div className="flex items-stretch justify-between gap-4 sm:gap-7">
                  {/* Columna izquierda: Saldo libre protagonista + Disponible + Comprometido con líneas finas */}
                  <div className="min-w-0 flex-1 divide-y divide-white/12">
                    {/* Protagonista: Saldo libre estimado */}
                    <div className="pb-3.5 sm:pb-4">
                      <p
                        data-testid="kpi-estimated-free-amount"
                        className={`text-3xl sm:text-5xl font-extrabold tracking-tight tabular-nums leading-none ${
                          reservedMetrics.estimatedFreeBalance < 0
                            ? 'text-rose-300'
                            : 'text-white'
                        }`}
                      >
                        {formatCurrency(reservedMetrics.estimatedFreeBalance)}
                      </p>
                      <p
                        data-testid="kpi-estimated-free-label"
                        className={`text-xs sm:text-sm font-medium mt-1.5 ${
                          reservedMetrics.estimatedFreeBalance < 0
                            ? 'text-rose-200/90'
                            : 'text-sky-100/75'
                        }`}
                      >
                        Saldo libre estimado
                      </p>

                      {selectedYear === 2027 &&
                        executiveMetrics.totalConsolidatedAssigned === 0 && (
                          <p
                            data-testid="pending-budget-2027-legend"
                            className="text-xs sm:text-sm text-sky-200/90 font-medium mt-2"
                          >
                            Presupuesto 2027 pendiente de asignación
                          </p>
                        )}
                    </div>

                    {/* Presupuesto disponible actual */}
                    <div className="py-3 sm:py-3.5">
                      <p
                        data-testid="kpi-consolidated-available-amount"
                        className="text-lg sm:text-2xl font-bold tracking-tight tabular-nums text-white leading-tight"
                      >
                        {formatCurrency(executiveMetrics.consolidatedAvailable)}
                      </p>
                      <p className="text-[11px] sm:text-xs font-medium text-sky-100/70 mt-0.5">
                        Presupuesto disponible actual
                      </p>
                    </div>

                    {/* Comprometido en actividades */}
                    <div className="pt-3 sm:pt-3.5">
                      <p
                        data-testid="kpi-reserved-quarter-amount"
                        className="text-lg sm:text-2xl font-bold tracking-tight tabular-nums text-white leading-tight"
                      >
                        {formatCurrency(reservedMetrics.reservedQuarterTotal)}
                      </p>
                      <p className="text-[11px] sm:text-xs font-medium text-sky-100/70 mt-0.5">
                        Comprometido en actividades {reservedMetrics.targetQuarter}
                      </p>
                    </div>
                  </div>

                  {/* Columna derecha: Tabla compacta por organización en la misma paleta limpia */}
                  {reservedMetrics.reservedByOrg.length > 0 && (
                    <div className="flex-shrink-0 border-l border-white/15 pl-3.5 sm:pl-6 self-stretch flex flex-col justify-center">
                      <p
                        data-testid="kpi-reserved-org-title"
                        className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-100/65 mb-2"
                      >
                        En agenda {reservedMetrics.targetQuarter}
                      </p>
                      <table
                        data-testid="kpi-reserved-org-list"
                        aria-label={`En agenda ${reservedMetrics.targetQuarter} por organización`}
                        className="text-[11px] sm:text-xs border-collapse"
                      >
                        <tbody className="divide-y divide-white/10">
                          {reservedMetrics.reservedByOrg.map((item) => (
                            <tr
                              key={item.organization}
                              data-testid={`kpi-reserved-org-${item.organization}`}
                            >
                              <td className="pr-3 sm:pr-5 py-1.5 font-medium text-sky-100/80 whitespace-nowrap">
                                {item.shortLabel}
                              </td>
                              <td className="py-1.5 font-bold text-white tabular-nums text-right whitespace-nowrap">
                                {formatCurrency(item.amount, false)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* POSICIÓN 1 (debajo de PRESUPUESTO DISPONIBLE): GRÁFICA "Asignación de fondos a cada organización" */}
            <OrgDistributionChart orgStats={executiveMetrics.orgStats} />

            {/* POSICIÓN 2: SECCIÓN "Resumen por trimestre" (abierta en PC, acordeón contraído por defecto en móvil) */}
            <section
              aria-label="Resumen por trimestre"
              data-testid="quarterly-rollover-section"
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
            >
              {/* En móvil: botón acordeón limpio solo con título y flecha ▾; en PC: título directo */}
              <button
                type="button"
                data-testid="toggle-quarter-summary-mobile"
                aria-expanded={isQuarterSummaryOpen}
                onClick={() => setIsQuarterSummaryOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 text-left md:cursor-default focus:outline-none"
              >
                <h2 className="text-base font-extrabold text-slate-900">
                  Resumen por trimestre
                </h2>
                <ChevronDown
                  className={`md:hidden w-4 h-4 text-slate-500 transition-transform duration-200 ease-out flex-shrink-0 ${
                    isQuarterSummaryOpen ? 'rotate-180 text-slate-900' : 'rotate-0'
                  }`}
                />
              </button>

              {/* Contenedor animado en móvil y siempre abierto en PC (md:grid-rows-[1fr]) */}
              <div
                data-testid="quarterly-rollover-content"
                className={`grid transition-[grid-template-rows,opacity,margin] duration-250 ease-out ${
                  isQuarterSummaryOpen
                    ? 'grid-rows-[1fr] opacity-100 mt-4'
                    : 'grid-rows-[0fr] opacity-0 mt-0 md:grid-rows-[1fr] md:opacity-100 md:mt-4'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {executiveMetrics.quarters.map((q) => (
                      <div
                        key={q.quarter}
                        data-testid={`hub-quarter-card-${q.quarter}`}
                        className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-block text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-[#072B52] text-white">
                              {q.quarter}
                            </span>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                              Ingreso del trimestre
                            </span>
                          </div>

                          {/* Número principal destacado en grande: Ingreso del trimestre */}
                          <p
                            data-testid={`hub-quarter-income-${q.quarter}`}
                            className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums mt-2.5"
                          >
                            {formatCurrency(q.assigned)}
                          </p>
                        </div>

                        {/* Líneas de detalle debajo en orden exacto:
                            1. Remanente anterior (o Saldo inicial en T1)
                            2. Monto total de fondos (Ingreso + Remanente)
                            3. Gastos del período (con estilo interactivo/subrayado tipo enlace) */}
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-600">
                            <span>
                              {q.quarter === 'T1' ? 'Saldo inicial:' : 'Remanente anterior:'}
                            </span>
                            <span
                              data-testid={`hub-quarter-carryover-${q.quarter}`}
                              className="font-bold text-slate-800 tabular-nums"
                            >
                              {formatCurrency(q.carryOverIn)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600">
                            <span>Monto total de fondos:</span>
                            <span
                              data-testid={`hub-quarter-available-${q.quarter}`}
                              className="font-extrabold text-slate-900 tabular-nums"
                            >
                              {formatCurrency(q.available)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-600 pt-0.5">
                            <span>Gastos del período:</span>
                            <button
                              type="button"
                              data-testid={`hub-quarter-spent-${q.quarter}`}
                              onClick={() => setSelectedQuarterModal(q.quarter)}
                              title={`Ver desglose de gastos de ${q.quarter}`}
                              className="pressable font-extrabold text-rose-700 hover:text-rose-900 underline decoration-rose-400/90 underline-offset-2 tabular-nums transition cursor-pointer"
                            >
                              {formatCurrency(q.spent)}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* POSICIÓN 3: SECCIÓN "Estado por Organización" (Grid en PC, Acordeones compactos en móvil) */}
            <section
              aria-label="Estado por Organización"
              data-testid="organizations-grid-section"
              className="space-y-3 sm:space-y-4"
            >
              <h2 className="text-base font-extrabold text-slate-900">
                Estado por Organización
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
                {executiveMetrics.orgStats.map((stat) => {
                  const isExpanded = Boolean(expandedOrgs[stat.organization]);
                  const todayIso = new Date().toISOString().slice(0, 10);
                  const nextAct = activities
                    .filter(
                      (a) =>
                        a.organization === stat.organization &&
                        a.status === 'APROBADA' &&
                        a.event_date >= todayIso
                    )
                    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];

                  return (
                    <article
                      key={stat.organization}
                      data-testid={`org-card-${stat.organization}`}
                      className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-slate-200/90 hover:border-slate-300 transition flex flex-col justify-between"
                    >
                      {/* Cabecera: en móvil es una fila interactiva [Nombre] ····· [$ Saldo] [▾]; en PC muestra nombre y saldo apilados */}
                      <button
                        type="button"
                        data-testid={`org-accordion-toggle-${stat.organization}`}
                        aria-expanded={isExpanded}
                        onClick={() => toggleOrgAccordion(stat.organization)}
                        className="w-full text-left flex items-center justify-between gap-2 md:block md:cursor-default focus:outline-none"
                      >
                        <h3 className="text-sm font-extrabold text-slate-900 flex-shrink-0">
                          {ORGANIZATION_LABELS[stat.organization]}
                        </h3>

                        {/* Línea punteada conectora solo en móvil */}
                        <span
                          aria-hidden="true"
                          className="md:hidden flex-1 border-b border-dotted border-slate-300 mx-1.5 translate-y-0.5"
                        />

                        <div className="flex items-center gap-2 flex-shrink-0 md:mt-2">
                          <p
                            data-testid={`org-card-available-${stat.organization}`}
                            className={`text-base md:text-2xl font-extrabold tabular-nums ${
                              stat.available < 0 ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {formatCurrency(stat.available)}
                          </p>

                          <ChevronDown
                            className={`md:hidden w-4 h-4 text-slate-500 transition-transform duration-200 ease-out ${
                              isExpanded ? 'rotate-180 text-slate-900' : 'rotate-0'
                            }`}
                          />
                        </div>
                      </button>

                      {/* Cuerpo colapsable en móvil y siempre visible en PC */}
                      <div
                        data-testid={`org-card-body-${stat.organization}`}
                        className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                          isExpanded
                            ? 'grid-rows-[1fr] opacity-100 mt-3'
                            : 'grid-rows-[0fr] opacity-0 mt-0 md:grid-rows-[1fr] md:opacity-100 md:mt-3'
                        }`}
                      >
                        <div className="overflow-hidden flex flex-col justify-between gap-3.5">
                          {/* Próxima actividad (con ícono 💰 si tiene costo estimado) */}
                          <div className="pt-3 border-t border-slate-100 text-xs">
                            {nextAct ? (
                              <div className="flex items-center justify-between gap-2 text-slate-600">
                                <span className="inline-flex items-center gap-1.5 truncate font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-[#083563] flex-shrink-0" />
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

                          {/* Botón plano y sobrio sin íconos: "ABRIR [ORGANIZACIÓN]" */}
                          <button
                            type="button"
                            data-testid={`inspect-org-${stat.organization}`}
                            onClick={() => setInspectedOrg(stat.organization)}
                            className="pressable w-full py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-[#072B52] text-[#072B52] hover:text-white text-xs font-extrabold tracking-wide transition text-center"
                          >
                            {OPEN_ORG_BUTTON_LABELS[stat.organization]}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* MODAL INTERACTIVO DE GASTOS DEL TRIMESTRE (Modal en PC / Bottom Sheet en Móvil con backdrop blur) */}
            {selectedQuarterModal && selectedQuarterSummary && (
              <div
                data-testid="quarter-expenses-modal-backdrop"
                onClick={() => setSelectedQuarterModal(null)}
                className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="quarter-expenses-modal-title"
                  data-testid="quarter-expenses-modal"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full sm:max-w-2xl max-h-[85dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
                >
                  {/* Cabecera: "Gastos de Trimestre [X] · Total: $ [Monto]" y botón de cerrar (✕) */}
                  <div className="px-5 py-4 bg-gradient-to-r from-[#083563] via-[#072B52] to-[#051E3B] text-white flex items-center justify-between gap-3">
                    <h3
                      id="quarter-expenses-modal-title"
                      data-testid="quarter-expenses-modal-title"
                      className="text-sm sm:text-base font-extrabold tracking-tight tabular-nums"
                    >
                      Gastos de Trimestre {selectedQuarterModal} · Total:{' '}
                      {formatCurrency(selectedQuarterSummary.spent)}
                    </h3>
                    <button
                      type="button"
                      data-testid="close-quarter-expenses-modal"
                      aria-label="Cerrar desglose de gastos"
                      onClick={() => setSelectedQuarterModal(null)}
                      className="pressable w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Lista compacta con solo 3 datos esenciales: Monto ($ #.##0,00) | Organización | Propósito o Detalle */}
                  <div className="p-4 pb-16 sm:p-5 overflow-y-auto divide-y divide-slate-100">
                    {selectedQuarterExpenses.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center font-medium">
                        No hay gastos registrados en este trimestre.
                      </p>
                    ) : (
                      selectedQuarterExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          data-testid={`quarter-expense-row-${exp.id}`}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="font-extrabold text-rose-700 tabular-nums flex-shrink-0 w-24 sm:w-28">
                              {formatCurrency(exp.net_amount)}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[11px] flex-shrink-0">
                              {ORGANIZATION_LABELS[exp.organization]}
                            </span>
                            <span className="text-slate-600 font-medium truncate">
                              {exp.concept}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <ProposeActivityModal
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
        userOrg={user.organization}
        canUseSeminario={false}
        mode="DIRECT_CREATE"
        onSubmitProposal={handleCreateDirectActivity}
      />
    </div>
  );
};
