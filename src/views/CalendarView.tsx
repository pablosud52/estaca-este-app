import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  EyeOff,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
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
import {
  getSharedLastSyncedAt,
  syncLcrCalendarWithShield,
} from '../services/lcrSyncService';
import { ActivityRecord, OrganizationCode } from '../types/database';
import { LcrSyncButton } from '../components/LcrSyncButton';

export type CalendarQuickPill =
  | 'TODAS'
  | 'MIS_ACTIVIDADES'
  | 'JOVENES'
  | 'PRIMARIA'
  | 'ESTACA_GENERAL';

interface CalendarViewProps {
  selectedYear?: number;
  activitiesProp?: ActivityRecord[];
  onActivitiesUpdate?: (updated: ActivityRecord[]) => void;
  onBack?: () => void;
  embedded?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedYear = 2026,
  activitiesProp,
  onActivitiesUpdate,
  onBack,
  embedded = false,
}) => {
  const { user } = useAuth();
  const [localActivities, setLocalActivities] = useState<ActivityRecord[]>(
    () => activitiesProp || SEED_ACTIVITIES
  );
  const [activePill, setActivePill] = useState<CalendarQuickPill>('TODAS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [shieldStatusMessage, setShieldStatusMessage] = useState<string | null>(null);

  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const nextUpcomingItemRef = useRef<HTMLDivElement | null>(null);

  // Sincronizar con prop externa cuando se provee desde PresidencyHub o LeaderView
  useEffect(() => {
    if (activitiesProp && activitiesProp.length > 0) {
      setLocalActivities(activitiesProp);
    }
  }, [activitiesProp]);

  // Al montar, recuperar último timestamp de sincronización compartida
  useEffect(() => {
    let active = true;
    getSharedLastSyncedAt().then((ts) => {
      if (active && ts) {
        setLastSyncedAt(ts);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleManualSync = async () => {
    const result = await syncLcrCalendarWithShield({
      currentActivities: localActivities,
      attemptLiveFetch: true,
    });
    setLocalActivities(result.activities);
    if (onActivitiesUpdate) {
      onActivitiesUpdate(result.activities);
    }
    setLastSyncedAt(result.lastSyncedAt);

    if (result.skippedByDbShield) {
      setShieldStatusMessage(
        'Escudo de Base de Datos activo (< 10 min): lectura instantánea desde Supabase sin saturar los servidores de la Iglesia.'
      );
    } else {
      setShieldStatusMessage(
        'Feed iCal RFC 5545 sincronizado y deduplicado por UID único en Supabase.'
      );
    }
  };

  // Fecha de referencia actual para separar eventos pasados (atenuados arriba) de la próxima actividad futura
  const referenceToday = '2026-11-08';

  const isUserOwnActivity = (act: ActivityRecord): boolean => {
    if (user.role === 'ADMIN' || user.role === 'PRESIDENCIA') {
      return true;
    }
    const baseOrg: OrganizationCode = user.organization === 'TODAS' ? 'MJ' : user.organization;
    if (act.organization === baseOrg) return true;
    if (baseOrg === 'MJ' || baseOrg === 'HJ') {
      if (act.organization === 'SEMINARIO') return true;
      const upperTitle = act.title.toUpperCase();
      if (
        (act.organization === 'HJ' || act.organization === 'MJ') &&
        (upperTitle.includes('HJ Y MJ') ||
          upperTitle.includes('HHJJ Y MMJJ') ||
          upperTitle.includes('HOMBRES Y MUJERES JÓVENES'))
      ) {
        return true;
      }
    }
    return false;
  };

  // Lista anual filtrada por año, píldora rápida y buscador en tiempo real
  const filteredActivities = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return localActivities
      .filter((act) => {
        if (act.status === 'CANCELADA' || act.status === 'RECHAZADA') return false;
        if (!act.event_date.startsWith(String(selectedYear))) return false;

        // Filtro por píldora rápida
        if (activePill === 'MIS_ACTIVIDADES') {
          if (!isUserOwnActivity(act) && act.organization !== 'ESTACA') {
            return false;
          }
        } else if (activePill === 'JOVENES') {
          if (
            act.organization !== 'HJ' &&
            act.organization !== 'MJ' &&
            act.organization !== 'SEMINARIO'
          ) {
            return false;
          }
        } else if (activePill === 'PRIMARIA') {
          if (act.organization !== 'PRIMARIA') return false;
        } else if (activePill === 'ESTACA_GENERAL') {
          if (act.organization !== 'ESTACA') return false;
        }

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
  }, [localActivities, selectedYear, activePill, searchQuery, user]);

  // ID del evento más próximo a la fecha actual para auto-enfoque
  const firstUpcomingId = useMemo(() => {
    const found = filteredActivities.find((a) => a.event_date >= referenceToday);
    return found ? found.id : null;
  }, [filteredActivities]);

  // Auto-enfoque / scroll suave al evento más próximo a la fecha actual (dejando eventos pasados accesibles hacia arriba)
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = listScrollRef.current;
      const target = nextUpcomingItemRef.current;
      if (container && target) {
        const targetOffset = Math.max(0, target.offsetTop - 95);
        container.scrollTo({
          top: targetOffset,
          behavior: 'smooth',
        });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activePill, selectedYear, firstUpcomingId]);

  const pills: Array<{ id: CalendarQuickPill; label: string; testId: string }> = [
    { id: 'TODAS', label: 'Todas', testId: 'calendar-pill-TODAS' },
    { id: 'MIS_ACTIVIDADES', label: 'Mis Actividades', testId: 'calendar-pill-MIS_ACTIVIDADES' },
    { id: 'JOVENES', label: 'Jóvenes', testId: 'calendar-pill-JOVENES' },
    { id: 'PRIMARIA', label: 'Primaria', testId: 'calendar-pill-PRIMARIA' },
    { id: 'ESTACA_GENERAL', label: 'Estaca General', testId: 'calendar-pill-ESTACA_GENERAL' },
  ];

  const baseUserOrg: OrganizationCode =
    user.organization === 'TODAS' ? 'ESTACA' : user.organization;

  return (
    <section
      data-testid="calendar-general-view"
      className={embedded ? 'space-y-4' : 'max-w-5xl mx-auto px-4 sm:px-6 pt-5 pb-16 space-y-5'}
    >
      {/* Cabecera de la Vista 4: Título + Doble Escudo de Sincronización con LCR */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              {onBack && (
                <button
                  type="button"
                  data-testid="calendar-view-back-btn"
                  onClick={onBack}
                  className="pressable inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  aria-label="Volver"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Calendario General de Actividades {selectedYear}
                </h1>
                <p className="text-xs text-slate-500">
                  Sincronizado con el feed oficial LCR · Deduplicación RFC 5545 por UID único
                </p>
              </div>
            </div>
          </div>

          {/* Botón Manual con Cooldown Progresivo (30s x 3 -> 10m) */}
          <LcrSyncButton onSync={handleManualSync} />
        </div>

        {/* Estado del Escudo de Base de Datos y Confidencialidad RBAC */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
            <span data-testid="calendar-db-shield-info">
              {shieldStatusMessage
                ? shieldStatusMessage
                : lastSyncedAt
                ? `Escudo DB activo · Última verificación: ${formatDate(lastSyncedAt.slice(0, 10))}`
                : 'Sincronización automática con LCR activa al iniciar la aplicación'}
            </span>
          </div>

          {user.role === 'LIDER' && (
            <div
              data-testid="calendar-rbac-confidentiality-banner"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>
                Presupuestos confidenciales: solo ves costos de{' '}
                <strong className="font-bold text-slate-800">
                  {ORGANIZATION_SHORT_LABELS[baseUserOrg]}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Filtros Rápidos por Píldoras + Buscador en Tiempo Real */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-card space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Píldoras de filtro rápido */}
          <div
            role="tablist"
            aria-label="Filtros rápidos de calendario"
            className="flex items-center gap-1.5 flex-wrap"
          >
            {pills.map((pill) => {
              const isActive = activePill === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={pill.testId}
                  onClick={() => setActivePill(pill.id)}
                  className={`pressable px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Buscador en tiempo real por nombre de actividad o lugar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="calendar-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actividad o lugar..."
              aria-label="Buscar actividad o lugar"
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
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

        {/* Lista Anual Continua con Auto-Enfoque al evento más próximo */}
        {filteredActivities.length === 0 ? (
          <div
            data-testid="calendar-empty-state"
            className="py-10 text-center space-y-2 text-slate-400"
          >
            <p className="text-sm font-bold text-slate-600">
              No se encontraron actividades para este filtro
            </p>
            <p className="text-xs">
              Prueba cambiando la píldora de categoría o limpiando el texto de búsqueda.
            </p>
          </div>
        ) : (
          <div
            ref={listScrollRef}
            data-testid="calendar-view-scroll-container"
            className="relative max-h-[540px] overflow-y-auto scroll-smooth pr-1 space-y-2.5"
          >
            {filteredActivities.map((act) => {
              const isPast = act.event_date < referenceToday;
              const isNextUpcoming = act.id === firstUpcomingId;
              const canSeeCost = canViewActivityBudget(
                user.role,
                baseUserOrg,
                act.organization
              );

              return (
                <article
                  key={act.id}
                  ref={isNextUpcoming ? nextUpcomingItemRef : null}
                  data-testid={`calendar-event-card-${act.organization}`}
                  data-event-title={act.title}
                  data-past={isPast ? 'true' : 'false'}
                  data-upcoming-anchor={isNextUpcoming ? 'true' : 'false'}
                  className={`p-4 rounded-2xl border transition ${
                    isPast
                      ? 'border-slate-200/60 bg-slate-100/60 opacity-65'
                      : isNextUpcoming
                      ? 'border-emerald-500/90 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-800">
                          <Building2 className="w-3 h-3" />
                          {ORGANIZATION_SHORT_LABELS[act.organization]}
                        </span>

                        {isPast ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                            Realizada
                          </span>
                        ) : isNextUpcoming ? (
                          <span
                            data-testid="calendar-view-upcoming-badge"
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-700 text-white"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            Próxima actividad
                          </span>
                        ) : act.status === 'PROPUESTA' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            Propuesta de Líder
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            Aprobada LCR
                          </span>
                        )}

                        {/* Regla Sagrada de Confidencialidad Presupuestaria (RBAC) */}
                        {canSeeCost && act.has_budget && act.estimated_cost > 0 && (
                          <span
                            data-testid="calendar-confidential-budget-badge"
                            className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300"
                          >
                            💰 Con Presupuesto
                          </span>
                        )}
                      </div>

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

                    {/* Monto de Costo Estimado: Estrictamente confidencial según RBAC */}
                    {canSeeCost && act.has_budget && act.estimated_cost > 0 && (
                      <div
                        data-testid="calendar-confidential-budget-amount"
                        className="flex-shrink-0 self-start sm:self-center px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-right shadow-2xs"
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
    </section>
  );
};
