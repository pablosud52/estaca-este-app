import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Copy,
  Check,
  X,
  ExternalLink,
  MapPin,
  Building2,
} from 'lucide-react';
import { SupplierRecord } from '../types/database';

interface SupplierContactModalProps {
  supplier: SupplierRecord | null;
  onClose: () => void;
  onToast: (message: string) => void;
}

interface PhoneItem {
  type: 'FIXED' | 'MOBILE';
  display: string;
  raw: string;
}

export const SupplierContactModal: React.FC<SupplierContactModalProps> = ({
  supplier,
  onClose,
  onToast,
}) => {
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  if (!supplier) return null;

  // Extraer teléfonos
  const items: PhoneItem[] = [];

  if (supplier.phone_mobile) {
    supplier.phone_mobile.split('|').forEach((p) => {
      const clean = p.trim();
      const raw = clean.replace(/\D/g, '');
      if (raw) {
        items.push({
          type: 'MOBILE',
          display: clean,
          raw,
        });
      }
    });
  }

  if (supplier.phone_fixed) {
    supplier.phone_fixed.split('|').forEach((p) => {
      const clean = p.trim();
      const raw = clean.replace(/\D/g, '');
      if (raw) {
        items.push({
          type: 'FIXED',
          display: clean,
          raw,
        });
      }
    });
  }

  const handleCopy = async (rawNumber: string, display: string) => {
    try {
      await navigator.clipboard.writeText(rawNumber);
      setCopiedNumber(rawNumber);
      onToast(`Copiado: ${rawNumber}`);
      setTimeout(() => setCopiedNumber(null), 2500);
    } catch {
      onToast(`Número: ${display}`);
    }
  };

  const getWhatsAppLink = (raw: string) => {
    // Si empieza con 09X, convertir a 5989X...
    let clean = raw;
    if (clean.startsWith('09')) {
      clean = '598' + clean.slice(1);
    } else if (!clean.startsWith('598') && clean.startsWith('9')) {
      clean = '598' + clean;
    }
    return `https://wa.me/${clean}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-slide-up sm:animate-scale-up max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de arrastre móvil */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Cabecera */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 mb-1.5">
              {supplier.category}
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
              {supplier.commercial_name}
            </h3>
            {supplier.legal_name && (
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate mt-0.5">
                {supplier.legal_name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="pressable p-2 -mr-1 -mt-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Lista de teléfonos */}
        <div className="p-5 overflow-y-auto space-y-3 overscroll-contain">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Vías de Contacto Telefónico
          </p>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No hay teléfonos registrados para este proveedor.
            </p>
          ) : (
            items.map((item, idx) => {
              const isCopied = copiedNumber === item.raw;
              const isMobile = item.type === 'MOBILE';

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMobile ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                      />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        {isMobile ? 'Celular / WhatsApp' : 'Línea Fija'}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums font-mono">
                      {item.display}
                    </span>
                  </div>

                  {/* Fila de acciones para este número */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                    {/* Botón Llamar */}
                    <a
                      href={`tel:${item.raw}`}
                      className="pressable flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800 transition touch-manipulation active:scale-[0.98]"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Llamar</span>
                    </a>

                    {/* Botón WhatsApp o Copiar */}
                    {isMobile ? (
                      <a
                        href={getWhatsAppLink(item.raw)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pressable flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition touch-manipulation active:scale-[0.98]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleCopy(item.raw, item.display)}
                        className="pressable flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-800 text-xs font-bold transition touch-manipulation active:scale-[0.98]"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-extrabold">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Si es móvil, botón secundario para copiar */}
                  {isMobile && (
                    <button
                      onClick={() => handleCopy(item.raw, item.display)}
                      className="pressable w-full py-1.5 text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1 touch-manipulation"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-extrabold">
                            Número copiado sin espacios
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copiar número sin espacios</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* Sitio web si lo tiene */}
          {supplier.website && (
            <div className="pt-2">
              <a
                href={supplier.website}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200/80 text-xs font-extrabold transition touch-manipulation active:scale-[0.98]"
              >
                <ExternalLink className="w-4 h-4 text-sky-600" />
                <span>Visitar Sitio Web Oficial</span>
              </a>
            </div>
          )}

          {/* Dirección física si la tiene */}
          {supplier.address && (
            <div className="pt-2 text-xs text-slate-500 flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{supplier.address}</span>
            </div>
          )}
        </div>

        {/* Pie con botón cerrar */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="pressable w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-black transition touch-manipulation active:scale-[0.98]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
