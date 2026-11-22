import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Lock,
  MapPin,
  Sparkles,
  XCircle,
  Check,
  X,
  Building2,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  isExpenseApplied,
  ORGANIZATION_LABELS,
  ORGANIZATION_SHORT_LABELS,
} from '../lib/formatters';
import { ActivityRecord, ExpenseRecord, OrganizationCode } from '../types/database';
import { EventLocationSelect } from './EventLocationSelect';

interface ActivityApprovalTrayProps {
  activities: ActivityRecord[];
  expenses?: ExpenseRecord[];
  canApprove: boolean;
  isSuperAdmin?: boolean;
  userFullName: string;
  userCalling: string;
  mode?: 'WAITING' | 'APPROVED' | 'BOTH';
  missingFromLcrIds?: Set<number>;
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
  onDeleteActivity?: (id: number) => Promise<void>;
  onCancelActivity?: (id: number) => Promise<void>;
  onKeepActivity?: (id: number) => Promise<void>;
}

export const ActivityApprovalTray: React.FC<ActivityApprovalTrayProps> = ({
  activities,
  expenses = [],
  canApprove,
  isSuperAdmin = false,
  userFullName,
  userCalling,
  mode = 'BOTH',
  missingFromLcrIds = new Set<number>(),
  onApproveActivity,
  onRejectActivity,
  onEditAndApproveActivity,
  onUpdateApprovedActivity,
  onDeleteActivity,
  onCancelActivity,
  onKeepActivity,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCost, setEditCost] = useState('');

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Modales y estado para la tabla Aprobados
  const [cancelModalAct, setCancelModalAct] = useState<ActivityRecord | null>(null);
  const [editApprovedAct, setEditApprovedAct] = useState<ActivityRecord | null>(null);
  const [appTitle, setAppTitle] = useState('');
  const [appDate, setAppDate] = useState('');
  const [appTime, setAppTime] = useState('');
  const [appEndTime, setAppEndTime] = useState('');
  const [appLocation, setAppLocation] = useState('');
  const [appOrg, setAppOrg] = useState<OrganizationCode>('ESTACA');
  const [appDesc, setAppDesc] = useState('');
  const [appCost, setAppCost] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [missingCursor, setMissingCursor] = useState(0);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const renderedExpenseActivityIds = useMemo(() => {
    const set = new Set<number>();
    for (const exp of expenses) {
      if (exp.activity_id && isExpenseApplied(exp)) {
        set.add(exp.activity_id);
      }
    }
    return set;
  }, [expenses]);

  const missingOrderedList = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return activities
      .filter((a) => missingFromLcrIds.has(a.id))
      .sort((a, b) => {
        const aFuture = a.event_date >= today ? 0 : 1;
        const bFuture = b.event_date >= today ? 0 : 1;
        if (aFuture !== bFuture) return aFuture - bFuture;
        return a.event_date.localeCompare(b.event_date);
      });
  }, [activities, missingFromLcrIds]);

  const handleJumpToNextMissing = () => {
    if (missingOrderedList.length === 0) return;
    const idx = missingCursor % missingOrderedList.length;
    const target = missingOrderedList[idx];
    setMissingCursor((c) => c + 1);
    const el = rowRefs.current[target.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(target.id);
      setTimeout(() => setHighlightedId(null), 2200);
    }
  };

  const openEditApprovedModal = (act: ActivityRecord) => {
    setEditApprovedAct(act);
    setAppTitle(act.title);
    setAppDate(act.event_date);
    setAppTime(act.start_time || '');
    setAppEndTime(act.end_time || '');
    setAppLocation(act.location);
    setAppOrg(act.organization);
    setAppDesc(act.description || '');
    setAppCost(String(act.estimated_cost || 0));
  };

  const handleSaveApprovedEdit = async () => {
    if (!editApprovedAct || !onUpdateApprovedActivity) return;
    const parsed = Number(String(appCost).replace(',', '.'));
    const safeCost = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setModalBusy(true);
    try {
      await onUpdateApprovedActivity(editApprovedAct.id, {
        title: appTitle.trim() || editApprovedAct.title,
        event_date: appDate || editApprovedAct.event_date,
        start_time: appTime.trim() ? appTime.trim() : null,
        end_time: appEndTime.trim() ? appEndTime.trim() : null,
        location: appLocation.trim() || 'Centro de Estaca',
        organization: appOrg,
        description: appDesc.trim(),
        estimated_cost: safeCost,
      });
      setEditApprovedAct(null);
    } finally {
      setModalBusy(false);
    }
  };

  // Regla sagrada de aprobación:
  // Eventos de LCR (origin === 'lcr') ya vienen aprobados institucionalmente y NUNCA van a la bandeja.
  // Solo van a la bandeja los eventos propuestos por líderes locales (origin === 'propuesta_lider' y status === 'PROPUESTA').
  const pendingProposals = activities.filter(
    (a) => a.origin === 'propuesta_lider' && a.status === 'PROPUESTA'
  );
  const resolvedActivities = activities.filter(
    (a) => a.status === 'APROBADA' || a.status === 'RECHAZADA'
  );

  const startEditing = (act: ActivityRecord) => {
    setRejectingId(null);
    setEditingId(act.id);
    setEditTitle(act.title);
    setEditDate(act.event_date);
    setEditTime(act.start_time || '19:00');
    setEditLocation(act.location);
    setEditDescription(act.description || '');
    setEditCost(String(act.estimated_cost || 0));
  };

  const handleSaveEditAndApprove = async (id: number) => {
    const parsedCost = Number(String(editCost).replace(',', '.'));
    const safeCost = Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0;

    await onEditAndApproveActivity(id, {
      title: editTitle.trim() || 'Actividad de Organización',
      event_date: editDate,
      start_time: editTime || '19:00',
      location: editLocation.trim() || 'Centro de Estaca',
      description: editDescription.trim(),
      estimated_cost: safeCost,
    });

    setEditingId(null);
    setFeedbackBanner(
      `Actividad "${editTitle.trim()}" actualizada y aprobada con presupuesto ${formatCurrency(safeCost)}.`
    );
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  const handleDirectApprove = async (act: ActivityRecord) => {
    await onApproveActivity(act.id);
    setFeedbackBanner(`Actividad "${act.title}" aprobada y publicada en el calendario oficial.`);
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  const handleConfirmReject = async (act: ActivityRecord) => {
    await onRejectActivity(act.id, rejectReason.trim() || 'Observada por Presidencia');
    setRejectingId(null);
    setRejectReason('');
    setFeedbackBanner(`Propuesta "${act.title}" marcada como rechazada.`);
    setTimeout(() => setFeedbackBanner(null), 4500);
  };

  return (
    <section
      aria-label="Aprobaciones y Agenda"
      data-testid="activity-approval-tray"
      className="space-y-4"
    >
      {/* Aviso compacto si el secretario no tiene permiso de aprobar */}
      {mode !== 'APPROVED' && !canApprove && (
        <div
          data-testid="readonly-presidency-notice"
          className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              Tu perfil en Presidencia tiene acceso de consulta ejecutiva. La acción de aprobar, editar o rechazar propuestas está reservada al Presidente, Consejeros, Secretario Financiero o secretarios con delegación expresa.
            </span>
          </div>
          <span
            data-testid="approval-permission-readonly"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-slate-700 text-[11px] font-bold shrink-0"
          >
            Modo Lectura ({userFullName})
          </span>
        </div>
      )}

      {/* Banner de confirmación tras acción */}
      {feedbackBanner && (
        <div
          data-testid="approval-feedback-banner"
          role="status"
          className="p-4 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-md border border-emerald-700 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Lista de Propuestas Esperando Aprobación */}
      {mode !== 'APPROVED' && pendingProposals.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-8 text-center">
          <p className="text-xs font-semibold text-slate-500">
            No hay actividades esperando aprobación.
          </p>
        </div>
      )}

      {mode !== 'APPROVED' && pendingProposals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pendingProposals.map((proposal) => {
            const isEditing = editingId === proposal.id;
            const isRejecting = rejectingId === proposal.id;

            return (
              <article
                key={proposal.id}
                data-testid={`proposal-card-${proposal.id}`}
                className="bg-white rounded-3xl p-5 shadow-sm border-2 border-amber-300/80 flex flex-col justify-between gap-4 transition"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-900 text-white text-xs font-extrabold">
                        <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{ORGANIZATION_SHORT_LABELS[proposal.organization]}</span>
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {ORGANIZATION_LABELS[proposal.organization]}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Propuesta Pendiente</span>
                    </span>
                  </div>

                  {/* Título y Descripción */}
                  <h3
                    data-testid={`proposal-title-${proposal.id}`}
                    className="text-base font-extrabold text-slate-900 mt-3"
                  >
                    {proposal.title}
                  </h3>
                  {proposal.description && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {proposal.description}
                    </p>
                  )}

                  {/* Metadatos Fecha, Hora, Lugar y Costo Estimado */}
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span data-testid={`proposal-date-${proposal.id}`}>
                          {formatDate(proposal.event_date)}
                        </span>
                      </span>

                      {proposal.start_time && (
                        <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{proposal.start_time} hs</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span data-testid={`proposal-location-${proposal.id}`}>
                          {proposal.location}
                        </span>
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">
                        Presupuesto estimado solicitado:
                      </span>
                      <span
                        data-testid={`proposal-cost-${proposal.id}`}
                        className="text-sm font-extrabold text-emerald-900 tabular-nums bg-emerald-100/90 px-2.5 py-0.5 rounded-lg border border-emerald-300"
                      >
                        {formatCurrency(proposal.estimated_cost)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Formulario Inline de Edición (cuando el miembro de Presidencia pulsa Editar) */}
                {isEditing && canApprove && (
                  <div
                    data-testid={`proposal-edit-form-${proposal.id}`}
                    className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-700"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                        Editar antes de aprobar
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nombre de la Actividad
                      </label>
                      <input
                        type="text"
                        data-testid={`edit-input-title-${proposal.id}`}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          data-testid={`edit-input-date-${proposal.id}`}
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Costo Aprobado ($)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          data-testid={`edit-input-cost-${proposal.id}`}
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Lugar
                      </label>
                      <EventLocationSelect
                        value={editLocation}
                        onChange={setEditLocation}
                        selectTestId={`edit-select-location-${proposal.id}`}
                        inputTestId={`edit-input-location-${proposal.id}`}
                        variant="dark"
                        selectClassName="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        inputClassName="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="pressable px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        data-testid={`save-edit-approve-btn-${proposal.id}`}
                        onClick={() => handleSaveEditAndApprove(proposal.id)}
                        className="pressable inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar y Aprobar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmación Inline de Rechazo */}
                {isRejecting && canApprove && (
                  <div
                    data-testid={`proposal-reject-form-${proposal.id}`}
                    className="p-4 rounded-2xl bg-rose-950 text-white space-y-3 border border-rose-800"
                  >
                    <p className="text-xs font-bold text-rose-200">
                      ¿Confirmas rechazar esta propuesta de {ORGANIZATION_SHORT_LABELS[proposal.organization]}?
                    </p>
                    <input
                      type="text"
                      data-testid={`reject-reason-input-${proposal.id}`}
                      placeholder="Motivo u observación para el líder (opcional)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-rose-900/70 border border-rose-700 text-xs text-white placeholder:text-rose-300/70 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="pressable px-3 py-1.5 rounded-xl text-xs font-bold text-rose-200 hover:bg-rose-900"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        data-testid={`confirm-reject-btn-${proposal.id}`}
                        onClick={() => handleConfirmReject(proposal)}
                        className="pressable px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white"
                      >
                        Confirmar Rechazo
                      </button>
                    </div>
                  </div>
                )}

                {/* Botonera de Acciones Ejecutivas (Aprobar | Editar | Rechazar) */}
                {canApprove && !isEditing && !isRejecting && (
                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      data-testid={`approve-proposal-btn-${proposal.id}`}
                      onClick={() => handleDirectApprove(proposal)}
                      className="pressable inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`edit-proposal-btn-${proposal.id}`}
                      onClick={() => startEditing(proposal)}
                      className="pressable inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200/80"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`reject-proposal-btn-${proposal.id}`}
                      onClick={() => {
                        setEditingId(null);
                        setRejectingId(proposal.id);
                      }}
                      className="pressable inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Tabla limpia: Aprobados */}
      {mode !== 'WAITING' && (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Aprobados ({resolvedActivities.length})
          </h3>

          {missingOrderedList.length > 0 && (
            <button
              type="button"
              data-testid="approved-missing-lcr-alert"
              onClick={handleJumpToNextMissing}
              className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold hover:bg-amber-100 transition inline-flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {missingOrderedList.length === 1
                  ? '1 evento ya no está en LCR · Ir al evento'
                  : `${missingOrderedList.length} eventos ya no están en LCR · Ir al próximo`}
              </span>
            </button>
          )}

          <div className="hidden sm:block w-12" />
        </div>
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Horario</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Estado</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Organización</th>
                <th className="py-2.5 px-3">Actividad</th>
                <th className="py-2.5 px-3 max-w-[150px]">Lugar</th>
                <th className="py-2.5 pl-3 pr-3 text-right whitespace-nowrap">Monto</th>
                <th className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resolvedActivities.map((act) => {
                const isMissingLcr = missingFromLcrIds.has(act.id);
                const hasRendered = renderedExpenseActivityIds.has(act.id);
                const isLocked = hasRendered && !isSuperAdmin;
                const isHighlighted = highlightedId === act.id;

                return (
                <tr
                  key={act.id}
                  ref={(el) => {
                    rowRefs.current[act.id] = el;
                  }}
                  data-testid={`resolved-activity-${act.id}`}
                  className={`transition ${
                    isHighlighted
                      ? 'bg-amber-50'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-2.5 px-3 text-slate-600 tabular-nums whitespace-nowrap">
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
                    {isMissingLcr ? (
                      <span
                        data-testid={`missing-lcr-status-${act.id}`}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200"
                      >
                        No está en LCR
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          act.status === 'APROBADA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {act.status === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {ORGANIZATION_SHORT_LABELS[act.organization]}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {act.title}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={act.location}>
                    {act.location}
                  </td>
                  <td className="py-2.5 pl-3 pr-3 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                    {act.estimated_cost > 0 ? formatCurrency(act.estimated_cost) : 'Sin costo'}
                  </td>
                  <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {onUpdateApprovedActivity && (
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => openEditApprovedModal(act)}
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
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {(onDeleteActivity || onCancelActivity || onKeepActivity) && (
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
                          Cancelado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal: Opciones de Cancelado / Eliminación */}
      {cancelModalAct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => !modalBusy && setCancelModalAct(null)}
        >
          <div
            data-testid="cancel-activity-modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Gestionar evento
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cancelModalAct.title} ({formatDate(cancelModalAct.event_date)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => !modalBusy && setCancelModalAct(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Este evento ya tiene gastos rendidos. No se puede eliminar ni modificar (solo el Super Admin puede hacerlo).
                </span>
              </div>
            )}

            <div className="space-y-2">
              {onDeleteActivity && (
                <button
                  type="button"
                  disabled={
                    modalBusy ||
                    (renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin)
                  }
                  onClick={async () => {
                    setModalBusy(true);
                    try {
                      await onDeleteActivity(cancelModalAct.id);
                      setCancelModalAct(null);
                    } finally {
                      setModalBusy(false);
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
                    modalBusy ||
                    (renderedExpenseActivityIds.has(cancelModalAct.id) && !isSuperAdmin)
                  }
                  onClick={async () => {
                    setModalBusy(true);
                    try {
                      await onCancelActivity(cancelModalAct.id);
                      setCancelModalAct(null);
                    } finally {
                      setModalBusy(false);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  2. Marcar como Cancelado (conserva el historial)
                </button>
              )}

              {onKeepActivity && (
                <button
                  type="button"
                  disabled={modalBusy}
                  onClick={async () => {
                    setModalBusy(true);
                    try {
                      await onKeepActivity(cancelModalAct.id);
                      setCancelModalAct(null);
                    } finally {
                      setModalBusy(false);
                    }
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition disabled:opacity-45"
                >
                  3. Mantener en el calendario
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Evento Aprobado */}
      {editApprovedAct && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => !modalBusy && setEditApprovedAct(null)}
        >
          <div
            data-testid="edit-approved-modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Editar actividad aprobada
                </h4>
                {editApprovedAct.ical_uid &&
                  !editApprovedAct.ical_uid.startsWith('PROPUESTA_LIDER') &&
                  !editApprovedAct.ical_uid.startsWith('NO_LCR_') && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Al estar vinculada a LCR, la fecha y el título pueden volver a actualizarse desde LCR.
                    </p>
                  )}
              </div>
              <button
                type="button"
                onClick={() => !modalBusy && setEditApprovedAct(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={appDate}
                  onChange={(e) => setAppDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Inicio (opcional)
                  </label>
                  <input
                    type="time"
                    value={appTime}
                    onChange={(e) => setAppTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Fin (opcional)
                  </label>
                  <input
                    type="time"
                    value={appEndTime}
                    onChange={(e) => setAppEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Organización
                </label>
                <select
                  value={appOrg}
                  onChange={(e) => setAppOrg(e.target.value as OrganizationCode)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none"
                >
                  {(Object.keys(ORGANIZATION_LABELS) as OrganizationCode[]).map((orgKey) => (
                    <option key={orgKey} value={orgKey}>
                      {ORGANIZATION_LABELS[orgKey]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Presupuesto estimado ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={appCost}
                  onChange={(e) => setAppCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Lugar
                </label>
                <EventLocationSelect
                  value={appLocation}
                  onChange={setAppLocation}
                  selectClassName="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none"
                  inputClassName="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={appDesc}
                  onChange={(e) => setAppDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={modalBusy}
                onClick={() => setEditApprovedAct(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalBusy}
                onClick={handleSaveApprovedEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {modalBusy ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
