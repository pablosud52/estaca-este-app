import React, { useEffect, useMemo, useState } from 'react';
import { Check, Wallet } from 'lucide-react';
import { formatCurrency, ORGANIZATION_LABELS } from '../lib/formatters';
import { BudgetAllocation, OrganizationCode } from '../types/database';

const BUDGET_ORGS: OrganizationCode[] = [
  'MJ',
  'HJ',
  'SEMINARIO',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'ESTACA',
];

interface BudgetManagementSectionProps {
  year: number;
  budgets: BudgetAllocation[];
  onSaveBudgetAllocation: (
    allocation: Omit<BudgetAllocation, 'id' | 'total_assigned'> & { id?: number }
  ) => Promise<void>;
  onSavedToast: (msg: string) => void;
}

interface RowDraft {
  id?: number;
  t1: string;
  t2: string;
  t3: string;
  t4: string;
  dirty: boolean;
  saving: boolean;
}

export const BudgetManagementSection: React.FC<BudgetManagementSectionProps> = ({
  year,
  budgets,
  onSaveBudgetAllocation,
  onSavedToast,
}) => {
  const [drafts, setDrafts] = useState<Record<OrganizationCode, RowDraft>>(
    {} as Record<OrganizationCode, RowDraft>
  );

  useEffect(() => {
    const next = {} as Record<OrganizationCode, RowDraft>;
    BUDGET_ORGS.forEach((org) => {
      const existing = budgets.find((b) => b.organization === org && Number(b.year) === year);
      next[org] = {
        id: existing?.id,
        t1: existing ? String(existing.t1_assigned) : '0',
        t2: existing ? String(existing.t2_assigned) : '0',
        t3: existing ? String(existing.t3_assigned) : '0',
        t4: existing ? String(existing.t4_assigned) : '0',
        dirty: false,
        saving: false,
      };
    });
    setDrafts(next);
  }, [budgets, year]);

  const parseNum = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
  };

  const grandTotal = useMemo(
    () =>
      BUDGET_ORGS.reduce((acc, org) => {
        const d = drafts[org];
        if (!d) return acc;
        return acc + parseNum(d.t1) + parseNum(d.t2) + parseNum(d.t3) + parseNum(d.t4);
      }, 0),
    [drafts]
  );

  const handleFieldChange = (
    org: OrganizationCode,
    field: 't1' | 't2' | 't3' | 't4',
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: value,
        dirty: true,
      },
    }));
  };

  const handleSaveRow = async (org: OrganizationCode) => {
    const d = drafts[org];
    if (!d || d.saving) return;

    setDrafts((prev) => ({
      ...prev,
      [org]: { ...prev[org], saving: true },
    }));

    try {
      await onSaveBudgetAllocation({
        id: d.id,
        year,
        organization: org,
        t1_assigned: parseNum(d.t1),
        t2_assigned: parseNum(d.t2),
        t3_assigned: parseNum(d.t3),
        t4_assigned: parseNum(d.t4),
      });
      setDrafts((prev) => ({
        ...prev,
        [org]: { ...prev[org], dirty: false, saving: false },
      }));
      onSavedToast(`Presupuesto ${year} de ${ORGANIZATION_LABELS[org]} guardado.`);
    } catch {
      setDrafts((prev) => ({
        ...prev,
        [org]: { ...prev[org], saving: false },
      }));
    }
  };

  return (
    <div
      data-testid="budget-management-section"
      className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Presupuestos por Organización ({year})
            </h3>
            <p className="text-xs text-slate-500">
              Asigna o ajusta los montos por trimestre (T1 incluye saldo inicial si aplica)
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Anual Asignado
          </span>
          <span className="text-base font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Organización</th>
              <th className="py-3 px-2 text-right">T1 ($)</th>
              <th className="py-3 px-2 text-right">T2 ($)</th>
              <th className="py-3 px-2 text-right">T3 ($)</th>
              <th className="py-3 px-2 text-right">T4 ($)</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
            {BUDGET_ORGS.map((org) => {
              const d = drafts[org];
              if (!d) return null;
              const rowTotal =
                parseNum(d.t1) + parseNum(d.t2) + parseNum(d.t3) + parseNum(d.t4);

              return (
                <tr key={org} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    {ORGANIZATION_LABELS[org]}
                  </td>
                  {(['t1', 't2', 't3', 't4'] as const).map((field) => (
                    <td key={field} className="py-2 px-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={d[field]}
                        onChange={(e) => handleFieldChange(org, field, e.target.value)}
                        className="w-24 sm:w-28 ml-auto block px-2.5 py-1.5 rounded-xl border border-slate-200 focus:border-emerald-700 focus:outline-none text-right text-xs font-semibold tabular-nums bg-white"
                      />
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(rowTotal)}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!d.dirty || d.saving}
                      onClick={() => handleSaveRow(org)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        d.dirty
                          ? 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400 cursor-default'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{d.saving ? 'Guardando' : 'Guardar'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
