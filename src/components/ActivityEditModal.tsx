import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Link2, Lock, MapPin, X } from 'lucide-react';
import {
  findMatchingLcrEvent,
  isGlobalChurchwideEvent,
  isLcrLinkedActivity,
} from '../lib/calendarHelpers';
import { formatDate, ORGANIZATION_LABELS } from '../lib/formatters';
import { ActivityRecord, OrganizationCode } from '../types/database';
import { EventLocationSelect } from './EventLocationSelect';

const EDITABLE_ORGS: OrganizationCode[] = [
  'ESTACA',
  'MJ',
  'HJ',
  'SEMINARIO',
  'SS',
  'PRIMARIA',
  'JAS',
  'AS',
  'CFS',
];

export interface ActivityEditPayload {
  title: string;
  event_date: string;
  start_time: string | null;
  end_time?: string | null;
  location: string;
  organization: OrganizationCode;
  description: string;
  app_notes: string;
  estimated_cost: number;
}

interface ActivityEditModalProps {
  activity: ActivityRecord | null;
  allActivities?: ActivityRecord[];
  isLocked?: boolean;
  onClose: () => void;
  onSave: (id: number, updates: ActivityEditPayload) => Promise<void>;
}

export const ActivityEditModal: React.FC<ActivityEditModalProps> = ({
  activity,
  allActivities = [],
  isLocked = false,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [organization, setOrganization] = useState<OrganizationCode>('ESTACA');
  const [appNotes, setAppNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isVisible = Boolean(activity && !isGlobalChurchwideEvent(activity));

  useEffect(() => {
    if (!activity) return;
    setTitle(activity.title || '');
    setEventDate(activity.event_date || '');
    setStartTime(activity.start_time || '');
    setEndTime(activity.end_time || '');
    setLocation(activity.location || '');
    setOrganization(
      activity.organization === 'TODAS' || activity.organization === 'CHURCHWIDE'
        ? 'ESTACA'
        : activity.organization
    );
    const initialNotes =
      activity.app_notes ??
      (!isLcrLinkedActivity(activity) ? activity.description || '' : '');
    setAppNotes(initialNotes);
    setEstimatedCost(String(activity.estimated_cost || 0));
    setErrorMsg(null);
  }, [activity]);

  const isLcrLinked = activity ? isLcrLinkedActivity(activity) : false;

  const matchingLcrCandidate = useMemo(() => {
    if (!activity || isLcrLinked) return null;
    return findMatchingLcrEvent(
      {
        id: activity.id,
        title: title.trim() || activity.title,
        event_date: eventDate || activity.event_date,
      },
      allActivities
    );
  }, [activity, isLcrLinked, title, eventDate, allActivities]);

  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isVisible, saving, onClose]);

  if (!isVisible || !activity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || saving) return;

    const parsedCost = Number(String(estimatedCost).replace(',', '.'));
    const safeCost = Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0;

    if (!isLcrLinked && (!title.trim() || !eventDate)) {
      setErrorMsg('Completa el nombre y la fecha de la actividad.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onSave(activity.id, {
        title: isLcrLinked ? activity.title : title.trim() || activity.title,
        event_date: isLcrLinked ? activity.event_date : eventDate || activity.event_date,
        start_time: isLcrLinked
          ? activity.start_time ?? null
          : startTime.trim() || null,
        end_time: isLcrLinked
          ? activity.end_time ?? null
          : endTime.trim() || null,
        location: isLcrLinked
          ? activity.location
          : location.trim() || 'Centro de Estaca',
        organization,
        description: isLcrLinked ? activity.description || '' : appNotes.trim(),
        app_notes: appNotes.trim(),
        estimated_cost: safeCost,
      });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los cambios. Intenta nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/45 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-edit-modal-title"
    >
      <div
        data-testid="edit-approved-modal"
        className="bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[92dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4
              id="activity-edit-modal-title"
              className="text-sm sm:text-base font-extrabold text-slate-900"
            >
              {isLcrLinked
                ? 'Editar datos complementarios'
                : 'Editar actividad'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isLcrLinked
                ? 'Dato oficial de LCR — Título, fecha, horario y lugar se editan en LCR.'
                : 'Evento local aún no vinculado a LCR: puedes editar todos sus datos.'}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {isLocked && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Esta actividad ya tiene gastos rendidos. Solo el Super Admin puede modificarla.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
              {errorMsg}
            </div>
          )}

          {isLcrLinked ? (
            /* Resumen solo lectura de los datos oficiales de LCR */
            <div
              data-testid="lcr-readonly-summary"
              className="rounded-2xl bg-slate-50 border border-slate-200/90 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Información oficial de LCR (solo lectura)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                  <Lock className="w-3 h-3" />
                  Se edita en LCR
                </span>
              </div>

              <p className="text-sm font-extrabold text-slate-900">{activity.title}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(activity.event_date)}
                </span>
                {activity.start_time && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {activity.start_time}
                    {activity.end_time ? ` - ${activity.end_time}` : ''} hs
                  </span>
                )}
                {activity.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {activity.location}
                  </span>
                )}
              </div>

              {activity.description && (
                <div className="pt-1.5 border-t border-slate-200/80">
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Descripción en LCR
                  </span>
                  <p className="text-xs text-slate-600">{activity.description}</p>
                </div>
              )}
            </div>
          ) : (
            /* Campos completos editables para eventos no vinculados a LCR */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nombre de la Actividad *
                </label>
                <input
                  type="text"
                  data-testid="edit-activity-title"
                  disabled={isLocked}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/15 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  data-testid="edit-activity-date"
                  disabled={isLocked}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Inicio (opc.)
                  </label>
                  <input
                    type="time"
                    disabled={isLocked}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Fin (opc.)
                  </label>
                  <input
                    type="time"
                    disabled={isLocked}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Lugar
                </label>
                <EventLocationSelect
                  value={location}
                  onChange={setLocation}
                  selectClassName="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none"
                  inputClassName="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none"
                />
              </div>

              {matchingLcrCandidate && (
                <div
                  data-testid="auto-link-match-banner"
                  className="sm:col-span-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2"
                >
                  <Link2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Coincide con LCR:</strong> "{matchingLcrCandidate.title}" ({formatDate(matchingLcrCandidate.event_date)}). Al guardar se vincularán automáticamente sin duplicarse.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campos complementarios de la app (editables siempre en eventos de Estaca) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Organización
              </label>
              <select
                data-testid="edit-activity-org"
                disabled={isLocked}
                value={organization}
                onChange={(e) => setOrganization(e.target.value as OrganizationCode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 disabled:bg-slate-50"
              >
                {EDITABLE_ORGS.map((orgKey) => (
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
                data-testid="edit-activity-cost"
                disabled={isLocked}
                min="0"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/15 tabular-nums disabled:bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Notas complementarias (visibles para todos)
              </label>
              <textarea
                rows={3}
                data-testid="edit-activity-app-notes"
                disabled={isLocked}
                value={appNotes}
                onChange={(e) => setAppNotes(e.target.value)}
                placeholder="Detalles prácticos que no están en LCR (ej. qué llevar, inscripción, contacto)..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/15 resize-none disabled:bg-slate-50"
              />
              {isLcrLinked && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Se guardan por separado de LCR y no se borran al sincronizar.
                </p>
              )}
            </div>
          </div>

          {/* Botonera */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="save-activity-edit-btn"
              disabled={saving || isLocked}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#083563] text-white hover:bg-[#072B52] disabled:opacity-45 transition"
            >
              {saving ? 'Guardando...' : matchingLcrCandidate ? 'Guardar y vincular con LCR' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
