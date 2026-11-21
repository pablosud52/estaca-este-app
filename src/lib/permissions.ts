import { isSuperAdminEmail } from '../data/seedData';
import { UserProfile } from '../types/database';

/**
 * Devuelve true si el usuario es Administrador (Presidente/Secretario de Estaca) o Super Admin.
 */
export function isAdminOrSuper(user: Pick<UserProfile, 'role' | 'email'>): boolean {
  return user.role === 'ADMIN' || isSuperAdminEmail(user.email);
}

/**
 * Devuelve true si el usuario ocupa el llamamiento de Secretario Financiero.
 */
export function isFinancialSecretary(user: Pick<UserProfile, 'calling'>): boolean {
  return (user.calling || '').toLowerCase().includes('secretario financiero');
}

/**
 * Gestión de Usuarios / Panel de Control del Directorio: exclusivo de Admins y Super Admin.
 */
export function canManageUsers(user: Pick<UserProfile, 'role' | 'email'>): boolean {
  return isAdminOrSuper(user);
}

/**
 * Historial de actividad (Logs): exclusivo de Admins y Super Admin.
 */
export function canViewLogs(user: Pick<UserProfile, 'role' | 'email'>): boolean {
  return isAdminOrSuper(user);
}

/**
 * Edición de Finanzas (cargar gastos, retiros, presupuestos y conciliar LCR):
 * Admins, Super Admin y Secretario Financiero. El resto de Presidencia ingresa en solo lectura.
 */
export function canEditFinances(user: Pick<UserProfile, 'role' | 'email' | 'calling'>): boolean {
  return isAdminOrSuper(user) || isFinancialSecretary(user);
}

/**
 * Acceso al Panel de Control del Calendario (aprobar, editar, vincular con LCR):
 * Todos los miembros de Presidencia (incluidos secretarios) y Admins.
 */
export function canApproveCalendar(user: Pick<UserProfile, 'role' | 'email'>): boolean {
  return user.role === 'ADMIN' || user.role === 'PRESIDENCIA' || isSuperAdminEmail(user.email);
}
