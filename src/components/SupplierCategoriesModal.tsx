import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Tags } from 'lucide-react';
import { SupplierRecord } from '../types/database';
import { normalizeSupplierText } from '../lib/supplierHelpers';

interface SupplierCategoriesModalProps {
  isOpen: boolean;
  categories: string[];
  suppliers: SupplierRecord[];
  onClose: () => void;
  onAddCategory: (name: string) => Promise<void>;
  onRenameCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (name: string, moveToCategory: string) => Promise<void>;
}

export const SupplierCategoriesModal: React.FC<SupplierCategoriesModalProps> = ({
  isOpen,
  categories,
  suppliers,
  onClose,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('Varios');
  const [busy, setBusy] = useState(false);

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
    if (!isOpen) {
      setNewName('');
      setAddError(null);
      setEditingCat(null);
      setDeletingCat(null);
    }
  }, [isOpen]);

  const countByCategory = (cat: string) =>
    suppliers.filter((s) => normalizeSupplierText(s.category || 'Varios') === normalizeSupplierText(cat)).length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;
    const duplicate = categories.find((c) => normalizeSupplierText(c) === normalizeSupplierText(clean));
    if (duplicate) {
      setAddError(`Ya existe el rubro "${duplicate}".`);
      return;
    }
    setBusy(true);
    try {
      await onAddCategory(clean);
      setNewName('');
      setAddError(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRename = async (oldName: string) => {
    const clean = editingValue.trim();
    if (!clean || clean === oldName) {
      setEditingCat(null);
      return;
    }
    setBusy(true);
    try {
      await onRenameCategory(oldName, clean);
      setEditingCat(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = async (cat: string) => {
    const count = countByCategory(cat);
    if (count === 0) {
      setBusy(true);
      try {
        await onDeleteCategory(cat, 'Varios');
      } finally {
        setBusy(false);
      }
      return;
    }
    const fallbackTarget = categories.find((c) => c !== cat) || 'Varios';
    setMoveTarget(fallbackTarget);
    setDeletingCat(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCat) return;
    setBusy(true);
    try {
      await onDeleteCategory(deletingCat, moveTarget);
      setDeletingCat(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(94vw,520px)] max-h-[85dvh] rounded-3xl bg-white p-0 shadow-2xl border border-slate-200 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm sm:text-base font-extrabold text-slate-900">
              Administrar rubros
            </h2>
            <p className="text-[11px] text-slate-500">
              Renombra, fusiona o elimina rubros sin perder proveedores
            </p>
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

      <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85dvh-80px)]">
        {/* Añadir nuevo rubro */}
        <form onSubmit={handleAdd} className="space-y-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Escribir nuevo rubro..."
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError(null);
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="pressable inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar</span>
            </button>
          </div>
          {addError && <p className="text-[11px] font-semibold text-amber-700">{addError}</p>}
        </form>

        {/* Lista de rubros */}
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {categories.map((cat) => {
            const count = countByCategory(cat);
            const isEditing = editingCat === cat;
            const isDeleting = deletingCat === cat;

            return (
              <li key={cat} className="p-3 bg-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveRename(cat);
                          }
                          if (e.key === 'Escape') setEditingCat(null);
                        }}
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveRename(cat)}
                        className="pressable p-1.5 rounded-lg bg-emerald-600 text-white"
                        title="Guardar nombre"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        className="pressable p-1.5 rounded-lg bg-slate-100 text-slate-600"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900">{cat}</span>
                        <span className="ml-2 text-[11px] text-slate-400 font-semibold tabular-nums">
                          ({count} {count === 1 ? 'proveedor' : 'proveedores'})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingCat(cat);
                            setEditingValue(cat);
                            setDeletingCat(null);
                          }}
                          title="Renombrar o fusionar rubro"
                          className="pressable p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteClick(cat)}
                          title="Eliminar rubro"
                          className="pressable p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200/80"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isDeleting && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-[11px] font-semibold text-amber-900">
                      Este rubro tiene {count} {count === 1 ? 'proveedor' : 'proveedores'}. Elige a
                      cuál moverlos antes de eliminarlo:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-amber-300 text-xs bg-white"
                      >
                        {categories
                          .filter((c) => c !== cat)
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        {!categories.some((c) => c !== cat && c === 'Varios') && (
                          <option value="Varios">Varios</option>
                        )}
                      </select>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleConfirmDelete}
                          className="pressable px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-extrabold"
                        >
                          Mover y eliminar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCat(null)}
                          className="pressable px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
};
