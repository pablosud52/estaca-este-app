import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, RefreshCw, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchAuditLogs } from '../services/auditLogService';
import { AuditActionType, AuditLogRecord, AuditSection } from '../types/database';

const SECTION_LABELS: Record<AuditSection, string> = {
  ACCESO: 'Accesos',
  FINANZAS: 'Finanzas',
  PRESUPUESTOS: 'Presupuestos',
  CALENDARIO: 'Calendario',
  DIRECTORIO: 'Directorio',
  PROVEEDORES: 'Proveedores',
};

const ACTION_LABELS: Record<AuditActionType, string> = {
  LOGIN: 'Ingreso',
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  RECONCILE: 'Conciliación',
  SYNC: 'Sincronización',
};

function getUruguayDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Montevideo',
  }).format(date);
  return parts; // YYYY-MM-DD
}

function formatDateTimeUruguay(isoString: string): { date: string; time: string } {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) {
    return { date: '—', time: '' };
  }
  const date = new Intl.DateTimeFormat('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Montevideo',
  }).format(dt);
  const time = new Intl.DateTimeFormat('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Montevideo',
  }).format(dt);
  return { date, time };
}

export const AuditLogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('TODOS');
  const [selectedSection, setSelectedSection] = useState<'TODAS' | AuditSection>('TODAS');
  const [selectedAction, setSelectedAction] = useState<'TODOS' | AuditActionType>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: dateFrom || dateTo ? 1000 : 500,
      });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((item) => {
      const email = (item.actor_email || '').toLowerCase();
      if (email && !map.has(email)) {
        map.set(email, item.actor_name || email);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((item) => {
      if (selectedUser !== 'TODOS' && (item.actor_email || '').toLowerCase() !== selectedUser) {
        return false;
      }
      if (selectedSection !== 'TODAS' && item.section !== selectedSection) {
        return false;
      }
      if (selectedAction !== 'TODOS' && item.action_type !== selectedAction) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.actor_name} ${item.actor_email} ${item.actor_calling || ''} ${
        item.summary
      } ${SECTION_LABELS[item.section] || item.section} ${
        ACTION_LABELS[item.action_type] || item.action_type
      }`.toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, selectedUser, selectedSection, selectedAction, searchTerm]);

  const hasActiveFilters = Boolean(
    dateFrom ||
      dateTo ||
      selectedUser !== 'TODOS' ||
      selectedSection !== 'TODAS' ||
      selectedAction !== 'TODOS' ||
      searchTerm.trim()
  );

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedUser('TODOS');
    setSelectedSection('TODAS');
    setSelectedAction('TODOS');
    setSearchTerm('');
  };

  const applyQuickDate = (preset: 'TODAY' | 'WEEK' | 'MONTH') => {
    const now = new Date();
    const today = getUruguayDateStr(now);
    if (preset === 'TODAY') {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (preset === 'WEEK') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      setDateFrom(getUruguayDateStr(weekAgo));
      setDateTo(today);
      return;
    }
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    setDateFrom(firstOfMonth);
    setDateTo(today);
  };

  const handleExportExcel = () => {
    const rows = filteredLogs.map((item) => {
      const { date, time } = formatDateTimeUruguay(item.created_at);
      return {
        Fecha: date,
        Hora: time,
        Usuario: item.actor_name,
        Correo: item.actor_email,
        Llamamiento: item.actor_calling || item.actor_role,
        Sección: SECTION_LABELS[item.section] || item.section,
        Tipo: ACTION_LABELS[item.action_type] || item.action_type,
        Detalle: item.summary,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');
    XLSX.writeFile(workbook, `historial_actividad_${getUruguayDateStr(new Date())}.xlsx`);
  };

  return (
    <section
      data-testid="audit-logs-panel"
      aria-label="Historial de Actividad"
      className="space-y-3"
    >
      {/* Cabecera simple */}
      <div className="bg-slate-900 rounded-3xl px-5 py-4 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-slate-300 flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-extrabold text-white">
            Historial de Actividad
          </h2>
        </div>

        <div className="flex items-end justify-between md:flex-1 md:items-center md:justify-end gap-3">
          <div className="order-2 md:order-1 md:mx-auto">
            {hasActiveFilters && (
              <button
                type="button"
                data-testid="audit-clear-filters-btn"
                onClick={handleClearFilters}
                className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>

          <div className="order-1 md:order-2 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button
              type="button"
              data-testid="export-audit-logs-btn"
              onClick={handleExportExcel}
              disabled={filteredLogs.length === 0}
              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-xs font-bold text-slate-100 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>

            <button
              type="button"
              data-testid="refresh-audit-logs-btn"
              onClick={loadLogs}
              disabled={loading}
              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros combinados */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          {/* Fila 1: Fechas rápidas + Desde / Hasta */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => applyQuickDate('TODAY')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-white transition"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => applyQuickDate('WEEK')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-white transition"
              >
                7 días
              </button>
              <button
                type="button"
                onClick={() => applyQuickDate('MONTH')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-white transition"
              >
                Este mes
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span>Desde</span>
                <input
                  type="date"
                  data-testid="audit-date-from"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </label>

              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span>Hasta</span>
                <input
                  type="date"
                  data-testid="audit-date-to"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </label>
            </div>
          </div>

          {/* Fila 2: Usuario + Sección + Tipo + Buscador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              aria-label="Filtrar por usuario"
              data-testid="audit-filter-user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="TODOS">Todos los usuarios</option>
              {userOptions.map(([email, name]) => (
                <option key={email} value={email}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por sección"
              data-testid="audit-filter-section"
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value as 'TODAS' | AuditSection)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="TODAS">Todas las secciones</option>
              {(Object.keys(SECTION_LABELS) as AuditSection[]).map((sec) => (
                <option key={sec} value={sec}>
                  {SECTION_LABELS[sec]}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por tipo de cambio"
              data-testid="audit-filter-action"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as 'TODOS' | AuditActionType)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="TODOS">Todos los tipos</option>
              {(Object.keys(ACTION_LABELS) as AuditActionType[]).map((act) => (
                <option key={act} value={act}>
                  {ACTION_LABELS[act]}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en el detalle..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>

          {/* Contador */}
          <div className="text-[11px] text-slate-500 font-semibold">
            Mostrando {filteredLogs.length} registro{filteredLogs.length === 1 ? '' : 's'} (últimos 6 meses)
          </div>
        </div>

        {/* Tabla / Lista */}
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500">
            Cargando historial...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500">
            No hay registros para los filtros seleccionados.
          </div>
        ) : (
          <>
            {/* Vista Escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Día y Hora</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Sección</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-4">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((item) => {
                    const { date, time } = formatDateTimeUruguay(item.created_at);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">
                          <span className="font-bold text-slate-900">{date}</span>
                          <span className="text-slate-400 font-semibold ml-1.5">{time}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900 leading-tight">{item.actor_name}</p>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {item.actor_calling || item.actor_role}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700">
                            {SECTION_LABELS[item.section] || item.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                          {ACTION_LABELS[item.action_type] || item.action_type}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{item.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredLogs.map((item) => {
                const { date, time } = formatDateTimeUruguay(item.created_at);
                return (
                  <div key={item.id} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-slate-700">
                        {SECTION_LABELS[item.section] || item.section} ·{' '}
                        {ACTION_LABELS[item.action_type] || item.action_type}
                      </span>
                      <span className="font-bold text-slate-500 tabular-nums">
                        {date} {time}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{item.summary}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.actor_name} ({item.actor_calling || item.actor_role})
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
