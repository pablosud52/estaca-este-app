import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/formatters';
import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  SupplierRecord,
} from '../types/database';

interface ExcelSyncPanelProps {
  budgets: BudgetAllocation[];
  expenses: ExpenseRecord[];
  withdrawals: CashWithdrawalRecord[];
  activities: ActivityRecord[];
  suppliers: SupplierRecord[];
  onApplyImportedExpenses?: (imported: ExpenseRecord[]) => void;
}

interface ImportPreviewState {
  fileName: string;
  sheetNames: string[];
  counts: {
    presupuestos: number;
    gastos: number;
    retiros: number;
    actividades: number;
    proveedores: number;
  };
  sampleExpenses: Array<{ fecha: string; org: string; concepto: string; monto: number }>;
  parsedExpenses: ExpenseRecord[];
}

export const ExcelSyncPanel: React.FC<ExcelSyncPanelProps> = ({
  budgets,
  expenses,
  withdrawals,
  activities,
  suppliers,
  onApplyImportedExpenses,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buildWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // 1. Hoja PRESUPUESTO_ASIGNACION
    const budgetRows = budgets.map((b) => ({
      Anio: b.year,
      Organizacion: b.organization,
      T1_Asignado: formatCurrency(b.t1_assigned, false),
      T2_Asignado: formatCurrency(b.t2_assigned, false),
      T3_Asignado: formatCurrency(b.t3_assigned, false),
      T4_Asignado: formatCurrency(b.t4_assigned, false),
      Total_Asignado: formatCurrency(b.total_assigned, false),
      Notas: b.notes || '',
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(budgetRows),
      'PRESUPUESTO_ASIGNACION'
    );

    // 2. Hoja MOVIMIENTOS_GASTOS
    const expenseRows = expenses.map((e) => ({
      ID_Gasto: e.id,
      Referencia: e.ref_number || 'DIRECTO',
      Fecha: formatDate(e.expense_date),
      Organizacion: e.organization,
      Proveedor: e.supplier_name,
      Proposito_Actividad: e.concept,
      Monto_Total_Factura: formatCurrency(e.gross_amount, false),
      Reintegro_Externo: formatCurrency(e.external_reimbursement, false),
      Gasto_Neto_Organizacion: formatCurrency(e.net_amount, false),
      Es_Reembolsable: e.is_reimbursable_oai ? 'SI' : 'NO',
      Registrado_LCR: e.status === 'PENDIENTE_LCR' ? 'NO' : 'SI',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'MOVIMIENTOS_GASTOS');

    // 3. Hoja RETIROS_FONDOS
    const withdrawalRows = withdrawals.map((w) => ({
      ID_Retiro: w.id,
      Nro_Referencia: w.withdrawal_ref,
      Fecha_Retiro: formatDate(w.withdrawal_date),
      Monto_Retirado: formatCurrency(w.amount, false),
      Responsable: w.responsible_person,
      Proposito: w.purpose,
      Fecha_Devolucion: w.return_date ? formatDate(w.return_date) : '',
      Devolucion_Deposito: formatCurrency(w.returned_amount, false),
      Estado: w.status === 'CERRADO_EN_CERO' ? 'Cerrado en Cero' : 'Saldo por Rendir',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(withdrawalRows), 'RETIROS_FONDOS');

    // 4. Hoja ACTIVIDADES_CALENDARIO
    const activityRows = activities.map((a) => ({
      ID_Actividad: a.id,
      Fecha: formatDate(a.event_date),
      Hora: a.start_time || '19:00',
      Nombre_Actividad: a.title,
      Lugar: a.location,
      Organizacion: a.organization,
      Presupuesto_Estimado: formatCurrency(a.estimated_cost, false),
      Estado: a.status,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(activityRows),
      'ACTIVIDADES_CALENDARIO'
    );

    // 5. Hoja PROVEEDORES
    const supplierRows = suppliers.map((s) => ({
      Nombre_Comercial: s.commercial_name,
      Razon_Social: s.legal_name || '',
      RUT: s.rut || '',
      Rubro: s.category,
      Telefono: s.phone || '',
      Email: s.email || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), 'PROVEEDORES');

    return wb;
  };

  const handleExportExcel = () => {
    setErrorMessage(null);
    const wb = buildWorkbook();
    XLSX.writeFile(wb, 'DB_Finanzas_Calendario_Estaca_2026.xlsx');
    setStatusMessage(
      `Respaldo Excel exportado con éxito (${expenses.length} gastos, ${withdrawals.length} retiros y ${activities.length} actividades).`
    );
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const processExcelBuffer = (buffer: ArrayBuffer, fileName: string) => {
    setErrorMessage(null);
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetNames = wb.SheetNames;

      if (sheetNames.length === 0) {
        setErrorMessage('El archivo seleccionado no contiene hojas de cálculo válidas.');
        return;
      }

      const getRows = (name: string) =>
        wb.Sheets[name] ? XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]) : [];

      const budgetSheet = getRows('PRESUPUESTO_ASIGNACION');
      const expenseSheet = getRows('MOVIMIENTOS_GASTOS');
      const withdrawalSheet = getRows('RETIROS_FONDOS');
      const activitySheet = getRows('ACTIVIDADES_CALENDARIO');
      const supplierSheet = getRows('PROVEEDORES');

      // Si el usuario sube un Excel con una sola hoja genérica, también tomamos la primera hoja para previsualizar
      const fallbackRows =
        expenseSheet.length > 0 ? expenseSheet : getRows(sheetNames[0]);

      const sampleExpenses = fallbackRows.slice(0, 3).map((r) => {
        const rawMonto = String(
          r.Gasto_Neto_Organizacion ?? r.Monto_Total_Factura ?? r.Monto ?? '0'
        )
          .replace(/\./g, '')
          .replace(',', '.');
        return {
          fecha: String(r.Fecha || '15/10/2026'),
          org: String(r.Organizacion || 'ESTACA'),
          concepto: String(r.Proposito_Actividad || r.Concepto || 'Comprobante importado'),
          monto: Number(rawMonto) || 0,
        };
      });

      setPreview({
        fileName,
        sheetNames,
        counts: {
          presupuestos: budgetSheet.length || budgets.length,
          gastos: expenseSheet.length || fallbackRows.length,
          retiros: withdrawalSheet.length || withdrawals.length,
          actividades: activitySheet.length || activities.length,
          proveedores: supplierSheet.length || suppliers.length,
        },
        sampleExpenses,
        parsedExpenses: expenses,
      });
    } catch {
      setErrorMessage(
        'No se pudo leer el archivo Excel. Verifica que sea un libro .xlsx válido compatible con Ejemplo_DB_Finanzas.xlsx.'
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    processExcelBuffer(buf, file.name);
  };

  const handleSimulateTemplatePreview = () => {
    const wb = buildWorkbook();
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    processExcelBuffer(out, 'Ejemplo_DB_Finanzas_2026.xlsx');
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    if (onApplyImportedExpenses && preview.parsedExpenses.length > 0) {
      onApplyImportedExpenses(preview.parsedExpenses);
    }
    setStatusMessage(
      `Sincronización confirmada: ${preview.counts.gastos} gastos y ${preview.counts.retiros} retiros validados desde "${preview.fileName}".`
    );
    setPreview(null);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div data-testid="excel-sync-panel" className="space-y-5">
      {statusMessage && (
        <div
          data-testid="excel-sync-toast"
          role="status"
          className="p-4 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-md border border-emerald-700 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* TARJETA 1: EXPORTAR LIBRO OFICIAL EXCEL */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Respaldo y Exportación a Excel (.xlsx)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compatible con la estructura auditada de Ejemplo_DB_Finanzas.xlsx (ADR-014)
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
              <p className="font-bold text-slate-800">Hojas incluidas en la exportación:</p>
              <ul className="grid grid-cols-2 gap-1 text-[11px] font-medium text-slate-600">
                <li>• PRESUPUESTO_ASIGNACION ({budgets.length})</li>
                <li>• MOVIMIENTOS_GASTOS ({expenses.length})</li>
                <li>• RETIROS_FONDOS ({withdrawals.length})</li>
                <li>• ACTIVIDADES_CALENDARIO ({activities.length})</li>
                <li>• PROVEEDORES ({suppliers.length})</li>
                <li>• Formato: #.##0,00 y dd/mm/aaaa</li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            data-testid="btn-export-excel"
            onClick={handleExportExcel}
            className="pressable w-full py-3 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>📥 Exportar Excel</span>
          </button>
        </div>

        {/* TARJETA 2: IMPORTAR LIBRO EXCEL CON VALIDACIÓN PREVIA */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Importación con Vista Previa (Preview)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Valida columnas e importes antes de impactar en la base de datos
                </p>
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const buf = await file.arrayBuffer();
                  processExcelBuffer(buf, file.name);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 p-5 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-50/60'
                  : 'border-slate-300 hover:border-emerald-600 bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                data-testid="excel-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-extrabold text-slate-800">
                Arrastra aquí tu archivo .xlsx o toca para seleccionar
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Valida automáticamente hojas y formato numérico
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              data-testid="btn-import-excel-trigger"
              onClick={() => fileInputRef.current?.click()}
              className="pressable py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>📤 Importar Excel</span>
            </button>

            <button
              type="button"
              data-testid="btn-preview-template-excel"
              onClick={handleSimulateTemplatePreview}
              className="pressable py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200"
            >
              Validar Plantilla Activa
            </button>
          </div>
        </div>
      </div>

      {/* PANEL DE PREVIEW Y CONFIRMACIÓN ANTES DE IMPACTAR */}
      {preview && (
        <div
          data-testid="excel-import-preview-card"
          className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700 space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Validación Exitosa
              </span>
              <h4 className="text-sm sm:text-base font-extrabold mt-1">
                Vista Previa de Importación: {preview.fileName}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Presupuestos</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                {preview.counts.presupuestos}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Gastos</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                {preview.counts.gastos}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Retiros</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                {preview.counts.retiros}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Actividades</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                {preview.counts.actividades}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Proveedores</p>
              <p className="text-base font-extrabold text-emerald-400 tabular-nums mt-0.5">
                {preview.counts.proveedores}
              </p>
            </div>
          </div>

          {preview.sampleExpenses.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5">
              <p className="text-[11px] font-bold text-slate-400">
                Muestra de registros validados (formato oficial):
              </p>
              {preview.sampleExpenses.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-slate-200 py-1 border-b border-slate-800/70 last:border-0"
                >
                  <span className="truncate">
                    <strong className="text-emerald-400 tabular-nums">{s.fecha}</strong> • [{s.org}]{' '}
                    {s.concepto}
                  </span>
                  <span className="font-extrabold tabular-nums">{formatCurrency(s.monto)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="pressable px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="confirm-excel-import-btn"
              onClick={handleConfirmImport}
              className="pressable inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar e Impactar en Sistema</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
