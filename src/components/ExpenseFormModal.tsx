import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Calendar,
  CreditCard,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  DuplicateDraftMatch,
  findDuplicatesForDraft,
} from '../lib/duplicateDetection';
import {
  formatCurrency,
  formatDate,
  getExpenseWithdrawalAllocations,
  ORGANIZATION_LABELS,
  parseMmddMontoShortcut,
} from '../lib/formatters';
import {
  ActivityRecord,
  ExpenseRecord,
  ExpenseType,
  OrganizationCode,
  SupplierRecord,
  WithdrawalAllocationItem,
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

export interface OpenWithdrawalOption {
  id: number;
  withdrawal_ref: string;
  withdrawal_date: string;
  amount: number;
  pendingToRender: number;
  purpose: string;
}

interface ParticipantRow {
  uid: string;
  organization: OrganizationCode;
  manualAmount: string | null;
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
  openWithdrawals: OpenWithdrawalOption[];
  existingExpenses?: ExpenseRecord[];
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
  openWithdrawals,
  existingExpenses = [],
  onClose,
  onSave,
  onDelete,
  onCreateSupplier,
}) => {
  const [expenseType, setExpenseType] = useState<ExpenseType>('EFECTIVO');
  const [shortcutInput, setShortcutInput] = useState('');
  const [shortcutBadge, setShortcutBadge] = useState<string | null>(null);

  const [activityDate, setActivityDate] = useState(todayIso());
  const [accountingDate, setAccountingDate] = useState(todayIso());
  const [activityDateTouched, setActivityDateTouched] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');

  const [grossAmount, setGrossAmount] = useState('');
  const [externalReimbursement, setExternalReimbursement] = useState('');
  const [directRefNumber, setDirectRefNumber] = useState('');

  // Selección manual opcional de retiros (null = automático FIFO hasta 2 retiros)
  const [manualWithdrawalRef1, setManualWithdrawalRef1] = useState<string | null>(null);
  const [manualWithdrawalRef2, setManualWithdrawalRef2] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState(suppliers[0]?.commercial_name || '');
  const [concept, setConcept] = useState('');
  const [statusLcr, setStatusLcr] = useState<'REGISTRADO_LCR' | 'PENDIENTE_LCR'>('REGISTRADO_LCR');
  const [isReimbursableOai, setIsReimbursableOai] = useState(false);

  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { uid: 'p-1', organization: 'PRIMARIA', manualAmount: null },
  ]);

  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateDraftMatch[]>([]);
  const [pendingSaveRecords, setPendingSaveRecords] = useState<Array<
    Omit<ExpenseRecord, 'id'>
  > | null>(null);

  const isRealExpense =
    expenseType === 'EFECTIVO' ||
    expenseType === 'DIRECTO_TARJETA' ||
    expenseType === 'TRANSFERENCIA';
  const isCashMode = expenseType === 'EFECTIVO';
  const isDirectOrTransfer =
    expenseType === 'DIRECTO_TARJETA' || expenseType === 'TRANSFERENCIA';

  // Retiros disponibles ordenados del más antiguo al más nuevo, sumando lo que ya tenía asignado este gasto si se está editando
  const availableWithdrawals = useMemo(() => {
    const editedMap = new Map<string, number>();
    if (editGroup?.records.length) {
      const first = editGroup.records[0];
      const existingAllocs = getExpenseWithdrawalAllocations({
        withdrawal_allocations: first.withdrawal_allocations,
        withdrawal_ref: first.withdrawal_ref,
        gross_amount: editGroup.records.reduce((acc, r) => acc + Number(r.gross_amount), 0),
      });
      existingAllocs.forEach((a) => {
        editedMap.set(a.withdrawal_ref, (editedMap.get(a.withdrawal_ref) || 0) + a.amount);
      });
    }

    const openRefs = new Set(openWithdrawals.map((w) => w.withdrawal_ref));
    const list = openWithdrawals.map((w) => ({
      ...w,
      effectiveAvailable: Number(
        (w.pendingToRender + (editedMap.get(w.withdrawal_ref) || 0)).toFixed(2)
      ),
    }));

    // Preservar retiros cerrados o de años anteriores ya vinculados al gasto que se edita
    const currentGross = parseFloat(grossAmount.replace(',', '.')) || 0;
    editedMap.forEach((amt, ref) => {
      if (!openRefs.has(ref) && amt > 0) {
        list.push({
          id: -Math.abs(ref.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7)),
          withdrawal_ref: ref,
          withdrawal_date: '0000-00-00',
          amount: amt,
          pendingToRender: 0,
          purpose: 'Retiro cerrado / histórico',
          effectiveAvailable: Number(Math.max(amt, currentGross).toFixed(2)),
        });
      }
    });

    return list
      .filter((w) => w.effectiveAvailable > 0)
      .sort((a, b) => a.withdrawal_date.localeCompare(b.withdrawal_date));
  }, [openWithdrawals, editGroup, grossAmount]);

  // Inicializar formulario al abrir
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

      const detectedType: ExpenseType =
        first.expense_type ||
        (first.is_applied === false
          ? first.activity_id
            ? 'PROYECTADO_ACTIVIDAD'
            : 'PLANIFICADO_SIN_FECHA'
          : first.withdrawal_ref
          ? 'EFECTIVO'
          : 'DIRECTO_TARJETA');

      setExpenseType(detectedType);
      setAccountingDate(first.expense_date);
      setActivityDate(first.activity_date || first.expense_date);
      setActivityDateTouched(true);
      setSelectedActivityId(first.activity_id ? String(first.activity_id) : '');
      setGrossAmount(totalGross.toFixed(2));
      setExternalReimbursement(totalExt > 0 ? totalExt.toFixed(2) : '');
      setDirectRefNumber(first.ref_number || '');
      setSupplierName(first.supplier_name);
      setConcept(first.concept);
      setStatusLcr(first.status === 'PENDIENTE_LCR' ? 'PENDIENTE_LCR' : 'REGISTRADO_LCR');
      setIsReimbursableOai(Boolean(first.is_reimbursable_oai));

      const existingAllocs = getExpenseWithdrawalAllocations({
        withdrawal_allocations: first.withdrawal_allocations,
        withdrawal_ref: first.withdrawal_ref,
        gross_amount: totalGross,
      });
      setManualWithdrawalRef1(existingAllocs[0]?.withdrawal_ref ?? null);
      setManualWithdrawalRef2(existingAllocs[1]?.withdrawal_ref ?? null);

      if (editGroup.records.length === 1) {
        setParticipants([
          { uid: 'p-1', organization: first.organization, manualAmount: null },
        ]);
      } else {
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
      setExpenseType('EFECTIVO');
      setAccountingDate(today);
      setActivityDate(today);
      setActivityDateTouched(false);
      setSelectedActivityId('');
      setGrossAmount('');
      setExternalReimbursement('');
      setDirectRefNumber('');
      setManualWithdrawalRef1(null);
      setManualWithdrawalRef2(null);
      setSupplierName(suppliers[0]?.commercial_name || '');
      setConcept('');
      setStatusLcr('REGISTRADO_LCR');
      setIsReimbursableOai(false);
      setParticipants([{ uid: 'p-1', organization: 'PRIMARIA', manualAmount: null }]);
    }
    setDuplicateMatches([]);
    setPendingSaveRecords(null);
  }, [isOpen, editGroup, suppliers]);

  useEffect(() => {
    setDuplicateMatches([]);
    setPendingSaveRecords(null);
  }, [grossAmount, supplierName, accountingDate, activityDate, directRefNumber, expenseType]);

  const parsedTotalGross = useMemo(() => {
    const n = parseFloat(grossAmount);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  }, [grossAmount]);

  const parsedExternalReimb = useMemo(() => {
    const n = parseFloat(externalReimbursement);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  }, [externalReimbursement]);

  // Cálculo automático de hasta 2 retiros en cascada (modo EFECTIVO)
  const cashCoverage = useMemo(() => {
    if (!isCashMode) {
      return { allocations: [] as WithdrawalAllocationItem[], uncovered: 0, w1: null, w2: null };
    }

    if (availableWithdrawals.length === 0) {
      return {
        allocations: [] as WithdrawalAllocationItem[],
        uncovered: parsedTotalGross,
        w1: null,
        w2: null,
      };
    }

    const w1 =
      (manualWithdrawalRef1 &&
        availableWithdrawals.find((w) => w.withdrawal_ref === manualWithdrawalRef1)) ||
      availableWithdrawals[0];

    if (parsedTotalGross <= 0) {
      return {
        allocations: w1 ? [{ withdrawal_ref: w1.withdrawal_ref, amount: 0 }] : [],
        uncovered: 0,
        w1,
        w2: null,
      };
    }

    const take1 = Number(Math.min(parsedTotalGross, w1.effectiveAvailable).toFixed(2));
    const remainingAfter1 = Number((parsedTotalGross - take1).toFixed(2));
    const allocations: WithdrawalAllocationItem[] = [
      { withdrawal_ref: w1.withdrawal_ref, amount: take1 },
    ];

    let w2 = null;
    let remainingAfter2 = remainingAfter1;

    if (remainingAfter1 > 0) {
      const candidates2 = availableWithdrawals.filter(
        (w) => w.withdrawal_ref !== w1.withdrawal_ref
      );
      w2 =
        (manualWithdrawalRef2 &&
          candidates2.find((w) => w.withdrawal_ref === manualWithdrawalRef2)) ||
        candidates2[0] ||
        null;

      if (w2) {
        const take2 = Number(Math.min(remainingAfter1, w2.effectiveAvailable).toFixed(2));
        remainingAfter2 = Number((remainingAfter1 - take2).toFixed(2));
        if (take2 > 0) {
          allocations.push({ withdrawal_ref: w2.withdrawal_ref, amount: take2 });
        }
      }
    }

    return {
      allocations,
      uncovered: Math.max(0, remainingAfter2),
      w1,
      w2,
    };
  }, [isCashMode, availableWithdrawals, manualWithdrawalRef1, manualWithdrawalRef2, parsedTotalGross]);

  // Cálculo en cascada de participantes (Organizaciones)
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

  const hasInsufficientCash = isCashMode && cashCoverage.uncovered > 0.01;

  const canSubmit =
    !saving &&
    parsedTotalGross > 0 &&
    Boolean(activityDate) &&
    Boolean(accountingDate) &&
    Boolean(concept.trim()) &&
    (isRealExpense ? Boolean(supplierName.trim()) : true) &&
    !hasAllocationMismatch &&
    !hasZeroOrNegativeParticipant &&
    !hasInsufficientCash;

  const usedOrgs = useMemo(
    () => new Set(participants.map((p) => p.organization)),
    [participants]
  );

  const availableOrgsToAdd = useMemo(
    () => TARGET_ORGS.filter((org) => !usedOrgs.has(org)),
    [usedOrgs]
  );

  // Atajo MMDD-MONTO: rellena fecha contable y monto sin pisar el retiro automático abierto
  const handleShortcutChange = (val: string) => {
    setShortcutInput(val);
    const parsed = parseMmddMontoShortcut(val);
    if (parsed.isValid && parsed.date && parsed.amount !== undefined) {
      setAccountingDate(parsed.date);
      if (!activityDateTouched && !editGroup) {
        setActivityDate(parsed.date);
      }
      setGrossAmount(String(parsed.amount));
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
      category: newSupplierCategory.trim() || 'Varios',
      official_invoice: true,
      rating: 5,
      status: 'PENDIENTE',
    });
    setSupplierName(newSupplierName.trim());
    setNewSupplierName('');
    setNewSupplierCategory('');
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

      const extParts =
        parsedExternalReimb > 0
          ? computedParticipants.map((p) =>
              Number(((parsedExternalReimb * p.computedAmount) / parsedTotalGross).toFixed(2))
            )
          : computedParticipants.map(() => 0);

      // En efectivo con 2 retiros, se unen con un espacio para poder copiar directo a LCR
      const finalRefNumber = isCashMode
        ? cashCoverage.allocations.map((a) => a.withdrawal_ref).join(' ')
        : isDirectOrTransfer
        ? directRefNumber.trim() || null
        : null;

      const primaryWithdrawalRef = isCashMode
        ? cashCoverage.allocations[0]?.withdrawal_ref || null
        : null;

      const records: Array<Omit<ExpenseRecord, 'id'>> = computedParticipants.map((p, idx) => {
        const extAmt = extParts[idx] || 0;
        const netAmt = Number(Math.max(0, p.computedAmount - extAmt).toFixed(2));
        // Asignar retiros proporcionalmente al peso de esta fila sobre el total para que la suma de todas las filas cuadre exacto por retiro
        const rowAllocations: WithdrawalAllocationItem[] = isCashMode
          ? cashCoverage.allocations.map((a) => ({
              withdrawal_ref: a.withdrawal_ref,
              amount:
                computedParticipants.length === 1
                  ? a.amount
                  : Number(((a.amount * p.computedAmount) / parsedTotalGross).toFixed(2)),
            }))
          : [];

        return {
          ref_number: finalRefNumber,
          expense_date: isRealExpense ? accountingDate : activityDate,
          activity_date: activityDate,
          activity_id: selectedActivityId ? Number(selectedActivityId) : null,
          shared_group_id: groupId,
          expense_type: expenseType,
          is_applied: isRealExpense,
          withdrawal_allocations: rowAllocations,
          organization: p.organization,
          supplier_name: isRealExpense ? supplierName.trim() : supplierName.trim() || 'Por definir',
          concept: concept.trim(),
          gross_amount: p.computedAmount,
          external_reimbursement: extAmt,
          net_amount: netAmt,
          is_reimbursable_oai: isReimbursableOai,
          status: isRealExpense ? statusLcr : 'PENDIENTE_LCR',
          withdrawal_ref: primaryWithdrawalRef,
        };
      });

      if (isRealExpense && existingExpenses.length > 0 && !pendingSaveRecords) {
        const matches = findDuplicatesForDraft(records, existingExpenses, editGroup?.ids);
        if (matches.length > 0) {
          setDuplicateMatches(matches);
          setPendingSaveRecords(records);
          return;
        }
      }

      await onSave(records, editGroup?.ids);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSaveDespiteDuplicate = async () => {
    if (!pendingSaveRecords) return;
    setSaving(true);
    try {
      await onSave(pendingSaveRecords, editGroup?.ids);
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
              {editGroup ? 'Editar Movimiento' : 'Añadir Gasto'}
            </h3>
            <p className="text-xs text-slate-500">
              Selecciona el tipo de movimiento y asigna una o más organizaciones
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
          {/* Selector de los 5 tipos de gasto */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Real:
              </span>
              {(
                [
                  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                  { id: 'DIRECTO_TARJETA', label: 'Tarjeta', icon: CreditCard },
                  { id: 'TRANSFERENCIA', label: 'Transferencia LCR', icon: Send },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = expenseType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`expense-type-${item.id}`}
                    onClick={() => setExpenseType(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1 mr-1">
                Proyectado:
              </span>
              {(
                [
                  { id: 'PROYECTADO_ACTIVIDAD', label: 'De Actividad' },
                  { id: 'PLANIFICADO_SIN_FECHA', label: 'Sin fecha' },
                ] as const
              ).map((item) => {
                const active = expenseType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`expense-type-${item.id}`}
                    onClick={() => setExpenseType(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      active
                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            {!isRealExpense && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-1.5 font-medium">
                Los gastos proyectados no descuentan el presupuesto real ni afectan retiros ni LCR hasta que los formalices.
              </p>
            )}
          </div>

          {/* Atajo MMDD-MONTO (para reales nuevos) */}
          {!editGroup && isRealExpense && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
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
                placeholder="Ej: 1115-5000 (completa fecha y monto)"
                value={shortcutInput}
                onChange={(e) => handleShortcutChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Vínculo con actividad del calendario + Dos fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {expenseType !== 'PLANIFICADO_SIN_FECHA' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Vincular a actividad del calendario{' '}
                    {expenseType === 'PROYECTADO_ACTIVIDAD' ? '*' : '(opcional)'}
                  </span>
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
            )}

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                {expenseType === 'PLANIFICADO_SIN_FECHA'
                  ? 'Fecha tentativa *'
                  : 'Fecha de la actividad *'}
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

            {isRealExpense && (
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
            )}
          </div>

          {/* Monto Total + Referencia (Directa/Transferencia) o Cobertura automática de Retiros (Efectivo) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
            <div className={isDirectOrTransfer ? 'sm:col-span-5' : 'sm:col-span-12'}>
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

            {isDirectOrTransfer && (
              <div className="sm:col-span-7">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {expenseType === 'TRANSFERENCIA'
                    ? 'N° Referencia Transferencia LCR'
                    : 'N° Cupón / Referencia única (sin separadores)'}
                </label>
                <input
                  type="text"
                  data-testid="expense-ref-input"
                  placeholder={expenseType === 'TRANSFERENCIA' ? 'Ej: TRF1095' : 'Ej: 1095082'}
                  value={directRefNumber}
                  onChange={(e) => setDirectRefNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono"
                />
              </div>
            )}
          </div>

          {/* Bloque de Retiros Automáticos (solo en modo EFECTIVO) */}
          {isCashMode && (
            <div
              data-testid="cash-withdrawal-coverage-box"
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  Retiros de efectivo vinculados (automático)
                </span>
                {cashCoverage.allocations.length === 2 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-white">
                    2 retiros encadenados
                  </span>
                )}
              </div>

              {availableWithdrawals.length === 0 ? (
                <div className="text-xs text-rose-700 font-bold flex flex-wrap items-center justify-between gap-2">
                  <span>No hay retiros en efectivo abiertos con saldo disponible.</span>
                  <button
                    type="button"
                    onClick={() => setExpenseType('PLANIFICADO_SIN_FECHA')}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold"
                  >
                    Dejar como Proyectado (pendiente de fondos)
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Retiro 1 */}
                  {cashCoverage.w1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <select
                        data-testid="withdrawal-select-1"
                        value={cashCoverage.w1.withdrawal_ref}
                        onChange={(e) => setManualWithdrawalRef1(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                      >
                        {availableWithdrawals.map((w) => (
                          <option key={w.withdrawal_ref} value={w.withdrawal_ref}>
                            {w.withdrawal_ref} • Disp: {formatCurrency(w.effectiveAvailable)} (
                            {formatDate(w.withdrawal_date)})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                        Toma: {formatCurrency(cashCoverage.allocations[0]?.amount || 0)}
                      </span>
                    </div>
                  )}

                  {/* Retiro 2 automático si el 1 no alcanzó */}
                  {cashCoverage.w2 && cashCoverage.allocations[1] && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-slate-200/70">
                      <select
                        data-testid="withdrawal-select-2"
                        value={cashCoverage.w2.withdrawal_ref}
                        onChange={(e) => setManualWithdrawalRef2(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                      >
                        {availableWithdrawals
                          .filter((w) => w.withdrawal_ref !== cashCoverage.w1?.withdrawal_ref)
                          .map((w) => (
                            <option key={w.withdrawal_ref} value={w.withdrawal_ref}>
                              {w.withdrawal_ref} • Disp: {formatCurrency(w.effectiveAvailable)} (
                              {formatDate(w.withdrawal_date)})
                            </option>
                          ))}
                      </select>
                      <span className="text-xs font-bold text-slate-700 tabular-nums whitespace-nowrap">
                        Toma: {formatCurrency(cashCoverage.allocations[1].amount)}
                      </span>
                    </div>
                  )}

                  {hasInsufficientCash && (
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-rose-600">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>
                          Faltan {formatCurrency(cashCoverage.uncovered)} por cubrir en retiros abiertos.
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpenseType('PLANIFICADO_SIN_FECHA')}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold"
                      >
                        Pasar a Proyectado (esperando fondos)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
            {isRealExpense && (
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
            )}

            <div className={isRealExpense ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Concepto / Propósito *
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

          {isRealExpense && isAddingSupplier && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Nombre del proveedor *"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
                <input
                  type="text"
                  list="expense-supplier-categories"
                  placeholder="Rubro (opcional)"
                  value={newSupplierCategory}
                  onChange={(e) => setNewSupplierCategory(e.target.value)}
                  className="w-full sm:w-44 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
                <datalist id="expense-supplier-categories">
                  {Array.from(new Set(suppliers.map((s) => s.category).filter(Boolean))).map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleQuickAddSupplier}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Sugerir
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Se usará en este gasto y quedará pendiente para que un Administrador lo revise en Proveedores.
              </p>
            </div>
          )}

          {/* Estado LCR, Reintegro externo y Reembolsable OAI (solo para gastos reales) */}
          {isRealExpense && (
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
          )}

          {duplicateMatches.length > 0 && pendingSaveRecords && (
            <div
              data-testid="expense-duplicate-warning"
              className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-950">
                  <p className="font-extrabold">
                    Posible pago duplicado detectado ({duplicateMatches.length}{' '}
                    {duplicateMatches.length === 1 ? 'coincidencia' : 'coincidencias'})
                  </p>
                  <p className="text-[11px] text-amber-900">
                    Ya existe un gasto muy parecido. Puedes eliminar este ingreso o continuar igualmente para enviarlo a doble revisión en el panel.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {duplicateMatches.map((match) => (
                  <div
                    key={match.movement.key}
                    className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2 font-extrabold text-slate-900">
                      <span className="truncate">{match.movement.primary.concept}</span>
                      <span className="tabular-nums text-rose-700">
                        {formatCurrency(match.movement.totalGross)}
                      </span>
                    </div>
                    <div className="text-slate-600 flex flex-wrap gap-x-2">
                      <span>{formatDate(match.movement.effectiveDate)}</span>
                      <span>· {match.movement.primary.supplier_name}</span>
                      <span>
                        ·{' '}
                        {ORGANIZATION_LABELS[match.movement.primary.organization] ||
                          match.movement.primary.organization}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-amber-800">
                      {match.reasons.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  data-testid="discard-duplicate-expense-btn"
                  onClick={onClose}
                  className="flex-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition"
                >
                  Eliminar gasto ingresado
                </button>
                <button
                  type="button"
                  data-testid="continue-duplicate-expense-btn"
                  disabled={saving}
                  onClick={handleConfirmSaveDespiteDuplicate}
                  className="flex-1 px-3 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 disabled:opacity-50 text-white text-xs font-extrabold transition"
                >
                  {saving ? 'Guardando...' : 'Continuar igualmente (doble revisión)'}
                </button>
              </div>
            </div>
          )}

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
                  : isRealExpense
                  ? 'Guardar gasto'
                  : 'Guardar proyección'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
