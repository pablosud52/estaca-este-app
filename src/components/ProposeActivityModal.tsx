import React, { useEffect, useRef, useState } from 'react';
import { X, CalendarPlus, MapPin, Clock, DollarSign, Sparkles, CheckCircle2 } from 'lucide-react';
import { OrganizationCode } from '../types/database';
import { ORGANIZATION_LABELS } from '../lib/formatters';

interface ProposeActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userOrg: OrganizationCode;
  canUseSeminario: boolean;
  onSubmitProposal: (proposal: {
    title: string;
    event_date: string;
    start_time: string;
    location: string;
    organization: OrganizationCode;
    estimated_cost: number;
    description?: string;
  }) => Promise<void>;
}

export const ProposeActivityModal: React.FC<ProposeActivityModalProps> = ({
  isOpen,
  onClose,
  userOrg,
  canUseSeminario,
  onSubmitProposal,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('2026-11-25');
  const [startTime, setStartTime] = useState('19:00');
  const [location, setLocation] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [isSeminarioJoint, setIsSeminarioJoint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const clickedInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!clickedInDialog) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !eventDate || !location.trim()) {
      setErrorMsg('Por favor completa el nombre, la fecha y el lugar de la actividad.');
      return;
    }

    const parsedCost = estimatedCost.trim() === '' ? 0 : Number(estimatedCost.replace(',', '.'));
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      setErrorMsg('Ingresa un costo estimado válido (0 o mayor).');
      return;
    }

    const targetOrg: OrganizationCode =
      canUseSeminario && isSeminarioJoint ? 'SEMINARIO' : userOrg === 'TODAS' ? 'ESTACA' : userOrg;

    setIsSubmitting(true);
    try {
      await onSubmitProposal({
        title: title.trim(),
        event_date: eventDate,
        start_time: startTime || '19:00',
        location: location.trim(),
        organization: targetOrg,
        estimated_cost: parsedCost,
      });
      // Reset fields
      setTitle('');
      setLocation('');
      setEstimatedCost('');
      setIsSeminarioJoint(false);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la propuesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-testid="propose-activity-modal"
      aria-labelledby="modal-propose-title"
      onCancel={onClose}
      onClick={handleBackdropClick}
      className="p-0 rounded-3xl shadow-2xl border border-slate-200/90 w-[calc(100%-1.5rem)] max-w-md mx-auto my-auto bg-white text-slate-900 overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-propose-title" className="text-base font-extrabold text-slate-900 leading-tight">
                Proponer Actividad
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {canUseSeminario && isSeminarioJoint
                  ? 'Fondo común: Seminario (visible en MMJJ y HHJJ)'
                  : `Organización: ${ORGANIZATION_LABELS[userOrg === 'TODAS' ? 'ESTACA' : userOrg]}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="pressable p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label htmlFor="act-title" className="block text-xs font-bold text-slate-700 mb-1.5">
              Nombre de la Actividad *
            </label>
            <input
              id="act-title"
              data-testid="input-activity-title"
              type="text"
              required
              placeholder="Ej: Noche de Juventud y Testimonio"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="act-date" className="block text-xs font-bold text-slate-700 mb-1.5">
                Fecha *
              </label>
              <input
                id="act-date"
                data-testid="input-activity-date"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="act-time" className="block text-xs font-bold text-slate-700 mb-1.5">
                Horario
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="act-time"
                  data-testid="input-activity-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="act-location" className="block text-xs font-bold text-slate-700 mb-1.5">
              Lugar / Salón *
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="act-location"
                data-testid="input-activity-location"
                type="text"
                required
                placeholder="Ej: Centro de Estaca / Salón Cultural"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="act-cost" className="block text-xs font-bold text-slate-700 mb-1.5">
              Costo Estimado Presupuestado ($)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="act-cost"
                data-testid="input-activity-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0,00 (dejar vacío si no requiere fondos)"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Regla Especial de Seminario para MJ y HJ (ADR-003 / PROJECT_CONTEXT.md §4.1) */}
          {canUseSeminario && (
            <label
              htmlFor="act-seminario-check"
              data-testid="seminario-checkbox-label"
              className={`pressable flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                isSeminarioJoint
                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
                  : 'bg-slate-50 border-slate-200/90 text-slate-700 hover:bg-slate-100/70'
              }`}
            >
              <input
                id="act-seminario-check"
                data-testid="checkbox-seminario"
                type="checkbox"
                checked={isSeminarioJoint}
                onChange={(e) => setIsSeminarioJoint(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Vincular a Seminario (MJ + HJ)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Se asocia al fondo común de Seminario y se visualiza automáticamente tanto en Mujeres Jóvenes como en Hombres Jóvenes.
                </p>
              </div>
            </label>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="pressable px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="submit-activity-btn"
              disabled={isSubmitting}
              className="pressable inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Enviando...' : 'Enviar Propuesta'}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
};
