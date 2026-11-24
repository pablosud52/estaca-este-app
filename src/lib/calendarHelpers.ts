import { ActivityRecord } from '../types/database';

/**
 * Normaliza un título de actividad para comparaciones tolerantes:
 * ignora mayúsculas/minúsculas, tildes/diacríticos y espacios extra.
 */
export function normalizeActivityTitle(title?: string | null): string {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Indica si un evento corresponde a un evento global de la Iglesia (Churchwide).
 * Los eventos globales son estrictamente de solo lectura en la app.
 */
export function isGlobalChurchwideEvent(
  act: Pick<ActivityRecord, 'organization'>
): boolean {
  return act.organization === 'CHURCHWIDE';
}

/**
 * Indica si una actividad ya está vinculada oficialmente a un evento de LCR
 * (excluye propuestas locales, pendientes de LCR y eventos marcados como "No requiere LCR").
 */
export function isLcrLinkedActivity(
  act: Pick<ActivityRecord, 'ical_uid' | 'status'>
): boolean {
  if (act.status === 'PROPUESTA') return false;
  const uid = (act.ical_uid || '').trim();
  if (!uid) return false;
  if (
    uid.startsWith('PROPUESTA_LIDER') ||
    uid.startsWith('PENDIENTE_LCR') ||
    uid.startsWith('NO_LCR_')
  ) {
    return false;
  }
  return true;
}

/**
 * Busca un evento oficial de LCR que coincida automáticamente por fecha exacta
 * y nombre normalizado (ignorando mayúsculas, tildes y espacios extra).
 */
export function findMatchingLcrEvent(
  localAct: Pick<ActivityRecord, 'id' | 'title' | 'event_date'>,
  activities: ActivityRecord[]
): ActivityRecord | null {
  const targetNorm = normalizeActivityTitle(localAct.title);
  if (!targetNorm || !localAct.event_date) return null;

  return (
    activities.find(
      (cand) =>
        cand.id !== localAct.id &&
        cand.status === 'APROBADA' &&
        isLcrLinkedActivity(cand) &&
        cand.event_date === localAct.event_date &&
        normalizeActivityTitle(cand.title) === targetNorm
    ) || null
  );
}

/**
 * Fusiona un evento creado/editado en la app con su equivalente oficial de LCR.
 * - LCR manda en: ical_uid, title, event_date, start_time, end_time, location y description.
 * - La app conserva: id (para no romper gastos/reservas), organization, estimated_cost (preservando
 *   el costo de LCR si el evento local no tenía presupuesto), has_budget y app_notes (combinando
 *   notas de ambos si difieren para nunca perder información).
 */
export function mergeLocalWithLcrActivity(
  localAct: ActivityRecord,
  lcrAct: ActivityRecord
): ActivityRecord {
  const localNotes = (localAct.app_notes || '').trim();
  const lcrNotes = (lcrAct.app_notes || '').trim();
  const localDesc = (localAct.description || '').trim();
  const lcrDesc = (lcrAct.description || '').trim();

  let mergedAppNotes: string | null = null;
  if (localNotes && lcrNotes) {
    mergedAppNotes =
      localNotes.toLowerCase() === lcrNotes.toLowerCase()
        ? localNotes
        : `${lcrNotes} | ${localNotes}`;
  } else {
    mergedAppNotes = localNotes || lcrNotes || null;
  }

  if (!mergedAppNotes && localDesc && localDesc.toLowerCase() !== lcrDesc.toLowerCase()) {
    mergedAppNotes = localDesc;
  }

  const mergedCost =
    Number(localAct.estimated_cost || 0) > 0
      ? Number(localAct.estimated_cost)
      : Number(lcrAct.estimated_cost || 0);

  return {
    ...localAct,
    ical_uid: lcrAct.ical_uid,
    title: lcrAct.title,
    event_date: lcrAct.event_date,
    start_time: lcrAct.start_time ?? localAct.start_time ?? null,
    end_time: lcrAct.end_time ?? localAct.end_time ?? null,
    location: lcrAct.location || localAct.location,
    description: lcrAct.description ?? null,
    app_notes: mergedAppNotes,
    organization: localAct.organization,
    estimated_cost: mergedCost,
    has_budget: mergedCost > 0,
    origin: 'lcr',
    status: 'APROBADA',
  };
}

/**
 * Evalúa si una fecha YYYY-MM-DD cae dentro del rango [dateFrom, dateTo] (ambos opcionales e inclusivos).
 */
export function matchesDateRange(
  eventDate: string,
  dateFrom?: string,
  dateTo?: string
): boolean {
  const from = (dateFrom || '').trim();
  const to = (dateTo || '').trim();
  if (from && eventDate < from) return false;
  if (to && eventDate > to) return false;
  return true;
}

/**
 * Indica si una actividad corresponde a un registro histórico importado de planillas Excel
 * (`ACT-YYYY-...`), válido para cualquier año fiscal (2026, 2027, etc.).
 */
export function isHistoricalImportedActivity(
  act: Pick<ActivityRecord, 'ical_uid'>
): boolean {
  return /^ACT-\d{4}-/i.test((act.ical_uid || '').trim());
}

/**
 * Indica si un `ical_uid` pertenece a un registro histórico/semilla local (`ACT-YYYY-...` o `LCR-YYYY-...`)
 * que no proviene del servidor en vivo de LCR.
 */
export function isSeedOrHistoricalUid(uid?: string | null): boolean {
  return /^(ACT|LCR)-\d{4}-/i.test((uid || '').trim());
}
