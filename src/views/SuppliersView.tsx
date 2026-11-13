import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Globe,
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
  ArrowLeft,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { SupplierRecord } from '../types/database';

interface SuppliersViewProps {
  suppliers: SupplierRecord[];
  onBack?: () => void;
  embedded?: boolean;
}

type SortOrder = 'RELEVANCE' | 'AZ' | 'ZA';

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('RELEVANCE');
  const [onlyWhatsApp, setOnlyWhatsApp] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isCategoryOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCategoryOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryOpen]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSupplierCategory = (s: SupplierRecord) => (s.category || 'Varios').trim() || 'Varios';

  // Lista única de categorías ordenadas por cantidad
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    suppliers.forEach((s) => {
      const cat = getSupplierCategory(s);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return [
      { id: 'TODOS', label: 'Todas las categorías', count: suppliers.length },
      ...sorted.map(([name, count]) => ({ id: name, label: name, count })),
    ];
  }, [suppliers]);

  const activeCategoryObj =
    categories.find((c) => c.id === selectedCategory) || categories[0];

  // Filtrado y orden
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const normalize = (str?: string) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const nTerm = normalize(term);

    return suppliers
      .filter((s) => {
        if (selectedCategory !== 'TODOS' && getSupplierCategory(s) !== selectedCategory) {
          return false;
        }
        if (onlyWhatsApp) {
          const hasBranchMobile = s.branches?.some((b) => (b.phone_mobile?.length || 0) > 0);
          if (!String(s.phone_mobile || '').trim() && !hasBranchMobile) return false;
        }
        if (!nTerm) return true;
        const branchMatch = s.branches?.some(
          (b) => normalize(b.name).includes(nTerm) || normalize(b.address).includes(nTerm)
        );
        return (
          normalize(s.commercial_name).includes(nTerm) ||
          normalize(s.description).includes(nTerm) ||
          normalize(s.category).includes(nTerm) ||
          normalize(s.address).includes(nTerm) ||
          Boolean(branchMatch)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'RELEVANCE') {
          const fa = a.frequency || 0;
          const fb = b.frequency || 0;
          if (fb !== fa) return fb - fa;
          return a.commercial_name.localeCompare(b.commercial_name, 'es');
        }
        if (sortOrder === 'AZ') {
          return a.commercial_name.localeCompare(b.commercial_name, 'es');
        }
        return b.commercial_name.localeCompare(a.commercial_name, 'es');
      });
  }, [suppliers, searchTerm, selectedCategory, sortOrder, onlyWhatsApp]);

  const handleCopy = async (key: string, digitsOnly: string, displayLabel: string) => {
    try {
      await navigator.clipboard.writeText(digitsOnly);
      setCopiedKey(key);
      setToastMessage(`Copiado: ${digitsOnly}`);
      setTimeout(() => {
        setCopiedKey(null);
        setToastMessage(null);
      }, 2000);
    } catch {
      setToastMessage(displayLabel);
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const getWhatsAppHref = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    let normalized = digits;
    if (normalized.startsWith('09')) {
      normalized = '598' + normalized.slice(1);
    } else if (!normalized.startsWith('598') && normalized.startsWith('9')) {
      normalized = '598' + normalized;
    }
    return `https://wa.me/${normalized}`;
  };

  const cleanDisplayUrl = (url: string) => {
    return url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '');
  };

  const getMapsUrl = (address: string) => {
    let query = address.trim();
    if (!query.toLowerCase().includes('uruguay')) {
      query += ', Uruguay';
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  const renderPhoneRow = (rawPhone: string, copyKey: string, isMobile: boolean) => {
    const digits = rawPhone.replace(/\D/g, '');
    const isCopied = copiedKey === copyKey;
    const waHref = isMobile ? getWhatsAppHref(rawPhone) : null;

    return (
      <div
        key={copyKey}
        className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs"
      >
        <span className="font-mono text-slate-900 font-bold tabular-nums text-[12px]">
          {rawPhone}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy(copyKey, digits, rawPhone)}
            className={`pressable p-1.5 rounded-lg border transition touch-manipulation ${
              isCopied
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
            }`}
            title="Copiar número"
            aria-label="Copiar número"
          >
            {isCopied ? (
              <Check className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <Copy className="w-4 h-4 fill-slate-700 stroke-[1.5]" />
            )}
          </button>

          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable p-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 shadow-xs transition touch-manipulation"
              title="Abrir WhatsApp"
              aria-label="Abrir WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-white stroke-[1.5]" />
            </a>
          )}

          <a
            href={`tel:${digits}`}
            className="pressable p-1.5 rounded-lg text-white bg-slate-900 hover:bg-slate-800 border border-slate-900 shadow-xs transition touch-manipulation"
            title="Llamar"
            aria-label="Llamar"
          >
            <Phone className="w-4 h-4 fill-white stroke-[1.5]" />
          </a>
        </div>
      </div>
    );
  };

  const handleToggleAlpha = () => {
    if (sortOrder === 'AZ') {
      setSortOrder('ZA');
    } else {
      setSortOrder('AZ');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-20">
      {/* Toast discreto de copiado */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-lg border border-slate-700/80 animate-fade-in flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ZONA FIJA SUPERIOR (Sticky): Cabecera + Buscador + Categorías/Orden + Toggles WhatsApp/Fijo */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-2.5 -mx-4 px-4 border-b border-slate-200 shadow-2xs space-y-2">
        {/* Cabecera en una sola línea con título destacado */}
        <div className="flex items-center justify-between gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="pressable inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 py-0.5 flex-shrink-0 touch-manipulation"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver</span>
            </button>
          )}

          <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight text-center uppercase truncate flex-1">
            Directorio de Proveedores
          </h1>

          {onBack && <div className="w-12 flex-shrink-0" aria-hidden="true" />}
        </div>

        {/* Input de Búsqueda limpio */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, producto o servicio..."
            className="w-full pl-9 pr-9 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:border-slate-400 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Fila compacta: Desplegable custom de rubro + Switch segmentado */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          {/* Desplegable personalizado de Rubro (contador gris y sin paréntesis) */}
          <div ref={categoryRef} className="relative">
            <button
              type="button"
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              aria-expanded={isCategoryOpen}
              aria-haspopup="listbox"
              className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:border-slate-400 cursor-pointer transition"
            >
              <span className="truncate">
                {activeCategoryObj.id === 'TODOS' ? 'Categorías' : activeCategoryObj.label}{' '}
                <span className="text-slate-400 font-semibold tabular-nums">
                  {activeCategoryObj.count}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${
                  isCategoryOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCategoryOpen && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-40"
              >
                {categories.map((c) => {
                  const isSelected = c.id === selectedCategory;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedCategory(c.id);
                          setIsCategoryOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left transition ${
                          isSelected
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span className="truncate">{c.label}</span>
                        <span className="text-slate-400 font-semibold tabular-nums flex-shrink-0">
                          {c.count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Switch segmentado de ancho fijo: [ Relevancia | A-Z / Z-A ] */}
          <div className="inline-flex items-center h-8 bg-slate-100 p-0.5 rounded-xl border border-slate-200/90 shadow-2xs select-none">
            <button
              type="button"
              onClick={() => setSortOrder('RELEVANCE')}
              className={`pressable h-full px-2.5 rounded-lg text-[11px] font-extrabold transition touch-manipulation whitespace-nowrap ${
                sortOrder === 'RELEVANCE'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relevancia
            </button>
            <button
              type="button"
              onClick={handleToggleAlpha}
              className={`pressable h-full px-2.5 rounded-lg text-[11px] font-extrabold transition touch-manipulation min-w-[38px] text-center ${
                sortOrder === 'AZ' || sortOrder === 'ZA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cambiar orden alfabético"
            >
              {sortOrder === 'ZA' ? 'Z-A' : 'A-Z'}
            </button>
          </div>
        </div>

        {/* Fila inferior: Contador visible a la izquierda + Tiene WhatsApp a la derecha */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
            Mostrando {filteredSuppliers.length} de {suppliers.length}
          </span>

          <button
            type="button"
            onClick={() => setOnlyWhatsApp((prev) => !prev)}
            className={`pressable inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition touch-manipulation ${
              onlyWhatsApp
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <MessageCircle
              className={`w-3 h-3 ${onlyWhatsApp ? 'text-white fill-white' : 'text-emerald-600'}`}
            />
            <span>Tiene WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Listado de Proveedores: Tarjetas plegables por defecto */}
      <div className="pt-3">
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-300 shadow-sm my-2">
            <p className="text-sm font-semibold text-slate-700">Sin resultados</p>
            <p className="text-xs text-slate-400 mt-1">
              No encontramos ningún comercio con ese criterio de búsqueda.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('TODOS');
                setOnlyWhatsApp(false);
              }}
              className="mt-3 text-xs font-semibold text-slate-900 underline underline-offset-4"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((s) => {
              const isExpanded = Boolean(expandedIds[s.id]);
              const mobiles = s.phone_mobile
                ? s.phone_mobile.split('|').map((p) => p.trim()).filter(Boolean)
                : [];
              const fixeds = s.phone_fixed
                ? s.phone_fixed.split('|').map((p) => p.trim()).filter(Boolean)
                : [];
              const addresses = s.address
                ? s.address.split('|').map((a) => a.trim()).filter(Boolean)
                : [];
              const branches = s.branches && s.branches.length > 0 ? s.branches : null;
              const hasBranchHours = Boolean(branches?.some((b) => b.hours));

              return (
                <article
                  key={s.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 shadow-sm hover:border-slate-400 transition-colors space-y-2.5"
                >
                  {/* 1. Cabecera: Nombre Comercial subrayado + alerta sin factura + Pastilla de Rubro */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-slate-900 leading-snug tracking-tight underline underline-offset-3 decoration-slate-400">
                        {s.commercial_name}
                      </h2>
                      {s.official_invoice === false && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>No emite factura oficial</span>
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {s.category}
                    </span>
                  </div>

                  {/* 2. Descripción destacada */}
                  {s.description && (
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                      {s.description}
                    </p>
                  )}

                  {/* Botón Ampliar / Ocultar */}
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleExpand(s.id)}
                      aria-expanded={isExpanded}
                      className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition touch-manipulation"
                    >
                      <span>{isExpanded ? 'Menos' : '+ Más'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Contenido desplegable: Sucursales (o Teléfonos -> Direcciones) -> Horarios -> Web */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 space-y-2.5">
                      {branches ? (
                        <div className="space-y-2">
                          {branches.map((branch, bIdx) => (
                            <div
                              key={bIdx}
                              className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-200/80 space-y-1.5"
                            >
                              {branch.name && (
                                <p className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
                                  {branch.name}
                                </p>
                              )}

                              <a
                                href={getMapsUrl(branch.address)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pressable flex items-start gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 font-medium leading-normal group/addr transition touch-manipulation"
                                title="Abrir ubicación en Google Maps"
                              >
                                <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover/addr:text-rose-500 flex-shrink-0 mt-0.5 transition-colors" />
                                <span className="underline underline-offset-2 decoration-slate-300 group-hover/addr:decoration-slate-900">
                                  {branch.address}
                                </span>
                              </a>

                              {((branch.phone_mobile && branch.phone_mobile.length > 0) ||
                                (branch.phone_fixed && branch.phone_fixed.length > 0)) && (
                                <div className="space-y-1 pt-0.5">
                                  {(branch.phone_mobile || []).map((mob, idx) =>
                                    renderPhoneRow(mob, `b-mob-${s.id}-${bIdx}-${idx}`, true)
                                  )}
                                  {(branch.phone_fixed || []).map((fix, idx) =>
                                    renderPhoneRow(fix, `b-fix-${s.id}-${bIdx}-${idx}`, false)
                                  )}
                                </div>
                              )}

                              {branch.hours && (
                                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 font-medium pt-0.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                  <span>{branch.hours}</span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Teléfonos compactos */}
                          {(mobiles.length > 0 || fixeds.length > 0) && (
                            <div className="space-y-1">
                              {mobiles.map((mob, idx) =>
                                renderPhoneRow(mob, `mob-${s.id}-${idx}`, true)
                              )}
                              {fixeds.map((fix, idx) =>
                                renderPhoneRow(fix, `fix-${s.id}-${idx}`, false)
                              )}
                            </div>
                          )}

                          {/* Direcciones */}
                          {addresses.length > 0 && (
                            <div className="space-y-1 pt-0.5">
                              {addresses.map((addr, aIdx) => (
                                <a
                                  key={aIdx}
                                  href={getMapsUrl(addr)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="pressable flex items-start gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 font-medium leading-normal group/addr transition touch-manipulation"
                                  title="Abrir ubicación en Google Maps"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover/addr:text-rose-500 flex-shrink-0 mt-0.5 transition-colors" />
                                  <span className="underline underline-offset-2 decoration-slate-300 group-hover/addr:decoration-slate-900">
                                    {addr}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Horario general (si no se mostró por sucursal) */}
                      {s.hours && !hasBranchHours && (
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-600 font-medium pt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span>{s.hours}</span>
                        </p>
                      )}

                      {/* Página Web */}
                      {s.website && (
                        <div className="pt-0.5">
                          <a
                            href={s.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pressable inline-flex items-center gap-1.5 text-xs text-sky-800 hover:text-sky-950 font-semibold underline underline-offset-4 decoration-sky-300 hover:decoration-sky-900 transition touch-manipulation"
                          >
                            <Globe className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                            <span>{cleanDisplayUrl(s.website)}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
