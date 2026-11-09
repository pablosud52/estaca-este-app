import React, { useState } from 'react';
import {
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
import { formatCurrency, formatDate, ORGANIZATION_LABELS, ORGANIZATION_SHORT_LABELS } from '../lib/formatters';
import { ActivityRecord } from '../types/database';

interface ActivityApprovalTrayProps {
  activities: ActivityRecord[];
  canApprove: boolean;
  userFullName: string;
  userCalling: string;
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
}

export const ActivityApprovalTray: React.FC<ActivityApprovalTrayProps> = ({
  activities,
  canApprove,
  userFullName,
  userCalling,
  onApproveActivity,
  onRejectActivity,
  onEditAndApproveActivity,
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

  const pendingProposals = activities.filter((a) => a.status === 'PROPUESTA');
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
      aria-label="Bandeja de Aprobación de Actividades"
      data-testid="activity-approval-tray"
      className="space-y-5"
    >
      {/* Cabecera de la Bandeja */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center flex-shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Bandeja de Aprobación de Actividades
              </h2>
              <span
                data-testid="tray-pending-count-badge"
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full tabular-nums ${
                  pendingProposals.length > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {pendingProposals.length} pendiente{pendingProposals.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Revisión ejecutiva de eventos y presupuestos propuestos por las organizaciones de la Estaca.
            </p>
          </div>
        </div>

        {/* Estado de Permiso Granular (PROJECT_CONTEXT.md §2 y §4.2) */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {canApprove ? (
            <span
              data-testid="approval-permission-active"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firma Autorizada ({userCalling})</span>
            </span>
          ) : (
            <span
              data-testid="approval-permission-readonly"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Modo Lectura ({userFullName})</span>
            </span>
          )}
        </div>
      </div>

      {/* Aviso si el secretario no tiene permiso de aprobar */}
      {!canApprove && (
        <div
          data-testid="readonly-presidency-notice"
          className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-center gap-3"
        >
          <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            Tu perfil en Presidencia tiene acceso de consulta ejecutiva. La acción de aprobar, editar o rechazar propuestas está reservada al Presidente, Consejeros, Secretario Financiero o secretarios con delegación expresa.
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

      {/* Lista de Propuestas Pendientes */}
      {pendingProposals.length === 0 ? (
        <div
          data-testid="empty-pending-proposals"
          className="bg-white rounded-3xl p-8 text-center border border-slate-200/90 shadow-sm"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            ¡Bandeja al día! No hay propuestas pendientes
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Todas las solicitudes de actividades enviadas por los líderes han sido revisadas.
          </p>
        </div>
      ) : (
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
                        Lugar / Salón
                      </label>
                      <input
                        type="text"
                        data-testid={`edit-input-location-${proposal.id}`}
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

      {/* Historial Reciente de Actividades Aprobadas / Resueltas */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
          Agenda Oficial Aprobada y Resuelta ({resolvedActivities.length})
        </h3>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
          {resolvedActivities.map((act) => (
            <div
              key={act.id}
              data-testid={`resolved-activity-${act.id}`}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {ORGANIZATION_SHORT_LABELS[act.organization]}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      act.status === 'APROBADA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {act.status === 'APROBADA' ? 'Aprobada' : 'Rechazada'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">{act.title}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {formatDate(act.event_date)} • {act.location}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-extrabold text-slate-800 tabular-nums">
                  {act.estimated_cost > 0 ? formatCurrency(act.estimated_cost) : 'Sin costo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
