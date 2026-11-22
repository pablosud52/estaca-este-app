import { ActivityRecord } from '../types/database';

/**
 * Normaliza un texto a mayúsculas sin tildes para comparar palabras clave de filtros.
 */
function normalizeFilterText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Detecta si una actividad corresponde a Seminario por título o descripción.
 */
export function isSeminarioActivityText(title: string, description?: string | null): boolean {
  const normalized = normalizeFilterText(`${title} ${description || ''}`);
  return normalized.includes('SEMINARIO');
}

/**
 * Detecta si una actividad corresponde a MeetUP (MeetUP, Meet UP, Meet-UP, Meetup).
 */
export function isMeetupActivityText(title: string, description?: string | null): boolean {
  const normalized = normalizeFilterText(`${title} ${description || ''}`);
  return /\bMEET[\s-]*UP\b/.test(normalized);
}

/**
 * Determina si una actividad es compartida entre Hombres Jóvenes (HJ) y Mujeres Jóvenes (MJ),
 * contemplando Seminario, MeetUP y actividades conjuntas explícitas de jóvenes.
 */
export function isSharedYouthActivity(
  act: Pick<ActivityRecord, 'title' | 'organization'> & { description?: string | null }
): boolean {
  if (act.organization === 'SEMINARIO') return true;
  if (isSeminarioActivityText(act.title, act.description)) return true;
  if (isMeetupActivityText(act.title, act.description)) return true;

  if (act.organization === 'HJ' || act.organization === 'MJ') {
    const normalizedTitle = normalizeFilterText(act.title);
    return (
      normalizedTitle.includes('HJ Y MJ') ||
      normalizedTitle.includes('HHJJ Y MMJJ') ||
      normalizedTitle.includes('HOMBRES Y MUJERES JOVENES') ||
      normalizedTitle.includes('CONECTADOS CON PROPOSITO')
    );
  }

  return false;
}
