import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Link2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { isEntryIncomplete, isEntryPersonLoaded, useAuth } from '../context/AuthContext';
import { isSuperAdminEmail } from '../data/seedData';
import { STAKE_ORG_STRUCTURE, STAKE_UNITS } from '../data/stakeOrgStructure';
import {
  formatUruguayanMobile,
  isValidGmail,
  isValidUruguayanMobile,
} from '../lib/formatters';
import {
  DirectoryOrgCode,
  ExtraRoleType,
  StakeDirectoryEntry,
  UserRole,
} from '../types/database';

interface UserManagementPanelProps {
  initialFilterIncomplete?: boolean;
}

const ROLE_BADGES: Record<UserRole, { label: string; className: string }> = {
  ADMIN: { label: 'ADMIN', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  PRESIDENCIA: { label: 'PRESIDENCIA', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  LIDER: { label: 'LÍDER', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  CONSULTA: { label: 'CONSULTA', className: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
  NO_AUTORIZADO: { label: 'SIN ACCESO', className: 'bg-slate-100 text-slate-600 border-slate-300' },
};

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
  initialFilterIncomplete = false,
}) => {
  const {
    user: currentUser,
    directoryEntries,
    incompleteContactsCount,
    updateDirectoryEntry,
    addExtraDirectoryEntry,
    removeExtraDirectoryEntry,
    toggleDirectoryAppAccess,
    linkDirectoryPerson,
  } = useAuth();

  const [selectedOrgFilter, setSelectedOrgFilter] = useState<DirectoryOrgCode | 'TODAS'>('TODAS');
  const [onlyIncomplete, setOnlyIncomplete] = useState<boolean>(initialFilterIncomplete);

  useEffect(() => {
    setOnlyIncomplete(initialFilterIncomplete);
  }, [initialFilterIncomplete]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Estado de edición inline de un puesto
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  // Estado para vincular persona existente
  const [linkingEntryId, setLinkingEntryId] = useState<string | null>(null);

  // Estado para formulario de agregar extra por organización
  const [addingOrg, setAddingOrg] = useState<DirectoryOrgCode | null>(null);
  const [extraRoleType, setExtraRoleType] = useState<ExtraRoleType>('SECRETARIO_AUXILIAR');
  const [extraManualCalling, setExtraManualCalling] = useState('');
  const [extraFirstName, setExtraFirstName] = useState('');
  const [extraLastName, setExtraLastName] = useState('');
  const [extraPhone, setExtraPhone] = useState('');
  const [extraEmail, setExtraEmail] = useState('');
  const [extraAppAccess, setExtraAppAccess] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);

  const triggerToast = (text: string, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadedPeopleForLink = useMemo(
    () =>
      directoryEntries.filter(
        (e) => isEntryPersonLoaded(e) && e.id !== linkingEntryId
      ),
    [directoryEntries, linkingEntryId]
  );

  const startEditing = (entry: StakeDirectoryEntry) => {
    setEditingId(entry.id);
    setDraftFirstName(entry.first_name);
    setDraftLastName(entry.last_name);
    setDraftPhone(entry.phone || '');
    setDraftEmail(entry.email || '');
    setDraftUnit(entry.assigned_unit || '');
    setDraftNotes(entry.assigned_org_notes || '');
    setDraftError(null);
  };

  const handleSaveEdit = async (entry: StakeDirectoryEntry) => {
    const cleanPhone = draftPhone.trim();
    const cleanEmail = draftEmail.trim().toLowerCase();

    if (cleanPhone && !isValidUruguayanMobile(cleanPhone)) {
      setDraftError('Celular inválido: debe ingresarse 09xxxxxxx (9 dígitos, todo junto sin espacios).');
      return;
    }

    if (cleanEmail && !isValidGmail(cleanEmail)) {
      setDraftError('Correo inválido: solo se permiten cuentas @gmail.com.');
      return;
    }

    await updateDirectoryEntry(entry.id, {
      first_name: draftFirstName.trim(),
      last_name: draftLastName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      assigned_unit: entry.directory_org === 'SUMO_CONSEJO' ? draftUnit.trim() : entry.assigned_unit,
      assigned_org_notes:
        entry.directory_org === 'SUMO_CONSEJO' ? draftNotes.trim() : entry.assigned_org_notes,
      has_app_access: cleanEmail ? entry.has_app_access : false,
    });

    setEditingId(null);
    setDraftError(null);
    triggerToast(`Datos guardados para ${entry.calling}.`);
  };

  const handleToggleAccess = async (entry: StakeDirectoryEntry) => {
    const res = await toggleDirectoryAppAccess(entry.id);
    if (!res.ok && res.error) {
      triggerToast(res.error, true);
      return;
    }
    triggerToast(
      entry.has_app_access
        ? `Acceso App desactivado para ${entry.first_name || entry.calling} (se conservan sus datos).`
        : `Acceso App activado para ${entry.first_name || entry.calling}.`
    );
  };

  const handlePresidencyRoleChange = async (entry: StakeDirectoryEntry, nextRole: UserRole) => {
    if (entry.is_permanent_admin || isSuperAdminEmail(entry.email)) {
      triggerToast('Un administrador permanente es inmutable.', true);
      return;
    }
    await updateDirectoryEntry(entry.id, {
      role: nextRole,
      can_approve_activities: nextRole === 'ADMIN' ? true : entry.can_approve_activities,
    });
    triggerToast('Rol actualizado.');
  };

  const openAddExtraForm = (org: DirectoryOrgCode) => {
    setAddingOrg(org);
    setExtraRoleType('SECRETARIO_AUXILIAR');
    setExtraManualCalling('');
    setExtraFirstName('');
    setExtraLastName('');
    setExtraPhone('');
    setExtraEmail('');
    setExtraAppAccess(false);
    setExtraError(null);
  };

  const handleCreateExtra = async (e: React.FormEvent, org: DirectoryOrgCode) => {
    e.preventDefault();
    setExtraError(null);

    if (!extraFirstName.trim() || !extraLastName.trim()) {
      setExtraError('Nombre y Apellido son obligatorios.');
      return;
    }

    const cleanPhone = extraPhone.trim();
    if (cleanPhone && !isValidUruguayanMobile(cleanPhone)) {
      setExtraError('Celular inválido: debe ingresarse 09xxxxxxx (9 dígitos, todo junto sin espacios).');
      return;
    }

    const cleanEmail = extraEmail.trim().toLowerCase();
    if (cleanEmail && !isValidGmail(cleanEmail)) {
      setExtraError('Correo inválido: solo se permiten cuentas @gmail.com.');
      return;
    }

    if (extraAppAccess && !cleanEmail) {
      setExtraError('Para activar Acceso App debes ingresar un correo @gmail.com.');
      return;
    }

    const callingLabel =
      extraRoleType === 'SECRETARIO_AUXILIAR'
        ? 'Secretario Auxiliar'
        : extraRoleType === 'ASESOR'
          ? 'Asesor'
          : extraManualCalling.trim();

    if (!callingLabel) {
      setExtraError('Debes ingresar el nombre del rol manual.');
      return;
    }

    const res = await addExtraDirectoryEntry(org, extraRoleType, callingLabel, {
      first_name: extraFirstName.trim(),
      last_name: extraLastName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      has_app_access: extraAppAccess,
    });

    if (!res.ok) {
      setExtraError(res.error || 'No se pudo agregar el integrante.');
      return;
    }

    setAddingOrg(null);
    triggerToast(`${extraFirstName.trim()} ${extraLastName.trim()} agregado como ${callingLabel}.`);
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleOrgs = useMemo(
    () =>
      STAKE_ORG_STRUCTURE.filter((org) =>
        selectedOrgFilter === 'TODAS' ? true : org.code === selectedOrgFilter
      ),
    [selectedOrgFilter]
  );

  return (
    <section
      aria-label="Gestión de Usuarios y Organigrama de Estaca"
      data-testid="user-management-panel"
      className="space-y-5"
    >
      {/* 1. BANNER OFICIAL DE SEGURIDAD E INMUTABILIDAD */}
      <div
        data-testid="security-self-protection-banner"
        className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 p-5 sm:p-6 text-white shadow-lg border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
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
                Fuente Única · Directorio + Acceso
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

        {/* Recordatorio de Contactos Incompletos */}
        <button
          type="button"
          data-testid="incomplete-contacts-filter-btn"
          onClick={() => setOnlyIncomplete((prev) => !prev)}
          className={`pressable inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap self-start lg:self-center border transition ${
            onlyIncomplete
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
              : incompleteContactsCount > 0
                ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>
            {incompleteContactsCount > 0
              ? `${incompleteContactsCount} con datos incompletos`
              : 'Todos los contactos completos'}
          </span>
        </button>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          data-testid="user-mgmt-toast"
          role="status"
          className={`p-3.5 rounded-2xl text-white text-xs font-bold shadow-md border flex items-center gap-2.5 ${
            toastMsg.isError
              ? 'bg-rose-900 border-rose-700'
              : 'bg-emerald-900 border-emerald-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Barra de búsqueda y filtro por organización */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, apellido, llamamiento, @gmail.com o unidad..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedOrgFilter('TODAS')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
              selectedOrgFilter === 'TODAS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas (12)
          </button>
          {STAKE_ORG_STRUCTURE.map((org) => (
            <button
              key={org.code}
              type="button"
              onClick={() => setSelectedOrgFilter(org.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                selectedOrgFilter === org.code
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {org.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Modal rápido para vincular persona ya cargada */}
      {linkingEntryId && (
        <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-indigo-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              <span>Vincular persona ya registrada en otro llamamiento</span>
            </h3>
            <button
              type="button"
              onClick={() => setLinkingEntryId(null)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Selecciona a la persona para copiar automáticamente Nombre, Apellido, Celular y Gmail sin volver a escribirlos:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {loadedPeopleForLink.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={async () => {
                  await linkDirectoryPerson(linkingEntryId, person.id);
                  setLinkingEntryId(null);
                  triggerToast(`Persona vinculada: ${person.first_name} ${person.last_name}.`);
                }}
                className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition"
              >
                <p className="text-xs font-bold text-slate-900">
                  {person.first_name} {person.last_name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{person.calling}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tarjetas por Organización */}
      <div className="space-y-4">
        {visibleOrgs.map((orgDef) => {
          const orgEntries = directoryEntries.filter((e) => e.directory_org === orgDef.code);
          const extrasCount = orgEntries.filter((e) => !e.is_fixed_slot).length;

          const filteredEntries = orgEntries.filter((entry) => {
            if (onlyIncomplete && !isEntryIncomplete(entry)) return false;
            if (!normalizedSearch) return true;
            const haystack = [
              entry.first_name,
              entry.last_name,
              entry.calling,
              entry.email,
              entry.phone,
              entry.assigned_unit,
              entry.assigned_org_notes,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(normalizedSearch);
          });

          if ((onlyIncomplete || normalizedSearch) && filteredEntries.length === 0) {
            return null;
          }

          return (
            <div
              key={orgDef.code}
              data-testid={`org-card-${orgDef.code}`}
              className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
            >
              {/* Cabecera de Organización */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-extrabold text-slate-900">{orgDef.label}</h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      orgDef.hasBudget
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                    }`}
                  >
                    {orgDef.hasBudget ? 'Con Presupuesto' : 'Directorio · Calendario · Proveedores'}
                  </span>
                </div>

                <span className="text-xs font-bold text-slate-500">
                  {orgEntries.filter(isEntryPersonLoaded).length} / {orgEntries.length} cargados
                </span>
              </div>

              {/* Filas de Puestos */}
              <div className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isLoaded = isEntryPersonLoaded(entry);
                  const isIncomplete = isEntryIncomplete(entry);
                  const isSelfOrPerm =
                    entry.is_permanent_admin ||
                    isSuperAdminEmail(entry.email) ||
                    (Boolean(entry.email) && entry.email === currentUser.email);
                  const roleBadge = ROLE_BADGES[entry.role];

                  return (
                    <div
                      key={entry.id}
                      data-testid={`directory-row-${entry.slot_key}`}
                      className={`p-4 sm:px-5 transition ${
                        !entry.has_app_access && isLoaded ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-emerald-900">
                              Editando: {entry.calling}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Nombre
                              </label>
                              <input
                                type="text"
                                value={draftFirstName}
                                onChange={(e) => setDraftFirstName(e.target.value)}
                                placeholder="Nombre"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Apellido
                              </label>
                              <input
                                type="text"
                                value={draftLastName}
                                onChange={(e) => setDraftLastName(e.target.value)}
                                placeholder="Apellido"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Celular (09xxxxxxx)
                              </label>
                              <input
                                type="tel"
                                maxLength={9}
                                value={draftPhone}
                                onChange={(e) => setDraftPhone(e.target.value.replace(/\D/g, ''))}
                                placeholder="099123456"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Correo Gmail (@gmail.com)
                              </label>
                              <input
                                type="email"
                                value={draftEmail}
                                onChange={(e) => setDraftEmail(e.target.value)}
                                placeholder="nombre@gmail.com"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                              />
                            </div>
                          </div>

                          {entry.directory_org === 'SUMO_CONSEJO' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Unidad asignada
                                </label>
                                <input
                                  type="text"
                                  list={`units-${entry.id}`}
                                  value={draftUnit}
                                  onChange={(e) => setDraftUnit(e.target.value)}
                                  placeholder="Ej: Paso Carrasco, Aeroparque..."
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                                />
                                <datalist id={`units-${entry.id}`}>
                                  {STAKE_UNITS.map((u) => (
                                    <option key={u} value={u} />
                                  ))}
                                </datalist>
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Organización / Comité asignado
                                </label>
                                <input
                                  type="text"
                                  value={draftNotes}
                                  onChange={(e) => setDraftNotes(e.target.value)}
                                  placeholder="Ej: HJ Pte // acompañar MJ // Obra Misional"
                                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                                />
                              </div>
                            </div>
                          )}

                          {draftError && (
                            <p className="text-xs font-bold text-rose-700">{draftError}</p>
                          )}

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              data-testid={`save-edit-${entry.slot_key}`}
                              onClick={() => handleSaveEdit(entry)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-800 text-white text-xs font-extrabold hover:bg-emerald-900"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Guardar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Info principal */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-800">
                                {entry.calling}
                              </span>
                              {!entry.is_fixed_slot && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  Adicional
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${roleBadge.className}`}
                              >
                                {roleBadge.label}
                              </span>
                              {isSelfOrPerm && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Lock className="w-3 h-3" />
                                  Inmutable
                                </span>
                              )}
                              {isIncomplete && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  {!entry.phone && !entry.email
                                    ? 'Falta celular y Gmail'
                                    : !entry.phone
                                      ? 'Falta celular'
                                      : 'Falta Gmail'}
                                </span>
                              )}
                            </div>

                            {isLoaded ? (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                                <span className="font-bold text-slate-900">
                                  {entry.first_name} {entry.last_name}
                                </span>
                                {entry.phone && (
                                  <span className="inline-flex items-center gap-1 text-slate-600 font-mono">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {formatUruguayanMobile(entry.phone)}
                                  </span>
                                )}
                                {entry.email && (
                                  <span className="inline-flex items-center gap-1 text-slate-600">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {entry.email}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs italic text-slate-400">
                                Puesto vacante — sin persona asignada
                              </p>
                            )}

                            {entry.directory_org === 'SUMO_CONSEJO' &&
                              (entry.assigned_unit || entry.assigned_org_notes) && (
                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  {entry.assigned_unit && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                                      Unidad: {entry.assigned_unit}
                                    </span>
                                  )}
                                  {entry.assigned_org_notes && (
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800">
                                      {entry.assigned_org_notes}
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>

                          {/* Controles de acción */}
                          <div className="flex flex-wrap items-center gap-2">
                            {orgDef.code === 'PRESIDENCIA' && isLoaded && (
                              <>
                                <select
                                  aria-label={`Rol de ${entry.calling}`}
                                  disabled={isSelfOrPerm}
                                  value={entry.role}
                                  onChange={(e) =>
                                    handlePresidencyRoleChange(entry, e.target.value as UserRole)
                                  }
                                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-[11px] font-bold bg-white disabled:bg-slate-100 disabled:text-slate-500"
                                >
                                  <option value="PRESIDENCIA">PRESIDENCIA</option>
                                  <option value="ADMIN">ADMIN</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={isSelfOrPerm}
                                  onClick={() =>
                                    updateDirectoryEntry(entry.id, {
                                      can_approve_activities: !entry.can_approve_activities,
                                    })
                                  }
                                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                                    entry.can_approve_activities
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {entry.can_approve_activities ? '✓ Aprueba' : 'No aprueba'}
                                </button>
                              </>
                            )}

                            {/* Switch universal Acceso App */}
                            <button
                              type="button"
                              data-testid={`toggle-access-${entry.slot_key}`}
                              disabled={isSelfOrPerm}
                              onClick={() => handleToggleAccess(entry)}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition ${
                                isSelfOrPerm
                                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                                  : entry.has_app_access
                                    ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>{entry.has_app_access ? 'Acceso ON' : 'Acceso OFF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setLinkingEntryId(entry.id)}
                              title="Vincular persona ya registrada"
                              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              data-testid={`edit-btn-${entry.slot_key}`}
                              onClick={() => startEditing(entry)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            {!entry.is_fixed_slot && (
                              <button
                                type="button"
                                onClick={() => removeExtraDirectoryEntry(entry.id)}
                                title="Eliminar integrante adicional"
                                className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pie de organización: botón para agregar extras (máx 3 / máx 2 en CFS) */}
              {orgDef.maxExtras > 0 && (
                <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
                  {addingOrg === orgDef.code ? (
                    <form
                      onSubmit={(e) => handleCreateExtra(e, orgDef.code)}
                      className="bg-white p-4 rounded-2xl border border-emerald-300 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4" />
                          <span>
                            {orgDef.extraLabel} ({extrasCount}/{orgDef.maxExtras})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddingOrg(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Rol a asignar
                          </label>
                          <select
                            value={extraRoleType}
                            onChange={(e) => setExtraRoleType(e.target.value as ExtraRoleType)}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                          >
                            <option value="SECRETARIO_AUXILIAR">Secretario Auxiliar</option>
                            <option value="ASESOR">Asesor</option>
                            <option value="MANUAL">Ingresar manualmente</option>
                          </select>
                        </div>

                        {extraRoleType === 'MANUAL' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Nombre del rol *
                            </label>
                            <input
                              type="text"
                              required
                              value={extraManualCalling}
                              onChange={(e) => setExtraManualCalling(e.target.value)}
                              placeholder="Ej: Secretario de Comunicación"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Nombre *
                          </label>
                          <input
                            type="text"
                            required
                            value={extraFirstName}
                            onChange={(e) => setExtraFirstName(e.target.value)}
                            placeholder="Nombre"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Apellido *
                          </label>
                          <input
                            type="text"
                            required
                            value={extraLastName}
                            onChange={(e) => setExtraLastName(e.target.value)}
                            placeholder="Apellido"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Celular (09xxxxxxx)
                          </label>
                          <input
                            type="tel"
                            maxLength={9}
                            value={extraPhone}
                            onChange={(e) => setExtraPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="099123456"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Correo Gmail (@gmail.com)
                          </label>
                          <input
                            type="email"
                            value={extraEmail}
                            onChange={(e) => setExtraEmail(e.target.value)}
                            placeholder="ejemplo@gmail.com"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={extraAppAccess}
                            onChange={(e) => setExtraAppAccess(e.target.checked)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                          />
                          <span>Activar Acceso App al guardar</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAddingOrg(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-800 text-white text-xs font-extrabold hover:bg-emerald-900"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>

                      {extraError && (
                        <p className="text-xs font-bold text-rose-700">{extraError}</p>
                      )}
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        Integrantes adicionales: {extrasCount} / {orgDef.maxExtras}
                      </span>
                      <button
                        type="button"
                        data-testid={`add-extra-btn-${orgDef.code}`}
                        disabled={extrasCount >= orgDef.maxExtras}
                        onClick={() => openAddExtraForm(orgDef.code)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition disabled:opacity-50 disabled:cursor-not-allowed bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{orgDef.extraLabel}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
