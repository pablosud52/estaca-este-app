import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'estaca_pwa_install_dismissed';

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const matchMediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(matchMediaStandalone || iosStandalone);
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

/**
 * Aviso discreto para instalar la app en el celular.
 * Nunca se muestra cuando la app ya está abierta en modo instalado (standalone)
 * ni después de que el usuario lo cierra manualmente.
 */
export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandaloneMode()) {
      setDismissed(true);
      return;
    }

    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch {
      // Si localStorage no está disponible, continuamos sin bloquear
    }

    setDismissed(false);

    if (isIosSafari()) {
      setShowIosHint(true);
      return;
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignorar si está bloqueado
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDismissed(true);
    }
    setDeferredPrompt(null);
  };

  if (dismissed || isStandaloneMode()) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div
      className="fixed bottom-3 inset-x-3 z-40 mx-auto max-w-md pb-[env(safe-area-inset-bottom)]"
      role="region"
      aria-label="Instalar aplicación"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] px-3.5 py-2.5 text-white shadow-xl">
        <img
          src="/pwa-192x192.png"
          alt="Estaca Este"
          className="h-10 w-10 shrink-0 rounded-xl border border-white/15"
        />

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight text-white">
            Instalar Estaca Este
          </p>
          {showIosHint ? (
            <p className="mt-0.5 text-[11px] leading-snug text-sky-100/85">
              Tocá <Share className="inline h-3 w-3 align-text-bottom text-sky-300" /> y elegí{' '}
              <span className="font-semibold text-white">«Agregar a inicio»</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug text-sky-100/85">
              Agregala a tu pantalla de inicio para entrar más rápido.
            </p>
          )}
        </div>

        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#072B52] transition hover:bg-sky-50 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso de instalación"
          className="shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
