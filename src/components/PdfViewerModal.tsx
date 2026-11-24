import React, { useEffect, useState } from 'react';
import { Check, Download, ExternalLink, FileText, Share2, X } from 'lucide-react';

interface PdfViewerModalProps {
  isOpen: boolean;
  title: string;
  pdfUrl: string;
  downloadFilename: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  title,
  pdfUrl,
  downloadFilename,
  onClose,
}) => {
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleShare = async () => {
    const absoluteUrl = `${window.location.origin}${pdfUrl}`;
    try {
      if (navigator.share) {
        // Intentar compartir el archivo PDF directamente en dispositivos compatibles; si no, compartir enlace
        try {
          const res = await fetch(pdfUrl);
          const blob = await res.blob();
          const file = new File([blob], downloadFilename, { type: 'application/pdf' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title,
              files: [file],
            });
            return;
          }
        } catch {
          // Fallback a compartir enlace
        }
        await navigator.share({
          title,
          url: absoluteUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(absoluteUrl);
      setShareFeedback('Enlace copiado');
      setTimeout(() => setShareFeedback(null), 2200);
    } catch {
      // Cancelado por el usuario o sin permiso de portapapeles
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-modal-title"
      data-testid="pdf-viewer-modal"
    >
      <div
        className="bg-white w-full max-w-5xl h-[92dvh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del visor */}
        <div className="px-4 py-3 bg-[#072B52] text-white flex flex-wrap items-center justify-between gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-sky-300 flex-shrink-0" />
            <h3
              id="pdf-viewer-modal-title"
              className="text-xs sm:text-sm font-extrabold truncate"
            >
              {title}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              data-testid="pdf-viewer-share-btn"
              onClick={() => void handleShare()}
              className="pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition"
              title="Compartir documento"
            >
              {shareFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{shareFeedback}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compartir</span>
                </>
              )}
            </button>

            <a
              href={pdfUrl}
              download={downloadFilename}
              data-testid="pdf-viewer-download-btn"
              className="pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition"
              title="Descargar PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar</span>
            </a>

            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="pdf-viewer-external-btn"
              className="pressable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition"
              title="Abrir en una pestaña nueva"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Nueva pestaña</span>
            </a>

            <button
              type="button"
              data-testid="pdf-viewer-close-btn"
              onClick={onClose}
              aria-label="Cerrar visor PDF"
              className="pressable p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visor incrustado del PDF */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
          <iframe
            src={`${pdfUrl}#toolbar=1&view=FitH`}
            title={title}
            data-testid="pdf-viewer-iframe"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
