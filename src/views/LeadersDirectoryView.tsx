import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { isEntryPersonLoaded, useAuth } from '../context/AuthContext';
import { STAKE_ORG_STRUCTURE } from '../data/stakeOrgStructure';
import { formatUruguayanMobile, toWhatsAppUrl } from '../lib/formatters';
import { DirectoryOrgCode } from '../types/database';

const ORG_DOT_CLASSES: Record<DirectoryOrgCode, string> = {
  PRESIDENCIA: 'bg-slate-900',
  SUMO_CONSEJO: 'bg-indigo-600',
  MJ: 'bg-rose-500',
  HJ: 'bg-amber-500',
  SS: 'bg-teal-600',
  PRIMARIA: 'bg-sky-500',
  JAS: 'bg-violet-600',
  AS: 'bg-cyan-600',
  CFS: 'bg-emerald-600',
  ESCUELA_DOMINICAL: 'bg-blue-500',
  BIENESTAR: 'bg-lime-600',
  MUSICA: 'bg-pink-500',
};

export const LeadersDirectoryView: React.FC = () => {
  const { directoryEntries } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<DirectoryOrgCode[]>([]);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const orgMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOrgMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setIsOrgMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOrgMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOrgMenuOpen]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const toggleOrg = (code: DirectoryOrgCode) => {
    setSelectedOrgs((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const orgFilterLabel = useMemo(() => {
    if (selectedOrgs.length === 0 || selectedOrgs.length === STAKE_ORG_STRUCTURE.length) {
      return 'Todas las organizaciones';
    }
    if (selectedOrgs.length === 1) {
      const found = STAKE_ORG_STRUCTURE.find((o) => o.code === selectedOrgs[0]);
      return found ? found.shortLabel : selectedOrgs[0];
    }
    if (
      selectedOrgs.length === 2 &&
      selectedOrgs.includes('HJ') &&
      selectedOrgs.includes('MJ')
    ) {
      return 'Jóvenes (HJ + MJ)';
    }
    return `${selectedOrgs.length} organizaciones`;
  }, [selectedOrgs]);

  const isOrgFiltered =
    selectedOrgs.length > 0 && selectedOrgs.length < STAKE_ORG_STRUCTURE.length;

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
        selectedOrgs.length === 0 ? true : selectedOrgs.includes(org.code)
      ),
    [selectedOrgs]
  );

  return (
    <section
      aria-label="Directorio"
      data-testid="leaders-directory-view"
      className="space-y-2.5"
    >
      {/* Marco superior fijo: Título + Desplegable multi-organización + Buscador */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
            Directorio
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
          {/* Selector desplegable multi-organización */}
          <div ref={orgMenuRef} className="relative sm:w-64 flex-shrink-0">
            <button
              type="button"
              data-testid="directory-org-filter-trigger"
              aria-haspopup="listbox"
              aria-expanded={isOrgMenuOpen}
              onClick={() => setIsOrgMenuOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 transition ${
                isOrgFiltered
                  ? 'bg-slate-100 border border-slate-700 text-slate-900'
                  : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <SlidersHorizontal
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isOrgFiltered ? 'text-slate-900' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{orgFilterLabel}</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${
                  isOrgMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOrgMenuOpen && (
              <div
                data-testid="directory-org-filter-popover"
                className="absolute left-0 right-0 sm:w-72 mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg p-2.5 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    data-testid="directory-filter-all"
                    onClick={() => {
                      setSelectedOrgs([]);
                      setIsOrgMenuOpen(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedOrgs.length === 0 ||
                      selectedOrgs.length === STAKE_ORG_STRUCTURE.length
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    data-testid="directory-filter-jovenes"
                    onClick={() => {
                      setSelectedOrgs(['HJ', 'MJ']);
                      setIsOrgMenuOpen(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedOrgs.length === 2 &&
                      selectedOrgs.includes('HJ') &&
                      selectedOrgs.includes('MJ')
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Jóvenes
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
                  {STAKE_ORG_STRUCTURE.map((org) => {
                    const checked = selectedOrgs.includes(org.code);
                    return (
                      <label
                        key={org.code}
                        data-testid={`directory-org-option-${org.code}`}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOrg(org.code)}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                        />
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            ORG_DOT_CLASSES[org.code]
                          }`}
                        />
                        <span className="truncate">{org.shortLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Buscador en tiempo real */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, apellido, llamamiento o unidad..."
              aria-label="Buscar en directorio"
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
            />
            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Marco independiente para las tarjetas (scroll propio sin mover la cabecera) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-card">
        <div className="relative overflow-y-auto scroll-smooth pr-1 space-y-4 max-h-[calc(100dvh-230px)] min-h-[320px]">
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
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 text-slate-900 font-mono text-[11px] sm:text-xs font-extrabold whitespace-nowrap">
                            <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                            <span>{formattedPhone}</span>
                          </span>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(entry.id, entry.phone || '')}
                              data-testid={`copy-phone-${entry.slot_key}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300 text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100 transition whitespace-nowrap"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700" />
                                  <span className="text-emerald-700">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
                                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-extrabold transition shadow-sm whitespace-nowrap"
                              >
                                <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
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
      </div>
    </section>
  );
};
