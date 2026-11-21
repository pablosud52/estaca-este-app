import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { fetchAuditLogs } from '../services/auditLogService';
import { AuditLogRecord, AuditSection } from '../types/database';

const SECTION_LABELS: Record<AuditSection, string> = {
  ACCESO: 'Accesos',
  FINANZAS: 'Finanzas',
  PRESUPUESTOS: 'Presupuestos',
  CALENDARIO: 'Calendario',
  DIRECTORIO: 'Directorio',
  PROVEEDORES: 'Proveedores',
};

const SECTION_BADGE_CLASSES: Record<AuditSection, string> = {
  ACCESO: 'bg-slate-100 text-slate-700 border-slate-200',
  FINANZAS: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PRESUPUESTOS: 'bg-teal-50 text-teal-800 border-teal-200',
  CALENDARIO: 'bg-sky-50 text-sky-800 border-sky-200',
  DIRECTORIO: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  PROVEEDORES: 'bg-amber-50 text-amber-800 border-amber-200',
};

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<'TODAS' | AuditSection>('TODAS');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(300);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter((item) => {
      if (selectedSection !== 'TODAS' && item.section !== selectedSection) {
        return false;
      }
      if (!q) return true;
      const haystack = `${item.actor_name} ${item.actor_email} ${item.actor_calling || ''} ${
        item.summary
      } ${SECTION_LABELS[item.section] || item.section}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, searchTerm, selectedSection]);

  return (
    <section
      data-testid="audit-logs-panel"
      aria-label="Historial de Actividad"
      className="space-y-4"
    >
      {/* Cabecera */}
      <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Historial de Actividad
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Registro inmutable de ingresos y cambios realizados en el sistema (solo Administradores).
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="refresh-audit-logs-btn"
            onClick={loadLogs}
            disabled={loading}
            className="pressable inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-emerald-300/90 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Libro de actas cerrado: ningún usuario puede editar ni borrar registros de este historial.</span>
        </div>
      </div>

      {/* Filtros y Buscador */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                'TODAS',
                'ACCESO',
                'FINANZAS',
                'PRESUPUESTOS',
                'CALENDARIO',
                'DIRECTORIO',
                'PROVEEDORES',
              ] as const
            ).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  selectedSection === sec
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {sec === 'TODAS' ? 'Todas' : SECTION_LABELS[sec]}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario o cambio..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>

        {/* Contenido */}
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500">
            Cargando historial de actividad...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500">
            No hay registros que coincidan con el filtro seleccionado.
          </div>
        ) : (
          <>
            {/* Vista Escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Día y Hora</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3">Sección</th>
                    <th className="py-2.5 px-4">Detalle / Qué modificó</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLogs.map((item) => {
                    const { date, time } = formatDateTimeUruguay(item.created_at);
                    const badgeClass =
                      SECTION_BADGE_CLASSES[item.section] || SECTION_BADGE_CLASSES.ACCESO;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                          <span className="font-bold text-slate-900">{date}</span>
                          <span className="text-slate-400 font-semibold ml-1.5">{time} hs</span>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 leading-tight">{item.actor_name}</p>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {item.actor_calling || item.actor_role} · {item.actor_email}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeClass}`}
                          >
                            {SECTION_LABELS[item.section] || item.section}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">{item.summary}</td>
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
                const badgeClass =
                  SECTION_BADGE_CLASSES[item.section] || SECTION_BADGE_CLASSES.ACCESO;

                return (
                  <div key={item.id} className="p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeClass}`}
                      >
                        {SECTION_LABELS[item.section] || item.section}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                        {date} · {time} hs
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
