import React, { useState, useMemo } from 'react';
import {
  Search,
  Phone,
  MessageCircle,
  ExternalLink,
  MapPin,
  ArrowUpDown,
  Building2,
  X,
  Layers,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { SupplierRecord } from '../types/database';
import { SupplierContactModal } from '../components/SupplierContactModal';

interface SuppliersViewProps {
  suppliers: SupplierRecord[];
  onBack?: () => void;
  embedded?: boolean;
}

type SortMode = 'FREQUENCY' | 'ALPHABETIC';

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  onBack,
  embedded = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [sortMode, setSortMode] = useState<SortMode>('FREQUENCY');
  const [activeModalSupplier, setActiveModalSupplier] = useState<SupplierRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Extraer categorías únicas con conteo
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    suppliers.forEach((s) => {
      const cat = s.category || 'Otros';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return [{ name: 'TODOS', count: suppliers.length }, ...sorted.map(([name, count]) => ({ name, count }))];
  }, [suppliers]);

  // 2. Filtrado y ordenamiento inteligente
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return suppliers
      .filter((s) => {
        // Filtro por categoría
        if (selectedCategory !== 'TODOS' && s.category !== selectedCategory) {
          return false;
        }

        // Búsqueda libre insensible a tildes y mayúsculas
        if (!term) return true;

        const normalize = (txt?: string) =>
          (txt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const nTerm = normalize(term);
        const matchName = normalize(s.commercial_name).includes(nTerm);
        const matchLegal = normalize(s.legal_name).includes(nTerm);
        const matchDesc = normalize(s.description).includes(nTerm);
        const matchCat = normalize(s.category).includes(nTerm);
        const matchAddress = normalize(s.address).includes(nTerm);

        return matchName || matchLegal || matchDesc || matchCat || matchAddress;
      })
      .sort((a, b) => {
        if (sortMode === 'FREQUENCY') {
          const fa = a.frequency || 0;
          const fb = b.frequency || 0;
          if (fb !== fa) return fb - fa;
          return a.commercial_name.localeCompare(b.commercial_name, 'es');
        } else {
          return a.commercial_name.localeCompare(b.commercial_name, 'es');
        }
      });
  }, [suppliers, searchTerm, selectedCategory, sortMode]);

  // Helper para contar teléfonos de un proveedor
  const getPhoneCount = (s: SupplierRecord) => {
    let count = 0;
    if (s.phone_mobile) count += s.phone_mobile.split('|').length;
    if (s.phone_fixed) count += s.phone_fixed.split('|').length;
    return count;
  };

  const getPrimaryWhatsApp = (s: SupplierRecord) => {
    if (!s.phone_mobile) return null;
    const first = s.phone_mobile.split('|')[0].trim();
    let raw = first.replace(/\D/g, '');
    if (raw.startsWith('09')) raw = '598' + raw.slice(1);
    else if (!raw.startsWith('598') && raw.startsWith('9')) raw = '598' + raw;
    return raw ? `https://wa.me/${raw}` : null;
  };

  const getPrimaryPhone = (s: SupplierRecord) => {
    if (s.phone_fixed) {
      const first = s.phone_fixed.split('|')[0].trim();
      return first.replace(/\D/g, '');
    }
    if (s.phone_mobile) {
      const first = s.phone_mobile.split('|')[0].trim();
      return first.replace(/\D/g, '');
    }
    return null;
  };

  return (
    <div className="w-full pb-16">
      {/* Toast de notificación rápida */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700/80 backdrop-blur-md animate-fade-in flex items-center gap-2">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabecera / Banner */}
      <div className="mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="pressable inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 mb-3 px-2 py-1 rounded-lg hover:bg-slate-100 transition touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Panel</span>
          </button>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
                <Building2 className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-800">
                Directorio Oficial
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Proveedores y Servicios
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Contactos verificados y proveedores de confianza para eventos y actividades de la Estaca.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {suppliers.length}
            </span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              Registrados
            </span>
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros (Sticky para Smartphone) */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 mb-4 -mx-4 px-4 border-b border-slate-200/80 space-y-3">
        {/* Input de Búsqueda */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, producto, cotillón, sonido..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Chips de Categorías (Desplazable horizontalmente en móvil) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 overscroll-contain">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`pressable flex-shrink-0 text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition touch-manipulation flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fila inferior de ordenamiento y contador de resultados */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="font-bold text-slate-500">
            {filteredSuppliers.length === suppliers.length ? (
              <span>Mostrando todos ({suppliers.length})</span>
            ) : (
              <span className="text-slate-900 font-extrabold">
                {filteredSuppliers.length} encontrados
              </span>
            )}
          </span>

          {/* Toggle de orden */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setSortMode('FREQUENCY')}
              className={`pressable px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition touch-manipulation ${
                sortMode === 'FREQUENCY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Relevantes
            </button>
            <button
              onClick={() => setSortMode('ALPHABETIC')}
              className={`pressable px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition touch-manipulation ${
                sortMode === 'ALPHABETIC'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🔤 A-Z
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Tarjetas de Proveedores */}
      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-3xl border border-slate-200/80 my-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            No se encontraron comercios
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Prueba buscando con otra palabra clave o cambiando el filtro de rubro seleccionado.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('TODOS');
            }}
            className="pressable mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold transition touch-manipulation"
          >
            Restablecer Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredSuppliers.map((supplier) => {
            const phoneCount = getPhoneCount(supplier);
            const waLink = getPrimaryWhatsApp(supplier);
            const callNumber = getPrimaryPhone(supplier);

            return (
              <div
                key={supplier.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs hover:border-slate-300 transition flex flex-col justify-between gap-3 relative group"
              >
                {/* Cabecera de la tarjeta */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      {supplier.category}
                    </span>

                    {/* Badge de uso frecuente si tiene más de 3 compras */}
                    {(supplier.frequency || 0) >= 4 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Frecuente ({supplier.frequency})</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-slate-900 tracking-tight mt-2 leading-snug">
                    {supplier.commercial_name}
                  </h3>

                  {supplier.legal_name && (
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate mt-0.5">
                      {supplier.legal_name}
                    </p>
                  )}

                  {supplier.description && (
                    <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                      {supplier.description}
                    </p>
                  )}

                  {supplier.address && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-[11px] text-slate-400 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-tight">
                        {supplier.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botonera de Contacto Touch */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  {/* Si tiene múltiples teléfonos o se prefiere ver el detalle completo */}
                  {phoneCount > 1 ? (
                    <button
                      onClick={() => setActiveModalSupplier(supplier)}
                      className="pressable flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 text-white text-xs font-extrabold shadow-sm hover:bg-slate-800 transition touch-manipulation active:scale-[0.98]"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ver Teléfonos ({phoneCount})</span>
                    </button>
                  ) : (
                    <>
                      {/* Llamar directo */}
                      {callNumber && (
                        <a
                          href={`tel:${callNumber}`}
                          className="pressable flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 text-white text-xs font-extrabold shadow-sm hover:bg-slate-800 transition touch-manipulation active:scale-[0.98]"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Llamar</span>
                        </a>
                      )}

                      {/* WhatsApp directo si es móvil */}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pressable flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow-sm hover:bg-emerald-700 transition touch-manipulation active:scale-[0.98]"
                          aria-label="Abrir chat de WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </a>
                      )}
                    </>
                  )}

                  {/* Web oficial */}
                  {supplier.website && (
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pressable p-2.5 rounded-xl bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/80 transition touch-manipulation active:scale-[0.98]"
                      title="Visitar sitio web"
                      aria-label="Visitar sitio web"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Botón rápido para abrir modal si tiene 1 teléfono pero quiere copiarlo */}
                  {phoneCount === 1 && (
                    <button
                      onClick={() => setActiveModalSupplier(supplier)}
                      className="pressable p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition touch-manipulation active:scale-[0.98]"
                      title="Opciones de contacto y copiar"
                      aria-label="Más opciones de contacto"
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Bottom Sheet de Contactos */}
      {activeModalSupplier && (
        <SupplierContactModal
          supplier={activeModalSupplier}
          onClose={() => setActiveModalSupplier(null)}
          onToast={showToast}
        />
      )}
    </div>
  );
};
