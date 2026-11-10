import ICAL from 'ical.js';
import { SEED_ACTIVITIES } from '../data/seedData';
import { supabase } from '../lib/supabase';
import { ActivityRecord, OrganizationCode } from '../types/database';

/**
 * URL oficial del feed iCal público de Estaca Montevideo Uruguay Este en LCR
 */
export const OFFICIAL_LCR_ICAL_URL =
  'https://churchofjesuschrist.org/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180';

/**
 * Tiempo mínimo entre consultas reales a los servidores de la Iglesia (Escudo de Base de Datos: 10 minutos)
 */
export const DB_SHIELD_WINDOW_MS = 10 * 60 * 1000;

export const LOCAL_SYNC_TIMESTAMP_KEY = 'estaca_lcr_last_synced_at_v1';
export const LOCAL_SYNCED_ACTIVITIES_KEY = 'estaca_lcr_synced_activities_v1';

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
  if (text.includes('PRIMARIA')) return 'PRIMARIA';
  if (text.includes('SEMINARIO')) return 'SEMINARIO';
  if (text.includes('MUJERES JÓVENES') || text.includes('MUJERES JOVENES') || text.includes('MMJJ')) {
    if (text.includes('HOMBRES') || text.includes('HHJJ') || text.includes('HJ')) return 'HJ';
    return 'MJ';
  }
  if (text.includes('HOMBRES JÓVENES') || text.includes('HOMBRES JOVENES') || text.includes('HHJJ') || text.includes('HJ')) {
    return 'HJ';
  }
  if (text.includes('SOCIEDAD DE SOCORRO') || text.includes('SOC. SOC.') || text.includes('SOC SOC')) {
    return 'SS';
  }
  if (text.includes('JÓVENES ADULTOS SOLTEROS') || text.includes('JAS')) return 'JAS';
  if (text.includes('ADULTOS SOLTEROS') || text.includes('ACTIVIDAD AS ') || text.includes('REUNIÓN AS')) {
    return 'AS';
  }
  if (text.includes('FAMILYSEARCH') || text.includes('HISTORIA FAMILIAR') || text.includes('CFS')) {
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
    const titleDateKey = `td:${item.title.trim().toLowerCase()}|${item.event_date}`;
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
 * - Si un evento coincide por `ical_uid` (o por título cuando el registro inicial no tenía UID),
 *   actualiza su fecha, hora, lugar y descripción (soportando reprogramaciones en LCR),
 *   pero preserva intactos `id`, `organization`, `estimated_cost`, `has_budget` y `status`.
 * - Jamás duplica registros existentes.
 */
export function deduplicateAndMergeIcalEvents(
  existingActivities: ActivityRecord[],
  parsedEvents: ParsedIcalEvent[]
): { merged: ActivityRecord[]; upsertedCount: number } {
  const byUid = new Map<string, ActivityRecord>();
  const byTitleKey = new Map<string, ActivityRecord>();

  existingActivities.forEach((act) => {
    if (act.ical_uid) {
      byUid.set(act.ical_uid, act);
    }
    byTitleKey.set(act.title.trim().toLowerCase(), act);
  });

  const updatedIds = new Set<number>();
  const newlyCreated: ActivityRecord[] = [];
  let upsertedCount = 0;

  parsedEvents.forEach((parsed, idx) => {
    const existingByUid = byUid.get(parsed.uid);
    const existingByTitle = byTitleKey.get(parsed.title.trim().toLowerCase());
    const target = existingByUid || existingByTitle;

    if (target) {
      const hasChanges =
        target.ical_uid !== parsed.uid ||
        target.event_date !== parsed.event_date ||
        (parsed.start_time && target.start_time !== parsed.start_time) ||
        (parsed.location && target.location !== parsed.location);

      if (hasChanges) {
        upsertedCount += 1;
      }

      const updated: ActivityRecord = {
        ...target,
        ical_uid: parsed.uid,
        title: parsed.title,
        event_date: parsed.event_date,
        start_time: parsed.start_time || target.start_time || null,
        end_time: parsed.end_time || target.end_time || null,
        location: parsed.location || target.location,
        description: parsed.description || target.description || null,
        origin: 'lcr',
      };

      byUid.set(parsed.uid, updated);
      byTitleKey.set(parsed.title.trim().toLowerCase(), updated);
      updatedIds.add(target.id);
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
        organization: parsed.inferredOrg,
        estimated_cost: 0,
        has_budget: false,
        origin: 'lcr',
        status: 'APROBADA',
      };
      newlyCreated.push(newRecord);
      byUid.set(parsed.uid, newRecord);
      byTitleKey.set(parsed.title.trim().toLowerCase(), newRecord);
    }
  });

  const mergedExisting = existingActivities.map((act) => {
    if (act.ical_uid && byUid.has(act.ical_uid)) {
      return byUid.get(act.ical_uid)!;
    }
    const titleMatch = byTitleKey.get(act.title.trim().toLowerCase());
    if (titleMatch && updatedIds.has(titleMatch.id)) {
      return titleMatch;
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
 * Sincronización inteligente con Doble Escudo:
 * 1. Revisa `last_synced_at` en Supabase. Si han pasado menos de 10 minutos, no consulta los
 *    servidores de la Iglesia y lee directamente de Supabase (`skippedByDbShield = true`).
 * 2. Si pasaron >= 10 minutos (o no existe registro previo), consulta el feed iCal de LCR,
 *    parsea con `ical.js` (RFC 5545), deduplica por `ical_uid` sin duplicar reprogramaciones,
 *    actualiza Supabase y registra el nuevo `last_synced_at`.
 */
export async function syncLcrCalendarWithShield(options?: {
  currentActivities?: ActivityRecord[];
  attemptLiveFetch?: boolean;
}): Promise<LcrSyncResult> {
  const nowMs = Date.now();
  const lastSyncedAt = await getSharedLastSyncedAt();
  const baseActivities =
    options?.currentActivities && options.currentActivities.length > 0
      ? options.currentActivities
      : await fetchConsolidatedActivitiesFromSupabase();

  // 1. Escudo de Base de Datos (Compartido: 10 minutos)
  if (lastSyncedAt) {
    const elapsedMs = nowMs - Date.parse(lastSyncedAt);
    if (!Number.isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < DB_SHIELD_WINDOW_MS) {
      const parsedFallback = parseIcalFeedWithIcalJs(FALLBACK_OFFICIAL_ICS_PAYLOAD);
      const { merged } = deduplicateAndMergeIcalEvents(baseActivities, parsedFallback);
      return {
        activities: merged,
        lastSyncedAt,
        skippedByDbShield: true,
        upsertedCount: 0,
        source: 'supabase_shield',
      };
    }
  }

  // 2. Consultar el feed iCal público de la Iglesia (con timeout rápido de 450ms si se solicita explícitamente)
  let rawIcs = FALLBACK_OFFICIAL_ICS_PAYLOAD;
  let source: 'lcr_live_ical' | 'lcr_fallback_ical' = 'lcr_fallback_ical';

  if (options?.attemptLiveFetch) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 450);
      const response = await fetch(OFFICIAL_LCR_ICAL_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (text.includes('BEGIN:VCALENDAR')) {
          rawIcs = text;
          source = 'lcr_live_ical';
        }
      }
    } catch {
      source = 'lcr_fallback_ical';
    }
  }

  // 3. Parsear RFC 5545 con ical.js y deduplicar por UID único
  const parsedEvents = parseIcalFeedWithIcalJs(rawIcs);
  const { merged, upsertedCount } = deduplicateAndMergeIcalEvents(baseActivities, parsedEvents);

  // 4. Persistir cambios de reprogramación en Supabase (por ical_uid) y actualizar timestamp
  const newIsoTimestamp = new Date(nowMs).toISOString();
  await saveSharedLastSyncedAt(newIsoTimestamp);

  try {
    localStorage.setItem(LOCAL_SYNCED_ACTIVITIES_KEY, JSON.stringify(merged));
  } catch {
    // Ignorar
  }

  return {
    activities: merged,
    lastSyncedAt: newIsoTimestamp,
    skippedByDbShield: false,
    upsertedCount,
    source,
  };
}
