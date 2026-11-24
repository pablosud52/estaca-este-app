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

/**
 * Determina si un evento corresponde a una reunión reservada de liderazgo
 * (Sumo Consejo o Presidencia de Estaca), excluyendo el Consejo de Estaca general.
 * Estas reuniones solo deben ser visibles para Presidencia y Administradores.
 */
export function isPrivateStakeMeeting(
  act: Pick<ActivityRecord, 'title'> & { description?: string | null }
): boolean {
  const titleNorm = normalizeFilterText(act.title);
  if (titleNorm.includes('CONSEJO DE ESTACA')) return false;
  const text = normalizeFilterText(`${act.title} ${act.description || ''}`);
  return (
    text.includes('SUMO CONSEJO') ||
    text.includes('HIGH COUNCIL') ||
    text.includes('PRESIDENCIA DE ESTACA') ||
    text.includes('STAKE PRESIDENCY') ||
    text.includes('REUNION DE PRESIDENCIA')
  );
}
