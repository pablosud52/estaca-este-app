import type { IcalTime } from 'ical.js';
import { SEED_ACTIVITIES } from '../data/seedData';
import { isMeetupActivityText, isSeminarioActivityText } from '../lib/activityFilters';
import { isSeedOrHistoricalUid, normalizeActivityTitle } from '../lib/calendarHelpers';
import { supabase } from '../lib/supabase';
import { ActivityRecord, OrganizationCode } from '../types/database';

/**
 * URL oficial del feed iCal público de Estaca Montevideo Uruguay Este en LCR
 */
export const OFFICIAL_LCR_ICAL_URL =
  'https://www.churchofjesuschrist.org/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180';

/**
 * Tiempo mínimo entre consultas reales a los servidores de la Iglesia (Escudo de Base de Datos: 10 minutos)
 */
export const DB_SHIELD_WINDOW_MS = 10 * 60 * 1000;

/**
 * Tiempo máximo de espera para la consulta en vivo al feed iCal de LCR (9.5 segundos,
 * alineado por encima del timeout de 7s del puente servidor /api/lcr-calendar)
 */
export const LIVE_FETCH_TIMEOUT_MS = 9500;

export const LOCAL_SYNC_TIMESTAMP_KEY = 'estaca_lcr_last_synced_at_v1';
export const LOCAL_SYNCED_ACTIVITIES_KEY = 'estaca_lcr_synced_activities_v1';
export const LOCAL_LIVE_UIDS_KEY = 'estaca_lcr_live_uids_v1';
export const LOCAL_LAST_SYNC_SOURCE_KEY = 'estaca_lcr_last_sync_source_v1';

/**
 * Respaldo iCal RFC 5545 oficial con los eventos de LCR de la Estaca Montevideo Uruguay Este.
 * Permite verificar el parseo RFC 5545 con `ical.js` y la deduplicación por `UID` incluso si el
 * navegador bloquea peticiones cross-origin (CORS) directas al servidor de churchofjesuschrist.org.
 */
export const FALLBACK_OFFICIAL_ICS_PAYLOAD = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//The Church of Jesus Christ of Latter-day Saints//Church Calendar v3.0//ES',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:Estaca Montevideo Uruguay Este',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1108-PRIM-NICOLICH',
  'DTSTART:20261108T100000',
  'DTEND:20261108T120000',
  'SUMMARY:Presentación Primaria Colonia Nicolich',
  'LOCATION:Capilla Colonia Nicolich',
  'DESCRIPTION:Presentación anual de la Primaria del Barrio Colonia Nicolich.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1115-PRIM-CARRASCO',
  'DTSTART:20261115T100000',
  'DTEND:20261115T120000',
  'SUMMARY:Presentación Primaria Camino Carrasco',
  'LOCATION:Capilla Camino Carrasco',
  'DESCRIPTION:Presentación sacramental de los niños de Primaria.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1121-AS-FINANIO',
  'DTSTART:20261121T200000',
  'DTEND:20261121T233000',
  'SUMMARY:Actividad AS de Fin de Año',
  'LOCATION:Centro de Estaca (Dalmiro Costa 4635)',
  'DESCRIPTION:Cena y baile de cierre de año para Adultos Solteros de la Estaca.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1122-PRIM-AEROPARQUE',
  'DTSTART:20261122T100000',
  'DTEND:20261122T120000',
  'SUMMARY:Presentación Primaria Aeroparque',
  'LOCATION:Capilla Aeroparque',
  'DESCRIPTION:Presentación anual de Primaria en Barrio Aeroparque.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1122-SS-INSTRUCCION',
  'DTSTART:20261122T170000',
  'DTEND:20261122T190000',
  'SUMMARY:Instrucción Cuórum de Élderes y Soc. Soc.',
  'LOCATION:Capilla Carrasco',
  'DESCRIPTION:Capacitación conjunta para presidencias de Cuórum de Élderes y Sociedad de Socorro.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1129-PRIM-TEMPLO',
  'DTSTART:20261129T160000',
  'DTEND:20261129T173000',
  'SUMMARY:Actividad Templo y Sacerdocio Primaria',
  'LOCATION:Capilla Carrasco',
  'DESCRIPTION:Preparación para el convenio bautismal y el servicio en el Templo.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1206-ESTACA-CONSEJO',
  'DTSTART:20261206T083000',
  'DTEND:20261206T110000',
  'SUMMARY:Consejo de Estaca',
  'LOCATION:Centro de Estaca',
  'DESCRIPTION:Reunión de coordinación y planificación del Consejo de Estaca.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:LCR-2026-1212-JOVENES-VOLEY',
  'DTSTART:20261212T150000',
  'DTEND:20261212T193000',
  'SUMMARY:Campeonato de Vóley HHJJ y MMJJ',
  'LOCATION:Capilla Montevideo 9',
  'DESCRIPTION:Torneo deportivo e integración para Hombres Jóvenes y Mujeres Jóvenes de la Estaca.',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

export interface ParsedIcalEvent {
  uid: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  location: string;
  hasExplicitLocation?: boolean;
  description: string | null;
  inferredOrg: OrganizationCode;
}

export interface LcrSyncResult {
  activities: ActivityRecord[];
  lastSyncedAt: string;
  skippedByDbShield: boolean;
  upsertedCount: number;
  source: 'supabase_shield' | 'lcr_live_ical' | 'lcr_fallback_ical';
  persistError?: string | null;
}

const URUGUAY_TIMEZONE = 'America/Montevideo';
const MAX_RRULE_OCCURRENCES = 400;
const MAX_RRULE_ITERATIONS = 5000;

/**
 * Normaliza un valor de hora HH:mm o HH:mm:ss a HH:mm para comparar cambios reales.
 */
function normalizeTimeForDiff(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

/**
 * Convierte un ICAL.Time a fecha YYYY-MM-DD y hora HH:mm en hora local de Uruguay (America/Montevideo).
 * - Para fechas puras (`isDate`, eventos de día completo) conserva el día calendario sin desplazamiento.
 * - Para horarios flotantes sin zona (sin `Z` ni `TZID`) conserva el reloj local tal cual.
 * - Para horarios UTC (`Z`) o con `TZID` explícito convierte el instante real a `America/Montevideo`.
 */
function extractMontevideoDateAndTime(
  icalTime: IcalTime,
  localTimezone: unknown
): {
  date: string;
  time: string | null;
} {
  if (icalTime.isDate) {
    const y = String(icalTime.year).padStart(4, '0');
    const m = String(icalTime.month).padStart(2, '0');
    const d = String(icalTime.day).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, time: null };
  }

  const zone = icalTime.zone;
  const isFloating = !zone || zone === localTimezone || zone.tzid === 'floating';
  if (isFloating) {
    const y = String(icalTime.year).padStart(4, '0');
    const m = String(icalTime.month).padStart(2, '0');
    const d = String(icalTime.day).padStart(2, '0');
    const hh = String(icalTime.hour || 0).padStart(2, '0');
    const mm = String(icalTime.minute || 0).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
  }

  const jsDate = icalTime.toJSDate();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: URUGUAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(jsDate);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  const hour = map.hour === '24' ? '00' : (map.hour || '00').padStart(2, '0');
  const minute = (map.minute || '00').padStart(2, '0');
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${hour}:${minute}`,
  };
}

/**
 * Infiere el código de organización a partir del título o descripción de un evento LCR
 * cuando se trata de un evento nuevo aún no clasificado en Supabase.
 */
export function inferOrganizationFromText(title: string, description?: string | null): OrganizationCode {
  const text = `${title} ${description || ''}`.toUpperCase();
  if (text.includes('CHURCHWIDE EVENTS') || text.includes('CHURCHWIDE')) return 'CHURCHWIDE';
  if (text.includes('PRIMARIA')) return 'PRIMARIA';
  if (isSeminarioActivityText(title, description)) return 'SEMINARIO';
  if (text.includes('MUJERES JÓVENES') || text.includes('MUJERES JOVENES') || text.includes('MMJJ') || text.includes('MM JJ')) {
    if (text.includes('HOMBRES') || text.includes('HHJJ') || text.includes('HH YY') || text.includes('HH Y MM') || text.includes('HJ')) return 'HJ';
    return 'MJ';
  }
  if (text.includes('HOMBRES JÓVENES') || text.includes('HOMBRES JOVENES') || text.includes('HHJJ') || text.includes('HH Y MM') || text.includes('HJ')) {
    return 'HJ';
  }
  if (isMeetupActivityText(title, description)) return 'HJ';
  if (text.includes('SOCIEDAD DE SOCORRO') || text.includes('SOC. SOC.') || text.includes('SOC SOC')) {
    return 'SS';
  }
  if (text.includes('JÓVENES ADULTOS SOLTEROS') || text.includes('JAS')) return 'JAS';
  if (text.includes('ADULTOS SOLTEROS') || text.includes('ACTIVIDAD AS ') || text.includes('REUNIÓN AS')) {
    return 'AS';
  }
  if (text.includes('FAMILYSEARCH') || text.includes('FAMILY SEARCH') || text.includes('HISTORIA FAMILIAR') || text.includes('CFS')) {
    return 'CFS';
  }
  return 'ESTACA';
}

/**
 * Parsea un archivo iCal (.ics) cumpliendo el estándar RFC 5545 mediante la librería `ical.js`.
 * - Convierte fechas/horas UTC o TZID a hora local de Uruguay (`America/Montevideo`).
 * - Expande eventos recurrentes (`RRULE`) en una ventana útil (año anterior a año siguiente),
 *   respetando excepciones (`RECURRENCE-ID`).
 */
export async function parseIcalFeedWithIcalJs(rawIcs: string): Promise<ParsedIcalEvent[]> {
  try {
    const { default: ICAL } = await import('ical.js');
    const localTz = ICAL.Timezone.localTimezone;
    const jCalData = ICAL.parse(rawIcs);
    const vcalendar = new ICAL.Component(jCalData);

    // Registrar definiciones VTIMEZONE presentes en el feed para resolver TZID correctamente
    const vtimezones = vcalendar.getAllSubcomponents('vtimezone');
    for (const tzComp of vtimezones) {
      try {
        const tz = new ICAL.Timezone(tzComp);
        if (tz.tzid) {
          ICAL.TimezoneService.register(tz.tzid, tz);
        }
      } catch {
        // Ignorar VTIMEZONE malformado
      }
    }

    const vevents = vcalendar.getAllSubcomponents('vevent');
    const nowYear = new Date().getFullYear();
    const windowStartDate = `${nowYear - 1}-01-01`;
    const windowEndDate = `${nowYear + 1}-12-31`;

    // Recopilar fechas de excepciones (RECURRENCE-ID) por UID para no duplicar la ocurrencia reemplazada
    const exceptionDatesByUid = new Map<string, Set<string>>();
    for (const veventComp of vevents) {
      const ev = new ICAL.Event(veventComp);
      const uid = String(ev.uid || '').trim();
      if (uid && ev.isRecurrenceException() && ev.recurrenceId) {
        const { date } = extractMontevideoDateAndTime(ev.recurrenceId, localTz);
        const set = exceptionDatesByUid.get(uid) || new Set<string>();
        set.add(date);
        exceptionDatesByUid.set(uid, set);
      }
    }

    const parsed: ParsedIcalEvent[] = [];

    for (const veventComp of vevents) {
      const event = new ICAL.Event(veventComp);
      const baseUid = String(event.uid || '').trim();
      const title = String(event.summary || '').trim();
      if (!baseUid || !title || !event.startDate) continue;

      const rawLocation = event.location ? String(event.location).trim() : '';
      const hasExplicitLocation = rawLocation.length > 0;
      const location = hasExplicitLocation ? rawLocation : 'Centro de Estaca';
      const description = event.description ? String(event.description).trim() : null;
      const inferredOrg = inferOrganizationFromText(title, description);

      if (event.isRecurring() && !event.isRecurrenceException()) {
        const masterStart = extractMontevideoDateAndTime(event.startDate, localTz);
        const excludedDates = exceptionDatesByUid.get(baseUid);
        const iter = event.iterator();
        let next: IcalTime | null;
        let iterations = 0;
        let emittedCount = 0;

        while (
          (next = iter.next()) &&
          iterations < MAX_RRULE_ITERATIONS &&
          emittedCount < MAX_RRULE_OCCURRENCES
        ) {
          iterations += 1;
          const occStart = extractMontevideoDateAndTime(next, localTz);
          if (occStart.date > windowEndDate) break;
          if (occStart.date < windowStartDate) continue;
          if (excludedDates && excludedDates.has(occStart.date)) continue;
          emittedCount += 1;

          let end_time: string | null = null;
          try {
            const details = event.getOccurrenceDetails(next);
            if (details?.endDate && !details.endDate.isDate) {
              end_time = extractMontevideoDateAndTime(details.endDate, localTz).time;
            }
          } catch {
            if (event.endDate && !event.endDate.isDate) {
              end_time = extractMontevideoDateAndTime(event.endDate, localTz).time;
            }
          }

          const occurrenceUid =
            occStart.date === masterStart.date ? baseUid : `${baseUid}__${occStart.date}`;

          parsed.push({
            uid: occurrenceUid,
            title,
            event_date: occStart.date,
            start_time: occStart.time,
            end_time,
            location,
            hasExplicitLocation,
            description,
            inferredOrg,
          });
        }
      } else {
        const start = extractMontevideoDateAndTime(event.startDate, localTz);
        const end_time =
          event.endDate && !event.endDate.isDate
            ? extractMontevideoDateAndTime(event.endDate, localTz).time
            : null;

        let uid = baseUid;
        if (event.isRecurrenceException()) {
          const recDate = event.recurrenceId
            ? extractMontevideoDateAndTime(event.recurrenceId, localTz).date
            : start.date;
          uid = `${baseUid}__${recDate}`;
        }

        parsed.push({
          uid,
          title,
          event_date: start.date,
          start_time: start.time,
          end_time,
          location,
          hasExplicitLocation,
          description,
          inferredOrg,
        });
      }
    }

    return parsed;
  } catch {
    return [];
  }
}

/**
 * Deduplica un listado de actividades por `ical_uid` o por `title + event_date`,
 * asegurando que jamás existan dos eventos idénticos en la lista.
 */
export function ensureUniqueActivities(list: ActivityRecord[]): ActivityRecord[] {
  const seenKeys = new Set<string>();
  const result: ActivityRecord[] = [];

  for (const item of list) {
    const uidKey = item.ical_uid ? `uid:${item.ical_uid}` : null;
    const titleDateKey = `td:${normalizeActivityTitle(item.title)}|${item.event_date}`;
    if ((uidKey && seenKeys.has(uidKey)) || seenKeys.has(titleDateKey)) {
      continue;
    }
    if (uidKey) seenKeys.add(uidKey);
    seenKeys.add(titleDateKey);
    result.push(item);
  }

  return result.sort((a, b) => a.event_date.localeCompare(b.event_date));
}

/**
 * Deduplicación Inmutable (RFC 5545):
 * Combina la lista de actividades existentes con los eventos parseados del feed iCal.
 * - Empareja únicamente por `ical_uid` exacto o por `fecha exacta + título normalizado`
 *   (jamás por título sin fecha, para no secuestrar actividades de otros días).
 * - Actualiza los datos oficiales de LCR preservando intactos `id`, `organization`,
 *   `estimated_cost`, `has_budget`, `app_notes` y promoviendo `PROPUESTA` -> `APROBADA`.
 * - Evita que dos eventos de LCR actualicen la misma fila.
 */
export function deduplicateAndMergeIcalEvents(
  existingActivities: ActivityRecord[],
  parsedEvents: ParsedIcalEvent[]
): { merged: ActivityRecord[]; upsertedCount: number } {
  const byUid = new Map<string, ActivityRecord>();
  const byDateTitleKey = new Map<string, ActivityRecord>();

  existingActivities.forEach((act) => {
    if (act.ical_uid) {
      byUid.set(act.ical_uid, act);
    }
    const normTitle = normalizeActivityTitle(act.title);
    if (normTitle && act.event_date) {
      byDateTitleKey.set(`${act.event_date}|${normTitle}`, act);
    }
  });

  const updatedById = new Map<number, ActivityRecord>();
  const matchedTargetIds = new Set<number>();
  const newlyCreated: ActivityRecord[] = [];
  let upsertedCount = 0;

  parsedEvents.forEach((parsed, idx) => {
    const normTitle = normalizeActivityTitle(parsed.title);
    const dateTitleKey = `${parsed.event_date}|${normTitle}`;
    const existingByUid = byUid.get(parsed.uid);
    const existingByDateTitle = byDateTitleKey.get(dateTitleKey);
    const candidate = existingByUid || existingByDateTitle;
    const target = candidate && !matchedTargetIds.has(candidate.id) ? candidate : undefined;

    if (target) {
      matchedTargetIds.add(target.id);

      const nextStartTime = parsed.start_time || target.start_time || null;
      const nextEndTime = parsed.end_time || target.end_time || null;
      const nextLocation =
        parsed.hasExplicitLocation === false && target.location
          ? target.location
          : parsed.location || target.location;
      const nextStatus = target.status === 'PROPUESTA' ? ('APROBADA' as const) : target.status;

      const hasChanges =
        target.ical_uid !== parsed.uid ||
        target.title !== parsed.title ||
        target.event_date !== parsed.event_date ||
        normalizeTimeForDiff(target.start_time) !== normalizeTimeForDiff(nextStartTime) ||
        normalizeTimeForDiff(target.end_time) !== normalizeTimeForDiff(nextEndTime) ||
        target.location !== nextLocation ||
        (target.description ?? null) !== (parsed.description ?? null) ||
        target.status !== nextStatus;

      if (hasChanges) {
        upsertedCount += 1;
      }

      const wasLocalPending =
        !target.ical_uid ||
        target.ical_uid.startsWith('PROPUESTA_LIDER') ||
        target.ical_uid.startsWith('PENDIENTE_LCR');

      let preservedAppNotes = target.app_notes ?? null;
      if (
        wasLocalPending &&
        !preservedAppNotes &&
        target.description &&
        target.description.trim() !== (parsed.description || '').trim()
      ) {
        preservedAppNotes = target.description.trim();
      }

      const updated: ActivityRecord = {
        ...target,
        ical_uid: parsed.uid,
        title: parsed.title,
        event_date: parsed.event_date,
        start_time: nextStartTime,
        end_time: nextEndTime,
        location: nextLocation,
        description: parsed.description ?? null,
        app_notes: preservedAppNotes,
        organization: target.organization,
        origin: 'lcr',
        status: nextStatus,
      };

      byUid.set(parsed.uid, updated);
      byDateTitleKey.set(dateTitleKey, updated);
      updatedById.set(target.id, updated);
    } else {
      upsertedCount += 1;
      const newRecord: ActivityRecord = {
        id: 9000 + idx,
        ical_uid: parsed.uid,
        title: parsed.title,
        event_date: parsed.event_date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        location: parsed.location,
        description: parsed.description,
        app_notes: null,
        organization: parsed.inferredOrg,
        estimated_cost: 0,
        has_budget: false,
        origin: 'lcr',
        status: 'APROBADA',
      };
      newlyCreated.push(newRecord);
      byUid.set(parsed.uid, newRecord);
      byDateTitleKey.set(dateTitleKey, newRecord);
    }
  });

  const mergedExisting = existingActivities.map((act) => {
    if (updatedById.has(act.id)) {
      return updatedById.get(act.id)!;
    }
    if (act.ical_uid && byUid.has(act.ical_uid)) {
      return byUid.get(act.ical_uid)!;
    }
    return act;
  });

  const merged = ensureUniqueActivities([...mergedExisting, ...newlyCreated]);

  return { merged, upsertedCount };
}

/**
 * Obtiene el último timestamp `last_synced_at` compartido en Supabase (`app_config.key = 'LAST_SYNCED_AT'`)
 * o desde el respaldo local.
 */
export async function getSharedLastSyncedAt(): Promise<string | null> {
  let localTs: string | null = null;
  try {
    localTs = localStorage.getItem(LOCAL_SYNC_TIMESTAMP_KEY);
  } catch {
    // Ignorar errores de almacenamiento
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value, updated_at')
      .eq('key', 'LAST_SYNCED_AT')
      .maybeSingle();

    if (!error && data?.value) {
      const remoteTime = Date.parse(data.value);
      const localTime = localTs ? Date.parse(localTs) : 0;
      if (!Number.isNaN(remoteTime) && remoteTime >= localTime) {
        try {
          localStorage.setItem(LOCAL_SYNC_TIMESTAMP_KEY, data.value);
        } catch {
          // Ignorar
        }
        return data.value;
      }
    }
  } catch {
    // Fallback a localTs
  }

  return localTs;
}

/**
 * Persiste el nuevo timestamp `last_synced_at` en `localStorage` y, si no está en modo simulación,
 * en Supabase (`public.app_config`).
 */
export async function saveSharedLastSyncedAt(
  isoTimestamp: string,
  options?: { isSimulating?: boolean }
): Promise<void> {
  try {
    localStorage.setItem(LOCAL_SYNC_TIMESTAMP_KEY, isoTimestamp);
  } catch {
    // Ignorar
  }

  if (options?.isSimulating) {
    return;
  }

  try {
    const { error } = await supabase.from('app_config').upsert(
      [
        {
          key: 'LAST_SYNCED_AT',
          value: isoTimestamp,
          description: 'Última sincronización global del calendario iCal de LCR',
          updated_at: isoTimestamp,
        },
      ],
      { onConflict: 'key' }
    );
    if (error) {
      console.error('Error guardando LAST_SYNCED_AT en Supabase:', error);
    }
  } catch (err) {
    console.error('Error de red guardando LAST_SYNCED_AT:', err);
  }
}

/**
 * Guarda la lista compartida de UIDs activos de LCR en `app_config.key = 'LCR_LIVE_UIDS'`
 * y en `localStorage`, para que la alerta "Quitadas de LCR" funcione en todos los navegadores.
 */
export async function saveSharedLcrLiveUids(
  uids: string[],
  isoTimestamp: string,
  options?: { isSimulating?: boolean }
): Promise<void> {
  try {
    localStorage.setItem(LOCAL_LIVE_UIDS_KEY, JSON.stringify(uids));
    localStorage.setItem(LOCAL_LAST_SYNC_SOURCE_KEY, 'lcr_live_ical');
  } catch {
    // Ignorar
  }

  if (options?.isSimulating) {
    return;
  }

  try {
    const { error } = await supabase.from('app_config').upsert(
      [
        {
          key: 'LCR_LIVE_UIDS',
          value: JSON.stringify(uids),
          description: 'Últimos UIDs activos recibidos en vivo desde el feed iCal de LCR',
          updated_at: isoTimestamp,
        },
      ],
      { onConflict: 'key' }
    );
    if (error) {
      // No bloquear la sincronización si la migración 11 aún no fue aplicada en Supabase
      console.warn('No se pudo persistir LCR_LIVE_UIDS en app_config:', error.message);
    }
  } catch {
    // Silencioso si no hay conexión
  }
}

/**
 * Hidrata `localStorage` con los UIDs vivos compartidos desde `app_config.key = 'LCR_LIVE_UIDS'`
 * cuando este navegador cae en el escudo de 10 minutos (`supabase_shield`).
 */
export async function hydrateSharedLcrLiveUids(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'LCR_LIVE_UIDS')
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        const uids = parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
        if (uids.length > 0) {
          try {
            localStorage.setItem(LOCAL_LIVE_UIDS_KEY, JSON.stringify(uids));
            localStorage.setItem(LOCAL_LAST_SYNC_SOURCE_KEY, 'lcr_live_ical');
          } catch {
            // Ignorar
          }
          return uids;
        }
      }
    }
  } catch {
    // Ignorar si no existe la clave o no hay red
  }
  return [];
}

/**
 * Lee las actividades reales de Supabase. Solo recurre a `SEED_ACTIVITIES` si no hay conexión
 * o si la tabla aún está vacía (modo simulación/offline).
 */
export async function fetchConsolidatedActivitiesFromSupabase(): Promise<ActivityRecord[]> {
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('event_date', { ascending: true });

    if (!error && data && data.length > 0) {
      const remoteActivities = data.map((a) => ({
        ...a,
        estimated_cost: Number(a.estimated_cost || 0),
        origin:
          a.ical_uid?.startsWith('PROPUESTA_LIDER') ||
          a.ical_uid?.startsWith('PENDIENTE_LCR') ||
          a.status === 'PROPUESTA'
            ? 'propuesta_lider'
            : 'lcr',
      })) as ActivityRecord[];

      return ensureUniqueActivities(remoteActivities);
    }
  } catch {
    // Fallback a SEED_ACTIVITIES solo en modo offline / sin Supabase
  }

  return ensureUniqueActivities([...SEED_ACTIVITIES]);
}

/**
 * Lee actividades previamente sincronizadas desde localStorage como respaldo offline.
 */
function loadCachedSyncedActivities(): ActivityRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SYNCED_ACTIVITIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persiste eventos nuevos o modificados de LCR en la tabla `public.activities` de Supabase.
 * - Empareja solo por `ical_uid` o `event_date + título normalizado` (sin secuestro por título solo).
 * - Evita colisiones múltiples sobre la misma fila (`claimedRowIds`).
 * - Solo ejecuta UPDATE cuando existe una diferencia real (diff check).
 * - Conserva `location`, `start_time`, `end_time`, `organization`, `estimated_cost`, `has_budget` y `app_notes`.
 * - Promueve `PROPUESTA` -> `APROBADA` al vincularse con LCR.
 * - Retorna `{ ok, error }` para que el llamador no avance el escudo si hubo fallo.
 */
async function persistLcrEventsToSupabase(
  parsedEvents: ParsedIcalEvent[]
): Promise<{ ok: boolean; error?: string }> {
  if (parsedEvents.length === 0) return { ok: true };

  try {
    const { data: existingRows, error: selectError } = await supabase
      .from('activities')
      .select(
        'id, ical_uid, title, event_date, start_time, end_time, location, description, app_notes, status'
      );

    if (selectError || !existingRows) {
      const msg = selectError?.message || 'No se pudieron leer actividades existentes en Supabase.';
      console.error('Error leyendo actividades en persistLcrEventsToSupabase:', selectError);
      return { ok: false, error: msg };
    }

    type ExistingRow = {
      id: number;
      ical_uid?: string | null;
      title?: string | null;
      event_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      location?: string | null;
      description?: string | null;
      app_notes?: string | null;
      status?: string | null;
    };

    const byUid = new Map<string, ExistingRow>();
    const byDateTitle = new Map<string, ExistingRow>();

    for (const row of existingRows as ExistingRow[]) {
      if (row.ical_uid) {
        byUid.set(row.ical_uid, row);
      }
      const normTitle = normalizeActivityTitle(row.title);
      if (normTitle && row.event_date) {
        byDateTitle.set(`${row.event_date}|${normTitle}`, row);
      }
    }

    const claimedRowIds = new Set<number>();
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: number; payload: Record<string, unknown> }> = [];

    for (const ev of parsedEvents) {
      const normTitle = normalizeActivityTitle(ev.title);
      const candidate = byUid.get(ev.uid) ?? byDateTitle.get(`${ev.event_date}|${normTitle}`);
      const existing = candidate && !claimedRowIds.has(candidate.id) ? candidate : undefined;

      if (existing !== undefined) {
        claimedRowIds.add(existing.id);

        const wasLocalPending =
          !existing.ical_uid ||
          existing.ical_uid.startsWith('PROPUESTA_LIDER') ||
          existing.ical_uid.startsWith('PENDIENTE_LCR');

        const nextStartTime = ev.start_time ?? normalizeTimeForDiff(existing.start_time) ?? null;
        const nextEndTime = ev.end_time ?? normalizeTimeForDiff(existing.end_time) ?? null;
        const nextLocation =
          ev.hasExplicitLocation === false && existing.location
            ? existing.location
            : ev.location || existing.location || 'Centro de Estaca';
        const nextDescription = ev.description ?? null;
        const nextStatus = existing.status === 'PROPUESTA' ? 'APROBADA' : existing.status;

        let nextAppNotes = existing.app_notes ?? null;
        if (
          wasLocalPending &&
          !nextAppNotes &&
          existing.description &&
          existing.description.trim() !== (ev.description || '').trim()
        ) {
          nextAppNotes = existing.description.trim();
        }

        const hasChanges =
          (existing.ical_uid ?? null) !== ev.uid ||
          (existing.title ?? '') !== ev.title ||
          (existing.event_date ?? '') !== ev.event_date ||
          normalizeTimeForDiff(existing.start_time) !== nextStartTime ||
          normalizeTimeForDiff(existing.end_time) !== nextEndTime ||
          (existing.location ?? '') !== nextLocation ||
          (existing.description ?? null) !== nextDescription ||
          (existing.app_notes ?? null) !== nextAppNotes ||
          (existing.status ?? null) !== nextStatus;

        if (!hasChanges) {
          continue;
        }

        const payload: Record<string, unknown> = {
          ical_uid: ev.uid,
          title: ev.title,
          event_date: ev.event_date,
          start_time: nextStartTime,
          end_time: nextEndTime,
          location: nextLocation,
          description: nextDescription,
        };

        if (nextAppNotes !== (existing.app_notes ?? null)) {
          payload.app_notes = nextAppNotes;
        }
        if (nextStatus && nextStatus !== existing.status) {
          payload.status = nextStatus;
        }

        toUpdate.push({
          id: existing.id,
          payload,
        });
      } else {
        toInsert.push({
          ical_uid: ev.uid,
          title: ev.title,
          event_date: ev.event_date,
          start_time: ev.start_time,
          end_time: ev.end_time,
          location: ev.location,
          description: ev.description,
          organization: ev.inferredOrg,
          estimated_cost: 0,
          has_budget: false,
          status: 'APROBADA',
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('activities')
        .upsert(toInsert, { onConflict: 'ical_uid', ignoreDuplicates: true });
      if (insertError) {
        console.error('Error insertando eventos LCR en Supabase:', insertError);
        return { ok: false, error: insertError.message };
      }
    }

    if (toUpdate.length > 0) {
      const updateResults = await Promise.all(
        toUpdate.map((item) =>
          supabase.from('activities').update(item.payload).eq('id', item.id)
        )
      );
      const firstErr = updateResults.find((r) => r.error)?.error;
      if (firstErr) {
        console.error('Error actualizando eventos LCR en Supabase:', firstErr);
        return { ok: false, error: firstErr.message };
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado persistiendo LCR.';
    console.error('Excepción en persistLcrEventsToSupabase:', err);
    return { ok: false, error: msg };
  }
}

let inFlightBackgroundLcrSync: Promise<LcrSyncResult> | null = null;

/**
 * Sincronización inteligente con Doble Escudo:
 * 1. Revisa `last_synced_at` en Supabase. Si han pasado menos de 10 minutos (y no se fuerza
 *    sincronización manual), no consulta los servidores de la Iglesia y lee de Supabase/caché (`skippedByDbShield = true`).
 * 2. Si pasaron >= 10 minutos (o es sincronización manual), consulta el feed iCal de LCR,
 *    parsea con `ical.js` (RFC 5545), deduplica por `ical_uid` sin duplicar reprogramaciones,
 *    persiste los eventos nuevos/actualizados en Supabase (siempre que NO esté en modo simulación)
 *    y registra el nuevo `last_synced_at` solo si la persistencia fue exitosa.
 * 3. Deduplicación single-flight: si ya existe una sincronización en segundo plano en vuelo,
 *    reutiliza esa promesa en lugar de disparar peticiones duplicadas.
 */
export async function syncLcrCalendarWithShield(options?: {
  currentActivities?: ActivityRecord[];
  attemptLiveFetch?: boolean;
  bypassDbShield?: boolean;
  isSimulating?: boolean;
  canPersistToDb?: boolean;
}): Promise<LcrSyncResult> {
  if (!options?.bypassDbShield && inFlightBackgroundLcrSync) {
    return inFlightBackgroundLcrSync;
  }

  const runSync = async (): Promise<LcrSyncResult> => {
  const nowMs = Date.now();
  const isSimulating = Boolean(options?.isSimulating);
  const canPersistToDb = options?.canPersistToDb ?? false;
  const lastSyncedAt = await getSharedLastSyncedAt();
  const baseActivities =
    options?.currentActivities && options.currentActivities.length > 0
      ? options.currentActivities
      : await fetchConsolidatedActivitiesFromSupabase();
  const shouldAttemptLiveFetch = options?.attemptLiveFetch ?? true;

  // 1. Escudo de Base de Datos (Compartido: 10 minutos, omitido solo en pulsación manual)
  if (lastSyncedAt && !options?.bypassDbShield) {
    const elapsedMs = nowMs - Date.parse(lastSyncedAt);
    if (!Number.isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < DB_SHIELD_WINDOW_MS) {
      // Hidratar UIDs vivos compartidos desde Supabase para que "Quitadas de LCR" funcione en cualquier navegador
      await hydrateSharedLcrLiveUids();
      // Si ya tenemos actividades reales (Supabase o estado actual), NO inyectar respaldo hardcoded
      const shieldActivities =
        baseActivities.length > 0
          ? ensureUniqueActivities(baseActivities)
          : ensureUniqueActivities(loadCachedSyncedActivities());
      return {
        activities: shieldActivities,
        lastSyncedAt,
        skippedByDbShield: true,
        upsertedCount: 0,
        source: 'supabase_shield',
        persistError: null,
      };
    }
  }

  // 2. Consultar el feed iCal público de la Iglesia (primero vía puente /api/lcr-calendar sin CORS, luego directo)
  let rawIcs = FALLBACK_OFFICIAL_ICS_PAYLOAD;
  let source: 'lcr_live_ical' | 'lcr_fallback_ical' = 'lcr_fallback_ical';

  if (shouldAttemptLiveFetch) {
    const fetchEndpoints = ['/api/lcr-calendar', OFFICIAL_LCR_ICAL_URL];
    for (const endpoint of fetchEndpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LIVE_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
        });
        if (response.ok) {
          const text = await response.text();
          if (text.includes('BEGIN:VCALENDAR')) {
            rawIcs = text;
            source = 'lcr_live_ical';
            break;
          }
        }
      } catch {
        // Intentar siguiente endpoint o caer en respaldo
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  // 3. Parsear RFC 5545 con ical.js y deduplicar por UID único
  // Si falló la lectura en vivo y ya tenemos eventos reales de LCR en Supabase, NO inyectar el respaldo hardcoded
  const hasRealLcrInBase = baseActivities.some((a) => (a.ical_uid || '').includes('@'));
  const parsedEvents =
    source === 'lcr_live_ical' || !hasRealLcrInBase
      ? await parseIcalFeedWithIcalJs(rawIcs)
      : [];
  const { merged, upsertedCount } =
    parsedEvents.length > 0
      ? deduplicateAndMergeIcalEvents(baseActivities, parsedEvents)
      : { merged: ensureUniqueActivities(baseActivities), upsertedCount: 0 };

  // 4. Persistir eventos nuevos y reprogramaciones en Supabase (`public.activities`) y actualizar timestamp
  //    Nunca escribir en Supabase producción si estamos en modo simulación (`isSimulating`).
  const newIsoTimestamp = new Date(nowMs).toISOString();
  let finalActivities = merged;
  let persistError: string | null = null;
  let effectiveLastSyncedAt = lastSyncedAt || newIsoTimestamp;

  if (source === 'lcr_live_ical') {
    const liveUids = parsedEvents.map((e) => e.uid);
    if (isSimulating || !canPersistToDb) {
      // En modo simulación o para roles de solo lectura (LIDER/CONSULTA), actualizar solo caché local
      // sin escribir en Supabase producción ni avanzar el escudo global de BD.
      await saveSharedLastSyncedAt(newIsoTimestamp, { isSimulating: true });
      await saveSharedLcrLiveUids(liveUids, newIsoTimestamp, { isSimulating: true });
      effectiveLastSyncedAt = newIsoTimestamp;
    } else {
      const persistResult = await persistLcrEventsToSupabase(parsedEvents);
      if (persistResult.ok) {
        await saveSharedLastSyncedAt(newIsoTimestamp, { isSimulating: false });
        await saveSharedLcrLiveUids(liveUids, newIsoTimestamp, { isSimulating: false });
        effectiveLastSyncedAt = newIsoTimestamp;
        // Recargar IDs reales de Supabase para evitar IDs sintéticos (9000+idx) al editar inmediatamente
        try {
          const refreshedFromDb = await fetchConsolidatedActivitiesFromSupabase();
          if (refreshedFromDb.length > 0) {
            const { merged: refreshedMerged } = deduplicateAndMergeIcalEvents(
              refreshedFromDb,
              parsedEvents
            );
            finalActivities = refreshedMerged;
          }
        } catch {
          // Conservar merged en memoria si falla la recarga
        }
      } else {
        persistError = persistResult.error || 'Error guardando cambios de LCR en Supabase.';
      }
    }
  }

  try {
    localStorage.setItem(LOCAL_SYNCED_ACTIVITIES_KEY, JSON.stringify(finalActivities));
    localStorage.setItem(LOCAL_LAST_SYNC_SOURCE_KEY, source);
    if (source === 'lcr_live_ical') {
      localStorage.setItem(
        LOCAL_LIVE_UIDS_KEY,
        JSON.stringify(parsedEvents.map((e) => e.uid))
      );
    }
  } catch {
    // Ignorar
  }

  return {
    activities: finalActivities,
    lastSyncedAt: effectiveLastSyncedAt,
    skippedByDbShield: false,
    upsertedCount,
    source,
    persistError,
  };
  };

  if (options?.bypassDbShield) {
    return runSync();
  }

  const promise = runSync().finally(() => {
    if (inFlightBackgroundLcrSync === promise) {
      inFlightBackgroundLcrSync = null;
    }
  });
  inFlightBackgroundLcrSync = promise;
  return promise;
}

/**
 * Indica si una actividad ya aprobada en la plataforma aún no está vinculada a LCR
 * (y no fue marcada como "No requiere LCR"). Nunca marca propuestas sin aprobar.
 */
export function isActivityPendingLcr(act: ActivityRecord): boolean {
  if (act.status !== 'APROBADA') return false;
  const uid = (act.ical_uid || '').trim();
  if (uid.startsWith('NO_LCR_')) return false;
  if (uid.startsWith('PROPUESTA_LIDER') || uid.startsWith('PENDIENTE_LCR')) return true;
  if (!uid && act.origin === 'propuesta_lider') return true;
  return false;
}

/**
 * Indica si una actividad fue marcada explícitamente como "No requiere LCR".
 */
export function isActivityNoLcr(act: ActivityRecord): boolean {
  return (act.ical_uid || '').trim().startsWith('NO_LCR_');
}

/**
 * Devuelve el estado resumido de la última sincronización con LCR y los UIDs vivos conocidos.
 */
export function getLocalLcrSyncMeta(): {
  lastSyncedAt: string | null;
  lastSource: string | null;
  liveUids: string[];
} {
  try {
    const lastSyncedAt = localStorage.getItem(LOCAL_SYNC_TIMESTAMP_KEY);
    const lastSource = localStorage.getItem(LOCAL_LAST_SYNC_SOURCE_KEY);
    const rawUids = localStorage.getItem(LOCAL_LIVE_UIDS_KEY);
    const liveUids = rawUids ? (JSON.parse(rawUids) as string[]) : [];
    return {
      lastSyncedAt,
      lastSource,
      liveUids: Array.isArray(liveUids) ? liveUids : [],
    };
  } catch {
    return { lastSyncedAt: null, lastSource: null, liveUids: [] };
  }
}

/**
 * Indica si un evento vinculado a LCR dejó de aparecer en la última lectura en vivo de LCR.
 */
export function isActivityMissingFromLcr(
  act: ActivityRecord,
  liveUids: string[],
  lastSource: string | null
): boolean {
  if (lastSource !== 'lcr_live_ical' || liveUids.length === 0) return false;
  if (act.status !== 'APROBADA') return false;
  const uid = (act.ical_uid || '').trim();
  if (
    !uid ||
    uid.startsWith('PROPUESTA_LIDER') ||
    uid.startsWith('PENDIENTE_LCR') ||
    uid.startsWith('NO_LCR_') ||
    isSeedOrHistoricalUid(uid)
  ) {
    return false;
  }
  return !liveUids.includes(uid);
}
