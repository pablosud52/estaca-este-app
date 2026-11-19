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
  Clock,
  AlertCircle,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { SupplierRecord } from '../types/database';
import { SupplierFormModal } from '../components/SupplierFormModal';

interface SuppliersViewProps {
  suppliers: SupplierRecord[];
  onBack?: () => void;
  embedded?: boolean;
  canManage?: boolean;
  onCreateSupplier?: (supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
  onUpdateSupplier?: (id: number, supplier: Omit<SupplierRecord, 'id'>) => Promise<void>;
  onDeleteSupplier?: (id: number) => Promise<void>;
}

type SortOrder = 'RELEVANCE' | 'AZ' | 'ZA';
type SuppliersTab = 'ACTIVE' | 'PENDING';

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  canManage = false,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SuppliersTab>('ACTIVE');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierRecord | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
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

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (supplierToDelete && !dialog.open) {
      dialog.showModal();
    } else if (!supplierToDelete && dialog.open) {
      dialog.close();
    }
  }, [supplierToDelete]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.status !== 'PENDIENTE'),
    [suppliers]
  );

  const pendingSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === 'PENDIENTE'),
    [suppliers]
  );

  const currentTabSuppliers = canManage && activeSubTab === 'PENDING' ? pendingSuppliers : activeSuppliers;

  const getSupplierCategory = (s: SupplierRecord) => (s.category || 'Varios').trim() || 'Varios';

  // Lista única de categorías ordenadas por cantidad (sobre proveedores activos)
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    activeSuppliers.forEach((s) => {
      const cat = getSupplierCategory(s);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return [
      { id: 'TODOS', label: 'Todas las categorías', count: activeSuppliers.length },
      ...sorted.map(([name, count]) => ({ id: name, label: name, count })),
    ];
  }, [activeSuppliers]);

  const existingCategoryNames = useMemo(
    () => categories.filter((c) => c.id !== 'TODOS').map((c) => c.label),
    [categories]
  );

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

    return currentTabSuppliers
      .filter((s) => {
        if (
          activeSubTab === 'ACTIVE' &&
          selectedCategory !== 'TODOS' &&
          getSupplierCategory(s) !== selectedCategory
        ) {
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
  }, [currentTabSuppliers, activeSubTab, searchTerm, selectedCategory, sortOrder, onlyWhatsApp]);

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

  const handleSaveModal = async (payload: Omit<SupplierRecord, 'id'>, existingId?: number) => {
    if (existingId !== undefined && onUpdateSupplier) {
      await onUpdateSupplier(existingId, payload);
      setToastMessage('Proveedor actualizado');
    } else if (onCreateSupplier) {
      await onCreateSupplier(payload);
      setToastMessage('Proveedor agregado');
    }
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleQuickApprove = async (s: SupplierRecord) => {
    if (!onUpdateSupplier) return;
    const { id: _id, ...rest } = s;
    await onUpdateSupplier(s.id, {
      ...rest,
      status: 'ACTIVO',
      updated_at: new Date().toISOString().slice(0, 10),
    });
    setToastMessage(`"${s.commercial_name}" aprobado en el directorio`);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete || !onDeleteSupplier) return;
    const deletedName = supplierToDelete.commercial_name;
    await onDeleteSupplier(supplierToDelete.id);
    setSupplierToDelete(null);
    setToastMessage(`"${deletedName}" eliminado del directorio`);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const formatSupplierDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return dateStr;
  };

  const renderExpandedDetails = (s: SupplierRecord) => {
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
      <div className="space-y-2.5">
        {s.description && (
          <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
            {s.description}
          </p>
        )}

        {branches ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            {(mobiles.length > 0 || fixeds.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {mobiles.map((mob, idx) => renderPhoneRow(mob, `mob-${s.id}-${idx}`, true))}
                {fixeds.map((fix, idx) => renderPhoneRow(fix, `fix-${s.id}-${idx}`, false))}
              </div>
            )}

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

        {s.hours && !hasBranchHours && (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-600 font-medium pt-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{s.hours}</span>
          </p>
        )}

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

        {canManage && (s.rut || s.legal_name || s.email) && (
          <div className="pt-2 border-t border-slate-200/70 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium">
            {s.legal_name && (
              <span>
                <strong className="text-slate-700">Razón social:</strong> {s.legal_name}
              </span>
            )}
            {s.rut && (
              <span className="tabular-nums">
                <strong className="text-slate-700">RUT:</strong> {s.rut}
              </span>
            )}
            {s.email && (
              <span>
                <strong className="text-slate-700">Email:</strong> {s.email}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-2.5">
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

      {/* Marco superior fijo: Título + Botón Nuevo (Admin) + Pestañas + Desplegable de categorías + Buscador */}
      <div className="sticky top-[62px] md:top-[108px] z-20 bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
              Proveedores
            </h1>
            <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
              {filteredSuppliers.length} de {currentTabSuppliers.length}
            </span>
          </div>

          {canManage && onCreateSupplier && (
            <button
              type="button"
              data-testid="suppliers-add-btn"
              onClick={() => {
                setEditingSupplier(null);
                setIsFormModalOpen(true);
              }}
              className="pressable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-xs transition touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo proveedor</span>
            </button>
          )}
        </div>

        {canManage && (
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              data-testid="suppliers-tab-active"
              onClick={() => setActiveSubTab('ACTIVE')}
              className={`pressable px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                activeSubTab === 'ACTIVE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Directorio ({activeSuppliers.length})
            </button>
            <button
              type="button"
              data-testid="suppliers-tab-pending"
              onClick={() => setActiveSubTab('PENDING')}
              className={`pressable inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                activeSubTab === 'PENDING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pendientes</span>
              {pendingSuppliers.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                  {pendingSuppliers.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Fila de controles: Desplegable de categorías + Buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
          {/* Desplegable personalizado de Rubro (estilo Calendario) */}
          <div ref={categoryRef} className="relative sm:w-64 flex-shrink-0">
            <button
              type="button"
              data-testid="suppliers-category-filter-trigger"
              onClick={() => setIsCategoryOpen((prev) => !prev)}
              aria-expanded={isCategoryOpen}
              aria-haspopup="listbox"
              className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 transition ${
                selectedCategory !== 'TODOS'
                  ? 'bg-slate-100 border border-slate-700 text-slate-900'
                  : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <SlidersHorizontal
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    selectedCategory !== 'TODOS' ? 'text-slate-900' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">
                  {activeCategoryObj.id === 'TODOS' ? 'Todas las categorías' : activeCategoryObj.label}{' '}
                  <span className="text-slate-400 font-semibold tabular-nums">
                    {activeCategoryObj.count}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${
                  isCategoryOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCategoryOpen && (
              <div
                role="listbox"
                className="absolute left-0 right-0 sm:w-72 mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg p-2 space-y-1.5"
              >
                <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('TODOS');
                      setIsCategoryOpen(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedCategory === 'TODOS'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Todas ({suppliers.length})
                  </button>
                </div>

                <ul className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                  {categories
                    .filter((c) => c.id !== 'TODOS')
                    .map((c) => {
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
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs text-left transition ${
                              isSelected
                                ? 'bg-slate-100 text-slate-900 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 font-semibold'
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
              </div>
            )}
          </div>

          {/* Input de Búsqueda limpio */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, producto o servicio..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition"
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
        </div>

        {/* Fila inferior: Switch de orden + Filtro WhatsApp */}
        <div className="flex items-center justify-between gap-2">
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

      {/* Lista / Tabla de proveedores */}
      {canManage ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="py-12 text-center px-4">
              <p className="text-sm font-semibold text-slate-700">
                {activeSubTab === 'PENDING' ? 'Sin sugerencias pendientes' : 'Sin resultados'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {activeSubTab === 'PENDING'
                  ? 'Cuando se sugiera un proveedor nuevo desde Finanzas aparecerá aquí para revisar.'
                  : 'No encontramos ningún comercio con ese criterio de búsqueda.'}
              </p>
              {activeSubTab === 'ACTIVE' && (
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
              )}
            </div>
          ) : (
            <>
              {/* VISTA ESCRITORIO: TABLA ALINEADA (estilo Finanzas y Calendario) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 pl-4 pr-3 whitespace-nowrap">Revisión</th>
                      <th className="py-3 px-3">Proveedor</th>
                      <th className="py-3 px-3 whitespace-nowrap">Rubro</th>
                      <th className="py-3 px-3 whitespace-nowrap">Teléfono</th>
                      <th className="py-3 px-3 whitespace-nowrap">RUT</th>
                      <th className="py-3 px-3 text-center whitespace-nowrap">Detalle</th>
                      <th className="py-3 pl-3 pr-4 text-right whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredSuppliers.map((s) => {
                      const isExpanded = Boolean(expandedIds[s.id]);
                      const primaryPhone =
                        (s.phone_mobile || s.phone_fixed || s.phone || '')
                          .split('|')
                          .map((p) => p.trim())
                          .filter(Boolean)[0] || '—';

                      return (
                        <React.Fragment key={s.id}>
                          <tr
                            data-testid={`admin-supplier-row-${s.id}`}
                            className={`transition ${
                              s.status === 'PENDIENTE'
                                ? 'bg-amber-50/40 hover:bg-amber-50/70'
                                : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td className="py-3 pl-4 pr-3 whitespace-nowrap text-slate-500 font-medium tabular-nums">
                              {formatSupplierDate(s.updated_at)}
                            </td>

                            <td className="py-3 px-3 min-w-[200px]">
                              <div className="font-bold text-slate-900 leading-snug">
                                {s.commercial_name}
                              </div>
                              {s.legal_name && (
                                <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                                  {s.legal_name}
                                </div>
                              )}
                              {s.official_invoice === false && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 mt-0.5">
                                  <AlertCircle className="w-3 h-3" />
                                  Sin factura oficial
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="inline-block text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {s.category}
                              </span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700 tabular-nums">
                              {primaryPhone}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 tabular-nums">
                              {s.rut || '—'}
                            </td>

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => toggleExpand(s.id)}
                                aria-expanded={isExpanded}
                                className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition"
                              >
                                <span>{isExpanded ? 'Menos' : '+ Más'}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-slate-500" />
                                )}
                              </button>
                            </td>

                            <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                              {s.status === 'PENDIENTE' ? (
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSupplier(s);
                                      setIsFormModalOpen(true);
                                    }}
                                    className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    <span>Completar</span>
                                  </button>
                                  {onUpdateSupplier && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickApprove(s)}
                                      className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                                      title="Aprobar así"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onDeleteSupplier && (
                                    <button
                                      type="button"
                                      onClick={() => setSupplierToDelete(s)}
                                      className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition"
                                      title="Descartar sugerencia"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {onUpdateSupplier && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSupplier(s);
                                        setIsFormModalOpen(true);
                                      }}
                                      title="Editar proveedor"
                                      aria-label={`Editar ${s.commercial_name}`}
                                      className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition"
                                    >
                                      <Pencil className="w-3 h-3 text-slate-500" />
                                      <span>Editar</span>
                                    </button>
                                  )}
                                  {onDeleteSupplier && (
                                    <button
                                      type="button"
                                      onClick={() => setSupplierToDelete(s)}
                                      title="Eliminar proveedor"
                                      aria-label={`Eliminar ${s.commercial_name}`}
                                      className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200/80 transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={7} className="px-4 py-3.5 border-t border-slate-100">
                                {renderExpandedDetails(s)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* VISTA MÓVIL: LISTA COMPACTA (sin tarjetas) */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredSuppliers.map((s) => {
                  const isExpanded = Boolean(expandedIds[s.id]);
                  const primaryPhone =
                    (s.phone_mobile || s.phone_fixed || s.phone || '')
                      .split('|')
                      .map((p) => p.trim())
                      .filter(Boolean)[0] || '';

                  return (
                    <div
                      key={s.id}
                      className={`p-3.5 space-y-2 ${
                        s.status === 'PENDIENTE' ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 leading-snug">
                            {s.commercial_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">{s.category}</span>
                            {s.updated_at && (
                              <span className="tabular-nums">· Rev: {formatSupplierDate(s.updated_at)}</span>
                            )}
                            {primaryPhone && <span className="font-mono tabular-nums">· {primaryPhone}</span>}
                            {s.rut && <span className="font-mono tabular-nums">· RUT {s.rut}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(s.id)}
                          aria-expanded={isExpanded}
                          className="pressable flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200"
                        >
                          <span>{isExpanded ? 'Menos' : '+ Más'}</span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-slate-100">
                          {renderExpandedDetails(s)}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        {s.status === 'PENDIENTE' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSupplier(s);
                                setIsFormModalOpen(true);
                              }}
                              className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-900 text-white"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Completar</span>
                            </button>
                            {onUpdateSupplier && (
                              <button
                                type="button"
                                onClick={() => handleQuickApprove(s)}
                                className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Aprobar</span>
                              </button>
                            )}
                            {onDeleteSupplier && (
                              <button
                                type="button"
                                onClick={() => setSupplierToDelete(s)}
                                className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {onUpdateSupplier && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(s);
                                  setIsFormModalOpen(true);
                                }}
                                className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-white border border-slate-200"
                              >
                                <Pencil className="w-3 h-3 text-slate-500" />
                                <span>Editar</span>
                              </button>
                            )}
                            {onDeleteSupplier && (
                              <button
                                type="button"
                                onClick={() => setSupplierToDelete(s)}
                                className="pressable inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-white border border-rose-200"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* VISTA SOLO LECTURA PARA LÍDERES / CONSULTA */
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-card">
          <div className="relative overflow-y-auto scroll-smooth pr-1 max-h-[calc(100dvh-260px)] min-h-[320px]">
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

                return (
                  <article
                    key={s.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-300/90 shadow-sm hover:border-slate-400 transition-colors space-y-2.5"
                  >
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

                    {s.description && (
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                        {s.description}
                      </p>
                    )}

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

                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-100">
                        {renderExpandedDetails(s)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Modal de Alta / Edición de Proveedor */}
      {canManage && (
        <SupplierFormModal
          isOpen={isFormModalOpen}
          initialSupplier={editingSupplier}
          existingCategories={existingCategoryNames}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingSupplier(null);
          }}
          onSave={handleSaveModal}
        />
      )}

      {/* Modal de Confirmación de Eliminación / Descarte */}
      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-supplier-title"
        onCancel={(e) => {
          e.preventDefault();
          setSupplierToDelete(null);
        }}
        className="m-auto w-[min(92vw,420px)] rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4"
      >
        <div className="space-y-1.5">
          <h2 id="delete-supplier-title" className="text-base font-extrabold text-slate-900">
            {supplierToDelete?.status === 'PENDIENTE'
              ? '¿Descartar sugerencia?'
              : '¿Eliminar proveedor del directorio?'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Se quitará{' '}
            <strong className="text-slate-900">{supplierToDelete?.commercial_name}</strong> de la
            lista de proveedores. Los gastos que ya fueron cargados en Finanzas conservarán este
            nombre en su historial.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            autoFocus
            onClick={() => setSupplierToDelete(null)}
            className="pressable px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="pressable px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 transition"
          >
            {supplierToDelete?.status === 'PENDIENTE' ? 'Sí, descartar' : 'Sí, eliminar'}
          </button>
        </div>
      </dialog>
    </section>
  );
};
