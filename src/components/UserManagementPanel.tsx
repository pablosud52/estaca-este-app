import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ORGANIZATION_LABELS, ORGANIZATION_SHORT_LABELS } from '../lib/formatters';
import { OrganizationCode, UserRole } from '../types/database';

const SELECTABLE_ORGS: OrganizationCode[] = [
  'TODAS',
  'MJ',
  'HJ',
  'PRIMARIA',
  'SS',
  'AS',
  'JAS',
  'CFS',
  'ESTACA',
];

export const UserManagementPanel: React.FC = () => {
  const { user: currentUser, profiles, updateUserProfile, addUserProfile } = useAuth();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCalling, setNewCalling] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newOrg, setNewOrg] = useState<OrganizationCode>('MJ');
  const [newRole, setNewRole] = useState<UserRole>('LIDER');
  const [newCanApprove, setNewCanApprove] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Si en el formulario de alta se elige una organización distinta de TODAS, el rol debe ser LIDER
  const handleOrgChangeInForm = (org: OrganizationCode) => {
    setNewOrg(org);
    if (org !== 'TODAS' && newRole === 'ADMIN') {
      setNewRole('LIDER');
      setNewCanApprove(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim()) return;

    const effectiveRole: UserRole =
      newOrg !== 'TODAS' && newRole === 'ADMIN' ? 'LIDER' : newRole;

    await addUserProfile({
      full_name: newFullName.trim(),
      email: newEmail.trim().toLowerCase(),
      calling: newCalling.trim() || `Líder de ${ORGANIZATION_SHORT_LABELS[newOrg]}`,
      phone: newPhone.trim() || undefined,
      organization: newOrg,
      role: effectiveRole,
      can_approve_activities: effectiveRole === 'ADMIN' ? true : newCanApprove,
      is_permanent_admin: false,
      is_active: true,
    });

    setNewFullName('');
    setNewEmail('');
    setNewCalling('');
    setNewPhone('');
    setIsAddOpen(false);
    triggerToast(`Usuario "${newFullName.trim()}" registrado en ${ORGANIZATION_SHORT_LABELS[newOrg]}.`);
  };

  const handleRoleChange = async (profileId: string, nextRole: UserRole, org: OrganizationCode) => {
    // Regla estricta PROJECT_CONTEXT.md §2: El rol ADMIN solo puede asignarse a Presidencia (TODAS)
    if (nextRole === 'ADMIN' && org !== 'TODAS') {
      triggerToast('El rol de Administrador es exclusivo para integrantes de la Presidencia de Estaca.');
      return;
    }

    await updateUserProfile(profileId, {
      role: nextRole,
      can_approve_activities: nextRole === 'ADMIN' ? true : undefined,
    });
    triggerToast('Rol de usuario actualizado.');
  };

  const handleToggleApprovalPermission = async (profileId: string, currentVal: boolean) => {
    await updateUserProfile(profileId, { can_approve_activities: !currentVal });
    triggerToast(
      !currentVal
        ? 'Permiso para aprobar actividades habilitado.'
        : 'Permiso para aprobar actividades revocado.'
    );
  };

  const handleToggleActiveState = async (profileId: string, currentActive: boolean) => {
    await updateUserProfile(profileId, {
      is_active: !currentActive,
      role: !currentActive ? 'LIDER' : 'NO_AUTORIZADO',
    });
    triggerToast(
      !currentActive
        ? 'Cuenta de usuario reactivada.'
        : 'Baja lógica aplicada (se preserva trazabilidad histórica).'
    );
  };

  return (
    <section
      aria-label="Gestión de Usuarios y Permisos RBAC"
      data-testid="user-management-panel"
      className="space-y-5"
    >
      {/* 1. BANNER OFICIAL DE SEGURIDAD E INMUTABILIDAD (PROJECT_CONTEXT.md §4.3) */}
      <div
        data-testid="security-self-protection-banner"
        className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 p-5 sm:p-6 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Regla Sagrada de Auto-Protección Inmutable
              </span>
              <span className="text-[10px] font-mono bg-slate-800 text-emerald-300 px-2 py-0.5 rounded-full border border-slate-700">
                RBAC Floor Activo
              </span>
            </div>
            <p
              data-testid="security-banner-official-text"
              className="text-xs sm:text-sm text-slate-200 mt-1.5 leading-relaxed"
            >
              Por seguridad del sistema, ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Las modificaciones de administradores deben ser realizadas por otro administrador activo.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-add-user-btn"
          onClick={() => setIsAddOpen((prev) => !prev)}
          className="pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold whitespace-nowrap self-start sm:self-center shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Nuevo Usuario</span>
        </button>
      </div>

      {/* Toast de confirmación */}
      {toastMsg && (
        <div
          data-testid="user-mgmt-toast"
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-900 text-white text-xs font-bold shadow-md border border-emerald-700 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Formulario Desplegable de Alta de Usuario */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateUser}
          data-testid="add-user-form"
          className="bg-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-emerald-600/40 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Alta de Líder o Integrante de Presidencia
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                required
                data-testid="new-user-name-input"
                placeholder="Ej: Ana Clara Gómez"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Correo Google (Gmail) *
              </label>
              <input
                type="email"
                required
                data-testid="new-user-email-input"
                placeholder="ejemplo@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Llamamiento / Cargo
              </label>
              <input
                type="text"
                data-testid="new-user-calling-input"
                placeholder="Ej: 1° Consejera Primaria"
                value={newCalling}
                onChange={(e) => setNewCalling(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Organización Asignada
              </label>
              <select
                data-testid="new-user-org-select"
                value={newOrg}
                onChange={(e) => handleOrgChangeInForm(e.target.value as OrganizationCode)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {SELECTABLE_ORGS.map((org) => (
                  <option key={org} value={org}>
                    {org === 'TODAS' ? 'Presidencia de Estaca (TODAS)' : ORGANIZATION_LABELS[org]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rol de Acceso
              </label>
              <select
                data-testid="new-user-role-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="LIDER">LÍDER (Organización)</option>
                {newOrg === 'TODAS' && (
                  <>
                    <option value="PRESIDENCIA">PRESIDENCIA (Ejecutivo)</option>
                    <option value="ADMIN">ADMINISTRADOR (Total)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                placeholder="+598 99 000 000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="pressable px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="submit-new-user-btn"
              className="pressable px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold shadow-sm"
            >
              Guardar Usuario
            </button>
          </div>
        </form>
      )}

      {/* 2. LISTADO / TABLA DE USUARIOS CON PROTECCIÓN INMUTABLE */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-800" />
            <h2 className="text-sm font-extrabold text-slate-900">
              Padrón de Usuarios y Permisos ({profiles.length})
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Conectado como: <strong className="text-slate-800">{currentUser.full_name}</strong>
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {profiles.map((row) => {
            const isSelf = row.email.toLowerCase() === currentUser.email.toLowerCase();
            const isPermanent =
              row.is_permanent_admin ||
              row.email.toLowerCase() === 'pablo.lamela@gmail.com' ||
              row.email.toLowerCase() === 'presidente.estaca@gmail.com';
            const isProtected = isSelf || isPermanent;

            return (
              <div
                key={row.id}
                data-testid={`user-row-${row.id}`}
                className={`p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                  !row.is_active ? 'bg-rose-50/40 opacity-80' : 'hover:bg-slate-50/70'
                }`}
              >
                {/* Datos de Identidad */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-900">{row.full_name}</span>

                    {isSelf && (
                      <span
                        data-testid={`self-session-badge-${row.id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Tu Sesión Activa</span>
                      </span>
                    )}

                    {isPermanent && (
                      <span
                        data-testid={`immutable-admin-pill-${row.id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300"
                      >
                        <Lock className="w-3 h-3 text-amber-700" />
                        <span>Admin Permanente Inmutable</span>
                      </span>
                    )}

                    {!row.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                        Inactivo / Baja Lógica
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    {row.calling} •{' '}
                    <span className="text-emerald-800 font-bold">
                      {ORGANIZATION_LABELS[row.organization]}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span>{row.email}</span>
                    </span>
                    {row.phone && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Phone className="w-3 h-3" />
                        <span>{row.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Controles de Rol, Permiso de Aprobación y Estado */}
                <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
                  {/* Selector de Rol */}
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      aria-label={`Rol de ${row.full_name}`}
                      data-testid={`role-select-${row.id}`}
                      disabled={isProtected || !row.is_active}
                      value={row.role}
                      onChange={(e) =>
                        handleRoleChange(row.id, e.target.value as UserRole, row.organization)
                      }
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="LIDER">LÍDER</option>
                      <option value="PRESIDENCIA">PRESIDENCIA</option>
                      {row.organization === 'TODAS' && <option value="ADMIN">ADMIN</option>}
                    </select>
                  </div>

                  {/* Permiso Granular de Aprobación en Presidencia */}
                  {(row.role === 'PRESIDENCIA' || row.role === 'ADMIN') && (
                    <button
                      type="button"
                      data-testid={`toggle-approve-perm-${row.id}`}
                      disabled={isProtected || row.role === 'ADMIN'}
                      onClick={() =>
                        handleToggleApprovalPermission(row.id, row.can_approve_activities)
                      }
                      className={`pressable px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                        row.can_approve_activities
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {row.can_approve_activities ? '✓ Aprueba Actividades' : 'Solo Lectura'}
                    </button>
                  )}

                  {/* Botón de Baja Lógica / Reactivación */}
                  <button
                    type="button"
                    data-testid={`toggle-active-btn-${row.id}`}
                    disabled={isProtected}
                    onClick={() => handleToggleActiveState(row.id, row.is_active)}
                    className={`pressable inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed ${
                      row.is_active
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {isProtected ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>Protegido</span>
                      </>
                    ) : row.is_active ? (
                      <span>Desactivar</span>
                    ) : (
                      <span>Reactivar</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
