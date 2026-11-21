import { supabase } from '../lib/supabase';
import {
  AuditActionType,
  AuditLogRecord,
  AuditSection,
  UserProfile,
} from '../types/database';

const LOCAL_LOGS_KEY = 'estaca_este_audit_logs_v1';
const MAX_LOCAL_LOGS = 200;

export interface RecordAuditLogParams {
  actor: Pick<UserProfile, 'email' | 'full_name' | 'role' | 'calling'>;
  actionType: AuditActionType;
  section: AuditSection;
  summary: string;
  details?: Record<string, unknown>;
}

function readLocalLogs(): AuditLogRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditLogRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalLogs(logs: AuditLogRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(logs.slice(0, MAX_LOCAL_LOGS)));
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
 * Obtiene los últimos registros del historial desde Supabase (con respaldo local si falla la red).
 */
export async function fetchAuditLogs(limit = 300): Promise<AuditLogRecord[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      return data as AuditLogRecord[];
    }
  } catch {
    // Usar respaldo local
  }
  return readLocalLogs().slice(0, limit);
}
