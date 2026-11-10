import React, { useEffect, useState } from 'react';
import { Check, Clock, Loader2, RefreshCw } from 'lucide-react';

export const LCR_BUTTON_STORAGE_KEY = 'estaca_lcr_sync_btn_state_v1';

/**
 * Tiempos oficiales del Escudo de Botón Manual:
 * - Primeras 3 pulsaciones consecutivas: 30 segundos
 * - A partir de la 4ª pulsación consecutiva: 10 minutos (600 segundos)
 * - Reinicio de ciclo tras inactividad: 1 hora (3.600 segundos)
 */
export const COOLDOWN_SHORT_SEC = 30;
export const COOLDOWN_LONG_SEC = 600;
export const INACTIVITY_RESET_MS = 60 * 60 * 1000;

interface PersistedButtonState {
  clickCount: number;
  lastClickTimestamp: number;
  cooldownUntil: number;
}

const loadButtonState = (): PersistedButtonState => {
  try {
    const raw = localStorage.getItem(LCR_BUTTON_STORAGE_KEY);
    if (!raw) {
      return { clickCount: 0, lastClickTimestamp: 0, cooldownUntil: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedButtonState>;
    const now = Date.now();
    const lastClick = Number(parsed.lastClickTimestamp || 0);

    // Si pasó 1 hora o más desde la última pulsación, se reinicia al ciclo de 30 segundos
    if (lastClick > 0 && now - lastClick >= INACTIVITY_RESET_MS) {
      return { clickCount: 0, lastClickTimestamp: 0, cooldownUntil: 0 };
    }

    return {
      clickCount: Number(parsed.clickCount || 0),
      lastClickTimestamp: lastClick,
      cooldownUntil: Number(parsed.cooldownUntil || 0),
    };
  } catch {
    return { clickCount: 0, lastClickTimestamp: 0, cooldownUntil: 0 };
  }
};

const saveButtonState = (state: PersistedButtonState) => {
  try {
    localStorage.setItem(LCR_BUTTON_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignorar errores de almacenamiento
  }
};

export function formatRemainingCooldown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

interface LcrSyncButtonProps {
  onSync: () => Promise<void>;
  className?: string;
}

export const LcrSyncButton: React.FC<LcrSyncButtonProps> = ({ onSync, className = '' }) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const st = loadButtonState();
    const diff = Math.ceil((st.cooldownUntil - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });
  const [consecutiveClicks, setConsecutiveClicks] = useState<number>(() => {
    return loadButtonState().clickCount;
  });

  // Reloj de cuenta regresiva cada 1 segundo mientras esté en cooldown
  useEffect(() => {
    const updateTimer = () => {
      const st = loadButtonState();
      const now = Date.now();
      const diff = Math.ceil((st.cooldownUntil - now) / 1000);
      if (diff > 0) {
        setRemainingSeconds(diff);
        setConsecutiveClicks(st.clickCount);
      } else {
        setRemainingSeconds(0);
      }
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 500);
    return () => clearInterval(intervalId);
  }, []);

  const handleManualClick = async () => {
    if (isSyncing || remainingSeconds > 0) return;

    setIsSyncing(true);
    try {
      // Pequeña pausa visual mínima para que el usuario perciba el estado "Sincronizando..."
      await Promise.all([
        onSync(),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
    } finally {
      const prev = loadButtonState();
      const now = Date.now();
      const shouldResetCycle =
        prev.lastClickTimestamp > 0 && now - prev.lastClickTimestamp >= INACTIVITY_RESET_MS;
      const nextCount = shouldResetCycle ? 1 : prev.clickCount + 1;

      // Primeras 3 pulsaciones: 30s | A partir de la 4ª pulsación consecutiva: 10 minutos (600s)
      const cooldownDurationSec = nextCount >= 4 ? COOLDOWN_LONG_SEC : COOLDOWN_SHORT_SEC;
      const cooldownUntil = now + cooldownDurationSec * 1000;

      const newState: PersistedButtonState = {
        clickCount: nextCount,
        lastClickTimestamp: now,
        cooldownUntil,
      };
      saveButtonState(newState);
      setConsecutiveClicks(nextCount);
      setRemainingSeconds(cooldownDurationSec);
      setIsSyncing(false);
    }
  };

  const isInCooldown = !isSyncing && remainingSeconds > 0;

  return (
    <div className={`flex flex-col items-start sm:items-end ${className}`}>
      <button
        type="button"
        data-testid="lcr-sync-button"
        data-sync-state={isSyncing ? 'SYNCING' : isInCooldown ? 'COOLDOWN' : 'IDLE'}
        data-click-count={consecutiveClicks}
        disabled={isSyncing || isInCooldown}
        onClick={handleManualClick}
        className={`pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition shadow-sm ${
          isSyncing
            ? 'bg-slate-800 text-white cursor-wait opacity-90'
            : isInCooldown
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-not-allowed'
            : 'bg-emerald-800 hover:bg-emerald-900 text-white'
        }`}
      >
        {isSyncing ? (
          <>
            <Loader2
              data-testid="lcr-sync-spinner"
              className="w-4 h-4 animate-spin text-emerald-300"
            />
            <span>Sincronizando...</span>
          </>
        ) : isInCooldown ? (
          <>
            <Check className="w-4 h-4 text-emerald-700" />
            <span>✓ Calendario al día</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 text-emerald-200" />
            <span>🔄 Sincronizar</span>
          </>
        )}
      </button>

      {isInCooldown && (
        <p
          data-testid="lcr-sync-cooldown-hint"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 tabular-nums"
        >
          <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span>
            ⏱️ Próxima sincronización manual disponible en{' '}
            <strong
              data-testid="lcr-sync-countdown-value"
              className="font-extrabold text-slate-700"
            >
              {formatRemainingCooldown(remainingSeconds)}
            </strong>
          </span>
        </p>
      )}
    </div>
  );
};
