import React, { useEffect, useState } from 'react';
import { Banknote, CreditCard, ArrowLeftRight, PiggyBank, X } from 'lucide-react';
import { formatCurrency, formatDate, parseMmddMontoShortcut } from '../lib/formatters';
import { CashWithdrawalRecord, MovementType } from '../types/database';
import { OpenWithdrawalOption } from './ExpenseFormModal';

interface NewMovementModalProps {
  isOpen: boolean;
  defaultResponsible: string;
  openWithdrawals?: OpenWithdrawalOption[];
  onClose: () => void;
  onSave: (
    movement: Omit<CashWithdrawalRecord, 'id'>,
    targetWithdrawalRef?: string
  ) => Promise<void>;
}

const MOVEMENT_OPTIONS: Array<{
  id: MovementType;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'EFECTIVO', label: 'Retiro', icon: Banknote },
  { id: 'DIRECTO_TARJETA', label: 'Tarjeta', icon: CreditCard },
  { id: 'TRANSFERENCIA', label: 'Transf.', icon: ArrowLeftRight },
  { id: 'DEPOSITO', label: 'Depósito', icon: PiggyBank },
];

export const NewMovementModal: React.FC<NewMovementModalProps> = ({
  isOpen,
  defaultResponsible,
  openWithdrawals = [],
  onClose,
  onSave,
}) => {
  const [movementType, setMovementType] = useState<MovementType>('EFECTIVO');
  const [shortcut, setShortcut] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    setDate(new Date().toISOString().slice(0, 10));
    setRefCode('');
    setAmount('');
    setPurpose('');
    setResponsible(defaultResponsible || 'Pablo Lamela');
    setTargetWithdrawalRef('AUTO');
    setError(null);
  }, [isOpen, defaultResponsible]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

    const cleanRef = refCode.trim() || `${date.slice(5, 7)}${date.slice(8, 10)}-${Math.round(parsedAmount)}`;
    if (!date) {
      setError('Selecciona la fecha del movimiento.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          withdrawal_ref: cleanRef,
          withdrawal_date: date,
          amount: parsedAmount,
          responsible_person: responsible.trim() || defaultResponsible || 'Pablo Lamela',
          purpose: purpose.trim() || 'Movimiento sin detalle',
          movement_type: movementType,
          status: movementType === 'EFECTIVO' ? 'PENDIENTE_JUSTIFICAR' : 'CERRADO_EN_CERO',
          return_date: null,
          returned_amount: 0,
        },
        movementType === 'DEPOSITO' ? targetWithdrawalRef : undefined
      );
      onClose();
    } catch {
      setError('No se pudo guardar el movimiento. Intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-movement-modal-title"
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 id="new-movement-modal-title" className="text-base font-extrabold text-slate-900">
              Nuevo Movimiento
            </h3>
            <p className="text-xs text-slate-500">
              Retiros, compras con tarjeta, transferencias y depósitos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Selector de tipo en pastilla dividida */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Tipo de movimiento
            </label>
            <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              {MOVEMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = movementType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMovementType(opt.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[11px] font-bold transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {movementType === 'EFECTIVO' && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Atajo rápido (MMDD-MONTO)
              </label>
              <input
                type="text"
                data-testid="new-withdrawal-shortcut-input"
                placeholder="Ej: 1105-20000 (completa fecha, ref. y monto)"
                value={shortcut}
                onChange={(e) => handleShortcutChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          )}

          {movementType === 'DEPOSITO' && openWithdrawals.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
              <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                Aplicar depósito a retiro abierto
              </label>
              <select
                value={targetWithdrawalRef}
                onChange={(e) => setTargetWithdrawalRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Referencia / Código
              </label>
              <input
                type="text"
                placeholder={movementType === 'EFECTIVO' ? 'Ej: 1105-20000' : 'Ej: TX-1094 o N° cupón'}
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Monto ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Responsable</label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Propósito / Detalle
            </label>
            <input
              type="text"
              placeholder="Ej: Compra materiales Primaria, Depósito sobrante retiro..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-testid="submit-new-withdrawal-btn"
              className="pressable px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm transition"
            >
              {isSaving ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
