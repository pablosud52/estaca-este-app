import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { isEntryPersonLoaded, useAuth } from '../context/AuthContext';
import { STAKE_ORG_STRUCTURE } from '../data/stakeOrgStructure';
import { formatUruguayanMobile, toWhatsAppUrl } from '../lib/formatters';
import { DirectoryOrgCode } from '../types/database';

export const LeadersDirectoryView: React.FC = () => {
  const { directoryEntries } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<DirectoryOrgCode | 'TODAS'>('TODAS');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const handleCopyPhone = async (entryId: string, rawPhone: string) => {
    const formatted = formatUruguayanMobile(rawPhone);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(entryId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Silencioso si el navegador bloquea portapapeles
    }
  };

  const visibleOrgs = useMemo(
    () =>
      STAKE_ORG_STRUCTURE.filter((org) =>
        selectedOrg === 'TODAS' ? true : org.code === selectedOrg
      ),
    [selectedOrg]
  );

  return (
    <section
      aria-label="Directorio de Líderes de la Estaca"
      data-testid="leaders-directory-view"
      className="space-y-5"
    >
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Directorio de Líderes de Estaca
            </h2>
            <p className="text-xs text-slate-500">
              Contactos oficiales separados por organización con acceso directo a WhatsApp.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {directoryEntries.filter(isEntryPersonLoaded).length} líderes registrados
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, apellido, llamamiento o unidad..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedOrg('TODAS')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              selectedOrg === 'TODAS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas
          </button>
          {STAKE_ORG_STRUCTURE.map((org) => (
            <button
              key={org.code}
              type="button"
              onClick={() => setSelectedOrg(org.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                selectedOrg === org.code
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {org.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {visibleOrgs.map((orgDef) => {
          const loadedInOrg = directoryEntries.filter((e) => {
            if (e.directory_org !== orgDef.code) return false;
            const hasContent =
              isEntryPersonLoaded(e) ||
              (orgDef.code === 'SUMO_CONSEJO' &&
                Boolean(e.assigned_unit?.trim() || e.assigned_org_notes?.trim()));
            if (!hasContent) return false;
            if (!normalizedSearch) return true;
            const haystack = [
              e.first_name,
              e.last_name,
              e.calling,
              e.assigned_unit,
              e.assigned_org_notes,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(normalizedSearch);
          });

          if (loadedInOrg.length === 0) return null;

          return (
            <div
              key={orgDef.code}
              className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">{orgDef.label}</h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {loadedInOrg.length} {loadedInOrg.length === 1 ? 'integrante' : 'integrantes'}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {loadedInOrg.map((entry) => {
                  const formattedPhone = formatUruguayanMobile(entry.phone);
                  const waUrl = toWhatsAppUrl(entry.phone);
                  const isCopied = copiedId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-800">{entry.calling}</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {isEntryPersonLoaded(entry)
                            ? `${entry.first_name} ${entry.last_name}`.trim()
                            : 'Sin asignar'}
                        </p>

                        {orgDef.code === 'SUMO_CONSEJO' &&
                          (entry.assigned_unit || entry.assigned_org_notes) && (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {entry.assigned_unit && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                                  <MapPin className="w-3 h-3 text-slate-500" />
                                  {entry.assigned_unit}
                                </span>
                              )}
                              {entry.assigned_org_notes && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800">
                                  {entry.assigned_org_notes}
                                </span>
                              )}
                            </div>
                          )}
                      </div>

                      {formattedPhone ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-900 font-mono text-xs font-extrabold">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span>{formattedPhone}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopyPhone(entry.id, entry.phone || '')}
                            data-testid={`copy-phone-${entry.slot_key}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span className="text-emerald-700">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`whatsapp-btn-${entry.slot_key}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition shadow-sm"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">Sin celular cargado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
