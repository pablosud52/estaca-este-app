import React, { useState, useMemo } from 'react';
import {
  Search,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Globe,
  MapPin,
  ChevronDown,
  X,
  ArrowLeft,
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
  const [sortOrder, setSortOrder] = useState<SortOrder>('RELEVANCE');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lista única de categorías ordenadas por cantidad
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    suppliers.forEach((s) => {
      const cat = s.category || 'Varios';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return [
      { id: 'TODOS', label: 'Todas las categorías', count: suppliers.length },
      ...sorted.map(([name, count]) => ({ id: name, label: name, count })),
    ];
  }, [suppliers]);

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
        if (selectedCategory !== 'TODOS' && s.category !== selectedCategory) {
          return false;
        }
        if (!nTerm) return true;
        return (
          normalize(s.commercial_name).includes(nTerm) ||
          normalize(s.legal_name).includes(nTerm) ||
          normalize(s.description).includes(nTerm) ||
          normalize(s.category).includes(nTerm) ||
          normalize(s.address).includes(nTerm)
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
  }, [suppliers, searchTerm, selectedCategory, sortOrder]);

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

      {/* ZONA FIJA SUPERIOR (Sticky): Cabecera + Buscador + Categorías/Filtros */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-2.5 -mx-4 px-4 border-b border-slate-200 shadow-2xs space-y-2">
        {/* Cabecera compacta en una sola línea */}
        <div className="flex items-center justify-between gap-2">
          <div className="w-16 flex-shrink-0">
            {onBack && (
              <button
                onClick={onBack}
                className="pressable inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 py-0.5 touch-manipulation"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
            )}
          </div>

          <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight text-center uppercase truncate flex-1">
            Guía de Proveedores
          </h1>

          <div className="w-16 flex-shrink-0 text-right">
            <span className="text-[11px] text-slate-400 font-bold tabular-nums whitespace-nowrap">
              {filteredSuppliers.length} de {suppliers.length}
            </span>
          </div>
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

        {/* Fila compacta: Desplegable de rubro + Switch segmentado */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          {/* Desplegable de Rubro */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:border-slate-400 cursor-pointer truncate"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === 'TODOS' ? 'Categorías' : c.label} ({c.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
      </div>

      {/* Listado de Proveedores: Tarjetas individuales */}
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
              }}
              className="mt-3 text-xs font-semibold text-slate-900 underline underline-offset-4"
            >
              Ver todos los proveedores
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((s) => {
              const mobiles = s.phone_mobile
                ? s.phone_mobile.split('|').map((p) => p.trim()).filter(Boolean)
                : [];
              const fixeds = s.phone_fixed
                ? s.phone_fixed.split('|').map((p) => p.trim()).filter(Boolean)
                : [];
              const addresses = s.address
                ? s.address.split('|').map((a) => a.trim()).filter(Boolean)
                : [];

              return (
                <article
                  key={s.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 shadow-sm hover:border-slate-400 transition-colors space-y-3"
                >
                  {/* 1. Cabecera: Nombre Comercial subrayado + Razón Social + Pastilla de Rubro */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-slate-900 leading-snug tracking-tight underline underline-offset-3 decoration-slate-400">
                        {s.commercial_name}
                      </h2>
                      {s.legal_name && (
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-tight mt-1">
                          {s.legal_name}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {s.category}
                    </span>
                  </div>

                  {/* 2. Descripción destacada con presencia (seminegrita) */}
                  {s.description && (
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                      {s.description}
                    </p>
                  )}

                  {/* 3. Teléfonos compactos con botones de solo icono rellenos [Copiar] [WhatsApp] [Llamar] */}
                  {(mobiles.length > 0 || fixeds.length > 0) && (
                    <div className="space-y-1">
                      {/* Celulares / WhatsApp */}
                      {mobiles.map((mob, idx) => {
                        const digits = mob.replace(/\D/g, '');
                        const copyKey = `mob-${s.id}-${idx}`;
                        const isCopied = copiedKey === copyKey;
                        const waHref = getWhatsAppHref(mob);

                        return (
                          <div
                            key={copyKey}
                            className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs"
                          >
                            <span className="font-mono text-slate-900 font-bold tabular-nums text-[12px]">
                              {mob}
                            </span>

                            {/* Orden estricto: Copiar -> WhatsApp -> Llamar */}
                            <div className="flex items-center gap-1.5">
                              {/* 1. Botón Copiar */}
                              <button
                                type="button"
                                onClick={() => handleCopy(copyKey, digits, mob)}
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

                              {/* 2. Botón WhatsApp */}
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

                              {/* 3. Botón Llamar */}
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
                      })}

                      {/* Fijos */}
                      {fixeds.map((fix, idx) => {
                        const digits = fix.replace(/\D/g, '');
                        const copyKey = `fix-${s.id}-${idx}`;
                        const isCopied = copiedKey === copyKey;

                        return (
                          <div
                            key={copyKey}
                            className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs"
                          >
                            <span className="font-mono text-slate-900 font-bold tabular-nums text-[12px]">
                              {fix}
                            </span>

                            {/* Orden estricto: Copiar -> Llamar */}
                            <div className="flex items-center gap-1.5">
                              {/* 1. Botón Copiar */}
                              <button
                                type="button"
                                onClick={() => handleCopy(copyKey, digits, fix)}
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

                              {/* 2. Botón Llamar */}
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
                      })}
                    </div>
                  )}

                  {/* 4. Direcciones individuales clickeables hacia Google Maps */}
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

                  {/* 5. Página Web (al final) con ícono de mundo y URL linkeable */}
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
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
