import ICAL from 'ical.js';
import { SEED_ACTIVITIES } from '../data/seedData';
import { isMeetupActivityText, isSeminarioActivityText } from '../lib/activityFilters';
import { normalizeActivityTitle } from '../lib/calendarHelpers';
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
 * Tiempo máximo de espera para la consulta en vivo al feed iCal de LCR (8 segundos)
 */
export const LIVE_FETCH_TIMEOUT_MS = 8000;

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
  description: string | null;
  inferredOrg: OrganizationCode;
}

export interface LcrSyncResult {
  activities: ActivityRecord[];
  lastSyncedAt: string;
  skippedByDbShield: boolean;
  upsertedCount: number;
  source: 'supabase_shield' | 'lcr_live_ical' | 'lcr_fallback_ical';
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
 */
export function parseIcalFeedWithIcalJs(rawIcs: string): ParsedIcalEvent[] {
  try {
    const jCalData = ICAL.parse(rawIcs);
    const vcalendar = new ICAL.Component(jCalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    return vevents
      .map((veventComp) => {
        const event = new ICAL.Event(veventComp);
        const uid = String(event.uid || '').trim();
        const title = String(event.summary || '').trim();
        if (!uid || !title || !event.startDate) return null;

        const y = String(event.startDate.year).padStart(4, '0');
        const m = String(event.startDate.month).padStart(2, '0');
        const d = String(event.startDate.day).padStart(2, '0');
        const event_date = `${y}-${m}-${d}`;

        let start_time: string | null = null;
        if (!event.startDate.isDate) {
          const hh = String(event.startDate.hour || 0).padStart(2, '0');
          const mm = String(event.startDate.minute || 0).padStart(2, '0');
          start_time = `${hh}:${mm}`;
        }

        let end_time: string | null = null;
        if (event.endDate && !event.endDate.isDate) {
          const hh = String(event.endDate.hour || 0).padStart(2, '0');
          const mm = String(event.endDate.minute || 0).padStart(2, '0');
          end_time = `${hh}:${mm}`;
        }

        const location = String(event.location || 'Centro de Estaca').trim();
        const description = event.description ? String(event.description).trim() : null;

        return {
          uid,
          title,
          event_date,
          start_time,
          end_time,
          location,
          description,
          inferredOrg: inferOrganizationFromText(title, description),
        };
      })
      .filter((item): item is ParsedIcalEvent => item !== null);
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
 * - Si un evento coincide por `ical_uid` o por `fecha + título normalizado` (ignorando
 *   mayúsculas, tildes y espacios extra), actualiza los datos oficiales de LCR
 *   (`title`, `event_date`, `start_time`, `end_time`, `location`, `description`),
 *   pero preserva intactos `id`, `organization`, `estimated_cost`, `has_budget`, `app_notes` y `status`.
 * - Jamás duplica registros existentes ni sobrescribe la organización o notas propias de la app.
 */
export function deduplicateAndMergeIcalEvents(
  existingActivities: ActivityRecord[],
  parsedEvents: ParsedIcalEvent[]
): { merged: ActivityRecord[]; upsertedCount: number } {
  const byUid = new Map<string, ActivityRecord>();
  const byDateTitleKey = new Map<string, ActivityRecord>();
  const byTitleKey = new Map<string, ActivityRecord>();

  existingActivities.forEach((act) => {
    if (act.ical_uid) {
      byUid.set(act.ical_uid, act);
    }
    const normTitle = normalizeActivityTitle(act.title);
    if (normTitle) {
      byDateTitleKey.set(`${act.event_date}|${normTitle}`, act);
      if (!act.ical_uid || act.ical_uid.startsWith('PROPUESTA_LIDER') || act.ical_uid.startsWith('PENDIENTE_LCR')) {
        byTitleKey.set(normTitle, act);
      }
    }
  });

  const updatedById = new Map<number, ActivityRecord>();
  const newlyCreated: ActivityRecord[] = [];
  let upsertedCount = 0;

  parsedEvents.forEach((parsed, idx) => {
    const normTitle = normalizeActivityTitle(parsed.title);
    const dateTitleKey = `${parsed.event_date}|${normTitle}`;
    const existingByUid = byUid.get(parsed.uid);
    const existingByDateTitle = byDateTitleKey.get(dateTitleKey);
    const existingByTitle = byTitleKey.get(normTitle);
    const target = existingByUid || existingByDateTitle || existingByTitle;

    if (target) {
      const hasChanges =
        target.ical_uid !== parsed.uid ||
        target.title !== parsed.title ||
        target.event_date !== parsed.event_date ||
        (parsed.start_time && target.start_time !== parsed.start_time) ||
        (parsed.location && target.location !== parsed.location);

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
        start_time: parsed.start_time || target.start_time || null,
        end_time: parsed.end_time || target.end_time || null,
        location: parsed.location || target.location,
        description: parsed.description ?? null,
        app_notes: preservedAppNotes,
        organization: target.organization,
        origin: 'lcr',
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
 * Persiste el nuevo timestamp `last_synced_at` en Supabase (`public.app_config`) y en `localStorage`.
 */
export async function saveSharedLastSyncedAt(isoTimestamp: string): Promise<void> {
  try {
    localStorage.setItem(LOCAL_SYNC_TIMESTAMP_KEY, isoTimestamp);
  } catch {
    // Ignorar
  }

  try {
    await supabase.from('app_config').upsert(
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
  } catch {
    // Silencioso si no hay conexión
  }
}

/**
 * Lee las actividades de Supabase y las consolida con `SEED_ACTIVITIES` (historial anual completo 2026).
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
        origin: a.ical_uid?.startsWith('PROPUESTA_LIDER')
          ? 'propuesta_lider'
          : a.status === 'PROPUESTA'
          ? 'propuesta_lider'
          : 'lcr',
      })) as ActivityRecord[];

      const existingUids = new Set(
        remoteActivities.map((a) => a.ical_uid).filter((u): u is string => Boolean(u))
      );
      const existingTitles = new Set(
        remoteActivities.map((a) => a.title.trim().toLowerCase())
      );

      const missingSeed = SEED_ACTIVITIES.filter(
        (s) =>
          (!s.ical_uid || !existingUids.has(s.ical_uid)) &&
          !existingTitles.has(s.title.trim().toLowerCase())
      );

      return ensureUniqueActivities([...remoteActivities, ...missingSeed]);
    }
  } catch {
    // Fallback a SEED_ACTIVITIES
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
 * Persiste eventos nuevos o reprogramados de LCR en la tabla `public.activities` de Supabase.
 * Preserva `organization`, `estimated_cost`, `has_budget`, `app_notes` y `status` de registros existentes.
 */
async function persistLcrEventsToSupabase(parsedEvents: ParsedIcalEvent[]): Promise<void> {
  if (parsedEvents.length === 0) return;

  try {
    const { data: existingRows, error: selectError } = await supabase
      .from('activities')
      .select('id, ical_uid, title, event_date, description, app_notes');

    if (selectError || !existingRows) return;

    type ExistingRow = {
      id: number;
      ical_uid?: string | null;
      title?: string | null;
      event_date?: string | null;
      description?: string | null;
      app_notes?: string | null;
    };

    const byUid = new Map<string, ExistingRow>();
    const byDateTitle = new Map<string, ExistingRow>();
    const byLocalTitle = new Map<string, ExistingRow>();

    for (const row of existingRows as ExistingRow[]) {
      if (row.ical_uid) {
        byUid.set(row.ical_uid, row);
      }
      const normTitle = normalizeActivityTitle(row.title);
      if (normTitle && row.event_date) {
        byDateTitle.set(`${row.event_date}|${normTitle}`, row);
      }
      if (
        normTitle &&
        (!row.ical_uid ||
          row.ical_uid.startsWith('PROPUESTA_LIDER') ||
          row.ical_uid.startsWith('PENDIENTE_LCR'))
      ) {
        byLocalTitle.set(normTitle, row);
      }
    }

    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: number; payload: Record<string, unknown> }> = [];

    for (const ev of parsedEvents) {
      const normTitle = normalizeActivityTitle(ev.title);
      const existing =
        byUid.get(ev.uid) ??
        byDateTitle.get(`${ev.event_date}|${normTitle}`) ??
        byLocalTitle.get(normTitle);

      if (existing !== undefined) {
        const wasLocalPending =
          !existing.ical_uid ||
          existing.ical_uid.startsWith('PROPUESTA_LIDER') ||
          existing.ical_uid.startsWith('PENDIENTE_LCR');

        const payload: Record<string, unknown> = {
          ical_uid: ev.uid,
          title: ev.title,
          event_date: ev.event_date,
          start_time: ev.start_time,
          end_time: ev.end_time,
          location: ev.location,
          description: ev.description,
        };

        if (
          wasLocalPending &&
          !existing.app_notes &&
          existing.description &&
          existing.description.trim() !== (ev.description || '').trim()
        ) {
          payload.app_notes = existing.description.trim();
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
      await supabase
        .from('activities')
        .upsert(toInsert, { onConflict: 'ical_uid', ignoreDuplicates: true });
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((item) =>
          supabase.from('activities').update(item.payload).eq('id', item.id)
        )
      );
    }
  } catch {
    // Silencioso si no hay conexión o permisos de escritura
  }
}

/**
 * Sincronización inteligente con Doble Escudo:
 * 1. Revisa `last_synced_at` en Supabase. Si han pasado menos de 10 minutos (y no se fuerza
 *    sincronización manual), no consulta los servidores de la Iglesia y lee de Supabase/caché (`skippedByDbShield = true`).
 * 2. Si pasaron >= 10 minutos (o es sincronización manual), consulta el feed iCal de LCR,
 *    parsea con `ical.js` (RFC 5545), deduplica por `ical_uid` sin duplicar reprogramaciones,
 *    persiste los eventos nuevos/actualizados en Supabase y registra el nuevo `last_synced_at`.
 */
export async function syncLcrCalendarWithShield(options?: {
  currentActivities?: ActivityRecord[];
  attemptLiveFetch?: boolean;
  bypassDbShield?: boolean;
}): Promise<LcrSyncResult> {
  const nowMs = Date.now();
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
      const cached = loadCachedSyncedActivities();
      const combinedBase =
        cached.length > 0 ? ensureUniqueActivities([...baseActivities, ...cached]) : baseActivities;
      const parsedFallback = parseIcalFeedWithIcalJs(FALLBACK_OFFICIAL_ICS_PAYLOAD);
      const { merged } = deduplicateAndMergeIcalEvents(combinedBase, parsedFallback);
      return {
        activities: merged,
        lastSyncedAt,
        skippedByDbShield: true,
        upsertedCount: 0,
        source: 'supabase_shield',
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
  const parsedEvents = parseIcalFeedWithIcalJs(rawIcs);
  const { merged, upsertedCount } = deduplicateAndMergeIcalEvents(baseActivities, parsedEvents);

  // 4. Persistir eventos nuevos y reprogramaciones en Supabase (`public.activities`) y actualizar timestamp
  const newIsoTimestamp = new Date(nowMs).toISOString();
  let finalActivities = merged;
  if (source === 'lcr_live_ical') {
    await persistLcrEventsToSupabase(parsedEvents);
    await saveSharedLastSyncedAt(newIsoTimestamp);
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
    lastSyncedAt: newIsoTimestamp,
    skippedByDbShield: false,
    upsertedCount,
    source,
  };
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
    uid.startsWith('ACT-2026-') ||
    uid.startsWith('LCR-2026-')
  ) {
    return false;
  }
  return !liveUids.includes(uid);
}
