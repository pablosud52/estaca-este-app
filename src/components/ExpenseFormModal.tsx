import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Plus,
  RotateCcw,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildMmddMontoRef,
  formatCurrency,
  formatDate,
  ORGANIZATION_LABELS,
  parseMmddMontoShortcut,
} from '../lib/formatters';
import {
  ActivityRecord,
  ExpenseRecord,
  OrganizationCode,
  SupplierRecord,
} from '../types/database';

const TARGET_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'SEMINARIO',
  'ESTACA',
];

interface ParticipantRow {
  uid: string;
  organization: OrganizationCode;
  manualAmount: string | null; // null = calculado automáticamente en gris
}

export interface ExpenseGroupEditData {
  ids: number[];
  records: ExpenseRecord[];
}

interface ExpenseFormModalProps {
  isOpen: boolean;
  editGroup: ExpenseGroupEditData | null;
  activities: ActivityRecord[];
  suppliers: SupplierRecord[];
  onClose: () => void;
  onSave: (
    records: Array<Omit<ExpenseRecord, 'id'>>,
    existingIds?: number[]
  ) => Promise<void>;
  onDelete?: (ids: number[]) => Promise<void>;
  onCreateSupplier: (supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, idx) =>
    Number(((baseCents + (idx === count - 1 ? remainder : 0)) / 100).toFixed(2))
  );
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  editGroup,
  activities,
  suppliers,
  onClose,
  onSave,
  onDelete,
  onCreateSupplier,
}) => {
  const [shortcutInput, setShortcutInput] = useState('');
  const [shortcutBadge, setShortcutBadge] = useState<string | null>(null);
  const [isDirectExpense, setIsDirectExpense] = useState(false);

  const [activityDate, setActivityDate] = useState(todayIso());
  const [accountingDate, setAccountingDate] = useState(todayIso());
  const [activityDateTouched, setActivityDateTouched] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');

  const [grossAmount, setGrossAmount] = useState('');
  const [externalReimbursement, setExternalReimbursement] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [supplierName, setSupplierName] = useState(suppliers[0]?.commercial_name || '');
  const [concept, setConcept] = useState('');
  const [statusLcr, setStatusLcr] = useState<'REGISTRADO_LCR' | 'PENDIENTE_LCR'>('REGISTRADO_LCR');
  const [isReimbursableOai, setIsReimbursableOai] = useState(false);

  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { uid: 'p-1', organization: 'PRIMARIA', manualAmount: null },
  ]);

  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRut, setNewSupplierRut] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inicializar formulario al abrir (nuevo o edición)
  useEffect(() => {
    if (!isOpen) return;
    setConfirmDelete(false);
    setIsAddingSupplier(false);
    setShortcutInput('');
    setShortcutBadge(null);

    if (editGroup && editGroup.records.length > 0) {
      const first = editGroup.records[0];
      const totalGross = editGroup.records.reduce((acc, r) => acc + Number(r.gross_amount), 0);
      const totalExt = editGroup.records.reduce(
        (acc, r) => acc + Number(r.external_reimbursement || 0),
        0
      );

      setAccountingDate(first.expense_date);
      setActivityDate(first.activity_date || first.expense_date);
      setActivityDateTouched(true);
      setSelectedActivityId(first.activity_id ? String(first.activity_id) : '');
      setGrossAmount(totalGross.toFixed(2));
      setExternalReimbursement(totalExt > 0 ? totalExt.toFixed(2) : '');
      setRefNumber(first.ref_number || '');
      setIsDirectExpense(!first.withdrawal_ref);
      setSupplierName(first.supplier_name);
      setConcept(first.concept);
      setStatusLcr(first.status === 'PENDIENTE_LCR' ? 'PENDIENTE_LCR' : 'REGISTRADO_LCR');
      setIsReimbursableOai(Boolean(first.is_reimbursable_oai));

      if (editGroup.records.length === 1) {
        setParticipants([
          { uid: 'p-1', organization: first.organization, manualAmount: null },
        ]);
      } else {
        // Si todas las cuotas son casi iguales, dejar en automático; si difieren, cargar como manual
        const evenParts = distributeEvenly(totalGross, editGroup.records.length);
        const isEven = editGroup.records.every(
          (r, idx) => Math.abs(Number(r.gross_amount) - evenParts[idx]) < 0.02
        );
        setParticipants(
          editGroup.records.map((r, idx) => ({
            uid: `p-${idx + 1}`,
            organization: r.organization,
            manualAmount: isEven ? null : Number(r.gross_amount).toFixed(2),
          }))
        );
      }
    } else {
      const today = todayIso();
      setAccountingDate(today);
      setActivityDate(today);
      setActivityDateTouched(false);
      setSelectedActivityId('');
      setGrossAmount('');
      setExternalReimbursement('');
      setRefNumber('');
      setIsDirectExpense(false);
      setSupplierName(suppliers[0]?.commercial_name || '');
      setConcept('');
      setStatusLcr('REGISTRADO_LCR');
      setIsReimbursableOai(false);
      setParticipants([{ uid: 'p-1', organization: 'PRIMARIA', manualAmount: null }]);
    }
  }, [isOpen, editGroup, suppliers]);

  const parsedTotalGross = useMemo(() => {
    const n = parseFloat(grossAmount);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  }, [grossAmount]);

  const parsedExternalReimb = useMemo(() => {
    const n = parseFloat(externalReimbursement);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  }, [externalReimbursement]);

  // Cálculo en cascada de participantes:
  // - Los modificados manualmente conservan su monto fijo.
  // - El saldo restante se divide automáticamente entre los que NO fueron modificados.
  const computedParticipants = useMemo(() => {
    if (participants.length === 1) {
      return participants.map((p) => ({
        ...p,
        computedAmount: parsedTotalGross,
        isAuto: true,
      }));
    }

    const manualRows = participants.filter((p) => p.manualAmount !== null);
    const autoRows = participants.filter((p) => p.manualAmount === null);

    const manualSum = manualRows.reduce((acc, p) => {
      const val = parseFloat(p.manualAmount || '0');
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);

    const remaining = Number((parsedTotalGross - manualSum).toFixed(2));
    const autoAmounts =
      autoRows.length > 0 ? distributeEvenly(Math.max(0, remaining), autoRows.length) : [];

    let autoIdx = 0;
    return participants.map((p) => {
      if (p.manualAmount !== null) {
        const val = parseFloat(p.manualAmount);
        return {
          ...p,
          computedAmount: Number.isFinite(val) ? Number(val.toFixed(2)) : 0,
          isAuto: false,
        };
      }
      // Si el saldo restante ya es <= 0, el automático queda en 0 para disparar la alerta
      const amt = remaining <= 0 ? 0 : autoAmounts[autoIdx] ?? 0;
      autoIdx += 1;
      return {
        ...p,
        computedAmount: amt,
        isAuto: true,
      };
    });
  }, [participants, parsedTotalGross]);

  const assignedSum = useMemo(
    () =>
      Number(
        computedParticipants.reduce((acc, p) => acc + p.computedAmount, 0).toFixed(2)
      ),
    [computedParticipants]
  );

  const allocationDiff = useMemo(
    () => Number((parsedTotalGross - assignedSum).toFixed(2)),
    [parsedTotalGross, assignedSum]
  );

  const hasZeroOrNegativeParticipant = useMemo(
    () =>
      parsedTotalGross > 0 &&
      computedParticipants.some((p) => p.computedAmount <= 0),
    [computedParticipants, parsedTotalGross]
  );

  const hasAllocationMismatch =
    parsedTotalGross > 0 && Math.abs(allocationDiff) > 0.01;

  const canSubmit =
    !saving &&
    parsedTotalGross > 0 &&
    Boolean(activityDate) &&
    Boolean(accountingDate) &&
    Boolean(concept.trim()) &&
    Boolean(supplierName.trim()) &&
    !hasAllocationMismatch &&
    !hasZeroOrNegativeParticipant;

  const usedOrgs = useMemo(
    () => new Set(participants.map((p) => p.organization)),
    [participants]
  );

  const availableOrgsToAdd = useMemo(
    () => TARGET_ORGS.filter((org) => !usedOrgs.has(org)),
    [usedOrgs]
  );

  const handleShortcutChange = (val: string) => {
    setShortcutInput(val);
    const parsed = parseMmddMontoShortcut(val);
    if (parsed.isValid && parsed.date && parsed.amount !== undefined && parsed.ref) {
      setAccountingDate(parsed.date);
      if (!activityDateTouched && !editGroup) {
        setActivityDate(parsed.date);
      }
      setGrossAmount(String(parsed.amount));
      if (!isDirectExpense) {
        setRefNumber(parsed.ref);
      }
      setShortcutBadge(`${formatDate(parsed.date)} • ${formatCurrency(parsed.amount)}`);
    } else {
      setShortcutBadge(null);
    }
  };

  const handleAccountingDateOrAmountChange = (nextDate: string, nextAmount: string) => {
    setAccountingDate(nextDate);
    if (!activityDateTouched && !editGroup) {
      setActivityDate(nextDate);
    }
    setGrossAmount(nextAmount);
    if (!isDirectExpense && nextDate && nextAmount && Number(nextAmount) > 0) {
      setRefNumber(buildMmddMontoRef(nextDate, Number(nextAmount)));
    }
  };

  const handleActivityLinkChange = (actIdStr: string) => {
    setSelectedActivityId(actIdStr);
    if (!actIdStr) return;
    const found = activities.find((a) => String(a.id) === actIdStr);
    if (found) {
      setActivityDate(found.event_date);
      setActivityDateTouched(true);
      if (!concept.trim()) {
        setConcept(found.title);
      }
    }
  };

  const handleAddParticipant = () => {
    if (availableOrgsToAdd.length === 0) return;
    setParticipants((prev) => [
      ...prev,
      {
        uid: `p-${Date.now()}-${prev.length + 1}`,
        organization: availableOrgsToAdd[0],
        manualAmount: null,
      },
    ]);
  };

  const handleRemoveParticipant = (uid: string) => {
    if (participants.length <= 1) return;
    setParticipants((prev) => prev.filter((p) => p.uid !== uid));
  };

  const handleParticipantOrgChange = (uid: string, nextOrg: OrganizationCode) => {
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, organization: nextOrg } : p))
    );
  };

  const handleParticipantAmountChange = (uid: string, val: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.uid === uid ? { ...p, manualAmount: val === '' ? null : val } : p
      )
    );
  };

  const handleResetParticipantAuto = (uid: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, manualAmount: null } : p))
    );
  };

  const handleQuickAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    await onCreateSupplier({
      commercial_name: newSupplierName.trim(),
      rut: newSupplierRut.trim() || undefined,
      category: 'Comercio General',
      official_invoice: true,
      rating: 5,
    });
    setSupplierName(newSupplierName.trim());
    setNewSupplierName('');
    setNewSupplierRut('');
    setIsAddingSupplier(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const existingGroupId = editGroup?.records[0]?.shared_group_id || null;
      const groupId =
        computedParticipants.length > 1
          ? existingGroupId || `grp-${Date.now()}`
          : null;

      // Prorratear reintegro externo proporcionalmente si hubiera
      const extParts =
        parsedExternalReimb > 0
          ? computedParticipants.map((p) =>
              Number(((parsedExternalReimb * p.computedAmount) / parsedTotalGross).toFixed(2))
            )
          : computedParticipants.map(() => 0);

      const records: Array<Omit<ExpenseRecord, 'id'>> = computedParticipants.map((p, idx) => {
        const extAmt = extParts[idx] || 0;
        const netAmt = Number(Math.max(0, p.computedAmount - extAmt).toFixed(2));
        return {
          ref_number: refNumber.trim() || null,
          expense_date: accountingDate,
          activity_date: activityDate,
          activity_id: selectedActivityId ? Number(selectedActivityId) : null,
          shared_group_id: groupId,
          organization: p.organization,
          supplier_name: supplierName.trim(),
          concept: concept.trim(),
          gross_amount: p.computedAmount,
          external_reimbursement: extAmt,
          net_amount: netAmt,
          is_reimbursable_oai: isReimbursableOai,
          status: statusLcr,
          withdrawal_ref: isDirectExpense ? null : refNumber.trim() || null,
        };
      });

      await onSave(records, editGroup?.ids);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-modal-title"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 id="expense-modal-title" className="text-base font-extrabold text-slate-900">
              {editGroup ? 'Editar Comprobante de Gasto' : 'Añadir Gasto'}
            </h3>
            <p className="text-xs text-slate-500">
              Registra el movimiento contable y asigna una o más organizaciones
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Atajo MMDD-MONTO + Gasto Directo */}
          {!editGroup && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="modal-mmdd-input"
                  className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Atajo rápido MMDD-MONTO</span>
                </label>
                {shortcutBadge && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-800 text-white tabular-nums">
                    {shortcutBadge}
                  </span>
                )}
              </div>
              <input
                id="modal-mmdd-input"
                data-testid="mmdd-shortcut-input"
                type="text"
                placeholder="Ej: 1115-5000 (15/11 y $ 5.000,00)"
                value={shortcutInput}
                onChange={(e) => handleShortcutChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Vínculo opcional con actividad del calendario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Vincular a actividad del calendario (opcional)</span>
              </label>
              <select
                value={selectedActivityId}
                onChange={(e) => handleActivityLinkChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              >
                <option value="">— Sin vincular (carga libre) —</option>
                {activities
                  .filter((a) => a.status !== 'CANCELADA' && a.status !== 'RECHAZADA')
                  .map((act) => (
                    <option key={act.id} value={act.id}>
                      {formatDate(act.event_date)} • {act.title} ({ORGANIZATION_LABELS[act.organization]})
                    </option>
                  ))}
              </select>
            </div>

            {/* Dos fechas distintas */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Fecha de la actividad *
              </label>
              <input
                type="date"
                required
                data-testid="expense-activity-date-input"
                value={activityDate}
                onChange={(e) => {
                  setActivityDate(e.target.value);
                  setActivityDateTouched(true);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Visible al líder y define el trimestre
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha contable / LCR *
              </label>
              <input
                type="date"
                required
                data-testid="expense-date-input"
                value={accountingDate}
                onChange={(e) =>
                  handleAccountingDateOrAmountChange(e.target.value, grossAmount)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm tabular-nums"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">
                Uso interno de control y rendición LCR
              </p>
            </div>
          </div>

          {/* Monto Total + Referencia + Tipo Directo */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Monto total del gasto ($) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                data-testid="expense-gross-amount-input"
                placeholder="0,00"
                value={grossAmount}
                onChange={(e) =>
                  handleAccountingDateOrAmountChange(accountingDate, e.target.value)
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-extrabold tabular-nums"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isDirectExpense ? 'N° Cupón / Ref. Directa' : 'Ref. Retiro (MMDD-MONTO)'}
              </label>
              <input
                type="text"
                data-testid="expense-ref-input"
                placeholder={isDirectExpense ? 'Ej: TX-401' : 'MMDD-MONTO'}
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-3 sm:pt-6">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="direct-expense-checkbox"
                  checked={isDirectExpense}
                  onChange={(e) => setIsDirectExpense(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-700"
                />
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                <span>Directo</span>
              </label>
            </div>
          </div>

          {/* Organización y Participantes (Reparto automático en cascada) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold text-slate-800">
                  Organización y reparto
                </span>
                {parsedTotalGross > 0 && hasAllocationMismatch && (
                  <span
                    data-testid="allocation-diff-error"
                    className="text-sm sm:text-base font-extrabold text-rose-600 tabular-nums"
                  >
                    {allocationDiff > 0
                      ? `Faltan ${formatCurrency(allocationDiff)}`
                      : `Sobregiro ${formatCurrency(Math.abs(allocationDiff))}`}
                  </span>
                )}
              </div>

              {availableOrgsToAdd.length > 0 && (
                <button
                  type="button"
                  data-testid="add-participant-btn"
                  onClick={handleAddParticipant}
                  className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-800"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Añadir</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {computedParticipants.map((p, idx) => {
                const isSingle = computedParticipants.length === 1;
                const isInvalidZero = parsedTotalGross > 0 && p.computedAmount <= 0;

                return (
                  <div
                    key={p.uid}
                    data-testid={`participant-row-${idx}`}
                    className="flex items-center gap-2"
                  >
                    <select
                      value={p.organization}
                      onChange={(e) =>
                        handleParticipantOrgChange(p.uid, e.target.value as OrganizationCode)
                      }
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold bg-white"
                    >
                      {TARGET_ORGS.filter(
                        (org) => org === p.organization || !usedOrgs.has(org)
                      ).map((org) => (
                        <option key={org} value={org}>
                          {ORGANIZATION_LABELS[org]}
                        </option>
                      ))}
                    </select>

                    <div className="relative w-36 sm:w-40 flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        data-testid={`participant-amount-${idx}`}
                        disabled={isSingle}
                        value={
                          p.isAuto
                            ? parsedTotalGross > 0
                              ? p.computedAmount.toFixed(2)
                              : ''
                            : p.manualAmount ?? ''
                        }
                        onChange={(e) =>
                          handleParticipantAmountChange(p.uid, e.target.value)
                        }
                        placeholder="0,00"
                        className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm font-bold tabular-nums text-right ${
                          isInvalidZero
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : p.isAuto
                            ? 'border-slate-200 bg-slate-200/70 text-slate-600'
                            : 'border-emerald-600 bg-white text-slate-900'
                        }`}
                      />
                      {!isSingle && !p.isAuto && (
                        <button
                          type="button"
                          title="Volver a cálculo automático"
                          onClick={() => handleResetParticipantAuto(p.uid)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {!isSingle && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.uid)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        aria-label="Quitar organización"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {hasZeroOrNegativeParticipant && (
              <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Cada organización agregada debe tener un monto mayor a $ 0,00.</span>
              </p>
            )}
          </div>

          {/* Proveedor y Concepto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Proveedor *</label>
                <button
                  type="button"
                  onClick={() => setIsAddingSupplier((v) => !v)}
                  className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <Store className="w-3 h-3" />
                  <span>{isAddingSupplier ? 'Cancelar' : '+ Nuevo'}</span>
                </button>
              </div>
              <select
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.commercial_name}>
                    {s.commercial_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Concepto / Descripción *
              </label>
              <input
                type="text"
                required
                data-testid="expense-concept-input"
                placeholder="Ej: Compra de materiales para actividad"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
              />
            </div>
          </div>

          {isAddingSupplier && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Nombre comercial *"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <input
                type="text"
                placeholder="RUT (opcional)"
                value={newSupplierRut}
                onChange={(e) => setNewSupplierRut(e.target.value)}
                className="w-full sm:w-36 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />
              <button
                type="button"
                onClick={handleQuickAddSupplier}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Guardar
              </button>
            </div>
          )}

          {/* Estado LCR, Reintegro externo y Reembolsable OAI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado LCR</label>
              <select
                value={statusLcr}
                onChange={(e) =>
                  setStatusLcr(e.target.value as 'REGISTRADO_LCR' | 'PENDIENTE_LCR')
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
              >
                <option value="REGISTRADO_LCR">✓ Registrado en LCR</option>
                <option value="PENDIENTE_LCR">Pendiente asentar LCR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reintegro otras estacas ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={externalReimbursement}
                onChange={(e) => setExternalReimbursement(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs tabular-nums"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReimbursableOai}
                  onChange={(e) => setIsReimbursableOai(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-700"
                />
                <span>Reembolsable OAI</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div>
              {editGroup && onDelete && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onDelete(editGroup.ids);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
                    >
                      Confirmar eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="submit-quick-expense-btn"
                disabled={!canSubmit}
                className="pressable px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-extrabold shadow-sm transition"
              >
                {saving
                  ? 'Guardando...'
                  : editGroup
                  ? 'Guardar cambios'
                  : 'Guardar gasto'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
