import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Trash2,
  X,
} from 'lucide-react';
import { DuplicateGroup, GroupedExpenseMovement } from '../lib/duplicateDetection';
import { formatCurrency, formatDate, ORGANIZATION_LABELS } from '../lib/formatters';

interface DuplicateReviewModalProps {
  isOpen: boolean;
  groups: DuplicateGroup[];
  canEdit?: boolean;
  onClose: () => void;
  onDeleteMovement: (movement: GroupedExpenseMovement) => Promise<void>;
  onIgnoreGroup: (group: DuplicateGroup) => void;
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  DIRECTO_TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  PROYECTADO_ACTIVIDAD: 'Proyectado',
  PLANIFICADO_SIN_FECHA: 'Planificado',
};

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  groups,
  canEdit = true,
  onClose,
  onDeleteMovement,
  onIgnoreGroup,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteKey(null);
      setDeletingKey(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleDetails = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmDelete = async (movement: GroupedExpenseMovement) => {
    setDeletingKey(movement.key);
    try {
      await onDeleteMovement(movement);
      setConfirmDeleteKey(null);
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-review-modal-title"
      data-testid="duplicate-review-modal"
    >
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-amber-50/70">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="duplicate-review-modal-title"
                className="text-base font-extrabold text-slate-900"
              >
                Doble revisión de posibles pagos duplicados
              </h3>
              <p className="text-xs text-slate-600">
                Compara los gastos lado a lado. Elimina el repetido o ignora la alerta si son pagos distintos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {groups.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-extrabold text-slate-800">
                No quedan posibles duplicados por revisar
              </p>
              <p className="text-xs text-slate-500">
                Todos los casos fueron resueltos o confirmados como válidos.
              </p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const allSameAmount = group.movements.every(
                (m) => Math.abs(m.totalGross - group.movements[0].totalGross) < 0.01
              );
              const allSameDate = group.movements.every(
                (m) => m.effectiveDate === group.movements[0].effectiveDate
              );
              const allSameConcept = group.movements.every(
                (m) =>
                  m.primary.concept.trim().toLowerCase() ===
                  group.movements[0].primary.concept.trim().toLowerCase()
              );

              return (
                <section
                  key={group.id}
                  data-testid={`duplicate-group-${idx}`}
                  className="rounded-2xl border border-amber-200 bg-slate-50/70 p-4 space-y-3"
                >
                  {/* Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            group.confidence === 'HIGH'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {group.confidence === 'HIGH'
                            ? 'Coincidencia alta'
                            : 'Coincidencia probable'}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          Caso #{idx + 1} ({group.movements.length} gastos)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        {group.reasons.join(' · ')}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid={`ignore-duplicate-group-${idx}`}
                      onClick={() => onIgnoreGroup(group)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition self-start sm:self-auto"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>No es duplicado (Ignorar)</span>
                    </button>
                  </div>

                  {/* Side-by-side comparison grid on PC, stacked on mobile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.movements.map((mov, mIdx) => {
                      const isExpanded = !!expandedKeys[mov.key];
                      const isConfirming = confirmDeleteKey === mov.key;
                      const isDeleting = deletingKey === mov.key;
                      const orgLabel = mov.isShared
                        ? `Varios (${mov.records.length} orgs)`
                        : ORGANIZATION_LABELS[mov.primary.organization] ||
                          mov.primary.organization;

                      return (
                        <div
                          key={mov.key}
                          data-testid={`duplicate-card-${idx}-${mIdx}`}
                          className="rounded-2xl bg-white border border-slate-200 p-3.5 flex flex-col justify-between gap-3 shadow-sm"
                        >
                          <div className="space-y-2.5">
                            {/* Top badge + Amount */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  {mIdx === 0 ? 'Gasto más reciente' : `Gasto #${mIdx + 1}`} ·{' '}
                                  {orgLabel}
                                </span>
                                <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                                  {mov.primary.concept}
                                </h4>
                              </div>
                              <span
                                className={`text-sm font-extrabold tabular-nums px-2 py-0.5 rounded-lg ${
                                  allSameAmount
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-slate-100 text-slate-900'
                                }`}
                              >
                                {formatCurrency(mov.totalGross)}
                              </span>
                            </div>

                            {/* Key comparison rows with difference highlighting */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div
                                className={`p-2 rounded-xl ${
                                  allSameDate ? 'bg-amber-50/70' : 'bg-sky-50/70'
                                }`}
                              >
                                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                  Fecha {!allSameDate && '(Distinta)'}
                                </span>
                                <span className="font-bold text-slate-800">
                                  {formatDate(mov.effectiveDate)}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-50">
                                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                  Proveedor
                                </span>
                                <span className="font-bold text-slate-800 truncate block">
                                  {mov.primary.supplier_name || '—'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                              <span>
                                Comprobante:{' '}
                                <strong className="text-slate-800">
                                  {mov.primary.ref_number || 'Sin ref.'}
                                </strong>
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  mov.isPendingLcr
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {mov.isPendingLcr ? 'Pendiente LCR' : 'Registrado LCR'}
                              </span>
                            </div>

                            {!allSameConcept && (
                              <p className="text-[11px] text-sky-700 font-semibold">
                                Concepto distinto al otro gasto del par.
                              </p>
                            )}

                            {/* Expandable full details */}
                            <button
                              type="button"
                              onClick={() => toggleDetails(mov.key)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Ocultar detalle</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>Ver detalle completo</span>
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Fecha contable / LCR:</span>
                                  <strong className="text-slate-800">
                                    {formatDate(mov.accountingDate)}
                                  </strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Medio de pago:</span>
                                  <strong className="text-slate-800">
                                    {EXPENSE_TYPE_LABELS[mov.primary.expense_type || ''] ||
                                      mov.primary.expense_type ||
                                      '—'}
                                  </strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Monto neto:</span>
                                  <strong className="text-slate-800">
                                    {formatCurrency(mov.totalNet)}
                                  </strong>
                                </div>
                                {mov.isShared && (
                                  <div className="pt-1 border-t border-slate-200 space-y-0.5">
                                    <span className="font-bold text-slate-700 block">
                                      Distribución compartida:
                                    </span>
                                    {mov.records.map((r) => (
                                      <div key={r.id} className="flex justify-between">
                                        <span>
                                          {ORGANIZATION_LABELS[r.organization] || r.organization}
                                        </span>
                                        <span>{formatCurrency(r.gross_amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Card Action: Delete */}
                          {canEdit && (
                            <div className="pt-2 border-t border-slate-100">
                              {isConfirming ? (
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    data-testid={`confirm-delete-duplicate-${idx}-${mIdx}`}
                                    onClick={() => handleConfirmDelete(mov)}
                                    className="flex-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold transition"
                                  >
                                    {isDeleting ? 'Eliminando...' : 'Confirmar eliminar'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`delete-duplicate-${idx}-${mIdx}`}
                                  onClick={() => setConfirmDeleteKey(mov.key)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar este gasto</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#072B52] hover:bg-[#083563] text-white text-xs font-extrabold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
