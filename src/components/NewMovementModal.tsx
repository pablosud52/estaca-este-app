import React, { useEffect, useState } from 'react';
import { Banknote, Info, PiggyBank, X } from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getTodayLocalIso,
  parseMmddMontoShortcut,
} from '../lib/formatters';
import { CashWithdrawalRecord, MovementType } from '../types/database';
import { OpenWithdrawalOption } from './ExpenseFormModal';

interface NewMovementModalProps {
  isOpen: boolean;
  defaultResponsible: string;
  openWithdrawals?: OpenWithdrawalOption[];
  existingRefs?: string[];
  onClose: () => void;
  onSave: (
    movement: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => Promise<void>;
}

const MOVEMENT_OPTIONS: Array<{
  id: 'EFECTIVO' | 'DEPOSITO';
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'EFECTIVO', label: 'Retiro de efectivo', icon: Banknote },
  { id: 'DEPOSITO', label: 'Depósito / Devolución', icon: PiggyBank },
];

export const NewMovementModal: React.FC<NewMovementModalProps> = ({
  isOpen,
  defaultResponsible,
  openWithdrawals = [],
  existingRefs = [],
  onClose,
  onSave,
}) => {
  const [movementType, setMovementType] = useState<MovementType>('EFECTIVO');
  const [shortcut, setShortcut] = useState('');
  const [date, setDate] = useState(() => getTodayLocalIso());
  const [refCode, setRefCode] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [responsible, setResponsible] = useState(defaultResponsible);
  const [targetWithdrawalRef, setTargetWithdrawalRef] = useState<string>('AUTO');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMovementType('EFECTIVO');
    setShortcut('');
    setDate(getTodayLocalIso());
    setRefCode('');
    setAmount('');
    setPurpose('');
    setResponsible(defaultResponsible || 'Administrador');
    setTargetWithdrawalRef('AUTO');
    setError(null);
  }, [isOpen, defaultResponsible]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleShortcutChange = (val: string) => {
    setShortcut(val);
    const parsed = parseMmddMontoShortcut(val);
    if (parsed.isValid && parsed.date && parsed.amount !== undefined && parsed.ref) {
      setDate(parsed.date);
      setRefCode(parsed.ref);
      setAmount(String(parsed.amount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresa un monto válido mayor a 0.');
      return;
    }

    if (!date) {
      setError('Selecciona la fecha del movimiento.');
      return;
    }

    if (movementType === 'DEPOSITO' && openWithdrawals.length === 0) {
      setError('No hay retiros de efectivo abiertos a los cuales aplicar este depósito.');
      return;
    }

    const mmdd = `${date.slice(5, 7)}${date.slice(8, 10)}`;
    const cleanRef =
      refCode.trim() ||
      (movementType === 'DEPOSITO'
        ? `DEP-${mmdd}-${Math.round(parsedAmount)}`
        : `${mmdd}-${Math.round(parsedAmount)}`);

    if (existingRefs.some((r) => r.trim().toLowerCase() === cleanRef.toLowerCase())) {
      setError(`Ya existe un movimiento con la referencia "${cleanRef}". Usa una referencia distinta.`);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          withdrawal_ref: cleanRef,
          withdrawal_date: date,
          amount: parsedAmount,
          responsible_person: responsible.trim() || defaultResponsible || 'Administrador',
          purpose:
            purpose.trim() ||
            (movementType === 'DEPOSITO' ? 'Devolución de sobrante en efectivo' : 'Retiro de efectivo'),
          movement_type: movementType,
          status: movementType === 'EFECTIVO' ? 'PENDIENTE_JUSTIFICAR' : 'CERRADO_EN_CERO',
          return_date: null,
          returned_amount: 0,
        },
        movementType === 'DEPOSITO' ? targetWithdrawalRef : undefined
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el movimiento. Intenta nuevamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-movement-modal-title"
        className="w-full max-w-lg max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera fija */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 id="new-movement-modal-title" className="text-base font-extrabold text-slate-900">
              Nuevo Movimiento de Efectivo
            </h3>
            <p className="text-xs text-slate-500">
              Retiros de cajero y depósitos de devolución de sobrantes
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              if (!isSaving) onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido con scroll seguro */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Selector de tipo en pastilla dividida (azul marino institucional) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Tipo de movimiento
              </label>
              <div className="grid grid-cols-2 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden divide-x divide-slate-200">
                {MOVEMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = movementType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setMovementType(opt.id);
                        setError(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-none text-xs font-bold transition ${
                        active
                          ? 'bg-[#072B52] text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                <Info className="w-3.5 h-3.5 text-[#083563] shrink-0 mt-0.5" />
                <span>
                  Los pagos con <strong>Tarjeta</strong> y <strong>Transferencia</strong> se cargan desde{' '}
                  <strong>Gastos</strong> y se reflejan aquí automáticamente.
                </span>
              </p>
            </div>

            {movementType === 'EFECTIVO' && (
              <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80">
                <label className="block text-[11px] font-bold text-[#072B52] mb-1">
                  Atajo rápido (MMDD-MONTO)
                </label>
                <input
                  type="text"
                  data-testid="new-withdrawal-shortcut-input"
                  placeholder="Ej: 1105-20000 (completa fecha, ref. y monto)"
                  value={shortcut}
                  onChange={(e) => handleShortcutChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-200 text-base sm:text-sm font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#083563]"
                />
              </div>
            )}

            {movementType === 'DEPOSITO' && (
              openWithdrawals.length > 0 ? (
                <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/80">
                  <label className="block text-[11px] font-bold text-[#072B52] mb-1">
                    Aplicar depósito a retiro abierto
                  </label>
                  <select
                    value={targetWithdrawalRef}
                    onChange={(e) => setTargetWithdrawalRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-sky-200 text-base sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#083563]"
                  >
                    <option value="AUTO">
                      Automático (cerrar retiros abiertos más antiguos primero)
                    </option>
                    {openWithdrawals.map((w) => (
                      <option key={w.id} value={w.withdrawal_ref}>
                        {w.withdrawal_ref} ({formatDate(w.withdrawal_date)}) — Pendiente:{' '}
                        {formatCurrency(w.pendingToRender)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                  No hay retiros de efectivo abiertos en este momento para aplicar un depósito.
                </div>
              )
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-semibold text-slate-800 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#083563]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Referencia / Código
                </label>
                <input
                  type="text"
                  placeholder={movementType === 'EFECTIVO' ? 'Ej: 1105-20000' : 'Ej: DEP-1105-2000'}
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#083563]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-bold text-slate-900 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#083563]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Responsable</label>
                <input
                  type="text"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#083563]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Propósito / Detalle
              </label>
              <input
                type="text"
                placeholder={
                  movementType === 'DEPOSITO'
                    ? 'Ej: Devolución sobrante retiro actividad...'
                    : 'Ej: Compra materiales Primaria, Actividad HJ...'
                }
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base sm:text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#083563]"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
              >
                {error}
              </p>
            )}
          </div>

          {/* Pie fijo */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (!isSaving) onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 disabled:opacity-40 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || (movementType === 'DEPOSITO' && openWithdrawals.length === 0)}
              data-testid="submit-new-withdrawal-btn"
              className="pressable px-4 py-2 rounded-xl bg-[#083563] hover:bg-[#072B52] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-extrabold shadow-sm transition"
            >
              {isSaving ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
