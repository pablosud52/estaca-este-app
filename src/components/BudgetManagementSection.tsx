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

type QuarterField = 't1' | 't2' | 't3' | 't4';

/**
 * Parsea un string numérico en formato `15.000,50` o `15000.50` o `15000,50` a número.
 */
function parseLocaleAmount(raw: string): number {
  const clean = raw.trim();
  if (!clean) return 0;
  // Si tiene coma, asumimos punto como separador de miles y coma como decimal
  if (clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
  }
  // Si no tiene coma pero tiene múltiples puntos (ej. 15.000), quitar puntos
  const dotCount = (clean.match(/\./g) || []).length;
  if (dotCount > 1) {
    const n = parseFloat(clean.replace(/\./g, ''));
    return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
  }
  const n = parseFloat(clean);
  return Number.isFinite(n) && n >= 0 ? Number(n.toFixed(2)) : 0;
}

function formatPercent(part: number, total: number): string {
  if (total <= 0 || part <= 0) return '0,0%';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
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
  const [focusedCell, setFocusedCell] = useState<string | null>(null);

  useEffect(() => {
    const next = {} as Record<OrganizationCode, RowDraft>;
    BUDGET_ORGS.forEach((org) => {
      const existing = budgets.find((b) => b.organization === org && Number(b.year) === year);
      next[org] = {
        id: existing?.id,
        t1: formatCurrency(existing ? Number(existing.t1_assigned) : 0, false),
        t2: formatCurrency(existing ? Number(existing.t2_assigned) : 0, false),
        t3: formatCurrency(existing ? Number(existing.t3_assigned) : 0, false),
        t4: formatCurrency(existing ? Number(existing.t4_assigned) : 0, false),
        dirty: false,
        saving: false,
      };
    });
    setDrafts(next);
  }, [budgets, year]);

  const quarterTotals = useMemo(() => {
    const totals: Record<QuarterField, number> = { t1: 0, t2: 0, t3: 0, t4: 0 };
    BUDGET_ORGS.forEach((org) => {
      const d = drafts[org];
      if (!d) return;
      totals.t1 += parseLocaleAmount(d.t1);
      totals.t2 += parseLocaleAmount(d.t2);
      totals.t3 += parseLocaleAmount(d.t3);
      totals.t4 += parseLocaleAmount(d.t4);
    });
    return {
      t1: Number(totals.t1.toFixed(2)),
      t2: Number(totals.t2.toFixed(2)),
      t3: Number(totals.t3.toFixed(2)),
      t4: Number(totals.t4.toFixed(2)),
    };
  }, [drafts]);

  const grandTotal = useMemo(
    () =>
      Number(
        (quarterTotals.t1 + quarterTotals.t2 + quarterTotals.t3 + quarterTotals.t4).toFixed(2)
      ),
    [quarterTotals]
  );

  const handleFieldChange = (org: OrganizationCode, field: QuarterField, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: value,
        dirty: true,
      },
    }));
  };

  const handleFieldFocus = (org: OrganizationCode, field: QuarterField) => {
    const key = `${org}-${field}`;
    setFocusedCell(key);
    const d = drafts[org];
    if (!d) return;
    const numericVal = parseLocaleAmount(d[field]);
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: numericVal === 0 ? '' : String(numericVal).replace('.', ','),
      },
    }));
  };

  const handleFieldBlur = (org: OrganizationCode, field: QuarterField) => {
    setFocusedCell(null);
    const d = drafts[org];
    if (!d) return;
    const numericVal = parseLocaleAmount(d[field]);
    setDrafts((prev) => ({
      ...prev,
      [org]: {
        ...prev[org],
        [field]: formatCurrency(numericVal, false),
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
        t1_assigned: parseLocaleAmount(d.t1),
        t2_assigned: parseLocaleAmount(d.t2),
        t3_assigned: parseLocaleAmount(d.t3),
        t4_assigned: parseLocaleAmount(d.t4),
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
              Porcentaje sobre el total del trimestre y monto asignado (T1 incluye saldo inicial si aplica)
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
              <th className="py-3 px-3">Organización</th>
              <th className="py-3 px-1.5 text-right">T1 ($)</th>
              <th className="py-3 px-1.5 text-right">T2 ($)</th>
              <th className="py-3 px-1.5 text-right">T3 ($)</th>
              <th className="py-3 px-1.5 text-right">T4 ($)</th>
              <th className="py-3 px-3 text-right">Total</th>
              <th className="py-3 px-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {BUDGET_ORGS.map((org) => {
              const d = drafts[org];
              if (!d) return null;
              const rowTotal =
                parseLocaleAmount(d.t1) +
                parseLocaleAmount(d.t2) +
                parseLocaleAmount(d.t3) +
                parseLocaleAmount(d.t4);

              return (
                <tr key={org} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                    {ORGANIZATION_LABELS[org]}
                  </td>
                  {(['t1', 't2', 't3', 't4'] as const).map((field) => {
                    const numVal = parseLocaleAmount(d[field]);
                    const pct = formatPercent(numVal, quarterTotals[field]);
                    const cellKey = `${org}-${field}`;
                    const isFocused = focusedCell === cellKey;

                    return (
                      <td key={field} className="py-2 px-1">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] font-semibold text-slate-400 tabular-nums w-9 text-right">
                            {pct}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={isFocused ? d[field] : formatCurrency(numVal, false)}
                            onFocus={() => handleFieldFocus(org, field)}
                            onBlur={() => handleFieldBlur(org, field)}
                            onChange={(e) => handleFieldChange(org, field, e.target.value)}
                            className="w-20 sm:w-[88px] px-2 py-1 rounded-lg border border-slate-200 focus:border-emerald-700 focus:outline-none text-right text-xs font-semibold tabular-nums bg-white"
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatCurrency(rowTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={!d.dirty || d.saving}
                      onClick={() => handleSaveRow(org)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
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
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/90 text-xs font-extrabold text-slate-800">
              <td className="py-3 px-3">Total del Trimestre</td>
              <td className="py-3 px-1.5 text-right tabular-nums">{formatCurrency(quarterTotals.t1)}</td>
              <td className="py-3 px-1.5 text-right tabular-nums">{formatCurrency(quarterTotals.t2)}</td>
              <td className="py-3 px-1.5 text-right tabular-nums">{formatCurrency(quarterTotals.t3)}</td>
              <td className="py-3 px-1.5 text-right tabular-nums">{formatCurrency(quarterTotals.t4)}</td>
              <td className="py-3 px-3 text-right tabular-nums">{formatCurrency(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
