import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  Info,
  ListChecks,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import {
  APPROPRIATE_FUNDS_ITEMS,
  FUNDS_NOTES,
  NORMATIVA_DOCS,
  isCategoryAllowedValue,
  type AppropriateFundsItem,
  type FundsCategoryFilter,
  type NormativaTabId,
} from '../data/normativasData';
import { PdfViewerModal } from './PdfViewerModal';

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const CATEGORY_FILTERS: { id: FundsCategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PRESUPUESTO', label: 'Presupuesto' },
  { id: 'OFRENDAS', label: 'Ofrendas de Ayuno' },
  { id: 'REEMBOLSABLES', label: 'Gastos Reembolsables' },
  { id: 'OTROS', label: 'Otros' },
  { id: 'MIEMBRO', label: 'A cargo del miembro' },
];

const TAB_ORDER: {
  id: NormativaTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'OPERATIONAL_SUMMARY', label: 'Resumen Operativo', icon: ClipboardList },
  { id: 'FUNDS_USE', label: 'Uso Apropiado de los Fondos', icon: CheckCircle2 },
  { id: 'ANNUAL_CLOSING', label: 'Cierre Anual', icon: Scale },
  { id: 'MONEY_EXCEPTION', label: 'Excepción de Dinero', icon: ArrowRightLeft },
];

interface AllowedEntry {
  key: string;
  label: string;
  detail: string | null;
  isMember?: boolean;
}

const extractDetail = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'SI') return null;
  if (trimmed.toUpperCase().startsWith('SI ')) {
    return trimmed.slice(3).trim();
  }
  return trimmed;
};

const getAllowedEntries = (item: AppropriateFundsItem): AllowedEntry[] => {
  const entries: AllowedEntry[] = [];

  if (isCategoryAllowedValue(item.presupuesto)) {
    entries.push({
      key: 'presupuesto',
      label: 'Presupuesto',
      detail: extractDetail(item.presupuesto),
    });
  }
  if (isCategoryAllowedValue(item.ofrendas)) {
    entries.push({
      key: 'ofrendas',
      label: 'Ofrendas de Ayuno',
      detail: extractDetail(item.ofrendas),
    });
  }
  if (isCategoryAllowedValue(item.reembolsables)) {
    entries.push({
      key: 'reembolsables',
      label: 'Gastos Reembolsables',
      detail: extractDetail(item.reembolsables),
    });
  }
  if (isCategoryAllowedValue(item.otros)) {
    entries.push({
      key: 'otros',
      label: 'Otros',
      detail: extractDetail(item.otros),
    });
  }
  if (isCategoryAllowedValue(item.miembro)) {
    entries.push({
      key: 'miembro',
      label: 'A cargo del miembro',
      detail: extractDetail(item.miembro),
      isMember: true,
    });
  }

  return entries;
};

const matchesCategoryFilter = (item: AppropriateFundsItem, filter: FundsCategoryFilter): boolean => {
  switch (filter) {
    case 'ALL':
      return true;
    case 'PRESUPUESTO':
      return isCategoryAllowedValue(item.presupuesto);
    case 'OFRENDAS':
      return isCategoryAllowedValue(item.ofrendas);
    case 'REEMBOLSABLES':
      return isCategoryAllowedValue(item.reembolsables);
    case 'OTROS':
      return isCategoryAllowedValue(item.otros);
    case 'MIEMBRO':
      return isCategoryAllowedValue(item.miembro);
  }
};

export const FinancialInfoSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NormativaTabId>('OPERATIONAL_SUMMARY');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FundsCategoryFilter>('ALL');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const activeDoc = NORMATIVA_DOCS[activeTab];

  const filteredFundsItems = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return APPROPRIATE_FUNDS_ITEMS.filter((item) => {
      if (!matchesCategoryFilter(item, categoryFilter)) return false;
      if (!query) return true;

      const noteTexts = item.notes
        .map((code) => FUNDS_NOTES[code]?.text || '')
        .join(' ');
      const searchable = normalizeSearchText(
        `${item.concept} ${item.reference} ${item.ofrendas} ${item.presupuesto} ${item.reembolsables} ${item.otros} ${item.miembro} ${noteTexts}`
      );
      return searchable.includes(query);
    });
  }, [searchQuery, categoryFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || categoryFilter !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
  };

  return (
    <div data-testid="financial-info-section" className="space-y-5 animate-fade-in">
      {/* Cabecera principal */}
      <div className="bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-white/10 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 text-sky-200 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
              Normativas
            </h2>
            <p className="text-xs text-sky-100/80 mt-0.5 leading-relaxed">
              Resumen operativo y guías oficiales para consulta rápida, con acceso directo a cada PDF original.
            </p>
          </div>
        </div>

        {/* Pestañas */}
        <div
          role="tablist"
          aria-label="Secciones de Normativas"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1"
        >
          {TAB_ORDER.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`normativa-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`pressable flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-left text-xs font-extrabold transition border ${
                  isSelected
                    ? 'bg-white text-[#072B52] border-white shadow-md'
                    : 'bg-white/10 text-sky-100 border-white/15 hover:bg-white/15'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? 'text-[#083563]' : 'text-sky-200'
                  }`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenedor del contenido activo */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* Cabecera de la pestaña + acceso al PDF oficial (si corresponde) */}
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                {activeDoc.title}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-700">
                {activeDoc.issuedLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {activeDoc.subtitle}
            </p>
          </div>

          {activeDoc.pdfUrl && (
            <button
              type="button"
              data-testid="normativa-open-pdf-btn"
              onClick={() => setPdfModalOpen(true)}
              className="pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#072B52] hover:bg-[#083563] text-white text-xs font-extrabold shadow-sm transition flex-shrink-0"
            >
              <FileText className="w-4 h-4 text-sky-200" />
              <span>Ver PDF oficial</span>
            </button>
          )}
        </div>

        {/* Contenido de la pestaña activa */}
        <div className="p-5 sm:p-6">
          {/* PESTAÑA 1: RESUMEN OPERATIVO (sin PDF oficial) */}
          {activeTab === 'OPERATIONAL_SUMMARY' && (
            <div data-testid="normativa-panel-OPERATIONAL_SUMMARY" className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dato 1: Límite de tarjeta */}
                <article className="rounded-2xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#072B52]/8 text-[#072B52] flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Límite de la tarjeta
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Tope mensual disponible para pagos con la tarjeta.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <p className="text-xl font-extrabold text-[#072B52] tabular-nums">
                      USD 1.500 <span className="text-xs font-bold text-slate-500">/ mes</span>
                    </p>
                    <p className="text-xs font-semibold text-slate-600 tabular-nums">
                      $ 60.000 aprox. mensuales
                    </p>
                  </div>
                </article>

                {/* Dato 2: Reinicio del saldo */}
                <article className="rounded-2xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#072B52]/8 text-[#072B52] flex items-center justify-center flex-shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Reinicio del saldo
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Ventana mensual en la que se renueva el saldo habilitado de la tarjeta.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <p className="text-xl font-extrabold text-[#072B52]">
                      Día 25 al 26
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      De cada mes
                    </p>
                  </div>
                </article>

                {/* Dato 3: Cierre del registro */}
                <article className="rounded-2xl border border-slate-200/90 bg-white p-5 flex flex-col justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#072B52]/8 text-[#072B52] flex items-center justify-center flex-shrink-0">
                        <CalendarClock className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Cierre de finanzas
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      En el registro de las finanzas, el cierre corresponde siempre al último día de cada mes.
                    </p>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <p className="text-xl font-extrabold text-[#072B52]">
                      Último día del mes
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      Corte mensual de registros
                    </p>
                  </div>
                </article>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-600">
                <Info className="w-4 h-4 text-[#083563] flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Esta vista reúne pautas prácticas de funcionamiento mensual aplicables a la Estaca y sus Unidades. Para consultar documentos emitidos por el Área, cambia a las pestañas <strong>Uso Apropiado de los Fondos</strong>, <strong>Cierre Anual</strong> o <strong>Excepción de Dinero</strong>.
                </p>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: USO APROPIADO DE LOS FONDOS */}
          {activeTab === 'FUNDS_USE' && (
            <div data-testid="normativa-panel-FUNDS_USE" className="space-y-4">
              {/* Buscador y filtros */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar concepto, referencia o nota (ej. templo, campamento, alimentos, oficina)..."
                    data-testid="normativas-funds-search"
                    className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-[#083563] focus:ring-2 focus:ring-sky-100 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtros de categoría */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {CATEGORY_FILTERS.map((cat) => {
                    const isActive = categoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        data-testid={`normativas-category-pill-${cat.id}`}
                        onClick={() => setCategoryFilter(cat.id)}
                        className={`pressable px-3 py-1.5 rounded-full text-[11px] font-bold transition border ${
                          isActive
                            ? 'bg-[#072B52] text-white border-[#072B52] shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Contador de resultados */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span data-testid="normativas-funds-count" className="font-semibold">
                    Mostrando <strong className="text-slate-800">{filteredFundsItems.length}</strong> de{' '}
                    <strong className="text-slate-800">{APPROPRIATE_FUNDS_ITEMS.length}</strong> conceptos oficiales
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="font-extrabold text-[#083563] hover:underline"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de conceptos — Estilo editorial limpio con tildes (Opción C) */}
              {filteredFundsItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center space-y-2.5">
                  <p className="text-sm font-extrabold text-slate-700">
                    No encontramos conceptos con ese criterio
                  </p>
                  <p className="text-xs text-slate-500">
                    Prueba con otra palabra clave o vuelve a seleccionar la categoría &ldquo;Todos&rdquo;.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#072B52] text-white text-xs font-extrabold"
                  >
                    Restablecer búsqueda
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/80 border border-slate-200/90 rounded-2xl bg-white overflow-hidden" data-testid="normativas-funds-list">
                  {filteredFundsItems.map((item) => {
                    const allowedEntries = getAllowedEntries(item);
                    const hasSpecialNoNote = item.ofrendas.startsWith('NO (');

                    return (
                      <article
                        key={item.id}
                        data-testid={`normativa-fund-item-${item.id}`}
                        className="p-4 sm:px-5 hover:bg-slate-50/60 transition space-y-2.5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums pt-0.5 w-5 flex-shrink-0 text-right">
                            {item.id}.
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                              {item.concept}
                            </h4>

                            {/* Línea editorial con tildes (sin pastillas de colores) */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                              {allowedEntries.length > 0 ? (
                                allowedEntries.map((entry) => (
                                  <span
                                    key={entry.key}
                                    className={`inline-flex items-center gap-1.5 font-semibold ${
                                      entry.isMember ? 'text-slate-600' : 'text-[#072B52]'
                                    }`}
                                  >
                                    {entry.isMember ? (
                                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5 text-[#083563] stroke-[2.5] flex-shrink-0" />
                                    )}
                                    <span>
                                      {entry.label}
                                      {entry.detail ? (
                                        <span className="font-bold text-slate-500"> · {entry.detail}</span>
                                      ) : null}
                                    </span>
                                  </span>
                                ))
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                                  <Ban className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                                  <span>
                                    {hasSpecialNoNote
                                      ? `No aprobado (${item.ofrendas}) — ver aclaración`
                                      : 'No aprobado con fondos de la Iglesia'}
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* Referencia oficial */}
                            <p className="text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-600">Referencia:</span>{' '}
                              {item.reference}
                            </p>

                            {/* Notas aclaratorias integradas */}
                            {item.notes.length > 0 && (
                              <div className="space-y-1.5 pt-0.5">
                                {item.notes.map((code) => {
                                  const note = FUNDS_NOTES[code];
                                  if (!note) return null;
                                  return (
                                    <div
                                      key={code}
                                      data-testid={`normativa-note-${code}`}
                                      className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs text-slate-700 leading-relaxed flex items-start gap-2"
                                    >
                                      <Info className="w-3.5 h-3.5 text-[#083563] flex-shrink-0 mt-0.5" />
                                      <div className="space-y-1 min-w-0">
                                        <p>
                                          <strong className="text-[#072B52]">Nota ({note.code}):</strong>{' '}
                                          {note.text}
                                        </p>
                                        {note.url && (
                                          <a
                                            href={note.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#083563] hover:underline break-all"
                                          >
                                            <span>Ver límites oficiales de aprobación (ChurchofJesusChrist.org)</span>
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 3: CIERRE ANUAL */}
          {activeTab === 'ANNUAL_CLOSING' && (
            <div data-testid="normativa-panel-ANNUAL_CLOSING" className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {/* 1. Regla del 50% */}
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Cómo funciona la quita al cierre del año (Tope del 50%)</span>
                </div>
                <ul className="space-y-1.5 text-xs text-amber-950/90 list-disc pl-5">
                  <li>
                    Se suman únicamente las <strong>4 asignaciones trimestrales recibidas en el año</strong>{' '}
                    (<span className="font-semibold">T1 + T2 + T3 + T4</span>),{' '}
                    <strong>sin contar</strong> el saldo inicial que venía del año anterior.
                  </li>
                  <li>
                    Se calcula el <strong>50% de esa suma anual</strong>: ese monto es el{' '}
                    <strong>tope máximo permitido</strong> al cierre del <strong>31 de diciembre</strong>.
                  </li>
                  <li>
                    <strong>Si el saldo al 31/12 es menor o igual a ese 50%:</strong> no hay descuento y pasa completo al año siguiente.
                  </li>
                  <li>
                    <strong>Si el saldo al 31/12 supera ese 50%:</strong> se descuenta el excedente y el nuevo año inicia con el tope del 50%.
                  </li>
                </ul>

                {/* Tabla de ejemplo oficial */}
                <div className="overflow-x-auto pt-1">
                  <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden border border-amber-200 text-xs">
                    <thead>
                      <tr className="bg-amber-100/80 text-amber-950 font-extrabold text-[11px]">
                        <th className="py-2 px-3">Caso</th>
                        <th className="py-2 px-3 text-right">4 Ingresos Anuales</th>
                        <th className="py-2 px-3 text-right">Tope 50%</th>
                        <th className="py-2 px-3 text-right">Saldo al 31/12</th>
                        <th className="py-2 px-3 text-right">Quita al cierre</th>
                        <th className="py-2 px-3 text-right">Saldo inicial próximo año</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 tabular-nums">
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Ejemplo 1 (Excede)</td>
                        <td className="py-2 px-3 text-right">$ 1.000,00</td>
                        <td className="py-2 px-3 text-right font-semibold">$ 500,00</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-700">$ 600,00</td>
                        <td className="py-2 px-3 text-right font-extrabold text-rose-700">- $ 100,00</td>
                        <td className="py-2 px-3 text-right font-extrabold text-slate-900">$ 500,00</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-slate-900">Ejemplo 2 (Dentro del tope)</td>
                        <td className="py-2 px-3 text-right">$ 1.000,00</td>
                        <td className="py-2 px-3 text-right font-semibold">$ 500,00</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">$ 400,00</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">Ninguno</td>
                        <td className="py-2 px-3 text-right font-extrabold text-slate-900">$ 400,00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Fechas y Tarjeta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <CalendarClock className="w-4 h-4 text-[#083563] flex-shrink-0" />
                    <span>Cierre administrativo y fechas límite</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                    <li>
                      El cierre administrativo del año es el <strong>31 de diciembre</strong>.
                    </li>
                    <li>
                      Todo gasto que no se registre y transmita antes del 31/12 se contabiliza en el año siguiente, incluso si la fecha del comprobante es anterior.
                    </li>
                    <li>
                      <strong>Del 1 al 5 de enero inclusive</strong> no se pueden registrar gastos en el sistema oficial de finanzas (LCR).
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <CreditCard className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>Tarjeta en $ 0,00 en diciembre (y mensual)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                    <li>
                      Al menos una vez en diciembre, tanto <strong>&ldquo;Saldo Final&rdquo;</strong> como{' '}
                      <strong>&ldquo;Para Ser Aprobado&rdquo;</strong> deben quedar en <strong>$ 0,00</strong>.
                    </li>
                    <li>
                      Dejar de usar la tarjeta unos días, esperar los movimientos bancarios, registrar todos los gastos y esperar <strong>2 días</strong> tras ver todo en cero antes de volver a usarla.
                    </li>
                    <li>
                      Si en enero se detecta saldo distinto de cero, la tarjeta puede quedar <strong>inhabilitada temporalmente</strong>. Se recomienda llevarla a cero al menos una vez al mes.
                    </li>
                  </ul>
                </div>
              </div>

              {/* 3. Uso permitido */}
              <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-950">
                <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold">Recordatorio sobre compras no aprobadas:</span> el presupuesto no debe utilizarse para adquirir elementos no aprobados por la Iglesia (por ejemplo: heladeras, televisores, proyectores u otros dispositivos tecnológicos).
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: EXCEPCIÓN DE DINERO */}
          {activeTab === 'MONEY_EXCEPTION' && (
            <div data-testid="normativa-panel-MONEY_EXCEPTION" className="space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {/* 1. Regla general */}
              <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 border border-sky-200/90 space-y-2">
                <div className="flex items-center gap-2 text-[#072B52] font-extrabold text-sm">
                  <ArrowRightLeft className="w-4 h-4 text-[#083563] flex-shrink-0" />
                  <span>Regla general sobre traspaso de fondos entre unidades</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Desde el año <strong>2010</strong>, <strong>no está permitido transferir dinero entre unidades locales</strong> (de Estaca a Barrio ni de Barrio a Estaca) sin contar previamente con la <strong>aprobación por escrito de la Presidencia de Área</strong> (Manual General, cap. 34).
                </p>
              </div>

              {/* 2. Plazo normal y alternativa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <CalendarClock className="w-4 h-4 text-[#083563] flex-shrink-0" />
                    <span>Plazo habitual y alternativa estándar</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 list-disc pl-4">
                    <li>
                      Una transferencia bancaria oficial ordinaria demora entre <strong>30 y 40 días</strong>.
                    </li>
                    <li>
                      Si un gasto presupuestado no puede esperar, la vía normal es que un miembro realice el pago con fondos propios y luego reciba el <strong>reembolso contra comprobante</strong>, en lugar de mover dinero entre unidades.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-slate-900 text-xs sm:text-sm">
                    <ListChecks className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <span>Cómo tramitar una solicitud de excepción</span>
                  </div>
                  <ol className="space-y-1.5 text-xs text-slate-600 list-decimal pl-4">
                    <li>
                      El <strong>Presidente de Estaca</strong> eleva la solicitud formal a la Presidencia de Área indicando motivo, monto exacto y unidades involucradas.
                    </li>
                    <li>
                      Esperar la <strong>aprobación previa por escrito</strong> de la Presidencia de Área antes de efectuar cualquier operación.
                    </li>
                    <li>
                      Una vez autorizada, registrar y rendir el movimiento según las pautas del Departamento de Finanzas de Unidades Locales.
                    </li>
                  </ol>
                </div>
              </div>

              {/* 3. Restricciones estrictas */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/90 space-y-2">
                <div className="flex items-center gap-2 text-rose-950 font-extrabold text-xs sm:text-sm">
                  <Ban className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Cuándo NO se autorizan excepciones</span>
                </div>
                <ul className="space-y-1.5 text-xs text-rose-950/90 list-disc pl-5">
                  <li>
                    Cuando la unidad tiene la <strong>tarjeta de débito/crédito inhabilitada</strong>.
                  </li>
                  <li>
                    Cuando existen <strong>fondos o gastos pendientes de rendir o aprobar</strong> sin regularizar en el sistema oficial.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Visor PDF integrado dentro de la app */}
      {activeDoc.pdfUrl && activeDoc.downloadFilename && (
        <PdfViewerModal
          isOpen={pdfModalOpen}
          title={activeDoc.title}
          pdfUrl={activeDoc.pdfUrl}
          downloadFilename={activeDoc.downloadFilename}
          onClose={() => setPdfModalOpen(false)}
        />
      )}
    </div>
  );
};
