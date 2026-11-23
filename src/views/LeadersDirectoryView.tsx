import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { isEntryPersonLoaded, useAuth } from '../context/AuthContext';
import { UserManagementPanel } from '../components/UserManagementPanel';
import { STAKE_ORG_STRUCTURE } from '../data/stakeOrgStructure';
import { formatUruguayanMobile, toWhatsAppUrl } from '../lib/formatters';
import { DirectoryOrgCode, StakeDirectoryEntry } from '../types/database';

const ORG_DOT_CLASSES: Record<DirectoryOrgCode, string> = {
  PRESIDENCIA: 'bg-slate-900',
  SUMO_CONSEJO: 'bg-slate-900',
  MJ: 'bg-rose-500',
  HJ: 'bg-blue-500',
  SS: 'bg-purple-500',
  PRIMARIA: 'bg-orange-500',
  JAS: 'bg-sky-500',
  AS: 'bg-indigo-500',
  CFS: 'bg-yellow-500',
  ESCUELA_DOMINICAL: 'bg-slate-900',
  BIENESTAR: 'bg-slate-900',
  MUSICA: 'bg-slate-900',
};

const toTelHref = (rawPhone?: string): string | null => {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('09') && digits.length === 9) {
    return `tel:+598${digits.slice(1)}`;
  }
  return `tel:${digits}`;
};

const sortOrgEntries = (orgCode: DirectoryOrgCode, entries: StakeDirectoryEntry[]) => {
  if (orgCode !== 'SUMO_CONSEJO') return entries;
  return [...entries].sort((a, b) => {
    const nameA = `${a.first_name} ${a.last_name}`.trim();
    const nameB = `${b.first_name} ${b.last_name}`.trim();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });
};

interface LeadersDirectoryViewProps {
  canManage?: boolean;
  initialManageMode?: boolean;
  initialFilterIncomplete?: boolean;
}

export const LeadersDirectoryView: React.FC<LeadersDirectoryViewProps> = ({
  canManage = false,
  initialManageMode = false,
  initialFilterIncomplete = false,
}) => {
  const { directoryEntries, incompleteContactsCount } = useAuth();
  const [isManageMode, setIsManageMode] = useState<boolean>(
    () => Boolean(canManage && (initialManageMode || initialFilterIncomplete))
  );
  const isManaging = canManage && isManageMode;

  useEffect(() => {
    if (!canManage) {
      setIsManageMode(false);
    } else if (initialManageMode || initialFilterIncomplete) {
      setIsManageMode(true);
    }
  }, [canManage, initialManageMode, initialFilterIncomplete]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<DirectoryOrgCode[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Partial<Record<DirectoryOrgCode, boolean>>>({});
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

  const toggleOrgAccordion = (code: DirectoryOrgCode) => {
    setExpandedOrgs((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const selectAllOrgs = () => {
    setSelectedOrgs([]);
    setExpandedOrgs({});
    setIsOrgMenuOpen(false);
  };

  const selectYouthOrgs = () => {
    setSelectedOrgs(['HJ', 'MJ']);
    setExpandedOrgs({ HJ: true, MJ: true });
    setIsOrgMenuOpen(false);
  };

  const toggleOrgFromDropdown = (code: DirectoryOrgCode) => {
    setSelectedOrgs((prev) => {
      const exists = prev.includes(code);
      const next = exists ? prev.filter((item) => item !== code) : [...prev, code];
      if (!exists) {
        setExpandedOrgs((exp) => ({ ...exp, [code]: true }));
      }
      if (next.length === 0) {
        setExpandedOrgs({});
      }
      return next;
    });
  };

  const selectSingleOrgChip = (code: DirectoryOrgCode) => {
    if (selectedOrgs.length === 1 && selectedOrgs[0] === code) {
      selectAllOrgs();
      return;
    }
    setSelectedOrgs([code]);
    setExpandedOrgs({ [code]: true });
    setIsOrgMenuOpen(false);
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

  const orgsWithLoadedEntries = useMemo(() => {
    const counts = new Map<DirectoryOrgCode, number>();
    for (const entry of directoryEntries) {
      if (isEntryPersonLoaded(entry)) {
        counts.set(entry.directory_org, (counts.get(entry.directory_org) || 0) + 1);
      }
    }
    return STAKE_ORG_STRUCTURE.filter((org) => (counts.get(org.code) || 0) > 0);
  }, [directoryEntries]);

  const visibleOrgBlocks = useMemo(() => {
    const baseOrgs = STAKE_ORG_STRUCTURE.filter((org) =>
      selectedOrgs.length === 0 ? true : selectedOrgs.includes(org.code)
    );

    return baseOrgs
      .map((orgDef) => {
        const filtered = directoryEntries.filter((e) => {
          if (e.directory_org !== orgDef.code) return false;
          if (!isEntryPersonLoaded(e)) return false;
          if (!normalizedSearch) return true;
          const haystack = [
            e.first_name,
            e.last_name,
            e.calling,
            e.assigned_unit,
            e.assigned_org_notes,
            orgDef.label,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedSearch);
        });

        return {
          orgDef,
          entries: sortOrgEntries(orgDef.code, filtered),
        };
      })
      .filter((block) => block.entries.length > 0);
  }, [directoryEntries, normalizedSearch, selectedOrgs]);

  const allVisibleExpanded =
    visibleOrgBlocks.length > 0 &&
    visibleOrgBlocks.every(({ orgDef }) => Boolean(expandedOrgs[orgDef.code]));

  const handleToggleAllVisible = () => {
    if (allVisibleExpanded) {
      setExpandedOrgs({});
      return;
    }
    const next: Partial<Record<DirectoryOrgCode, boolean>> = {};
    for (const { orgDef } of visibleOrgBlocks) {
      next[orgDef.code] = true;
    }
    setExpandedOrgs(next);
  };

  const hasYouthEntries = orgsWithLoadedEntries.some(
    (o) => o.code === 'HJ' || o.code === 'MJ'
  );

  if (isManaging) {
    return (
      <UserManagementPanel
        initialFilterIncomplete={initialFilterIncomplete}
        onExitManageMode={() => setIsManageMode(false)}
      />
    );
  }

  return (
    <section
      aria-label="Directorio"
      data-testid="leaders-directory-view"
      className="space-y-3"
    >
      {/* Cabecera fija: Título + Filtro desplegable + Buscador + Pastillas rápidas */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
            Directorio
          </h1>

          <div className="flex items-center gap-2">
            {!normalizedSearch && visibleOrgBlocks.length > 1 && (
              <button
                type="button"
                data-testid="directory-toggle-all-btn"
                onClick={handleToggleAllVisible}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition"
              >
                {allVisibleExpanded ? 'Plegar todas' : 'Expandir todas'}
              </button>
            )}

            {canManage && (
              <button
                type="button"
                data-testid="directory-manage-toggle"
                aria-pressed="false"
                onClick={() => setIsManageMode(true)}
                className="pressable h-[34px] inline-flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Gestionar</span>
                {incompleteContactsCount > 0 && (
                  <span
                    data-testid="directory-manage-incomplete-badge"
                    className="inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold tabular-nums animate-pulse"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {incompleteContactsCount}
                  </span>
                )}
              </button>
            )}
          </div>
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
                    onClick={selectAllOrgs}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedOrgs.length === 0 ||
                      selectedOrgs.length === STAKE_ORG_STRUCTURE.length
                        ? 'bg-[#072B52] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    data-testid="directory-filter-jovenes"
                    onClick={selectYouthOrgs}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedOrgs.length === 2 &&
                      selectedOrgs.includes('HJ') &&
                      selectedOrgs.includes('MJ')
                        ? 'bg-[#072B52] text-white'
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
                          onChange={() => toggleOrgFromDropdown(org.code)}
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

                <div className="pt-1.5 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOrgMenuOpen(false)}
                    className="px-3 py-1 rounded-lg bg-[#072B52] text-white text-[11px] font-bold hover:bg-[#083563] transition"
                  >
                    Listo
                  </button>
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

        {/* Pastillas rápidas horizontales (1 toque para filtrar y desplegar en móvil) */}
        {orgsWithLoadedEntries.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={selectAllOrgs}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                selectedOrgs.length === 0
                  ? 'bg-[#072B52] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>

            {hasYouthEntries && (
              <button
                type="button"
                onClick={selectYouthOrgs}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                  selectedOrgs.length === 2 &&
                  selectedOrgs.includes('HJ') &&
                  selectedOrgs.includes('MJ')
                    ? 'bg-[#072B52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Jóvenes
              </button>
            )}

            {orgsWithLoadedEntries.map((org) => {
              const isSelected = selectedOrgs.length === 1 && selectedOrgs[0] === org.code;
              return (
                <button
                  key={org.code}
                  type="button"
                  data-testid={`directory-quick-chip-${org.code}`}
                  onClick={() => selectSingleOrgChip(org.code)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                    isSelected
                      ? 'bg-[#072B52] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isSelected ? 'bg-white' : ORG_DOT_CLASSES[org.code]
                    }`}
                  />
                  <span>{org.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de acordeones por organización (desplazamiento natural de la página) */}
      {visibleOrgBlocks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-xs font-semibold text-slate-500">
          {normalizedSearch || isOrgFiltered
            ? 'No se encontraron contactos con ese filtro o búsqueda.'
            : 'No hay contactos cargados en el directorio todavía.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleOrgBlocks.map(({ orgDef, entries }) => {
            const isExpanded = Boolean(normalizedSearch) || Boolean(expandedOrgs[orgDef.code]);

            return (
              <div
                key={orgDef.code}
                data-testid={`directory-org-card-${orgDef.code}`}
                className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
              >
                <button
                  type="button"
                  data-testid={`directory-org-accordion-toggle-${orgDef.code}`}
                  aria-expanded={isExpanded}
                  onClick={() => toggleOrgAccordion(orgDef.code)}
                  className={`w-full px-4 sm:px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-2 text-left ${
                    isExpanded ? 'border-b border-slate-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        ORG_DOT_CLASSES[orgDef.code]
                      }`}
                    />
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">
                      {orgDef.label}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-xs font-bold text-slate-500">
                      {entries.length} {entries.length === 1 ? 'integrante' : 'integrantes'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {entries.map((entry) => {
                      const formattedPhone = formatUruguayanMobile(entry.phone);
                      const telHref = toTelHref(entry.phone);
                      const waUrl = toWhatsAppUrl(entry.phone);
                      const isCopied = copiedId === entry.id;
                      const displayCalling =
                        orgDef.code === 'SUMO_CONSEJO'
                          ? 'Miembro del Sumo Consejo'
                          : entry.calling;

                      return (
                        <div
                          key={entry.id}
                          className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <p className="text-xs font-bold text-[#083563]">{displayCalling}</p>
                            <p className="text-sm font-extrabold text-slate-900">
                              {`${entry.first_name} ${entry.last_name}`.trim()}
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
                              {telHref ? (
                                <a
                                  href={telHref}
                                  title="Llamar por teléfono"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition"
                                >
                                  <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                                  <span>{formattedPhone}</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 text-slate-900 font-mono text-[11px] sm:text-xs font-extrabold whitespace-nowrap">
                                  <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 flex-shrink-0" />
                                  <span>{formattedPhone}</span>
                                </span>
                              )}

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
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
