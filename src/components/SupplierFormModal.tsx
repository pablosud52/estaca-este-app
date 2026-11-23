import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Store, MapPin, Building2, AlertTriangle, Tags } from 'lucide-react';
import { SupplierBranch, SupplierRecord } from '../types/database';
import {
  findSupplierDuplicates,
  normalizeSupplierText,
  splitMultiValue,
  validateFixedPhones,
  validateMobilePhones,
} from '../lib/supplierHelpers';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';

interface SupplierFormModalProps {
  isOpen: boolean;
  initialSupplier?: SupplierRecord | null;
  allSuppliers: SupplierRecord[];
  existingCategories: string[];
  onClose: () => void;
  onSave: (payload: Omit<SupplierRecord, 'id'>, existingId?: number) => Promise<void>;
  onAddCategory?: (name: string) => Promise<void>;
  onOpenManageCategories?: () => void;
}

interface BranchDraft {
  name: string;
  address: string;
  phone_mobile: string;
  phone_fixed: string;
  hours: string;
}

const joinList = (items?: string[]): string => (items && items.length > 0 ? items.join(' | ') : '');
const ADD_NEW_CAT_VALUE = '__ADD_NEW_CATEGORY__';

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  initialSupplier,
  allSuppliers,
  existingCategories,
  onClose,
  onSave,
  onAddCategory,
  onOpenManageCategories,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [commercialName, setCommercialName] = useState('');
  const [category, setCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNote, setNewCategoryNote] = useState<string | null>(null);

  const [legalName, setLegalName] = useState('');
  const [rut, setRut] = useState('');
  const [officialInvoice, setOfficialInvoice] = useState(true);
  const [description, setDescription] = useState('');

  const [phoneMobile, setPhoneMobile] = useState('');
  const [phoneFixed, setPhoneFixed] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [website, setWebsite] = useState('');
  const [branches, setBranches] = useState<BranchDraft[]>([]);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setTouched({});
    setSubmitAttempted(false);
    setIsAddingCategory(false);
    setNewCategoryName('');
    setNewCategoryNote(null);

    if (initialSupplier) {
      setCommercialName(initialSupplier.commercial_name || '');
      setCategory(initialSupplier.category || existingCategories[0] || 'Varios');
      setLegalName(initialSupplier.legal_name || '');
      setRut(initialSupplier.rut || '');
      setOfficialInvoice(initialSupplier.official_invoice ?? true);
      setDescription(initialSupplier.description || '');
      setPhoneMobile(initialSupplier.phone_mobile || '');
      setPhoneFixed(initialSupplier.phone_fixed || '');
      setAddress(initialSupplier.address || '');
      setHours(initialSupplier.hours || '');
      setWebsite(initialSupplier.website || '');
      setBranches(
        (initialSupplier.branches || []).map((b) => ({
          name: b.name || '',
          address: b.address || '',
          phone_mobile: joinList(b.phone_mobile),
          phone_fixed: joinList(b.phone_fixed),
          hours: b.hours || '',
        }))
      );
    } else {
      setCommercialName('');
      setCategory(existingCategories[0] || '');
      setLegalName('');
      setRut('');
      setOfficialInvoice(true);
      setDescription('');
      setPhoneMobile('');
      setPhoneFixed('');
      setAddress('');
      setHours('');
      setWebsite('');
      setBranches([]);
    }
  }, [isOpen, initialSupplier, existingCategories]);

  const markTouched = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));
  const showError = (key: string) => Boolean(touched[key] || submitAttempted);

  const mobileError = showError('phoneMobile') ? validateMobilePhones(phoneMobile) : null;
  const fixedError = showError('phoneFixed') ? validateFixedPhones(phoneFixed) : null;

  const branchPhoneErrors = useMemo(() => {
    const errs: Record<number, { mobile?: string; fixed?: string }> = {};
    branches.forEach((b, idx) => {
      const mErr = showError(`branch-mob-${idx}`) ? validateMobilePhones(b.phone_mobile) : null;
      const fErr = showError(`branch-fix-${idx}`) ? validateFixedPhones(b.phone_fixed) : null;
      if (mErr || fErr) {
        errs[idx] = { mobile: mErr || undefined, fixed: fErr || undefined };
      }
    });
    return errs;
  }, [branches, touched, submitAttempted]);

  const duplicates = useMemo(
    () =>
      findSupplierDuplicates(
        {
          commercialName,
          rut,
          phoneMobile,
          phoneFixed,
          address,
          branches,
        },
        allSuppliers,
        initialSupplier?.id
      ),
    [commercialName, rut, phoneMobile, phoneFixed, address, branches, allSuppliers, initialSupplier?.id]
  );

  const handleConfirmNewCategory = async () => {
    const clean = newCategoryName.trim();
    if (!clean) return;
    const match = existingCategories.find(
      (c) => normalizeSupplierText(c) === normalizeSupplierText(clean)
    );
    if (match) {
      setCategory(match);
      setNewCategoryNote(`Ya existía "${match}", se seleccionó automáticamente.`);
      setIsAddingCategory(false);
      setNewCategoryName('');
      return;
    }
    if (onAddCategory) {
      await onAddCategory(clean);
    }
    setCategory(clean);
    setIsAddingCategory(false);
    setNewCategoryName('');
    setNewCategoryNote(null);
  };

  const handleAddBranch = () => {
    setBranches((prev) => [
      ...prev,
      { name: '', address: '', phone_mobile: '', phone_fixed: '', hours: '' },
    ]);
  };

  const handleUpdateBranch = (idx: number, field: keyof BranchDraft, value: string) => {
    setBranches((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const handleRemoveBranch = (idx: number) => {
    setBranches((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!commercialName.trim() || !category.trim()) return;
    if (validateMobilePhones(phoneMobile) || validateFixedPhones(phoneFixed)) return;
    for (const b of branches) {
      if (validateMobilePhones(b.phone_mobile) || validateFixedPhones(b.phone_fixed)) return;
    }

    setSaving(true);
    try {
      const cleanBranches: SupplierBranch[] = branches
        .filter((b) => b.address.trim().length > 0)
        .map((b) => {
          const mob = splitMultiValue(b.phone_mobile);
          const fix = splitMultiValue(b.phone_fixed);
          return {
            ...(b.name.trim() ? { name: b.name.trim() } : {}),
            address: b.address.trim(),
            ...(mob.length > 0 ? { phone_mobile: mob } : {}),
            ...(fix.length > 0 ? { phone_fixed: fix } : {}),
            ...(b.hours.trim() ? { hours: b.hours.trim() } : {}),
          };
        });

      const mobileVal = phoneMobile.trim();
      const fixedVal = phoneFixed.trim();
      const combinedPhone = [mobileVal, fixedVal].filter(Boolean).join(' | ');

      const payload: Omit<SupplierRecord, 'id'> = {
        commercial_name: commercialName.trim(),
        category: category.trim(),
        legal_name: legalName.trim() || undefined,
        rut: rut.trim() || undefined,
        official_invoice: officialInvoice,
        description: description.trim() || undefined,
        phone_mobile: mobileVal || undefined,
        phone_fixed: fixedVal || undefined,
        phone: combinedPhone || initialSupplier?.phone || undefined,
        address: address.trim() || undefined,
        hours: hours.trim() || undefined,
        website: website.trim() || undefined,
        branches: cleanBranches.length > 0 ? cleanBranches : undefined,
        rating: initialSupplier?.rating ?? 5,
        frequency: initialSupplier?.frequency ?? 1,
        status: 'ACTIVO',
        updated_at: new Date().toISOString().slice(0, 10),
      };

      await onSave(payload, initialSupplier?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isPendingReview = initialSupplier?.status === 'PENDIENTE';
  const modalTitle = isPendingReview
    ? 'Revisar y completar proveedor'
    : initialSupplier
    ? 'Editar proveedor'
    : 'Nuevo proveedor';

  const selectOptions = useMemo(() => {
    const base = [...existingCategories];
    if (category && !base.some((c) => normalizeSupplierText(c) === normalizeSupplierText(category))) {
      base.push(category);
      base.sort((a, b) => a.localeCompare(b, 'es'));
    }
    return base;
  }, [existingCategories, category]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(94vw,620px)] max-h-[90dvh] rounded-3xl bg-white p-0 shadow-2xl border border-slate-200 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#083563] text-white flex items-center justify-center">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm sm:text-base font-extrabold text-slate-900">
              {modalTitle}
            </h2>
            {isPendingReview && (
              <p className="text-[11px] font-semibold text-amber-700">
                Sugerido desde Finanzas — al guardar pasará al directorio activo
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="pressable p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90dvh-132px)] p-5 space-y-5">
        {/* Bloque 1: Datos principales (incluye datos fiscales) */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>1. Datos principales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sup-commercial-name" className="block text-xs font-bold text-slate-700 mb-1">
                Nombre comercial *
              </label>
              <input
                id="sup-commercial-name"
                type="text"
                required
                autoFocus
                placeholder="Ej: Confitería Panino"
                value={commercialName}
                onChange={(e) => setCommercialName(e.target.value)}
                onBlur={() => markTouched('commercialName')}
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
              <p className="field-error-msg text-[11px] text-red-600 font-semibold mt-1">
                Ingresa el nombre comercial del proveedor.
              </p>
              {duplicates.commercialName && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Ya existe un proveedor llamado "{duplicates.commercialName}".</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="sup-category" className="text-xs font-bold text-slate-700">
                  Rubro / Categoría *
                </label>
                {onOpenManageCategories && (
                  <button
                    type="button"
                    onClick={onOpenManageCategories}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    <Tags className="w-3 h-3" />
                    <span>Administrar rubros</span>
                  </button>
                )}
              </div>
              <select
                id="sup-category"
                required
                value={isAddingCategory ? ADD_NEW_CAT_VALUE : category}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewCategoryNote(null);
                  if (val === ADD_NEW_CAT_VALUE) {
                    setIsAddingCategory(true);
                  } else {
                    setIsAddingCategory(false);
                    setCategory(val);
                  }
                }}
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              >
                <option value="" disabled>
                  Seleccionar rubro...
                </option>
                <option value={ADD_NEW_CAT_VALUE}>+ Añadir nuevo rubro...</option>
                {selectOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {isAddingCategory && (
                <div className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nombre del nuevo rubro..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmNewCategory();
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmNewCategory}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    Agregar
                  </button>
                </div>
              )}
              {newCategoryNote && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700">{newCategoryNote}</p>
              )}
            </div>

            <div>
              <label htmlFor="sup-legal-name" className="block text-xs font-bold text-slate-700 mb-1">
                Razón social
              </label>
              <input
                id="sup-legal-name"
                type="text"
                placeholder="Ej: Alvana S.R.L."
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label htmlFor="sup-rut" className="block text-xs font-bold text-slate-700 mb-1">
                RUT
              </label>
              <input
                id="sup-rut"
                type="text"
                inputMode="numeric"
                placeholder="Ej: 214178550011"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white tabular-nums"
              />
              {duplicates.rut && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Este RUT ya figura en: {duplicates.rut}.</span>
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <div>
              <span className="block text-xs font-bold text-slate-800">Emite factura oficial</span>
              <span className="block text-[11px] text-slate-500">
                Indica si entrega comprobante fiscal válido para rendir en LCR
              </span>
            </div>
            <input
              type="checkbox"
              checked={officialInvoice}
              onChange={(e) => setOfficialInvoice(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
          </label>

          <div>
            <label htmlFor="sup-description" className="block text-xs font-bold text-slate-700 mb-1">
              Descripción corta <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              id="sup-description"
              rows={2}
              placeholder="Ej: Servicio de lunch, tortas y confitería para eventos."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 resize-none"
            />
          </div>
        </section>

        {/* Bloque 2: Contacto y ubicación */}
        <section className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span>2. Contacto y ubicación</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sup-mobile" className="block text-xs font-bold text-slate-700 mb-1">
                Celular / WhatsApp <span className="font-normal text-slate-400">(9 dígitos)</span>
              </label>
              <input
                id="sup-mobile"
                type="tel"
                placeholder="Ej: 099 123 456"
                value={phoneMobile}
                onChange={(e) => setPhoneMobile(e.target.value)}
                onBlur={() => markTouched('phoneMobile')}
                aria-invalid={mobileError ? 'true' : 'false'}
                className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm bg-white ${
                  mobileError ? 'border-red-500 bg-red-50/40' : 'border-slate-300'
                }`}
              />
              {mobileError && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{mobileError}</p>
              )}
              {duplicates.phoneMobile && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Este celular ya figura en: {duplicates.phoneMobile}.</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="sup-fixed" className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono fijo <span className="font-normal text-slate-400">(8 dígitos)</span>
              </label>
              <input
                id="sup-fixed"
                type="tel"
                placeholder="Ej: 2522 1238"
                value={phoneFixed}
                onChange={(e) => setPhoneFixed(e.target.value)}
                onBlur={() => markTouched('phoneFixed')}
                aria-invalid={fixedError ? 'true' : 'false'}
                className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm bg-white ${
                  fixedError ? 'border-red-500 bg-red-50/40' : 'border-slate-300'
                }`}
              />
              {fixedError && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{fixedError}</p>
              )}
              {duplicates.phoneFixed && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Este teléfono ya figura en: {duplicates.phoneFixed}.</span>
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sup-address" className="block text-xs font-bold text-slate-700 mb-1">
                Dirección
              </label>
              <AddressAutocompleteInput
                id="sup-address"
                value={address}
                onChange={setAddress}
                placeholder="Escribe calle y número (sugerencias de Uruguay)..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
              {duplicates.address && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Esta dirección ya figura en: {duplicates.address}.</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="sup-hours" className="block text-xs font-bold text-slate-700 mb-1">
                Horario de atención
              </label>
              <input
                id="sup-hours"
                type="text"
                placeholder="Ej: Lun-Vie 09:00-18:00"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label htmlFor="sup-website" className="block text-xs font-bold text-slate-700 mb-1">
                Sitio web
              </label>
              <input
                id="sup-website"
                type="url"
                placeholder="https://ejemplo.com.uy"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
              <p className="field-error-msg text-[11px] text-red-600 font-semibold mt-1">
                Incluye http:// o https:// al comienzo.
              </p>
            </div>
          </div>

          {/* Sucursales */}
          <div className="pt-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Sucursales {branches.length > 0 && `(${branches.length})`}
              </span>
              <button
                type="button"
                onClick={handleAddBranch}
                className="pressable inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold border border-slate-200 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar sucursal</span>
              </button>
            </div>

            {branches.map((branch, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-600 uppercase">
                    Sucursal {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBranch(idx)}
                    className="pressable inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del local (ej: Centro)"
                    value={branch.name}
                    onChange={(e) => handleUpdateBranch(idx, 'name', e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <div>
                    <AddressAutocompleteInput
                      required
                      placeholder="Dirección de la sucursal *"
                      value={branch.address}
                      onChange={(val) => handleUpdateBranch(idx, 'address', val)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                    />
                    {duplicates.branchAddresses[idx] && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-700">
                        Dirección ya registrada en: {duplicates.branchAddresses[idx]}
                      </p>
                    )}
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Celular(es) 9 dígitos (sep. por |)"
                      value={branch.phone_mobile}
                      onChange={(e) => handleUpdateBranch(idx, 'phone_mobile', e.target.value)}
                      onBlur={() => markTouched(`branch-mob-${idx}`)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs bg-white ${
                        branchPhoneErrors[idx]?.mobile
                          ? 'border-red-500 bg-red-50/40'
                          : 'border-slate-300'
                      }`}
                    />
                    {branchPhoneErrors[idx]?.mobile && (
                      <p className="mt-0.5 text-[10px] font-semibold text-red-600">
                        {branchPhoneErrors[idx].mobile}
                      </p>
                    )}
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Fijo(s) 8 dígitos (sep. por |)"
                      value={branch.phone_fixed}
                      onChange={(e) => handleUpdateBranch(idx, 'phone_fixed', e.target.value)}
                      onBlur={() => markTouched(`branch-fix-${idx}`)}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-xs bg-white ${
                        branchPhoneErrors[idx]?.fixed
                          ? 'border-red-500 bg-red-50/40'
                          : 'border-slate-300'
                      }`}
                    />
                    {branchPhoneErrors[idx]?.fixed && (
                      <p className="mt-0.5 text-[10px] font-semibold text-red-600">
                        {branchPhoneErrors[idx].fixed}
                      </p>
                    )}
                  </div>
                  {duplicates.branchPhones[idx] && (
                    <p className="sm:col-span-2 text-[10px] font-semibold text-amber-700">
                      Teléfono ya registrado en: {duplicates.branchPhones[idx]}
                    </p>
                  )}
                  <input
                    type="text"
                    placeholder="Horario de esta sucursal"
                    value={branch.hours}
                    onChange={(e) => handleUpdateBranch(idx, 'hours', e.target.value)}
                    className="sm:col-span-2 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="pressable px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="pressable px-4 py-2 rounded-xl bg-[#083563] text-white text-xs font-extrabold hover:bg-[#072B52] disabled:opacity-50 transition"
          >
            {saving
              ? 'Guardando...'
              : isPendingReview
              ? 'Aprobar y guardar'
              : initialSupplier
              ? 'Guardar cambios'
              : 'Guardar proveedor'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
