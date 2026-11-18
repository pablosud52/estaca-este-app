import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Clock,
  EyeOff,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_ACTIVITIES } from '../data/seedData';
import {
  canViewActivityBudget,
  formatCurrency,
  formatDate,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import { syncLcrCalendarWithShield } from '../services/lcrSyncService';
import { ActivityRecord, OrganizationCode } from '../types/database';
import { LcrSyncButton } from '../components/LcrSyncButton';

type SelectableOrg = Exclude<OrganizationCode, 'TODAS' | 'SEMINARIO'>;

const SELECTABLE_ORGS: Array<{ code: SelectableOrg; label: string; dotClass: string }> = [
  { code: 'ESTACA', label: 'Estaca General', dotClass: 'bg-slate-500' },
  { code: 'MJ', label: ORGANIZATION_LABELS.MJ, dotClass: 'bg-rose-500' },
  { code: 'HJ', label: ORGANIZATION_LABELS.HJ, dotClass: 'bg-blue-500' },
  { code: 'SS', label: ORGANIZATION_LABELS.SS, dotClass: 'bg-purple-500' },
  { code: 'PRIMARIA', label: ORGANIZATION_LABELS.PRIMARIA, dotClass: 'bg-orange-500' },
  { code: 'JAS', label: ORGANIZATION_LABELS.JAS, dotClass: 'bg-sky-500' },
  { code: 'AS', label: ORGANIZATION_LABELS.AS, dotClass: 'bg-indigo-500' },
  { code: 'CFS', label: ORGANIZATION_LABELS.CFS, dotClass: 'bg-yellow-500' },
];

const ORG_CARD_STYLES: Record<OrganizationCode, { bg: string; border: string }> = {
  ESTACA: { bg: 'bg-slate-100/80 hover:bg-slate-100', border: 'border-slate-300/80' },
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
  onActivitiesUpdate?: (updated: ActivityRecord[]) => void;
  onBack?: () => void;
  onProposeActivity?: () => void;
  embedded?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedYear = 2026,
  activitiesProp,
  onActivitiesUpdate,
  onBack,
  onProposeActivity,
  embedded = false,
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

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const nextUpcomingItemRef = useRef<HTMLDivElement | null>(null);
  const orgMenuRef = useRef<HTMLDivElement | null>(null);

  // Sincronizar con prop externa cuando se provee desde PresidencyHub o LeaderView
  useEffect(() => {
    if (activitiesProp && activitiesProp.length > 0) {
      setLocalActivities(activitiesProp);
    }
  }, [activitiesProp]);

  // Al cambiar de usuario/rol (ej. selector rápido RBAC), posicionar el filtro según el perfil
  useEffect(() => {
    setSelectedOrgs(getDefaultSelectedOrgs(user.role, user.organization));
    setIsOrgMenuOpen(false);
  }, [user.id, user.role, user.organization]);

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
    });
    setLocalActivities(result.activities);
    if (onActivitiesUpdate) {
      onActivitiesUpdate(result.activities);
    }
  };

  // Fecha de referencia actual para separar eventos pasados (atenuados arriba) de la próxima actividad futura
  const referenceToday = '2026-11-08';

  const matchesSelectedOrganizations = (act: ActivityRecord): boolean => {
    if (selectedOrgs.length === 0 || selectedOrgs.length === SELECTABLE_ORGS.length) {
      return true;
    }

    const includesYouth = selectedOrgs.includes('HJ') || selectedOrgs.includes('MJ');

    // Seminario no es independiente: aparece cuando se filtra HJ o MJ
    if (act.organization === 'SEMINARIO') {
      return includesYouth;
    }

    // Actividades compartidas HJ + MJ
    if (act.organization === 'HJ' || act.organization === 'MJ') {
      if (selectedOrgs.includes(act.organization)) return true;
      const upperTitle = act.title.toUpperCase();
      const isSharedYouth =
        upperTitle.includes('HJ Y MJ') ||
        upperTitle.includes('HHJJ Y MMJJ') ||
        upperTitle.includes('HOMBRES Y MUJERES JÓVENES');
      if (isSharedYouth && includesYouth) return true;
      return false;
    }

    return selectedOrgs.includes(act.organization as SelectableOrg);
  };

  // Lista anual filtrada por año, organizaciones seleccionadas y buscador en tiempo real
  const filteredActivities = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return localActivities
      .filter((act) => {
        if (act.status === 'CANCELADA' || act.status === 'RECHAZADA') return false;
        if (!act.event_date.startsWith(String(selectedYear))) return false;
        if (!matchesSelectedOrganizations(act)) return false;

        // Buscador en tiempo real por título o lugar
        if (normalizedQuery.length > 0) {
          const matchesTitle = act.title.toLowerCase().includes(normalizedQuery);
          const matchesLocation = (act.location || '').toLowerCase().includes(normalizedQuery);
          const matchesOrg =
            ORGANIZATION_LABELS[act.organization].toLowerCase().includes(normalizedQuery) ||
            ORGANIZATION_SHORT_LABELS[act.organization].toLowerCase().includes(normalizedQuery);
          if (!matchesTitle && !matchesLocation && !matchesOrg) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [localActivities, selectedYear, selectedOrgs, searchQuery]);

  // ID del evento más próximo a la fecha actual para auto-enfoque
  const firstUpcomingId = useMemo(() => {
    const found = filteredActivities.find((a) => a.event_date >= referenceToday);
    return found ? found.id : null;
  }, [filteredActivities]);

  // Auto-enfoque / scroll suave al evento más próximo a la fecha actual (ocultando los pasados arriba)
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = listScrollRef.current;
      const target = nextUpcomingItemRef.current;
      if (container && target) {
        container.scrollTo({
          top: Math.max(0, target.offsetTop),
          behavior: 'smooth',
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedOrgs, selectedYear, firstUpcomingId]);

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

  const baseUserOrg: OrganizationCode =
    user.organization === 'TODAS' ? 'ESTACA' : user.organization;

  const canSeeYouthQuickFilter =
    user.role === 'ADMIN' ||
    user.role === 'PRESIDENCIA' ||
    baseUserOrg === 'HJ' ||
    baseUserOrg === 'MJ';

  const isOrgFiltered =
    selectedOrgs.length > 0 && selectedOrgs.length < SELECTABLE_ORGS.length;

  return (
    <section
      data-testid="calendar-general-view"
      className={
        embedded
          ? 'space-y-2.5'
          : 'max-w-5xl mx-auto px-4 sm:px-6 pt-2 sm:pt-3 pb-6 space-y-3'
      }
    >
      {/* Marco superior unificado: Título + Sincronizar + Filtros y Búsqueda (fijo arriba) */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
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

          <LcrSyncButton onSync={handleManualSync} />
        </div>

        {/* Barra de controles destacada: Selector multi-organización + Proponer Actividad + Buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
          <div className="flex items-center gap-2">
          {/* Selector desplegable multi-organización (móvil y web) */}
          <div ref={orgMenuRef} className="relative flex-1 sm:flex-none sm:w-64 min-w-0">
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
                        ? 'bg-slate-900 text-white'
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
                          ? 'bg-slate-900 text-white'
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

          {onProposeActivity && (
            <button
              type="button"
              data-testid="calendar-propose-btn"
              onClick={onProposeActivity}
              className="pressable h-[34px] inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 rounded-xl shadow-sm flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex flex-col sm:flex-row sm:gap-1 items-start sm:items-center leading-[1.1] sm:leading-4 text-left">
                <span>Proponer</span>
                <span>Actividad</span>
              </span>
            </button>
          )}
          </div>

          {/* Buscador en tiempo real por nombre de actividad o lugar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="calendar-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actividad o lugar..."
              aria-label="Buscar actividad o lugar"
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
      </div>

      {/* Marco independiente para las tarjetas de eventos (scroll propio sin mover la cabecera) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-card">
        {filteredActivities.length === 0 ? (
          <div
            data-testid="calendar-empty-state"
            className="py-10 text-center space-y-2 text-slate-400"
          >
            <p className="text-sm font-bold text-slate-600">
              No se encontraron actividades para este filtro
            </p>
            <p className="text-xs">
              Prueba cambiando las organizaciones seleccionadas o limpiando el texto de búsqueda.
            </p>
          </div>
        ) : (
          <div
            ref={listScrollRef}
            data-testid="calendar-view-scroll-container"
            className={`relative overflow-y-auto scroll-smooth pr-1 space-y-2.5 ${
              embedded ? 'max-h-[480px]' : 'max-h-[calc(100dvh-245px)] min-h-[320px]'
            }`}
          >
            {filteredActivities.map((act) => {
              const isPast = act.event_date < referenceToday;
              const isNextUpcoming = act.id === firstUpcomingId;
              const canSeeCost = canViewActivityBudget(
                user.role,
                baseUserOrg,
                act.organization
              );
              const cardStyle = ORG_CARD_STYLES[act.organization] || ORG_CARD_STYLES.TODAS;

              return (
                <article
                  key={act.id}
                  ref={isNextUpcoming ? nextUpcomingItemRef : null}
                  data-testid={`calendar-event-card-${act.organization}`}
                  data-event-title={act.title}
                  data-past={isPast ? 'true' : 'false'}
                  data-upcoming-anchor={isNextUpcoming ? 'true' : 'false'}
                  className={`p-4 rounded-2xl transition space-y-2 ${
                    isPast
                      ? 'border border-slate-200/60 bg-slate-100/60 opacity-65'
                      : isNextUpcoming
                      ? `${cardStyle.bg} border-2 border-slate-900 upcoming-card-pulse shadow-sm`
                      : `${cardStyle.bg} border ${cardStyle.border}`
                  }`}
                >
                  {/* Fila superior: Organización a la izquierda + Estado a la derecha */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/85 text-slate-800 border border-slate-200/80">
                      {ORGANIZATION_SHORT_LABELS[act.organization]}
                    </span>

                    {isPast ? (
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
                    ) : act.status === 'PROPUESTA' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        Propuesta de Líder
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        Aprobada LCR
                      </span>
                    )}
                  </div>

                  {/* Título, descripción y detalles */}
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(act.event_date)}
                      </span>
                      {act.start_time && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {act.start_time} hs
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

                  {/* Presupuesto en la parte inferior derecha (verde reservado para dinero) */}
                  {canSeeCost && act.has_budget && act.estimated_cost > 0 && (
                    <div className="flex justify-end pt-1">
                      <div
                        data-testid="calendar-confidential-budget-amount"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-right"
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700/80">
                          Costo Estimado
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-emerald-900 tabular-nums">
                          {formatCurrency(act.estimated_cost)}
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
