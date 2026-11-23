import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  LayoutGrid,
  Link2,
  List,
  Lock,
  MapPin,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_ACTIVITIES } from '../data/seedData';
import { isSharedYouthActivity } from '../lib/activityFilters';
import {
  isGlobalChurchwideEvent,
  isLcrLinkedActivity,
  matchesDateRange,
} from '../lib/calendarHelpers';
import {
  canViewActivityBudget,
  formatCurrency,
  formatDate,
  isExpenseApplied,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import {
  getLocalLcrSyncMeta,
  isActivityMissingFromLcr,
  isActivityPendingLcr,
  syncLcrCalendarWithShield,
} from '../services/lcrSyncService';
import { ActivityRecord, ExpenseRecord, OrganizationCode } from '../types/database';
import { LcrSyncButton } from '../components/LcrSyncButton';
import { ActivityEditModal, ActivityEditPayload } from '../components/ActivityEditModal';

export type CalendarManageFilter = 'ALL' | 'WAITING_APPROVAL' | 'PENDING_LCR' | 'MISSING_LCR';

type SelectableOrg = Exclude<OrganizationCode, 'TODAS' | 'SEMINARIO'>;

const SELECTABLE_ORGS: Array<{ code: SelectableOrg; label: string; dotClass: string }> = [
  { code: 'ESTACA', label: 'Estaca General', dotClass: 'bg-teal-600' },
  { code: 'CHURCHWIDE', label: 'Churchwide Events', dotClass: 'bg-slate-500' },
  { code: 'MJ', label: ORGANIZATION_LABELS.MJ, dotClass: 'bg-rose-500' },
  { code: 'HJ', label: ORGANIZATION_LABELS.HJ, dotClass: 'bg-blue-500' },
  { code: 'SS', label: ORGANIZATION_LABELS.SS, dotClass: 'bg-purple-500' },
  { code: 'PRIMARIA', label: ORGANIZATION_LABELS.PRIMARIA, dotClass: 'bg-orange-500' },
  { code: 'JAS', label: ORGANIZATION_LABELS.JAS, dotClass: 'bg-sky-500' },
  { code: 'AS', label: ORGANIZATION_LABELS.AS, dotClass: 'bg-indigo-500' },
  { code: 'CFS', label: ORGANIZATION_LABELS.CFS, dotClass: 'bg-yellow-500' },
];

const ORG_CARD_STYLES: Record<OrganizationCode, { bg: string; border: string }> = {
  ESTACA: { bg: 'bg-teal-50/75 hover:bg-teal-50', border: 'border-teal-200/90' },
  MJ: { bg: 'bg-rose-50/75 hover:bg-rose-50', border: 'border-rose-200/90' },
  HJ: { bg: 'bg-blue-50/75 hover:bg-blue-50', border: 'border-blue-200/90' },
  SEMINARIO: {
    bg: 'bg-gradient-to-r from-blue-50/85 to-rose-50/85',
    border: 'border-blue-200/80',
  },
  SS: { bg: 'bg-purple-50/75 hover:bg-purple-50', border: 'border-purple-200/90' },
  PRIMARIA: { bg: 'bg-orange-50/75 hover:bg-orange-50', border: 'border-orange-200/90' },
  JAS: { bg: 'bg-sky-50/75 hover:bg-sky-50', border: 'border-sky-200/90' },
  AS: { bg: 'bg-indigo-50/75 hover:bg-indigo-50', border: 'border-indigo-200/90' },
  CFS: { bg: 'bg-yellow-50/75 hover:bg-yellow-50', border: 'border-yellow-200/90' },
  CHURCHWIDE: { bg: 'bg-slate-100/80 hover:bg-slate-100', border: 'border-slate-300/80' },
  TODAS: { bg: 'bg-slate-50/75', border: 'border-slate-200/90' },
};

function getDefaultSelectedOrgs(
  role: string,
  organization: OrganizationCode
): SelectableOrg[] {
  if (role !== 'LIDER' || organization === 'TODAS') {
    return [];
  }
  if (organization === 'SEMINARIO') {
    return ['HJ', 'MJ'];
  }
  return [organization];
}

interface CalendarViewProps {
  selectedYear?: number;
  activitiesProp?: ActivityRecord[];
  expenses?: ExpenseRecord[];
  onActivitiesUpdate?: (updated: ActivityRecord[]) => void;
  onBack?: () => void;
  onProposeActivity?: () => void;
  proposeButtonLabel?: string;
  embedded?: boolean;
  onlyPendingLcr?: boolean;
  onClearPendingLcrFilter?: () => void;
  // Props opcionales de gestión unificada (Presidencia, Secretarios y Administradores)
  canManage?: boolean;
  isSuperAdmin?: boolean;
  initialManageMode?: boolean;
  initialStatusFilter?: CalendarManageFilter;
  onOpenCreateModal?: () => void;
  onApproveActivity?: (id: number) => Promise<void>;
  onRejectActivity?: (id: number, reason?: string) => Promise<void>;
  onUpdateActivity?: (id: number, updates: ActivityEditPayload) => Promise<{ autoLinked?: boolean; linkedTitle?: string } | void>;
  onLinkWithLcrEvent?: (pendingActivityId: number, lcrActivityId: number) => Promise<void>;
  onMarkNoLcrRequired?: (activityId: number) => Promise<void>;
  onDeleteActivity?: (activityId: number) => Promise<void>;
  onCancelActivity?: (activityId: number) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedYear = new Date().getFullYear(),
  activitiesProp,
  expenses = [],
  onActivitiesUpdate,
  onBack,
  onProposeActivity,
  proposeButtonLabel = 'Proponer Actividad',
  embedded = false,
  onlyPendingLcr = false,
  onClearPendingLcrFilter,
  canManage = false,
  isSuperAdmin = false,
  initialManageMode = false,
  initialStatusFilter = 'ALL',
  onOpenCreateModal,
  onApproveActivity,
  onRejectActivity,
  onUpdateActivity,
  onLinkWithLcrEvent,
  onMarkNoLcrRequired,
  onDeleteActivity,
  onCancelActivity,
}) => {
  const { user } = useAuth();
  const [localActivities, setLocalActivities] = useState<ActivityRecord[]>(
    () => activitiesProp || SEED_ACTIVITIES
  );
  const [selectedOrgs, setSelectedOrgs] = useState<SelectableOrg[]>(() =>
    getDefaultSelectedOrgs(user.role, user.organization)
  );
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filtro por fecha o rango de fechas (disponible para todos los usuarios)
  const [showDateFilter, setShowDateFilter] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Modo Gestión unificado (siempre arranca en Modo Lectura / Tarjetas salvo entrada desde alerta del Dashboard)
  const [isManageMode, setIsManageMode] = useState<boolean>(
    () => Boolean(canManage && (initialManageMode || onlyPendingLcr))
  );
  const [viewMode, setViewMode] = useState<'CARDS' | 'LIST'>('CARDS');
  const [statusFilter, setStatusFilter] = useState<CalendarManageFilter>(() =>
    onlyPendingLcr ? 'PENDING_LCR' : initialStatusFilter
  );
  const [showCancelledOrRejected, setShowCancelledOrRejected] = useState<boolean>(false);

  // Modales y acciones de gestión
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [linkingActivity, setLinkingActivity] = useState<ActivityRecord | null>(null);
  const [linkSearch, setLinkSearch] = useState<string>('');
  const [cancelModalAct, setCancelModalAct] = useState<ActivityRecord | null>(null);
  const [rejectModalAct, setRejectModalAct] = useState<ActivityRecord | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const nextUpcomingCardRef = useRef<HTMLElement | null>(null);
  const nextUpcomingRowRef = useRef<HTMLTableRowElement | null>(null);
  const orgMenuRef = useRef<HTMLDivElement | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Sincronizar con prop externa cuando se provee desde PresidencyHub o LeaderView
  useEffect(() => {
    if (activitiesProp) {
      setLocalActivities(activitiesProp);
    }
  }, [activitiesProp]);

  // Sincronizar entrada desde alertas del Dashboard
  useEffect(() => {
    if (!canManage) {
      setIsManageMode(false);
      setViewMode('CARDS');
      setStatusFilter('ALL');
      return;
    }
    if (onlyPendingLcr) {
      setIsManageMode(true);
      setStatusFilter('PENDING_LCR');
    } else if (initialManageMode) {
      setIsManageMode(true);
      setStatusFilter(initialStatusFilter);
    }
  }, [canManage, initialManageMode, initialStatusFilter, onlyPendingLcr]);

  // Al cambiar de usuario/rol (ej. selector rápido RBAC), posicionar el filtro según el perfil
  useEffect(() => {
    setSelectedOrgs(getDefaultSelectedOrgs(user.role, user.organization));
    setIsOrgMenuOpen(false);
    if (!canManage) {
      setIsManageMode(false);
      setViewMode('CARDS');
      setStatusFilter('ALL');
    }
  }, [user.id, user.role, user.organization, canManage]);

  // Cerrar el menú de organizaciones al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOrgMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setIsOrgMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOrgMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOrgMenuOpen]);

  const handleManualSync = async () => {
    const result = await syncLcrCalendarWithShield({
      currentActivities: localActivities,
      attemptLiveFetch: true,
      bypassDbShield: true,
    });
    setLocalActivities(result.activities);
    if (onActivitiesUpdate) {
      onActivitiesUpdate(result.activities);
    }
    return result;
  };

  const toggleManageMode = () => {
    if (!canManage) return;
    setIsManageMode((prev) => {
      const next = !prev;
      if (!next) {
        setViewMode('CARDS');
        setStatusFilter('ALL');
        setShowCancelledOrRejected(false);
        if (onlyPendingLcr && onClearPendingLcrFilter) {
          onClearPendingLcrFilter();
        }
      }
      return next;
    });
  };

  const referenceToday = new Date().toISOString().slice(0, 10);

  const baseUserOrg: OrganizationCode =
    user.organization === 'TODAS' ? 'ESTACA' : user.organization;

  // IDs de actividades con gastos ya rendidos (bloqueadas salvo Super Admin)
  const renderedExpenseActivityIds = useMemo(() => {
    const set = new Set<number>();
    for (const exp of expenses) {
      if (exp.activity_id && isExpenseApplied(exp)) {
        set.add(exp.activity_id);
      }
    }
    return set;
  }, [expenses]);

  // IDs de eventos que dejaron de aparecer en la última sincronización en vivo con LCR
  const missingFromLcrIds = useMemo(() => {
    const meta = getLocalLcrSyncMeta();
    const set = new Set<number>();
    for (const act of localActivities) {
      if (isActivityMissingFromLcr(act, meta.liveUids, meta.lastSource)) {
        set.add(act.id);
      }
    }
    return set;
  }, [localActivities]);

  // Contadores de gestión (para el botón Gestionar y los filtros rápidos)
  const waitingApprovalCount = useMemo(
    () =>
      localActivities.filter(
        (a) => a.origin === 'propuesta_lider' && a.status === 'PROPUESTA'
      ).length,
    [localActivities]
  );

  const pendingLcrCount = useMemo(
    () => localActivities.filter(isActivityPendingLcr).length,
    [localActivities]
  );

  const missingFromLcrCount = missingFromLcrIds.size;

  const totalAttentionCount =
    waitingApprovalCount + pendingLcrCount + missingFromLcrCount;

  const matchesSelectedOrganizations = (act: ActivityRecord): boolean => {
    if (selectedOrgs.length === 0 || selectedOrgs.length === SELECTABLE_ORGS.length) {
      return true;
    }

    const includesYouth = selectedOrgs.includes('HJ') || selectedOrgs.includes('MJ');

    if (includesYouth && isSharedYouthActivity(act)) {
      return true;
    }

    return selectedOrgs.includes(act.organization as SelectableOrg);
  };

  const canSeePendingLcrBadge = (act: ActivityRecord): boolean => {
    if (!isActivityPendingLcr(act)) return false;
    if (user.role === 'ADMIN' || user.role === 'PRESIDENCIA') return true;
    if (user.role === 'LIDER') {
      if (act.organization === baseUserOrg) return true;
      if (act.organization === 'SEMINARIO' && (baseUserOrg === 'HJ' || baseUserOrg === 'MJ')) {
        return true;
      }
    }
    return false;
  };

  // Lista anual filtrada por año, rango de fechas, estado (en modo gestión), organizaciones y buscador
  const filteredActivities = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const effectiveStatusFilter: CalendarManageFilter =
      canManage && isManageMode ? statusFilter : onlyPendingLcr ? 'PENDING_LCR' : 'ALL';

    return localActivities
      .filter((act) => {
        const isCancelledOrRejected =
          act.status === 'CANCELADA' || act.status === 'RECHAZADA';

        // En Modo Lectura o sin interruptor activo, ocultar canceladas y rechazadas
        if (isCancelledOrRejected) {
          if (!(canManage && isManageMode && showCancelledOrRejected)) {
            return false;
          }
        }

        // Reuniones reservadas (Sumo Consejo, Presidencia de Estaca) solo visibles para Presidencia y Admin
        if (user.role !== 'ADMIN' && user.role !== 'PRESIDENCIA') {
          const text = `${act.title} ${act.description || ''}`.toUpperCase();
          const isStakeCouncil = text.includes('CONSEJO DE ESTACA');
          const isPrivateStakeMeeting =
            !isStakeCouncil &&
            (text.includes('SUMO CONSEJO') ||
              text.includes('HIGH COUNCIL') ||
              text.includes('PRESIDENCIA DE ESTACA') ||
              text.includes('STAKE PRESIDENCY') ||
              text.includes('REUNIÓN DE PRESIDENCIA') ||
              text.includes('REUNION DE PRESIDENCIA'));
          if (isPrivateStakeMeeting) return false;
        }

        // Filtros rápidos de estado (solo en Modo Gestión o alerta Pendientes LCR)
        if (effectiveStatusFilter === 'WAITING_APPROVAL') {
          if (!(act.origin === 'propuesta_lider' && act.status === 'PROPUESTA')) {
            return false;
          }
        } else if (effectiveStatusFilter === 'PENDING_LCR') {
          if (!isActivityPendingLcr(act)) return false;
        } else if (effectiveStatusFilter === 'MISSING_LCR') {
          if (!missingFromLcrIds.has(act.id)) return false;
        } else {
          // Filtro de año cuando no estamos mirando una cola transversal de atención
          if (!dateFrom && !dateTo && !act.event_date.startsWith(String(selectedYear))) {
            return false;
          }
        }

        // Filtro por rango de fechas (Desde / Hasta)
        if ((dateFrom || dateTo) && !matchesDateRange(act.event_date, dateFrom, dateTo)) {
          return false;
        }

        if (!matchesSelectedOrganizations(act)) return false;

        // Buscador en tiempo real por título, lugar, notas u organización
        if (normalizedQuery.length > 0) {
          const matchesTitle = act.title.toLowerCase().includes(normalizedQuery);
          const matchesLocation = (act.location || '').toLowerCase().includes(normalizedQuery);
          const matchesNotes = (act.app_notes || '').toLowerCase().includes(normalizedQuery);
          const matchesOrg =
            (ORGANIZATION_LABELS[act.organization] || '').toLowerCase().includes(normalizedQuery) ||
            (ORGANIZATION_SHORT_LABELS[act.organization] || '').toLowerCase().includes(normalizedQuery);
          if (!matchesTitle && !matchesLocation && !matchesNotes && !matchesOrg) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [
    localActivities,
    selectedYear,
    selectedOrgs,
    searchQuery,
    dateFrom,
    dateTo,
    canManage,
    isManageMode,
    statusFilter,
    showCancelledOrRejected,
    onlyPendingLcr,
    missingFromLcrIds,
    user.role,
  ]);

  // Eventos oficiales de LCR candidatos para vincular manualmente con un evento pendiente
  const lcrCandidateEvents = useMemo(() => {
    if (!linkingActivity) return [];
    const q = linkSearch.trim().toLowerCase();
    return localActivities
      .filter((a) => {
        if (a.id === linkingActivity.id) return false;
        if (a.status !== 'APROBADA') return false;
        if (!isLcrLinkedActivity(a)) return false;
        if (q) {
          return (
            a.title.toLowerCase().includes(q) ||
            a.event_date.includes(q) ||
            (a.location || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Priorizar los más cercanos en fecha al evento pendiente
        const diffA = Math.abs(
          Date.parse(a.event_date) - Date.parse(linkingActivity.event_date)
        );
        const diffB = Math.abs(
          Date.parse(b.event_date) - Date.parse(linkingActivity.event_date)
        );
        if (!Number.isNaN(diffA) && !Number.isNaN(diffB) && diffA !== diffB) {
          return diffA - diffB;
        }
        return a.event_date.localeCompare(b.event_date);
      });
  }, [localActivities, linkingActivity, linkSearch]);

  // ID del evento más próximo a la fecha actual para auto-enfoque
  const firstUpcomingId = useMemo(() => {
    const found = filteredActivities.find((a) => a.event_date >= referenceToday);
    return found ? found.id : null;
  }, [filteredActivities, referenceToday]);

  // Auto-enfoque / scroll suave al evento más próximo a la fecha actual
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = listScrollRef.current;
      const target =
        isManageMode && viewMode === 'LIST'
          ? nextUpcomingRowRef.current
          : nextUpcomingCardRef.current;
      if (container && target) {
        container.scrollTo({
          top: Math.max(0, target.offsetTop - (viewMode === 'LIST' ? 40 : 0)),
          behavior: 'smooth',
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedOrgs, selectedYear, firstUpcomingId, viewMode, statusFilter]);

  const toggleOrg = (code: SelectableOrg) => {
    setSelectedOrgs((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const orgFilterLabel = useMemo(() => {
    if (selectedOrgs.length === 0 || selectedOrgs.length === SELECTABLE_ORGS.length) {
      return 'Todas las organizaciones';
    }
    if (selectedOrgs.length === 1) {
      const found = SELECTABLE_ORGS.find((o) => o.code === selectedOrgs[0]);
      return found ? found.label : ORGANIZATION_LABELS[selectedOrgs[0]];
    }
    if (
      selectedOrgs.length === 2 &&
      selectedOrgs.includes('HJ') &&
      selectedOrgs.includes('MJ')
    ) {
      return 'Jóvenes (HJ + MJ)';
    }
    return `${selectedOrgs.length} organizaciones`;
  }, [selectedOrgs]);

  const canSeeYouthQuickFilter =
    user.role === 'ADMIN' ||
    user.role === 'PRESIDENCIA' ||
    baseUserOrg === 'HJ' ||
    baseUserOrg === 'MJ';

  const isOrgFiltered =
    selectedOrgs.length > 0 && selectedOrgs.length < SELECTABLE_ORGS.length;
  const hasDateFilter = Boolean(dateFrom || dateTo);

  const handleSaveEdit = async (id: number, updates: ActivityEditPayload) => {
    if (!onUpdateActivity) return;
    const result = await onUpdateActivity(id, updates);
    if (result && result.autoLinked) {
      showFeedback(
        `Actividad vinculada automáticamente con "${result.linkedTitle || updates.title}" en LCR.`
      );
    } else {
      showFeedback('Cambios guardados en la actividad.');
    }
  };

  const handleClearAllFilters = () => {
    setSelectedOrgs([]);
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('ALL');
    setShowCancelledOrRejected(false);
    if (onlyPendingLcr && onClearPendingLcrFilter) {
      onClearPendingLcrFilter();
    }
  };

  return (
    <section
      data-testid="calendar-general-view"
      className={
        embedded
          ? 'space-y-2.5'
          : 'max-w-5xl mx-auto px-4 sm:px-6 pt-2 sm:pt-3 pb-6 space-y-3'
      }
    >
      {/* Marco superior unificado */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
        {/* Fila 1: Título + Interruptor Gestionar (solo con permiso) + Sincronizar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                type="button"
                data-testid="calendar-view-back-btn"
                onClick={onBack}
                className="pressable inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex-shrink-0"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                Calendario {selectedYear}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                data-testid="calendar-manage-toggle"
                aria-pressed={isManageMode}
                onClick={toggleManageMode}
                className={`pressable h-[34px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold transition ${
                  isManageMode
                    ? 'bg-[#072B52] text-white shadow-sm'
                    : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{isManageMode ? 'Gestionando' : 'Gestionar'}</span>
                {!isManageMode && totalAttentionCount > 0 && (
                  <span
                    data-testid="calendar-manage-attention-badge"
                    className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold tabular-nums animate-pulse"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {totalAttentionCount}
                  </span>
                )}
              </button>
            )}
            <LcrSyncButton onSync={handleManualSync} />
          </div>
        </div>

        {/* Fila 2: Selector multi-organización + Fechas + Botón Proponer/Crear + Buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            {/* Selector desplegable multi-organización */}
            <div ref={orgMenuRef} className="relative flex-1 sm:flex-none sm:w-56 min-w-0">
              <button
                type="button"
                data-testid="calendar-org-filter-trigger"
                aria-haspopup="listbox"
                aria-expanded={isOrgMenuOpen}
                onClick={() => setIsOrgMenuOpen((prev) => !prev)}
                className={`w-full h-[34px] flex items-center justify-between gap-2 rounded-xl px-3 text-xs font-bold shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 transition ${
                  isOrgFiltered
                    ? 'bg-slate-100 border border-slate-700 text-slate-900'
                    : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <SlidersHorizontal
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isOrgFiltered ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{orgFilterLabel}</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${
                    isOrgMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOrgMenuOpen && (
                <div
                  data-testid="calendar-org-filter-popover"
                  className="absolute left-0 w-[min(calc(100vw-3rem),18rem)] sm:w-72 mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg p-2.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      data-testid="calendar-filter-all"
                      onClick={() => {
                        setSelectedOrgs([]);
                        setIsOrgMenuOpen(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                        selectedOrgs.length === 0 ||
                        selectedOrgs.length === SELECTABLE_ORGS.length
                          ? 'bg-[#072B52] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Todas
                    </button>
                    {canSeeYouthQuickFilter && (
                      <button
                        type="button"
                        data-testid="calendar-filter-jovenes"
                        onClick={() => {
                          setSelectedOrgs(['HJ', 'MJ']);
                          setIsOrgMenuOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          selectedOrgs.length === 2 &&
                          selectedOrgs.includes('HJ') &&
                          selectedOrgs.includes('MJ')
                            ? 'bg-[#072B52] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Jóvenes (HJ + MJ)
                      </button>
                    )}
                    {user.role === 'LIDER' && (
                      <button
                        type="button"
                        data-testid="calendar-filter-mine"
                        onClick={() => {
                          setSelectedOrgs(getDefaultSelectedOrgs(user.role, user.organization));
                          setIsOrgMenuOpen(false);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      >
                        Solo mi org
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                    {SELECTABLE_ORGS.map((org) => {
                      const checked = selectedOrgs.includes(org.code);
                      return (
                        <label
                          key={org.code}
                          data-testid={`calendar-filter-org-${org.code}`}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOrg(org.code)}
                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                          />
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${org.dotClass}`} />
                          <span className="truncate">{org.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Botón compacto de filtro por Fechas */}
            <button
              type="button"
              data-testid="calendar-date-filter-toggle"
              onClick={() => setShowDateFilter((prev) => !prev)}
              className={`h-[34px] inline-flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-bold transition flex-shrink-0 ${
                hasDateFilter || showDateFilter
                  ? 'bg-slate-100 border border-slate-700 text-slate-900'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Filtrar por fecha o rango de fechas"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Fechas</span>
              {hasDateFilter && <span className="w-1.5 h-1.5 rounded-full bg-[#083563]" />}
            </button>

            {/* Botón + Proponer Actividad (Líderes en modo lectura) */}
            {!canManage && onProposeActivity && (
              <button
                type="button"
                data-testid="calendar-propose-btn"
                onClick={onProposeActivity}
                className="pressable h-[34px] inline-flex items-center gap-1.5 bg-[#083563] hover:bg-[#072B52] text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 rounded-xl shadow-sm flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex flex-col sm:flex-row sm:gap-1 items-start sm:items-center leading-[1.1] sm:leading-4 text-left">
                  {proposeButtonLabel.split(' ').map((word, idx) => (
                    <span key={idx}>{word}</span>
                  ))}
                </span>
              </button>
            )}

            {/* Botón + Crear Evento (Presidencia / Secretarios / Admin dentro de Gestionar) */}
            {canManage && isManageMode && onOpenCreateModal && (
              <button
                type="button"
                data-testid="cal-ctrl-create-event-btn"
                onClick={onOpenCreateModal}
                className="pressable h-[34px] inline-flex items-center gap-1.5 bg-[#083563] hover:bg-[#072B52] text-white text-xs font-bold px-3 rounded-xl shadow-sm flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Crear Evento</span>
              </button>
            )}
          </div>

          {/* Buscador en tiempo real por nombre, lugar, notas u organización */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="calendar-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actividad, lugar o nota..."
              aria-label="Buscar actividad, lugar o nota"
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                data-testid="calendar-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Fila desplegable: Filtro por rango de fechas (Desde / Hasta) */}
        {(showDateFilter || hasDateFilter) && (
          <div
            data-testid="calendar-date-range-bar"
            className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs"
          >
            <span className="text-[11px] font-bold text-slate-500">Rango:</span>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">Desde</span>
              <input
                type="date"
                data-testid="calendar-date-from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">Hasta</span>
              <input
                type="date"
                data-testid="calendar-date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </label>
            {hasDateFilter && (
              <button
                type="button"
                data-testid="calendar-date-clear"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Limpiar fechas
              </button>
            )}
          </div>
        )}

        {/* Fila 3 (solo en Modo Gestión): Selector Tarjetas/Lista + Filtros rápidos de estado + Interruptor Canceladas */}
        {canManage && isManageMode && (
          <div
            data-testid="calendar-manage-bar"
            className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
          >
            {/* Filtros rápidos de estado */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="cal-filter-all"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  statusFilter === 'ALL'
                    ? 'bg-[#072B52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todas
              </button>

              <button
                type="button"
                data-testid="cal-filter-waiting"
                onClick={() => setStatusFilter('WAITING_APPROVAL')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1.5 ${
                  statusFilter === 'WAITING_APPROVAL'
                    ? 'bg-[#072B52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Esperando aprobación</span>
                {waitingApprovalCount > 0 && (
                  <span className="inline-flex items-center gap-1 animate-pulse">
                    <span
                      className={`text-[10px] font-extrabold tabular-nums ${
                        statusFilter === 'WAITING_APPROVAL' ? 'text-amber-300' : 'text-amber-700'
                      }`}
                    >
                      {waitingApprovalCount}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="cal-filter-pending-lcr"
                onClick={() => setStatusFilter('PENDING_LCR')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1.5 ${
                  statusFilter === 'PENDING_LCR'
                    ? 'bg-[#072B52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Pendientes en LCR</span>
                {pendingLcrCount > 0 && (
                  <span
                    className={`text-[10px] font-extrabold tabular-nums ${
                      statusFilter === 'PENDING_LCR' ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  >
                    {pendingLcrCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="cal-filter-missing-lcr"
                onClick={() => setStatusFilter('MISSING_LCR')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1.5 ${
                  statusFilter === 'MISSING_LCR'
                    ? 'bg-[#072B52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Quitadas de LCR</span>
                {missingFromLcrCount > 0 && (
                  <span
                    className={`text-[10px] font-extrabold tabular-nums ${
                      statusFilter === 'MISSING_LCR' ? 'text-amber-300' : 'text-amber-700'
                    }`}
                  >
                    {missingFromLcrCount}
                  </span>
                )}
              </button>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="cal-toggle-cancelled"
                  checked={showCancelledOrRejected}
                  onChange={(e) => setShowCancelledOrRejected(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span>Canceladas / Rechazadas</span>
              </label>
            </div>

            {/* Selector Tarjetas / Lista */}
            <div
              data-testid="calendar-view-mode-switcher"
              className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80"
            >
              <button
                type="button"
                data-testid="calendar-mode-cards-btn"
                onClick={() => setViewMode('CARDS')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
              <button
                type="button"
                data-testid="calendar-mode-list-btn"
                onClick={() => setViewMode('LIST')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  viewMode === 'LIST'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Banner de confirmación tras acción */}
      {feedbackBanner && (
        <div
          data-testid="calendar-feedback-banner"
          role="status"
          className="px-4 py-3 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-sm border border-emerald-700 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Marco principal de actividades */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-card">
        {filteredActivities.length === 0 ? (
          <div
            data-testid="calendar-empty-state"
            className="py-10 text-center space-y-2.5 text-slate-400"
          >
            <p className="text-sm font-bold text-slate-600">
              No se encontraron actividades para este filtro
            </p>
            <p className="text-xs">
              Prueba cambiando el filtro, las fechas o limpiando el texto de búsqueda.
            </p>
            {(isOrgFiltered || hasDateFilter || searchQuery || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3.5 py-1.5 rounded-xl bg-[#072B52] text-white text-xs font-bold hover:bg-[#083563] transition"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : canManage && isManageMode && viewMode === 'LIST' ? (
          /* ===================== MODO LISTA (solo dentro de Gestionar) ===================== */
          <div
            ref={listScrollRef}
            data-testid="calendar-list-view-container"
            className="overflow-x-auto max-h-[calc(100dvh-300px)] min-h-[320px] overflow-y-auto"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Horario</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Org.</th>
                  <th className="py-2.5 px-3">Actividad</th>
                  <th className="py-2.5 px-3 max-w-[150px]">Lugar</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Monto</th>
                  <th className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => {
                  const isPast = act.event_date < referenceToday;
                  const isNextUpcoming = act.id === firstUpcomingId;
                  const isGlobal = isGlobalChurchwideEvent(act);
                  const isPendingLcr = isActivityPendingLcr(act);
                  const isMissingLcr = missingFromLcrIds.has(act.id);
                  const isProposal = act.origin === 'propuesta_lider' && act.status === 'PROPUESTA';
                  const hasRendered = renderedExpenseActivityIds.has(act.id);
                  const isLocked = hasRendered && !isSuperAdmin;
                  const isBusy = busyId === act.id;

                  return (
                    <tr
                      key={act.id}
                      ref={isNextUpcoming ? nextUpcomingRowRef : null}
                      data-testid={`calendar-list-row-${act.id}`}
                      className={`transition ${
                        isPast
                          ? 'bg-slate-50/60 opacity-65'
                          : isNextUpcoming
                          ? 'bg-emerald-50/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-700 font-semibold tabular-nums whitespace-nowrap">
                        {formatDate(act.event_date)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 tabular-nums whitespace-nowrap">
                        {act.start_time
                          ? act.end_time
                            ? `${act.start_time} - ${act.end_time}`
                            : act.start_time
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isProposal ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Esperando aprobación
                          </span>
                        ) : act.status === 'CANCELADA' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                            Cancelada
                          </span>
                        ) : act.status === 'RECHAZADA' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            Rechazada
                          </span>
                        ) : isMissingLcr ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            No está en LCR
                          </span>
                        ) : isPendingLcr ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Pendiente LCR
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {isLcrLinkedActivity(act) ? 'LCR' : 'Aprobada'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {ORGANIZATION_SHORT_LABELS[act.organization]}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{act.title}</div>
                        {act.app_notes && (
                          <div className="text-[11px] text-emerald-800 mt-0.5 line-clamp-1">
                            Nota: {act.app_notes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={act.location}>
                        {act.location}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                        {act.estimated_cost > 0 ? formatCurrency(act.estimated_cost) : '—'}
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">
                        {isGlobal ? (
                          <span className="text-[10px] font-semibold text-slate-400">
                            Evento global
                          </span>
                        ) : isProposal ? (
                          <div className="inline-flex items-center gap-1">
                            {onApproveActivity && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(act.id);
                                  try {
                                    await onApproveActivity(act.id);
                                    showFeedback(`Actividad "${act.title}" aprobada.`);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                            )}
                            {onUpdateActivity && (
                              <button
                                type="button"
                                onClick={() => setEditingActivity(act)}
                                title="Editar propuesta"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onRejectActivity && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModalAct(act);
                                  setRejectReason('');
                                }}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition"
                              >
                                Rechazar
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            {isPendingLcr && onLinkWithLcrEvent && (
                              <button
                                type="button"
                                data-testid={`link-lcr-btn-${act.id}`}
                                onClick={() => {
                                  setLinkingActivity(act);
                                  setLinkSearch('');
                                }}
                                className="px-2 py-1 rounded-lg bg-[#072B52] hover:bg-[#083563] text-white text-[11px] font-bold inline-flex items-center gap-1 transition"
                              >
                                <Link2 className="w-3 h-3" />
                                <span>Vincular</span>
                              </button>
                            )}
                            {onUpdateActivity && (
                              <button
                                type="button"
                                data-testid={`edit-activity-btn-${act.id}`}
                                disabled={isLocked}
                                onClick={() => setEditingActivity(act)}
                                title={
                                  isLocked
                                    ? 'Bloqueado: tiene gastos rendidos (solo Super Admin)'
                                    : 'Editar actividad'
                                }
                                className={`p-1.5 rounded-lg transition ${
                                  isLocked
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                              >
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Edit3 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            {(onDeleteActivity || onCancelActivity || onMarkNoLcrRequired) && (
                              <button
                                type="button"
                                data-testid={`cancel-action-btn-${act.id}`}
                                onClick={() => setCancelModalAct(act)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                                  isMissingLcr
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                Opciones
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ===================== MODO TARJETAS (defecto en Lectura y Gestión) ===================== */
          <div
            ref={listScrollRef}
            data-testid="calendar-view-scroll-container"
            className={`relative overflow-y-auto scroll-smooth pr-1 space-y-2.5 ${
              embedded ? 'max-h-[480px]' : 'max-h-[calc(100dvh-255px)] min-h-[320px]'
            }`}
          >
            {filteredActivities.map((act) => {
              const isPast = act.event_date < referenceToday;
              const isNextUpcoming = act.id === firstUpcomingId;
              const isGlobal = isGlobalChurchwideEvent(act);
              const isPendingLcr = isActivityPendingLcr(act);
              const isMissingLcr = missingFromLcrIds.has(act.id);
              const isProposal = act.origin === 'propuesta_lider' && act.status === 'PROPUESTA';
              const hasRendered = renderedExpenseActivityIds.has(act.id);
              const isLocked = hasRendered && !isSuperAdmin;
              const isBusy = busyId === act.id;
              const canSeeCost = canViewActivityBudget(
                user.role,
                baseUserOrg,
                act.organization
              );
              const cardStyle = ORG_CARD_STYLES[act.organization] || ORG_CARD_STYLES.TODAS;

              return (
                <article
                  key={act.id}
                  ref={isNextUpcoming ? nextUpcomingCardRef : null}
                  data-testid={`calendar-event-card-${act.organization}`}
                  data-event-title={act.title}
                  data-past={isPast ? 'true' : 'false'}
                  data-upcoming-anchor={isNextUpcoming ? 'true' : 'false'}
                  className={`p-4 rounded-2xl transition space-y-2 ${
                    act.status === 'CANCELADA' || act.status === 'RECHAZADA'
                      ? 'border border-slate-200 bg-slate-50 opacity-70'
                      : isProposal
                      ? 'bg-white border-2 border-amber-300/90 shadow-xs'
                      : isPast
                      ? 'border border-slate-200/60 bg-slate-100/60 opacity-65'
                      : isNextUpcoming
                      ? `${cardStyle.bg} border-2 border-slate-900 upcoming-card-pulse shadow-sm`
                      : `${cardStyle.bg} border ${cardStyle.border}`
                  }`}
                >
                  {/* Fila superior: Organización a la izquierda + Estados a la derecha */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/85 text-slate-800 border border-slate-200/80">
                      {ORGANIZATION_SHORT_LABELS[act.organization]}
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canManage && isManageMode && isMissingLcr && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          No está en LCR
                        </span>
                      )}

                      {canSeePendingLcrBadge(act) && (
                        <span
                          data-testid="calendar-pending-lcr-badge"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                        >
                          Pendiente en LCR
                        </span>
                      )}

                      {act.status === 'CANCELADA' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                          Cancelada
                        </span>
                      ) : act.status === 'RECHAZADA' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                          Rechazada
                        </span>
                      ) : isPast ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                          Realizada
                        </span>
                      ) : isNextUpcoming ? (
                        <span
                          data-testid="calendar-view-upcoming-badge"
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-white"
                        >
                          Próxima actividad
                        </span>
                      ) : isProposal ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                          Esperando aprobación
                        </span>
                      ) : !canSeePendingLcrBadge(act) ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                          {isLcrLinkedActivity(act) ? 'Aprobada LCR' : 'Aprobada'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Título, descripción oficial LCR y notas complementarias */}
                  <div className="space-y-1">
                    <h3
                      className={`text-sm font-extrabold ${
                        isPast ? 'text-slate-600' : 'text-slate-900'
                      }`}
                    >
                      {act.title}
                    </h3>

                    {act.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {act.description}
                      </p>
                    )}

                    {act.app_notes &&
                      act.app_notes.trim() !== (act.description || '').trim() && (
                        <p
                          data-testid={`calendar-app-notes-${act.id}`}
                          className="text-xs text-emerald-900 bg-white/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5"
                        >
                          <span className="font-bold">Nota: </span>
                          {act.app_notes}
                        </p>
                      )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(act.event_date)}
                      </span>
                      {act.start_time && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {act.start_time}
                          {act.end_time ? ` - ${act.end_time}` : ''} hs
                        </span>
                      )}
                      {act.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {act.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pie de tarjeta: Acciones de gestión (si Gestionar está activo y no es global) + Costo Estimado */}
                  <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
                    {canManage && isManageMode && !isGlobal ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isProposal ? (
                          <>
                            {onApproveActivity && (
                              <button
                                type="button"
                                data-testid={`approve-proposal-btn-${act.id}`}
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(act.id);
                                  try {
                                    await onApproveActivity(act.id);
                                    showFeedback(`Actividad "${act.title}" aprobada.`);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprobar</span>
                              </button>
                            )}
                            {onUpdateActivity && (
                              <button
                                type="button"
                                data-testid={`edit-activity-btn-${act.id}`}
                                onClick={() => setEditingActivity(act)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            )}
                            {onRejectActivity && (
                              <button
                                type="button"
                                data-testid={`reject-proposal-btn-${act.id}`}
                                onClick={() => {
                                  setRejectModalAct(act);
                                  setRejectReason('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Rechazar</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {onUpdateActivity && (
                              <button
                                type="button"
                                data-testid={`edit-activity-btn-${act.id}`}
                                disabled={isLocked}
                                onClick={() => setEditingActivity(act)}
                                title={
                                  isLocked
                                    ? 'Bloqueado: tiene gastos rendidos (solo Super Admin)'
                                    : 'Editar actividad'
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                                  isLocked
                                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Edit3 className="w-3.5 h-3.5" />
                                )}
                                <span>Editar</span>
                              </button>
                            )}

                            {isPendingLcr && onLinkWithLcrEvent && (
                              <button
                                type="button"
                                data-testid={`link-lcr-btn-${act.id}`}
                                onClick={() => {
                                  setLinkingActivity(act);
                                  setLinkSearch('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#072B52] hover:bg-[#083563] text-white text-[11px] font-bold transition"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>Vincular con LCR</span>
                              </button>
                            )}

                            {isPendingLcr && onMarkNoLcrRequired && (
                              <button
                                type="button"
                                data-testid={`no-lcr-btn-${act.id}`}
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(act.id);
                                  try {
                                    await onMarkNoLcrRequired(act.id);
                                    showFeedback('Actividad marcada como "No requiere LCR".');
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>No requiere LCR</span>
                              </button>
                            )}

                            {(onDeleteActivity || onCancelActivity || onMarkNoLcrRequired) && (
                              <button
                                type="button"
                                data-testid={`cancel-action-btn-${act.id}`}
                                onClick={() => setCancelModalAct(act)}
                                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                                  isMissingLcr
                                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                Opciones
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {canSeeCost && act.has_budget && act.estimated_cost > 0 && (
                      <div
                        data-testid="calendar-confidential-budget-amount"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-right ml-auto"
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700/80">
                          Costo Estimado
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-900 tabular-nums">
                          {formatCurrency(act.estimated_cost)}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal unificado de edición */}
      <ActivityEditModal
        activity={editingActivity}
        allActivities={localActivities}
        isLocked={
          editingActivity
            ? renderedExpenseActivityIds.has(editingActivity.id) && !isSuperAdmin
            : false
        }
        onClose={() => setEditingActivity(null)}
        onSave={handleSaveEdit}
      />

      {/* Modal: Vincular manualmente con evento de LCR */}
      {linkingActivity && onLinkWithLcrEvent && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => busyId === null && setLinkingActivity(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            data-testid="link-lcr-modal"
            className="bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[85dvh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-extrabold text-slate-900">
                  Vincular con evento de LCR
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {linkingActivity.title} ({formatDate(linkingActivity.event_date)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinkingActivity(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-600">
                Elige el evento equivalente de LCR. Se adoptarán el nombre, fecha, horario y lugar oficiales de LCR y se conservarán tu organización, presupuesto y notas.
              </p>

              <input
                type="text"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Buscar evento de LCR por nombre, fecha o lugar..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />

              {lcrCandidateEvents.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No se encontraron eventos de LCR con ese filtro.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {lcrCandidateEvents.slice(0, 25).map((cand) => (
                    <div
                      key={cand.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{cand.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(cand.event_date)} • {cand.location}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === linkingActivity.id}
                        onClick={async () => {
                          setBusyId(linkingActivity.id);
                          try {
                            await onLinkWithLcrEvent(linkingActivity.id, cand.id);
                            showFeedback(`Vinculada con "${cand.title}" de LCR.`);
                            setLinkingActivity(null);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#072B52] text-white font-bold hover:bg-[#083563] shrink-0 disabled:opacity-50"
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Opciones de Cancelar / Eliminar / Mantener */}
      {cancelModalAct && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => busyId === null && setCancelModalAct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            data-testid="cancel-activity-modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Gestionar evento</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cancelModalAct.title} ({formatDate(cancelModalAct.event_date)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalAct(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Este evento ya tiene gastos rendidos. No se puede eliminar ni cancelar (solo el Super Admin puede hacerlo).
                </span>
              </div>
            )}

            <div className="space-y-2">
              {onDeleteActivity && (
                <button
                  type="button"
                  disabled={
                    busyId === cancelModalAct.id ||
                    (renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin)
                  }
                  onClick={async () => {
                    setBusyId(cancelModalAct.id);
                    try {
                      await onDeleteActivity(cancelModalAct.id);
                      showFeedback('Actividad eliminada.');
                      setCancelModalAct(null);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  1. Eliminar definitivamente
                </button>
              )}

              {onCancelActivity && (
                <button
                  type="button"
                  disabled={
                    busyId === cancelModalAct.id ||
                    (renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin)
                  }
                  onClick={async () => {
                    setBusyId(cancelModalAct.id);
                    try {
                      await onCancelActivity(cancelModalAct.id);
                      showFeedback('Actividad marcada como Cancelada.');
                      setCancelModalAct(null);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  2. Marcar como Cancelada (conserva el historial)
                </button>
              )}

              {onMarkNoLcrRequired && (
                <button
                  type="button"
                  disabled={busyId === cancelModalAct.id}
                  onClick={async () => {
                    setBusyId(cancelModalAct.id);
                    try {
                      await onMarkNoLcrRequired(cancelModalAct.id);
                      showFeedback('Actividad mantenida en el calendario.');
                      setCancelModalAct(null);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition disabled:opacity-45"
                >
                  3. Mantener en el calendario (sin vínculo LCR)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rechazar propuesta con motivo opcional */}
      {rejectModalAct && onRejectActivity && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => busyId === null && setRejectModalAct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Rechazar propuesta</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {rejectModalAct.title} ({ORGANIZATION_SHORT_LABELS[rejectModalAct.organization]})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalAct(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo u observación para el líder (opcional)..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalAct(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busyId === rejectModalAct.id}
                onClick={async () => {
                  setBusyId(rejectModalAct.id);
                  try {
                    await onRejectActivity(
                      rejectModalAct.id,
                      rejectReason.trim() || 'Observada por Presidencia'
                    );
                    showFeedback(`Propuesta "${rejectModalAct.title}" marcada como rechazada.`);
                    setRejectModalAct(null);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
