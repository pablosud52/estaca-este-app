import React, { useMemo, useState } from 'react';
import { Check, Link2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate, ORGANIZATION_SHORT_LABELS } from '../lib/formatters';
import {
  getLocalLcrSyncMeta,
  isActivityMissingFromLcr,
  isActivityPendingLcr,
} from '../services/lcrSyncService';
import { ActivityRecord, ExpenseRecord, OrganizationCode } from '../types/database';
import { ActivityApprovalTray } from './ActivityApprovalTray';

export type CalendarControlSubTab = 'WAITING_APPROVAL' | 'APPROVED' | 'PENDING_LCR';

interface CalendarControlPanelProps {
  activities: ActivityRecord[];
  expenses?: ExpenseRecord[];
  canApprove: boolean;
  isSuperAdmin?: boolean;
  userFullName: string;
  userCalling: string;
  initialSubTab?: CalendarControlSubTab;
  onApproveActivity: (id: number) => Promise<void>;
  onRejectActivity: (id: number, reason?: string) => Promise<void>;
  onEditAndApproveActivity: (
    id: number,
    updates: {
      title: string;
      event_date: string;
      start_time: string;
      location: string;
      description: string;
      estimated_cost: number;
    }
  ) => Promise<void>;
  onUpdateApprovedActivity?: (
    id: number,
    updates: {
      title: string;
      event_date: string;
      start_time: string | null;
      end_time?: string | null;
      location: string;
      organization: OrganizationCode;
      description: string;
      estimated_cost: number;
    }
  ) => Promise<void>;
  onLinkWithLcrEvent: (pendingActivityId: number, lcrActivityId: number) => Promise<void>;
  onMarkNoLcrRequired: (activityId: number) => Promise<void>;
  onDeleteActivity: (activityId: number) => Promise<void>;
  onCancelActivity?: (activityId: number) => Promise<void>;
  onManualSync: () => Promise<void>;
  onOpenCreateModal?: () => void;
}

export const CalendarControlPanel: React.FC<CalendarControlPanelProps> = ({
  activities,
  expenses = [],
  canApprove,
  isSuperAdmin = false,
  userFullName,
  userCalling,
  initialSubTab = 'WAITING_APPROVAL',
  onApproveActivity,
  onRejectActivity,
  onEditAndApproveActivity,
  onUpdateApprovedActivity,
  onLinkWithLcrEvent,
  onMarkNoLcrRequired,
  onDeleteActivity,
  onCancelActivity,
  onManualSync,
  onOpenCreateModal,
}) => {
  const [subTab, setSubTab] = useState<CalendarControlSubTab>(initialSubTab);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pendingApprovalsCount = useMemo(
    () =>
      activities.filter(
        (a) => a.origin === 'propuesta_lider' && a.status === 'PROPUESTA'
      ).length,
    [activities]
  );

  const pendingLcrList = useMemo(
    () =>
      activities
        .filter(isActivityPendingLcr)
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [activities]
  );

  const missingFromLcrIds = useMemo(() => {
    const meta = getLocalLcrSyncMeta();
    const set = new Set<number>();
    for (const act of activities) {
      if (isActivityMissingFromLcr(act, meta.liveUids, meta.lastSource)) {
        set.add(act.id);
      }
    }
    return set;
  }, [activities]);

  // Eventos oficiales de LCR disponibles para vincular manualmente con un duplicado
  const lcrCandidateEvents = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return activities
      .filter((a) => {
        if (a.status !== 'APROBADA') return false;
        const uid = (a.ical_uid || '').trim();
        if (!uid || uid.startsWith('PROPUESTA_LIDER') || uid.startsWith('NO_LCR_')) {
          return false;
        }
        if (q) {
          return (
            a.title.toLowerCase().includes(q) ||
            a.event_date.includes(q) ||
            (a.location || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [activities, linkSearch]);

  const handleSyncClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await onManualSync();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div data-testid="calendar-control-panel" className="space-y-4">
      {/* Navegación compacta en 3 pestañas + Botón Crear Evento */}
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
        <button
          type="button"
          data-testid="cal-ctrl-tab-approved"
          onClick={() => setSubTab('APPROVED')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-2 ${
            subTab === 'APPROVED'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Aprobados</span>
          {missingFromLcrIds.size > 0 && (
            <span className="inline-flex items-center gap-1.5 animate-pulse">
              <span
                className={`text-[11px] font-extrabold tabular-nums ${
                  subTab === 'APPROVED' ? 'text-amber-300' : 'text-amber-700'
                }`}
              >
                {missingFromLcrIds.size}
              </span>
              <span
                data-testid="cal-ctrl-approved-dot"
                className="w-2 h-2 rounded-full bg-amber-500"
              />
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="cal-ctrl-tab-waiting"
          onClick={() => setSubTab('WAITING_APPROVAL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-2 ${
            subTab === 'WAITING_APPROVAL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Esperando Aprobación</span>
          {pendingApprovalsCount > 0 && (
            <span className="inline-flex items-center gap-1.5 animate-pulse">
              <span
                className={`text-[11px] font-extrabold tabular-nums ${
                  subTab === 'WAITING_APPROVAL' ? 'text-amber-300' : 'text-amber-700'
                }`}
              >
                {pendingApprovalsCount}
              </span>
              <span
                data-testid="cal-ctrl-approvals-dot"
                className="w-2 h-2 rounded-full bg-amber-500"
              />
            </span>
          )}
        </button>

        <button
          type="button"
          data-testid="cal-ctrl-tab-pending-lcr"
          onClick={() => setSubTab('PENDING_LCR')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-2 ${
            subTab === 'PENDING_LCR'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>Pendientes en LCR</span>
          {pendingLcrList.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 animate-pulse"
              data-testid="cal-ctrl-pending-lcr-count"
            >
              <span
                className={`text-[11px] font-extrabold tabular-nums ${
                  subTab === 'PENDING_LCR' ? 'text-amber-300' : 'text-amber-700'
                }`}
              >
                {pendingLcrList.length}
              </span>
              <span
                data-testid="cal-ctrl-pending-lcr-dot"
                className="w-2 h-2 rounded-full bg-amber-500"
              />
            </span>
          )}
        </button>
      </div>

      {onOpenCreateModal && (
        <button
          type="button"
          data-testid="cal-ctrl-create-event-btn"
          onClick={onOpenCreateModal}
          className="pressable inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Evento</span>
        </button>
      )}
      </div>

      {/* Pestaña 1: Esperando Aprobación */}
      {subTab === 'WAITING_APPROVAL' && (
        <ActivityApprovalTray
          activities={activities}
          canApprove={canApprove}
          userFullName={userFullName}
          userCalling={userCalling}
          mode="WAITING"
          onApproveActivity={onApproveActivity}
          onRejectActivity={onRejectActivity}
          onEditAndApproveActivity={onEditAndApproveActivity}
        />
      )}

      {/* Pestaña 2: Tabla Aprobados */}
      {subTab === 'APPROVED' && (
        <ActivityApprovalTray
          activities={activities}
          expenses={expenses}
          canApprove={canApprove}
          isSuperAdmin={isSuperAdmin}
          userFullName={userFullName}
          userCalling={userCalling}
          mode="APPROVED"
          missingFromLcrIds={missingFromLcrIds}
          onApproveActivity={onApproveActivity}
          onRejectActivity={onRejectActivity}
          onEditAndApproveActivity={onEditAndApproveActivity}
          onUpdateApprovedActivity={onUpdateApprovedActivity}
          onDeleteActivity={onDeleteActivity}
          onCancelActivity={onCancelActivity}
          onKeepActivity={onMarkNoLcrRequired}
        />
      )}

      {/* Pestaña 2: Actividades aprobadas pendientes de registro en LCR */}
      {subTab === 'PENDING_LCR' && (
        <div
          data-testid="cal-ctrl-pending-lcr-panel"
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Actividades aprobadas pendientes de LCR
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Si ya la cargaste en LCR con otro nombre, puedes vincularla sin perder su presupuesto.
              </p>
            </div>
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSyncClick}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Comprobando...' : 'Comprobar LCR'}</span>
            </button>
          </div>

          {pendingLcrList.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Todo al día
              </p>
              <p className="text-xs text-slate-500 mt-1">
                No hay actividades aprobadas pendientes de vincular en LCR.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingLcrList.map((act) => {
                const isPast = act.event_date < todayStr;
                const isLinking = linkingId === act.id;
                const isConfirmingDelete = confirmDeleteId === act.id;
                const isBusy = busyId === act.id;

                return (
                  <div key={act.id} className="px-5 py-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {act.title}
                          </span>
                          {isPast && (
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Fecha pasada
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span>{formatDate(act.event_date)}</span>
                          <span>•</span>
                          <span>
                            {ORGANIZATION_SHORT_LABELS[act.organization] || act.organization}
                          </span>
                          {Number(act.estimated_cost || 0) > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-medium text-slate-700">
                                {formatCurrency(Number(act.estimated_cost))}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          data-testid={`link-lcr-btn-${act.id}`}
                          onClick={() => {
                            setLinkingId(isLinking ? null : act.id);
                            setLinkSearch('');
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{isLinking ? 'Cerrar' : 'Vincular con LCR'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          data-testid={`no-lcr-btn-${act.id}`}
                          onClick={async () => {
                            setBusyId(act.id);
                            try {
                              await onMarkNoLcrRequired(act.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>No requiere LCR</span>
                        </button>

                        {!isConfirmingDelete ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setConfirmDeleteId(act.id);
                              setLinkingId(null);
                            }}
                            title="Eliminar actividad"
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-xl px-2 py-1">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyId(act.id);
                                try {
                                  await onDeleteActivity(act.id);
                                  setConfirmDeleteId(null);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="text-xs font-bold text-rose-700 hover:underline px-1"
                            >
                              Eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selector limpio para vincular con un evento ya traído de LCR */}
                    {isLinking && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            Elige el evento equivalente de LCR para unirlos:
                          </span>
                          <input
                            type="text"
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            placeholder="Buscar por nombre o fecha..."
                            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 sm:w-56"
                          />
                        </div>

                        {lcrCandidateEvents.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">
                            No se encontraron eventos de LCR con ese filtro.
                          </p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto divide-y divide-slate-200/70 bg-white border border-slate-200 rounded-lg">
                            {lcrCandidateEvents.slice(0, 20).map((cand) => (
                              <div
                                key={cand.id}
                                className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">
                                    {cand.title}
                                  </p>
                                  <p className="text-slate-500">
                                    {formatDate(cand.event_date)} • {cand.location}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    setBusyId(act.id);
                                    try {
                                      await onLinkWithLcrEvent(act.id, cand.id);
                                      setLinkingId(null);
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 shrink-0 disabled:opacity-50"
                                >
                                  Vincular
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
