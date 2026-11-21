import { supabase } from '../lib/supabase';
import {
  AuditActionType,
  AuditLogRecord,
  AuditSection,
  UserProfile,
} from '../types/database';

const LOCAL_LOGS_KEY = 'estaca_este_audit_logs_v1';
const RETENTION_DAYS = 180;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_LOCAL_LOGS = 500;

export interface RecordAuditLogParams {
  actor: Pick<UserProfile, 'email' | 'full_name' | 'role' | 'calling'>;
  actionType: AuditActionType;
  section: AuditSection;
  summary: string;
  details?: Record<string, unknown>;
}

export interface FetchAuditLogsParams {
  dateFrom?: string; // YYYY-MM-DD (hora Uruguay)
  dateTo?: string;   // YYYY-MM-DD (hora Uruguay)
  limit?: number;
}

function pruneOldLogs(logs: AuditLogRecord[]): AuditLogRecord[] {
  const cutoff = Date.now() - RETENTION_MS;
  return logs.filter((item) => {
    const ts = new Date(item.created_at).getTime();
    return Number.isNaN(ts) || ts >= cutoff;
  });
}

function readLocalLogs(): AuditLogRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditLogRecord[];
    return Array.isArray(parsed) ? pruneOldLogs(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalLogs(logs: AuditLogRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(pruneOldLogs(logs).slice(0, MAX_LOCAL_LOGS)));
  } catch {
    // Ignorar error de cuota
  }
}

/**
 * Registra un evento en el libro inmutable de historial (Supabase + respaldo local).
 * Nunca lanza excepciones para no interrumpir la operación principal del usuario.
 */
export async function recordAuditLog({
  actor,
  actionType,
  section,
  summary,
  details = {},
}: RecordAuditLogParams): Promise<void> {
  const nowIso = new Date().toISOString();
  const payload = {
    actor_email: (actor.email || 'sin-correo').trim().toLowerCase(),
    actor_name: actor.full_name || 'Usuario',
    actor_role: actor.role || 'DESCONOCIDO',
    actor_calling: actor.calling || null,
    action_type: actionType,
    section,
    summary,
    details,
  };

  const localEntry: AuditLogRecord = {
    id: Date.now(),
    created_at: nowIso,
    ...payload,
  };
  writeLocalLogs([localEntry, ...readLocalLogs()]);

  try {
    await supabase.from('audit_logs').insert(payload);
  } catch {
    // Respaldo local ya guardado
  }
}

/**
 * Registra el ingreso del usuario una sola vez por sesión de navegador para evitar ruido al recargar.
 */
export async function recordSessionLoginOnce(
  user: Pick<UserProfile, 'email' | 'full_name' | 'role' | 'calling'>
): Promise<void> {
  if (typeof window === 'undefined' || !user.email) return;
  const normalizedEmail = user.email.trim().toLowerCase();
  const sessionKey = `estaca_este_login_logged_${normalizedEmail}`;
  if (sessionStorage.getItem(sessionKey)) return;

  sessionStorage.setItem(sessionKey, '1');
  await recordAuditLog({
    actor: user,
    actionType: 'LOGIN',
    section: 'ACCESO',
    summary: `Ingresó al sistema (${user.calling || user.role})`,
  });
}

/**
 * Obtiene registros del historial desde Supabase (con filtro opcional de fecha/rango y respaldo local).
 * Aplica ventana máxima de retención de 180 días (6 meses).
 */
export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<AuditLogRecord[]> {
  const { dateFrom, dateTo, limit = 500 } = params;
  const cutoffIso = new Date(Date.now() - RETENTION_MS).toISOString();

  // Si el usuario elige solo "Desde", se toma como día puntual; si elige ambos, es rango completo.
  const effectiveFrom = dateFrom || undefined;
  const effectiveTo = dateTo || dateFrom || undefined;

  const fromIso = effectiveFrom ? `${effectiveFrom}T00:00:00-03:00` : cutoffIso;
  const toIso = effectiveTo ? `${effectiveTo}T23:59:59.999-03:00` : undefined;

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', fromIso > cutoffIso ? fromIso : cutoffIso)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (toIso) {
      query = query.lte('created_at', toIso);
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      return data as AuditLogRecord[];
    }
  } catch {
    // Usar respaldo local
  }

  const fromMs = new Date(fromIso).getTime();
  const toMs = toIso ? new Date(toIso).getTime() : Number.POSITIVE_INFINITY;

  return readLocalLogs()
    .filter((item) => {
      const ts = new Date(item.created_at).getTime();
      return ts >= fromMs && ts <= toMs;
    })
    .slice(0, limit);
}
