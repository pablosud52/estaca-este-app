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
  ArrowUpDown,
} from 'lucide-react';
import { SupplierRecord } from '../types/database';

interface SuppliersViewProps {
  suppliers: SupplierRecord[];
  onBack?: () => void;
  embedded?: boolean;
}

type SortOrder = 'RELEVANCE' | 'ALPHABETIC';

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
      { id: 'TODOS', label: 'Todos los rubros', count: suppliers.length },
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
        return a.commercial_name.localeCompare(b.commercial_name, 'es');
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

      {/* Cabecera sobria y limpia (sin kickers, sin decoraciones de IA) */}
      <header className="pt-2 pb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="pressable inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 py-1 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
        )}
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Proveedores
          </h1>
          <span className="text-xs text-slate-400 font-medium tabular-nums">
            {filteredSuppliers.length} de {suppliers.length}
          </span>
        </div>
      </header>

      {/* Controles: Buscador + Desplegable de Rubro + Orden */}
      <div className="space-y-2.5 pb-4">
        {/* Input de Búsqueda limpio */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, producto o servicio..."
            className="w-full pl-9 pr-9 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              aria-label="Borrar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Fila compacta: Desplegable de rubro + Botón de orden */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Desplegable de Rubro */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Toggle de orden */}
          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === 'RELEVANCE' ? 'ALPHABETIC' : 'RELEVANCE'))
            }
            className="pressable inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition touch-manipulation"
            title="Cambiar orden"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>{sortOrder === 'RELEVANCE' ? 'Relevancia' : 'A-Z'}</span>
          </button>
        </div>
      </div>

      {/* Listado de Proveedores: diseño tipo directorio sobrio */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200/80 my-2">
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
        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {filteredSuppliers.map((s) => {
            // Parsear números de móvil y fijos
            const mobiles = s.phone_mobile
              ? s.phone_mobile.split('|').map((p) => p.trim()).filter(Boolean)
              : [];
            const fixeds = s.phone_fixed
              ? s.phone_fixed.split('|').map((p) => p.trim()).filter(Boolean)
              : [];

            return (
              <article key={s.id} className="p-4 sm:p-5 space-y-2.5">
                {/* Cabecera del ítem: Nombre + Razón Social + Rubro */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 leading-snug">
                      {s.commercial_name}
                    </h2>
                    {s.legal_name && (
                      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide leading-tight mt-0.5">
                        {s.legal_name}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {s.category}
                  </span>
                </div>

                {/* Descripción concisa */}
                {s.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {s.description}
                  </p>
                )}

                {/* Dirección si existe */}
                {s.address && (
                  <p className="text-[11px] text-slate-400 flex items-start gap-1 leading-normal">
                    <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>{s.address}</span>
                  </p>
                )}

                {/* Página Web visible si existe (ícono de mundo + URL linkeable) */}
                {s.website && (
                  <div className="pt-0.5">
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 font-medium underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900 transition"
                    >
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>{cleanDisplayUrl(s.website)}</span>
                    </a>
                  </div>
                )}

                {/* Vías de contacto telefónico: visibles con sus acciones al lado */}
                <div className="pt-1 space-y-1.5">
                  {/* Celulares / WhatsApp */}
                  {mobiles.map((mob, idx) => {
                    const digits = mob.replace(/\D/g, '');
                    const copyKey = `mob-${s.id}-${idx}`;
                    const isCopied = copiedKey === copyKey;
                    const waHref = getWhatsAppHref(mob);

                    return (
                      <div
                        key={copyKey}
                        className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-mono text-slate-800 font-medium tabular-nums">
                          {mob}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Botón WhatsApp */}
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition touch-manipulation"
                            title="Abrir WhatsApp"
                          >
                            <MessageCircle className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>

                          {/* Botón Llamar */}
                          <a
                            href={`tel:${digits}`}
                            className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition touch-manipulation"
                            title="Llamar"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>Llamar</span>
                          </a>

                          {/* Botón Copiar */}
                          <button
                            type="button"
                            onClick={() => handleCopy(copyKey, digits, mob)}
                            className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition touch-manipulation"
                            title="Copiar número"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Teléfonos fijos */}
                  {fixeds.map((fix, idx) => {
                    const digits = fix.replace(/\D/g, '');
                    const copyKey = `fix-${s.id}-${idx}`;
                    const isCopied = copiedKey === copyKey;

                    return (
                      <div
                        key={copyKey}
                        className="flex items-center justify-between gap-2 py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-mono text-slate-800 font-medium tabular-nums">
                          {fix}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Botón Llamar */}
                          <a
                            href={`tel:${digits}`}
                            className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition touch-manipulation"
                            title="Llamar"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>Llamar</span>
                          </a>

                          {/* Botón Copiar */}
                          <button
                            type="button"
                            onClick={() => handleCopy(copyKey, digits, fix)}
                            className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition touch-manipulation"
                            title="Copiar número"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
