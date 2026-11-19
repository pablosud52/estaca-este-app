import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Plus, Trash2, Store, MapPin, FileText, Building2 } from 'lucide-react';
import { SupplierBranch, SupplierRecord } from '../types/database';

interface SupplierFormModalProps {
  isOpen: boolean;
  initialSupplier?: SupplierRecord | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (payload: Omit<SupplierRecord, 'id'>, existingId?: number) => Promise<void>;
}

interface BranchDraft {
  name: string;
  address: string;
  phone_mobile: string;
  phone_fixed: string;
  hours: string;
}

const splitList = (value: string): string[] =>
  value
    .split(/[|,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (items?: string[]): string => (items && items.length > 0 ? items.join(' | ') : '');

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  initialSupplier,
  existingCategories,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const categoryListId = useId();

  const [commercialName, setCommercialName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phoneMobile, setPhoneMobile] = useState('');
  const [phoneFixed, setPhoneFixed] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [legalName, setLegalName] = useState('');
  const [rut, setRut] = useState('');
  const [officialInvoice, setOfficialInvoice] = useState(true);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
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
    if (initialSupplier) {
      setCommercialName(initialSupplier.commercial_name || '');
      setCategory(initialSupplier.category || '');
      setDescription(initialSupplier.description || '');
      setPhoneMobile(initialSupplier.phone_mobile || '');
      setPhoneFixed(initialSupplier.phone_fixed || '');
      setAddress(initialSupplier.address || '');
      setHours(initialSupplier.hours || '');
      setWebsite(initialSupplier.website || '');
      setEmail(initialSupplier.email || '');
      setLegalName(initialSupplier.legal_name || '');
      setRut(initialSupplier.rut || '');
      setOfficialInvoice(initialSupplier.official_invoice ?? true);
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
      setCategory('');
      setDescription('');
      setPhoneMobile('');
      setPhoneFixed('');
      setAddress('');
      setHours('');
      setWebsite('');
      setEmail('');
      setLegalName('');
      setRut('');
      setOfficialInvoice(true);
      setBranches([]);
    }
  }, [isOpen, initialSupplier]);

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
    if (!commercialName.trim() || !category.trim()) return;

    setSaving(true);
    try {
      const cleanBranches: SupplierBranch[] = branches
        .filter((b) => b.address.trim().length > 0)
        .map((b) => {
          const mob = splitList(b.phone_mobile);
          const fix = splitList(b.phone_fixed);
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
        description: description.trim() || undefined,
        phone_mobile: mobileVal || undefined,
        phone_fixed: fixedVal || undefined,
        phone: combinedPhone || initialSupplier?.phone || undefined,
        address: address.trim() || undefined,
        hours: hours.trim() || undefined,
        website: website.trim() || undefined,
        email: email.trim() || undefined,
        legal_name: legalName.trim() || undefined,
        rut: rut.trim() || undefined,
        official_invoice: officialInvoice,
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
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
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
        {/* Bloque 1: Datos principales */}
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
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
              <p className="field-error-msg text-[11px] text-red-600 font-semibold mt-1">
                Ingresa el nombre comercial del proveedor.
              </p>
            </div>

            <div>
              <label htmlFor="sup-category" className="block text-xs font-bold text-slate-700 mb-1">
                Rubro / Categoría *
              </label>
              <input
                id="sup-category"
                type="text"
                required
                list={categoryListId}
                placeholder="Ej: Panadería / Catering"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
              <datalist id={categoryListId}>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              <p className="field-error-msg text-[11px] text-red-600 font-semibold mt-1">
                Indica un rubro o categoría.
              </p>
            </div>
          </div>

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
                Celular / WhatsApp
              </label>
              <input
                id="sup-mobile"
                type="tel"
                placeholder="Ej: 099 123 456"
                value={phoneMobile}
                onChange={(e) => setPhoneMobile(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label htmlFor="sup-fixed" className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono fijo
              </label>
              <input
                id="sup-fixed"
                type="tel"
                placeholder="Ej: 2522 1238"
                value={phoneFixed}
                onChange={(e) => setPhoneFixed(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
            </div>

            <div>
              <label htmlFor="sup-address" className="block text-xs font-bold text-slate-700 mb-1">
                Dirección
              </label>
              <input
                id="sup-address"
                type="text"
                placeholder="Ej: Cno. Carrasco 4746, Montevideo"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
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

            <div>
              <label htmlFor="sup-email" className="block text-xs font-bold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="sup-email"
                type="email"
                placeholder="ventas@ejemplo.com.uy"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="validated-field w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
              />
              <p className="field-error-msg text-[11px] text-red-600 font-semibold mt-1">
                Ingresa un correo válido.
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
                  <input
                    type="text"
                    required
                    placeholder="Dirección de la sucursal *"
                    value={branch.address}
                    onChange={(e) => handleUpdateBranch(idx, 'address', e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Celular(es) separados por |"
                    value={branch.phone_mobile}
                    onChange={(e) => handleUpdateBranch(idx, 'phone_mobile', e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Fijo(s) separados por |"
                    value={branch.phone_fixed}
                    onChange={(e) => handleUpdateBranch(idx, 'phone_fixed', e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                  />
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

        {/* Bloque 3: Datos fiscales */}
        <section className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>3. Datos fiscales (Finanzas)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            className="pressable px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 disabled:opacity-50 transition"
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
