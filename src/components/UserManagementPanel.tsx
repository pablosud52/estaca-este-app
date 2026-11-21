import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eraser,
  Info,
  Link2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { isEntryIncomplete, isEntryPersonLoaded, useAuth } from '../context/AuthContext';
import { isSuperAdminEmail } from '../data/seedData';
import {
  DIRECTORY_ORG_BY_CODE,
  PRESIDENCY_COUNSELOR_SLOTS,
  STAKE_ORG_STRUCTURE,
  STAKE_UNITS,
} from '../data/stakeOrgStructure';
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
  ADMIN: { label: 'ADMIN', className: 'bg-slate-800 text-white border-slate-800' },
  PRESIDENCIA: { label: 'PRESIDENCIA', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  LIDER: { label: 'LÍDER', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  CONSULTA: { label: 'CONSULTA', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  NO_AUTORIZADO: { label: 'SIN ACCESO', className: 'bg-white text-slate-400 border-slate-200' },
};

interface PendingPresidentModal {
  mode: 'REPLACE_OR_CORRECT' | 'CONFIRM_CLEAR';
  entry: StakeDirectoryEntry;
  cleanPhone: string;
  cleanEmail: string;
}

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
    clearDirectoryEntryWithCascade,
    releasePresidencyCounselors,
  } = useAuth();

  // Todas las organizaciones inician plegadas por defecto
  const [expandedOrgs, setExpandedOrgs] = useState<Partial<Record<DirectoryOrgCode, boolean>>>(
    () => {
      if (!initialFilterIncomplete) return {};
      const initial: Partial<Record<DirectoryOrgCode, boolean>> = {};
      for (const org of STAKE_ORG_STRUCTURE) {
        if (directoryEntries.some((e) => e.directory_org === org.code && isEntryIncomplete(e))) {
          initial[org.code] = true;
        }
      }
      return initial;
    }
  );
  const [onlyIncomplete, setOnlyIncomplete] = useState<boolean>(initialFilterIncomplete);

  useEffect(() => {
    setOnlyIncomplete(initialFilterIncomplete);
    if (initialFilterIncomplete) {
      const next: Partial<Record<DirectoryOrgCode, boolean>> = {};
      for (const org of STAKE_ORG_STRUCTURE) {
        if (directoryEntries.some((e) => e.directory_org === org.code && isEntryIncomplete(e))) {
          next[org.code] = true;
        }
      }
      setExpandedOrgs(next);
    }
  }, [initialFilterIncomplete, directoryEntries]);

  useEffect(() => {
    if (incompleteContactsCount === 0 && onlyIncomplete) {
      setOnlyIncomplete(false);
    }
  }, [incompleteContactsCount, onlyIncomplete]);

  const [toastMsg, setToastMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Edición inline de un puesto
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftCleared, setDraftCleared] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Modal de confirmación de relevo de Presidente/a
  const [presidentModal, setPresidentModal] = useState<PendingPresidentModal | null>(null);

  // Modal de información de Seguridad de administradores
  const [isSecurityInfoOpen, setIsSecurityInfoOpen] = useState<boolean>(false);

  // Vincular persona existente
  const [linkingEntryId, setLinkingEntryId] = useState<string | null>(null);

  // Formulario de agregar extra por organización
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
    setTimeout(() => setToastMsg(null), 4500);
  };

  const toggleOrgAccordion = (code: DirectoryOrgCode) => {
    setExpandedOrgs((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleToggleOnlyIncomplete = () => {
    setOnlyIncomplete((prev) => {
      const nextVal = !prev;
      if (nextVal) {
        const nextExpanded: Partial<Record<DirectoryOrgCode, boolean>> = {};
        for (const org of STAKE_ORG_STRUCTURE) {
          if (directoryEntries.some((e) => e.directory_org === org.code && isEntryIncomplete(e))) {
            nextExpanded[org.code] = true;
          }
        }
        setExpandedOrgs(nextExpanded);
      } else {
        setExpandedOrgs({});
      }
      return nextVal;
    });
  };

  const loadedPeopleForLink = useMemo(
    () => directoryEntries.filter((e) => isEntryPersonLoaded(e) && e.id !== linkingEntryId),
    [directoryEntries, linkingEntryId]
  );

  const getLinkedTargetsForSumo = (sumoEntryId: string): string[] =>
    directoryEntries
      .filter((e) => e.linked_entry_id === sumoEntryId)
      .map((e) => `${DIRECTORY_ORG_BY_CODE[e.directory_org].shortLabel} · ${e.calling}`);

  const startEditing = (entry: StakeDirectoryEntry) => {
    setEditingId(entry.id);
    setDraftFirstName(entry.first_name);
    setDraftLastName(entry.last_name);
    setDraftPhone(entry.phone || '');
    setDraftEmail(entry.email || '');
    setDraftUnit(entry.assigned_unit || '');
    setDraftNotes(entry.assigned_org_notes || '');
    setDraftCleared(false);
    setDraftError(null);
  };

  const canClearEntryFields = (entry: StakeDirectoryEntry): boolean => {
    const isSelf =
      Boolean(entry.email) &&
      entry.email?.trim().toLowerCase() === currentUser.email.trim().toLowerCase();
    if (isSelf) return false;

    const isTargetPermanent = entry.is_permanent_admin || isSuperAdminEmail(entry.email);
    const isCurrentPermanent =
      currentUser.is_permanent_admin || isSuperAdminEmail(currentUser.email);
    if (isTargetPermanent && !isCurrentPermanent) return false;

    return true;
  };

  const handleClearFieldsInDraft = () => {
    setDraftFirstName('');
    setDraftLastName('');
    setDraftPhone('');
    setDraftEmail('');
    setDraftUnit('');
    setDraftNotes('');
    setDraftCleared(true);
    setDraftError(null);
  };

  const commitStandardSave = async (
    entry: StakeDirectoryEntry,
    cleanPhone: string,
    cleanEmail: string
  ): Promise<boolean> => {
    const res = await updateDirectoryEntry(entry.id, {
      first_name: draftFirstName.trim(),
      last_name: draftLastName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      assigned_unit: entry.directory_org === 'SUMO_CONSEJO' ? draftUnit.trim() : entry.assigned_unit,
      assigned_org_notes:
        entry.directory_org === 'SUMO_CONSEJO' ? draftNotes.trim() : entry.assigned_org_notes,
      has_app_access: cleanEmail ? entry.has_app_access : false,
    });

    if (!res.ok) {
      triggerToast(res.error || 'No se pudo guardar en la base de datos.', true);
      return false;
    }

    setEditingId(null);
    setDraftCleared(false);
    setDraftError(null);
    return true;
  };

  const handleSaveEdit = async (entry: StakeDirectoryEntry) => {
    const cleanPhone = draftPhone.trim();
    const cleanEmail = draftEmail.trim().toLowerCase();
    const isSelf =
      Boolean(entry.email) &&
      entry.email?.trim().toLowerCase() === currentUser.email.trim().toLowerCase();

    if (isSelf && !cleanEmail) {
      setDraftError('Por seguridad, no puedes dejar vacío tu propio correo de administrador.');
      return;
    }

    if (cleanPhone && !isValidUruguayanMobile(cleanPhone)) {
      setDraftError(
        'Celular inválido: debe ingresarse 09xxxxxxx (9 dígitos, todo junto sin espacios).'
      );
      return;
    }

    if (cleanEmail && !isValidGmail(cleanEmail)) {
      setDraftError('Correo inválido: solo se permiten cuentas @gmail.com.');
      return;
    }

    const isNowEmpty =
      !draftFirstName.trim() &&
      !draftLastName.trim() &&
      !cleanPhone &&
      !cleanEmail &&
      (entry.directory_org !== 'SUMO_CONSEJO' || (!draftUnit.trim() && !draftNotes.trim()));

    const wasLoaded = isEntryPersonLoaded(entry);
    const hasCounselors = Boolean(PRESIDENCY_COUNSELOR_SLOTS[entry.slot_key]);

    // Caso 1: Se vaciaron todos los campos de un puesto que tenía datos
    if (isNowEmpty && wasLoaded) {
      if (hasCounselors) {
        setPresidentModal({
          mode: 'CONFIRM_CLEAR',
          entry,
          cleanPhone,
          cleanEmail,
        });
        return;
      }

      const { clearedLinkedCallings, error: cloudError } = await clearDirectoryEntryWithCascade(
        entry.id,
        {
          clearCounselors: true,
        }
      );
      setEditingId(null);
      setDraftCleared(false);
      if (cloudError) {
        triggerToast(`Guardado localmente, pero falló la nube: ${cloudError}`, true);
        return;
      }
      triggerToast(
        clearedLinkedCallings.length > 0
          ? `Puesto vaciado junto con su vínculo (${clearedLinkedCallings.join(', ')}).`
          : `Puesto ${entry.calling} vaciado.`
      );
      return;
    }

    // Caso 2: Es Presidente/a con consejeros y ya tenía una persona cargada -> preguntar si es corrección o relevo
    if (hasCounselors && wasLoaded && (draftFirstName.trim() || draftLastName.trim())) {
      setPresidentModal({
        mode: 'REPLACE_OR_CORRECT',
        entry,
        cleanPhone,
        cleanEmail,
      });
      return;
    }

    // Caso 3: Guardado normal (incluye primera carga de un Presidente que estaba vacío)
    const saved = await commitStandardSave(entry, cleanPhone, cleanEmail);
    if (saved) {
      triggerToast(`Datos guardados para ${entry.calling}.`);
    }
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
      setExtraError(
        'Celular inválido: debe ingresarse 09xxxxxxx (9 dígitos, todo junto sin espacios).'
      );
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

  return (
    <section
      aria-label="Gestión de Usuarios y Organigrama de Estaca"
      data-testid="user-management-panel"
      className="space-y-4"
    >
      {/* 1. TÍTULO DE SECCIÓN */}
      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
        Gestión de Usuarios
      </h2>

      {/* Aviso parpadeante de datos incompletos (solo visible cuando faltan datos) */}
      {incompleteContactsCount > 0 && (
        <button
          type="button"
          data-testid="incomplete-contacts-filter-btn"
          onClick={handleToggleOnlyIncomplete}
          className={`w-full rounded-2xl px-4 py-3 border-2 flex items-center justify-between gap-3 text-left transition animate-pulse ${
            onlyIncomplete
              ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-md'
              : 'bg-amber-50 text-amber-950 border-amber-400 hover:bg-amber-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold">
              {incompleteContactsCount}{' '}
              {incompleteContactsCount === 1
                ? 'contacto con datos incompletos'
                : 'contactos con datos incompletos'}{' '}
              (falta celular o Gmail)
            </span>
          </div>
          <span className="text-xs font-extrabold underline whitespace-nowrap">
            {onlyIncomplete ? 'Ver todas' : 'Filtrar'}
          </span>
        </button>
      )}

      {/* Modal de Información: Seguridad de administradores */}
      {isSecurityInfoOpen && (
        <div
          data-testid="admin-security-info-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsSecurityInfoOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Seguridad de administradores
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500">
                    Admins Permanentes: Presidente & Secretario de Estaca
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSecurityInfoOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p
              data-testid="security-banner-official-text"
              className="text-xs sm:text-sm text-slate-700 leading-relaxed"
            >
              Por seguridad del sistema, ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Las modificaciones de administradores deben ser realizadas por otro administrador activo.
            </p>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsSecurityInfoOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal de Relevo de Presidente/a (Corrección vs Nuevo Presidente / Vaciar) */}
      {presidentModal && (
        <div
          data-testid="presidency-release-modal"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {presidentModal.mode === 'CONFIRM_CLEAR'
                    ? 'Confirmar vaciado de Presidente/a'
                    : 'Cambio en Presidente/a de Organización'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {presidentModal.mode === 'CONFIRM_CLEAR'
                    ? 'Al vaciar al Presidente/a se vaciarán también automáticamente 1° y 2° Consejero/a (sin afectar a Secretarios ni Auxiliares). ¿Confirmar?'
                    : '¿Esta modificación es solo una corrección de datos o se trata de un relevo (nuevo Presidente/a)? Si es un nuevo Presidente/a, se vaciarán automáticamente 1° y 2° Consejero/a (no afecta a Secretarios).'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPresidentModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>

              {presidentModal.mode === 'CONFIRM_CLEAR' ? (
                <button
                  type="button"
                  data-testid="confirm-clear-president-btn"
                  onClick={async () => {
                    const { entry } = presidentModal;
                    setPresidentModal(null);
                    const { clearedCounselors, error: cloudError } =
                      await clearDirectoryEntryWithCascade(entry.id, {
                        clearCounselors: true,
                      });
                    setEditingId(null);
                    setDraftCleared(false);
                    if (cloudError) {
                      triggerToast(`Guardado localmente, pero falló la nube: ${cloudError}`, true);
                      return;
                    }
                    triggerToast(
                      `Presidente/a vaciado junto con: ${clearedCounselors.join(', ')}.`
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-extrabold"
                >
                  Confirmar vaciado en cascada
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="president-correction-only-btn"
                    onClick={async () => {
                      const { entry, cleanPhone, cleanEmail } = presidentModal;
                      setPresidentModal(null);
                      await commitStandardSave(entry, cleanPhone, cleanEmail);
                      triggerToast('Corrección guardada (consejeros sin cambios).');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold"
                  >
                    Solo corrección de datos
                  </button>
                  <button
                    type="button"
                    data-testid="president-new-release-btn"
                    onClick={async () => {
                      const { entry, cleanPhone, cleanEmail } = presidentModal;
                      setPresidentModal(null);
                      const saved = await commitStandardSave(entry, cleanPhone, cleanEmail);
                      if (!saved) return;
                      const { clearedCounselors, error: cloudError } =
                        await releasePresidencyCounselors(entry.slot_key);
                      if (cloudError) {
                        triggerToast(`Guardado localmente, pero falló la nube: ${cloudError}`, true);
                        return;
                      }
                      triggerToast(
                        `Nuevo Presidente/a guardado. Se vaciaron: ${clearedCounselors.join(', ')}.`
                      );
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
                  >
                    Nuevo Presidente/a (relevo)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Tarjetas Acordeón por Organización (todas plegadas al entrar) */}
      <div className="space-y-3">
        {STAKE_ORG_STRUCTURE.map((orgDef) => {
          const orgEntries = directoryEntries.filter((e) => e.directory_org === orgDef.code);
          const extrasCount = orgEntries.filter((e) => !e.is_fixed_slot).length;
          const incompleteInOrg = orgEntries.filter(isEntryIncomplete).length;
          const loadedInOrg = orgEntries.filter(isEntryPersonLoaded).length;
          const isExpanded = Boolean(expandedOrgs[orgDef.code]);

          if (onlyIncomplete && incompleteInOrg === 0) {
            return null;
          }

          const visibleEntries = onlyIncomplete
            ? orgEntries.filter(isEntryIncomplete)
            : orgEntries;

          return (
            <div
              key={orgDef.code}
              data-testid={`org-card-${orgDef.code}`}
              className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden"
            >
              {/* Cabecera Acordeón */}
              <div className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid={`org-accordion-toggle-${orgDef.code}`}
                  aria-expanded={isExpanded}
                  onClick={() => toggleOrgAccordion(orgDef.code)}
                  className="flex-1 flex flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Users className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <h3 className="text-sm font-extrabold text-slate-900">{orgDef.label}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {orgDef.hasBudget ? 'Con Presupuesto' : 'Solo Consulta'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {incompleteInOrg > 0 && (
                      <span
                        data-testid={`org-incomplete-badge-${orgDef.code}`}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {incompleteInOrg} {incompleteInOrg === 1 ? 'incompleto' : 'incompletos'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-500">
                      {loadedInOrg} / {orgEntries.length} cargados
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {orgDef.code === 'PRESIDENCIA' && isExpanded && (
                  <button
                    type="button"
                    data-testid="admin-security-info-btn"
                    onClick={() => setIsSecurityInfoOpen(true)}
                    aria-label="Seguridad de administradores"
                    title="Seguridad de administradores"
                    className="p-1.5 rounded-full text-sky-600 hover:bg-sky-100 transition flex-shrink-0"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Contenido Desplegable */}
              {isExpanded && (
                <>
                  <div className="divide-y divide-slate-100 border-t border-slate-200">
                    {visibleEntries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      const isLoaded = isEntryPersonLoaded(entry);
                      const isIncomplete = isEntryIncomplete(entry);
                      const isSelfOrPerm =
                        entry.is_permanent_admin ||
                        isSuperAdminEmail(entry.email) ||
                        (Boolean(entry.email) &&
                          entry.email?.toLowerCase() === currentUser.email.toLowerCase());
                      const roleBadge = ROLE_BADGES[entry.role];
                      const canClear = canClearEntryFields(entry);
                      const linkedTargets =
                        entry.directory_org === 'SUMO_CONSEJO'
                          ? getLinkedTargetsForSumo(entry.id)
                          : [];

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
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-extrabold text-emerald-900">
                                  Editando: {entry.calling}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    data-testid={`clear-fields-${entry.slot_key}`}
                                    disabled={!canClear}
                                    onClick={handleClearFieldsInDraft}
                                    title={
                                      canClear
                                        ? 'Vaciar todos los campos de este puesto'
                                        : 'Bloqueado por regla de auto-protección de administrador'
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <Eraser className="w-3.5 h-3.5" />
                                    <span>Limpiar campos</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="text-slate-400 hover:text-slate-700"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {draftCleared && linkedTargets.length > 0 && (
                                <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                                  Al guardar también se vaciará el puesto vinculado:{' '}
                                  {linkedTargets.join(', ')}.
                                </p>
                              )}

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
                                    onChange={(e) =>
                                      setDraftPhone(e.target.value.replace(/\D/g, ''))
                                    }
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
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                                      <Lock className="w-3 h-3" />
                                      Fijo
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
                                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                                          {entry.assigned_org_notes}
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>

                              {/* Controles de acción */}
                              <div className="flex flex-wrap items-center gap-2">
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
