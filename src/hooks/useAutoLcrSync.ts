import { useEffect, useRef } from 'react';
import {
  DB_SHIELD_WINDOW_MS,
  syncLcrCalendarWithShield,
} from '../services/lcrSyncService';
import { ActivityRecord } from '../types/database';

const FOCUS_CHECK_THROTTLE_MS = 30 * 1000;
const AUTO_POLL_INTERVAL_MS = DB_SHIELD_WINDOW_MS;

/**
 * Mantiene el calendario sincronizado automáticamente con LCR mientras la app permanece abierta:
 * - Al volver la pestaña/PWA a primer plano (`visibilitychange` / `focus`), con throttle de 30s.
 * - Periódicamente cada 10 minutos (`DB_SHIELD_WINDOW_MS`).
 * Respeta siempre el escudo compartido de 10 minutos en Supabase y bloquea escrituras en `isSimulating`.
 */
export function useAutoLcrSync(options: {
  activities: ActivityRecord[];
  isSimulating: boolean;
  canPersistToDb?: boolean;
  enabled?: boolean;
  onSynced: (syncedActivities: ActivityRecord[]) => void;
}) {
  const enabled = options.enabled ?? true;
  const activitiesRef = useRef<ActivityRecord[]>(options.activities);
  activitiesRef.current = options.activities;

  const isSimulatingRef = useRef<boolean>(options.isSimulating);
  isSimulatingRef.current = options.isSimulating;

  const canPersistToDbRef = useRef<boolean>(options.canPersistToDb ?? false);
  canPersistToDbRef.current = options.canPersistToDb ?? false;

  const onSyncedRef = useRef(options.onSynced);
  onSyncedRef.current = options.onSynced;

  const inFlightRef = useRef<boolean>(false);
  const lastCheckMsRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const runAutoSync = async (respectThrottle: boolean) => {
      if (!active || inFlightRef.current) return;
      const now = Date.now();
      if (respectThrottle && now - lastCheckMsRef.current < FOCUS_CHECK_THROTTLE_MS) {
        return;
      }

      inFlightRef.current = true;
      lastCheckMsRef.current = now;

      try {
        const result = await syncLcrCalendarWithShield({
          currentActivities: activitiesRef.current,
          attemptLiveFetch: true,
          bypassDbShield: false,
          isSimulating: isSimulatingRef.current,
          canPersistToDb: canPersistToDbRef.current,
        });
        if (active && !result.skippedByDbShield && result.activities.length > 0) {
          onSyncedRef.current(result.activities);
        }
      } catch (err) {
        console.error('Error en sincronización automática con LCR:', err);
      } finally {
        inFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runAutoSync(true);
      }
    };

    const handleWindowFocus = () => {
      void runAutoSync(true);
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runAutoSync(false);
      }
    }, AUTO_POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled]);
}
