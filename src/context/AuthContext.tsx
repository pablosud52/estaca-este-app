import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  buildInitialDirectoryEntries,
  DEV_PROFILES,
  isSuperAdminEmail,
  SUPER_ADMIN_EMAIL,
} from '../data/seedData';
import { DIRECTORY_ORG_BY_CODE, PRESIDENCY_COUNSELOR_SLOTS } from '../data/stakeOrgStructure';
import { isValidGmail } from '../lib/formatters';
import {
  getForceAccountSelect,
  setForceAccountSelect,
  supabase,
} from '../lib/supabase';
import {
  DirectoryOrgCode,
  ExtraRoleType,
  OrganizationCode,
  StakeDirectoryEntry,
  UserProfile,
} from '../types/database';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface PersistenceResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  user: UserProfile;
  profiles: UserProfile[];
  directoryEntries: StakeDirectoryEntry[];
  incompleteContactsCount: number;
  authStatus: AuthStatus;
  isAuthRequired: boolean;
  switchProfileById: (profileId: string) => void;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  addUserProfile: (newProfile: Omit<UserProfile, 'id'>) => Promise<void>;
  updateDirectoryEntry: (
    id: string,
    updates: Partial<StakeDirectoryEntry>
  ) => Promise<PersistenceResult>;
  addExtraDirectoryEntry: (
    org: DirectoryOrgCode,
    extraRoleType: ExtraRoleType,
    callingLabel: string,
    data: Pick<StakeDirectoryEntry, 'first_name' | 'last_name' | 'phone' | 'email' | 'has_app_access'>
  ) => Promise<PersistenceResult>;
  removeExtraDirectoryEntry: (id: string) => Promise<PersistenceResult>;
  toggleDirectoryAppAccess: (id: string) => Promise<PersistenceResult>;
  linkDirectoryPerson: (targetEntryId: string, sourceEntryId: string) => Promise<PersistenceResult>;
  clearDirectoryEntryWithCascade: (
    id: string,
    options?: { clearCounselors?: boolean }
  ) => Promise<{ clearedLinkedCallings: string[]; clearedCounselors: string[]; error?: string }>;
  releasePresidencyCounselors: (
    presidentSlotKey: string
  ) => Promise<{ clearedCounselors: string[]; error?: string }>;
  signInWithGoogle: (forceAccountSelect?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  isSimulating: boolean;
  /** Correo real autenticado vía Google OAuth (o null en modo simulación local) */
  realAuthEmail: string | null;
  /** Exclusivo para pablosud52@gmail.com en producción (y activo en desarrollo local) */
  canUseRoleSwitcher: boolean;
  /** Permite a pablosud52@gmail.com ocultar o mostrar la píldora flotante cuando lo desee */
  isRoleSwitcherVisible: boolean;
  toggleRoleSwitcherVisibility: () => void;
  /** Organizaciones que este usuario tiene permiso de ver */
  allowedOrganizations: OrganizationCode[];
  /** Si el usuario pertenece a MJ o HJ y puede alternar/incluir Seminario */
  canAccessSeminario: boolean;
}

const STORAGE_KEY = 'estaca_este_active_profile_id';
const SWITCHER_VISIBILITY_KEY = 'estaca_este_role_switcher_visible';
const DIRECTORY_STORAGE_KEY = 'estaca_este_directory_entries_v1';

const normalizeDirectoryEntries = (entries: StakeDirectoryEntry[]): StakeDirectoryEntry[] =>
  entries.map((entry) => {
    const isSuper = isSuperAdminEmail(entry.email);
    if (entry.slot_key === 'pres-presidente') {
      return {
        ...entry,
        role: 'ADMIN',
        is_permanent_admin: true,
        can_approve_activities: true,
      };
    }
    if (entry.slot_key === 'pres-secretario') {
      return {
        ...entry,
        role: 'ADMIN',
        is_permanent_admin: true,
        can_approve_activities: Boolean(entry.can_approve_activities),
      };
    }
    if (entry.slot_key === 'pres-secretario-financiero') {
      return {
        ...entry,
        role: isSuper ? 'ADMIN' : entry.role === 'ADMIN' ? 'PRESIDENCIA' : entry.role,
        is_permanent_admin: isSuper,
        can_approve_activities: isSuper ? true : entry.can_approve_activities,
      };
    }
    return entry;
  });

const loadInitialDirectory = (): StakeDirectoryEntry[] => {
  if (typeof window === 'undefined') return buildInitialDirectoryEntries();
  try {
    const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StakeDirectoryEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeDirectoryEntries(parsed);
      }
    }
  } catch {
    // Fallback a semilla
  }
  return normalizeDirectoryEntries(buildInitialDirectoryEntries());
};

const saveDirectoryLocal = (entries: StakeDirectoryEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignorar error de cuota
  }
};

export const isEntryPersonLoaded = (entry: StakeDirectoryEntry): boolean =>
  Boolean(entry.first_name.trim() || entry.last_name.trim());

export const isEntryIncomplete = (entry: StakeDirectoryEntry): boolean => {
  if (!isEntryPersonLoaded(entry)) return false;
  const missingPhone = !entry.phone || !entry.phone.trim();
  const missingEmail = !entry.email || !isValidGmail(entry.email);
  return missingPhone || missingEmail;
};

const toDbDirectoryRow = (entry: StakeDirectoryEntry) => ({
  id: entry.id,
  directory_org: entry.directory_org,
  slot_key: entry.slot_key,
  calling: entry.calling,
  is_fixed_slot: entry.is_fixed_slot,
  extra_role_type: entry.extra_role_type ?? null,
  first_name: entry.first_name ?? '',
  last_name: entry.last_name ?? '',
  phone: entry.phone?.trim() || null,
  email: entry.email?.trim().toLowerCase() || null,
  has_app_access: Boolean(entry.has_app_access),
  role: entry.role,
  can_approve_activities: Boolean(entry.can_approve_activities),
  is_permanent_admin: Boolean(entry.is_permanent_admin),
  assigned_unit: entry.assigned_unit?.trim() || null,
  assigned_org_notes: entry.assigned_org_notes?.trim() || null,
  linked_entry_id: entry.linked_entry_id || null,
  updated_at: new Date().toISOString(),
});

const mergeDirectoryFromRemote = (remoteRows: StakeDirectoryEntry[]): StakeDirectoryEntry[] => {
  const base = buildInitialDirectoryEntries();
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
  const baseIds = new Set(base.map((b) => b.id));

  const mergedFixed = base.map((slot) => {
    const remote = remoteById.get(slot.id);
    if (!remote) return slot;
    return {
      ...slot,
      ...remote,
      first_name: remote.first_name || '',
      last_name: remote.last_name || '',
      phone: remote.phone || '',
      email: remote.email || '',
      assigned_unit: remote.assigned_unit || undefined,
      assigned_org_notes: remote.assigned_org_notes || undefined,
      linked_entry_id: remote.linked_entry_id || undefined,
      extra_role_type: remote.extra_role_type || undefined,
    };
  });

  const remoteExtras = remoteRows
    .filter((row) => !baseIds.has(row.id))
    .map((row) => ({
      ...row,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      phone: row.phone || '',
      email: row.email || '',
      assigned_unit: row.assigned_unit || undefined,
      assigned_org_notes: row.assigned_org_notes || undefined,
      linked_entry_id: row.linked_entry_id || undefined,
      extra_role_type: row.extra_role_type || undefined,
    }));

  return normalizeDirectoryEntries([...mergedFixed, ...remoteExtras]);
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_REQUIRED =
  import.meta.env.PROD || import.meta.env.VITE_REQUIRE_AUTH === 'true';

const resolveUserByEmail = (
  email: string,
  availableProfiles: UserProfile[]
): UserProfile => {
  const canonical = isSuperAdminEmail(email)
    ? SUPER_ADMIN_EMAIL
    : email.trim().toLowerCase();

  const found = availableProfiles.find(
    (p) => p.email.trim().toLowerCase() === canonical
  );

  if (found) {
    if (isSuperAdminEmail(found.email)) {
      return {
        ...found,
        email: SUPER_ADMIN_EMAIL,
        role: 'ADMIN',
        is_permanent_admin: true,
        can_approve_activities: true,
        is_active: true,
      };
    }
    return found;
  }

  if (isSuperAdminEmail(canonical)) {
    const superDev = DEV_PROFILES.find((p) => isSuperAdminEmail(p.email));
    if (superDev) return superDev;
  }

  return {
    id: `unauth-${canonical}`,
    email: canonical,
    full_name: canonical,
    role: 'NO_AUTORIZADO',
    organization: 'ESTACA',
    calling: 'Sin acceso',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: false,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(DEV_PROFILES);
  const [directoryEntries, setDirectoryEntries] = useState<StakeDirectoryEntry[]>(loadInitialDirectory);
  const [user, setUser] = useState<UserProfile>(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return DEV_PROFILES.find((p) => p.id === savedId) || DEV_PROFILES.find((p) => p.id === 'lider-mj-01') || DEV_PROFILES[0];
  });
  const [isSimulating, setIsSimulating] = useState<boolean>(!AUTH_REQUIRED);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    AUTH_REQUIRED ? 'loading' : 'authenticated'
  );
  const [realAuthEmail, setRealAuthEmail] = useState<string | null>(null);
  const realAuthEmailRef = useRef<string | null>(realAuthEmail);
  realAuthEmailRef.current = realAuthEmail;
  const [isRoleSwitcherVisible, setIsRoleSwitcherVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(SWITCHER_VISIBILITY_KEY);
    return saved === null ? true : saved === 'true';
  });

  const profilesRef = useRef<UserProfile[]>(profiles);
  profilesRef.current = profiles;

  const directoryEntriesRef = useRef<StakeDirectoryEntry[]>(directoryEntries);
  directoryEntriesRef.current = directoryEntries;

  const toggleRoleSwitcherVisibility = () => {
    setIsRoleSwitcherVisible((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SWITCHER_VISIBILITY_KEY, String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;

    async function initAuthAndProfiles() {
      let latestProfiles = profilesRef.current;
      let sessionEmail: string | null = null;

      try {
        // 1. Verificar sesión real de Google OAuth si existe
        const { data: sessionData } = await supabase.auth.getSession();
        sessionEmail = sessionData?.session?.user?.email?.toLowerCase() || null;
        if (mounted && sessionEmail) {
          setRealAuthEmail(sessionEmail);
        }

        // 2. Sincronizar perfiles desde Supabase y asegurar correo oficial pablosud52@gmail.com
        const [{ data, error }, { data: dirData, error: dirError }] = await Promise.all([
          supabase
            .from('users_profiles')
            .select('*')
            .order('full_name', { ascending: true }),
          supabase.from('stake_directory_entries').select('*'),
        ]);

        if (!error && data && data.length > 0 && mounted) {
          const legacyRow = data.find(
            (d) => String(d.email || '').toLowerCase() === 'pablo.lamela@gmail.com'
          );
          if (legacyRow) {
            await supabase
              .from('users_profiles')
              .update({
                email: SUPER_ADMIN_EMAIL,
                role: 'ADMIN',
                is_permanent_admin: true,
                can_approve_activities: true,
                is_active: true,
              })
              .eq('id', legacyRow.id);
            legacyRow.email = SUPER_ADMIN_EMAIL;
          }

          const devByEmail = new Map(
            DEV_PROFILES.map((p) => [p.email.toLowerCase(), p])
          );
          const remoteEmails = new Set(
            data.map((d) => {
              const em = String(d.email || '').toLowerCase();
              return isSuperAdminEmail(em) ? SUPER_ADMIN_EMAIL : em;
            })
          );

          const normalizedRemote: UserProfile[] = data.map((d) => {
            const rawEmail = String(d.email || '').toLowerCase();
            const canonicalEmail = isSuperAdminEmail(rawEmail)
              ? SUPER_ADMIN_EMAIL
              : rawEmail;
            const devMatch = devByEmail.get(canonicalEmail);
            const isSuper = isSuperAdminEmail(canonicalEmail);

            return {
              ...(d as UserProfile),
              id: devMatch ? devMatch.id : String(d.id),
              email: canonicalEmail,
              role: isSuper ? 'ADMIN' : (d.role as UserProfile['role']),
              is_permanent_admin: isSuper ? true : Boolean(d.is_permanent_admin),
              can_approve_activities: isSuper ? true : Boolean(d.can_approve_activities),
              is_active: isSuper ? true : Boolean(d.is_active),
            };
          });

          const mergedProfiles: UserProfile[] = [
            ...DEV_PROFILES.filter((p) => !remoteEmails.has(p.email.toLowerCase())),
            ...normalizedRemote,
          ].map((item) => {
            if (isSuperAdminEmail(item.email)) {
              return {
                ...item,
                email: SUPER_ADMIN_EMAIL,
                role: 'ADMIN',
                is_permanent_admin: true,
                can_approve_activities: true,
                is_active: true,
              };
            }
            return item;
          });

          latestProfiles = mergedProfiles;
          setProfiles(mergedProfiles);
        }

        // 3. Cargar directorio real desde Supabase (si tiene registros)
        if (!dirError && dirData && dirData.length > 0 && mounted) {
          const mergedDir = mergeDirectoryFromRemote(dirData as StakeDirectoryEntry[]);
          setDirectoryEntries(mergedDir);
          saveDirectoryLocal(mergedDir);
        }
      } catch {
        // Fallback silencioso a perfiles/directorio locales en caso de desconexión
      } finally {
        if (mounted) {
          if (sessionEmail) {
            const resolved = resolveUserByEmail(sessionEmail, latestProfiles);
            setUser(resolved);
            setIsSimulating(false);
            setAuthStatus('authenticated');
          } else if (AUTH_REQUIRED) {
            setAuthStatus('unauthenticated');
          } else {
            setAuthStatus('authenticated');
          }
        }
      }
    }

    initAuthAndProfiles();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const email = session?.user?.email?.toLowerCase() || null;
      setRealAuthEmail(email);
      if (email) {
        const resolved = resolveUserByEmail(email, profilesRef.current);
        setUser(resolved);
        setIsSimulating(false);
        setAuthStatus('authenticated');
      } else if (AUTH_REQUIRED) {
        setAuthStatus('unauthenticated');
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const switchProfileById = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId) || DEV_PROFILES.find((p) => p.id === profileId);
    if (target) {
      setUser(target);
      setIsSimulating(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, target.id);
      }
    }
  };

  const updateUserProfile = async (id: string, updates: Partial<UserProfile>) => {
    setProfiles((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // Si es el Super-Admin Vitalicio (pablosud52@gmail.com):
        // Permite actualizar su llamamiento, organización o teléfono si en el futuro deja de ser
        // Secretario Financiero, pero BLINDA de por vida su rol ADMIN, estado activo e inmutabilidad.
        if (isSuperAdminEmail(item.email)) {
          const safeSuperUpdates: UserProfile = {
            ...item,
            calling: updates.calling !== undefined ? updates.calling : item.calling,
            organization:
              updates.organization !== undefined ? updates.organization : item.organization,
            phone: updates.phone !== undefined ? updates.phone : item.phone,
            full_name: updates.full_name !== undefined ? updates.full_name : item.full_name,
            email: SUPER_ADMIN_EMAIL,
            role: 'ADMIN',
            is_permanent_admin: true,
            can_approve_activities: true,
            is_active: true,
          };
          if (user.id === item.id) {
            setUser(safeSuperUpdates);
          }
          return safeSuperUpdates;
        }

        // Regla Sagrada #1: Ningún otro administrador puede quitarse permisos ni modificar un admin permanente
        if (item.is_permanent_admin || item.email === user.email) {
          return item;
        }
        return { ...item, ...updates };
      })
    );

    try {
      await supabase.from('users_profiles').update(updates).eq('id', id);
    } catch {
      // Estado local ya actualizado
    }
  };

  const addUserProfile = async (newProfile: Omit<UserProfile, 'id'>) => {
    const created: UserProfile = {
      ...newProfile,
      id: `user-${Date.now()}`,
    };
    setProfiles((prev) => [...prev, created]);

    try {
      await supabase.from('users_profiles').insert([newProfile]);
    } catch {
      // Estado local ya actualizado
    }
  };

  const signInWithGoogle = async (forceAccountSelectArg?: boolean) => {
    const shouldForce = forceAccountSelectArg ?? getForceAccountSelect();
    setForceAccountSelect(false);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        ...(shouldForce ? { queryParams: { prompt: 'select_account' } } : {}),
      },
    });
  };

  const signOut = async () => {
    setForceAccountSelect(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignorar si no había sesión remota activa
    }
    setRealAuthEmail(null);
    if (AUTH_REQUIRED) {
      setIsSimulating(false);
      setAuthStatus('unauthenticated');
    } else {
      switchProfileById(DEV_PROFILES[0].id);
    }
  };

  const syncEntryToProfiles = async (entry: StakeDirectoryEntry) => {
    const email = entry.email?.trim().toLowerCase() || '';
    if (!email || !isValidGmail(email)) return;

    const orgDef = DIRECTORY_ORG_BY_CODE[entry.directory_org];
    const fullName = `${entry.first_name.trim()} ${entry.last_name.trim()}`.trim() || entry.calling;
    const isSuper = isSuperAdminEmail(email);
    const effectiveRole = isSuper ? 'ADMIN' : entry.role;
    const effectiveActive = isSuper ? true : entry.has_app_access;

    setProfiles((prev) => {
      const existingIdx = prev.findIndex((p) => p.email.toLowerCase() === email);
      if (existingIdx >= 0) {
        const next = [...prev];
        const curr = next[existingIdx];
        next[existingIdx] = {
          ...curr,
          full_name: fullName,
          first_name: entry.first_name.trim(),
          last_name: entry.last_name.trim(),
          phone: entry.phone?.trim() || undefined,
          calling: entry.calling,
          organization: orgDef.budgetOrgCode,
          role: effectiveRole,
          can_approve_activities: isSuper ? true : entry.can_approve_activities,
          is_permanent_admin: isSuper ? true : entry.is_permanent_admin,
          is_active: effectiveActive,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `user-${entry.id}`,
          email,
          full_name: fullName,
          first_name: entry.first_name.trim(),
          last_name: entry.last_name.trim(),
          phone: entry.phone?.trim() || undefined,
          calling: entry.calling,
          organization: orgDef.budgetOrgCode,
          role: effectiveRole,
          can_approve_activities: isSuper ? true : entry.can_approve_activities,
          is_permanent_admin: isSuper ? true : entry.is_permanent_admin,
          is_active: effectiveActive,
        },
      ];
    });

    try {
      await supabase.from('users_profiles').upsert(
        {
          email,
          full_name: fullName,
          first_name: entry.first_name.trim(),
          last_name: entry.last_name.trim(),
          phone: entry.phone?.trim() || null,
          calling: entry.calling,
          organization: orgDef.budgetOrgCode,
          role: effectiveRole,
          can_approve_activities: isSuper ? true : entry.can_approve_activities,
          is_permanent_admin: isSuper ? true : entry.is_permanent_admin,
          is_active: effectiveActive,
        },
        { onConflict: 'email' }
      );
    } catch {
      // Estado local ya sincronizado
    }
  };

  const updateDirectoryEntry = async (
    id: string,
    updates: Partial<StakeDirectoryEntry>
  ): Promise<PersistenceResult> => {
    const currentEntries = directoryEntriesRef.current;
    let updatedTarget: StakeDirectoryEntry | null = null;
    const next = currentEntries.map((entry) => {
      if (entry.id !== id) return entry;
      const isSuper = isSuperAdminEmail(entry.email);
      const merged: StakeDirectoryEntry = {
        ...entry,
        ...updates,
        email: updates.email !== undefined ? updates.email.trim().toLowerCase() : entry.email,
        role: isSuper ? 'ADMIN' : updates.role ?? entry.role,
        is_permanent_admin: isSuper ? true : updates.is_permanent_admin ?? entry.is_permanent_admin,
        can_approve_activities: isSuper
          ? true
          : updates.can_approve_activities ?? entry.can_approve_activities,
        has_app_access: isSuper ? true : updates.has_app_access ?? entry.has_app_access,
      };
      updatedTarget = merged;
      return merged;
    });

    if (!updatedTarget) {
      return { ok: false, error: 'Registro no encontrado en el directorio.' };
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    await syncEntryToProfiles(updatedTarget);
    if (!realAuthEmailRef.current && !AUTH_REQUIRED) {
      return { ok: true };
    }
    try {
      const { error } = await supabase
        .from('stake_directory_entries')
        .upsert(toDbDirectoryRow(updatedTarget), { onConflict: 'id' });
      if (error) {
        return {
          ok: false,
          error: `No se pudo guardar en la base de datos (${error.message}).`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de conexión con la base de datos: ${err.message}`
            : 'Error de conexión con la base de datos.',
      };
    }
  };

  const addExtraDirectoryEntry = async (
    org: DirectoryOrgCode,
    extraRoleType: ExtraRoleType,
    callingLabel: string,
    data: Pick<StakeDirectoryEntry, 'first_name' | 'last_name' | 'phone' | 'email' | 'has_app_access'>
  ): Promise<PersistenceResult> => {
    const orgDef = DIRECTORY_ORG_BY_CODE[org];
    const currentExtras = directoryEntriesRef.current.filter(
      (e) => e.directory_org === org && !e.is_fixed_slot
    );
    if (currentExtras.length >= orgDef.maxExtras) {
      return {
        ok: false,
        error: `Máximo de ${orgDef.maxExtras} integrantes adicionales alcanzado en ${orgDef.shortLabel}.`,
      };
    }

    const cleanEmail = data.email?.trim().toLowerCase() || '';
    if (cleanEmail && !isValidGmail(cleanEmail)) {
      return { ok: false, error: 'Solo se permiten correos @gmail.com.' };
    }
    if (data.has_app_access && !cleanEmail) {
      return { ok: false, error: 'Para activar Acceso App debes ingresar un correo @gmail.com.' };
    }

    const created: StakeDirectoryEntry = {
      id: `dir-${org.toLowerCase()}-extra-${Date.now()}`,
      directory_org: org,
      slot_key: `${org.toLowerCase()}-extra-${currentExtras.length + 1}`,
      calling: callingLabel.trim(),
      is_fixed_slot: false,
      extra_role_type: extraRoleType,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: data.phone?.trim() || '',
      email: cleanEmail,
      has_app_access: Boolean(data.has_app_access && cleanEmail),
      role: orgDef.defaultExtraRole,
      can_approve_activities: false,
      is_permanent_admin: false,
    };

    const next = [...directoryEntriesRef.current, created];
    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    await syncEntryToProfiles(created);
    if (!realAuthEmailRef.current && !AUTH_REQUIRED) {
      return { ok: true };
    }
    try {
      const { error } = await supabase
        .from('stake_directory_entries')
        .upsert(toDbDirectoryRow(created), { onConflict: 'id' });
      if (error) {
        return {
          ok: false,
          error: `Se guardó localmente pero falló la nube: ${error.message}`,
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de conexión con la base de datos: ${err.message}`
            : 'Error de conexión con la base de datos.',
      };
    }
  };

  const removeExtraDirectoryEntry = async (id: string): Promise<PersistenceResult> => {
    const target = directoryEntriesRef.current.find((e) => e.id === id && !e.is_fixed_slot);
    if (!target) return { ok: false, error: 'Integrante adicional no encontrado.' };

    const next = directoryEntriesRef.current.filter((e) => e.id !== id);
    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    if (target.email) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.email.toLowerCase() === target.email?.toLowerCase() ? { ...p, is_active: false } : p
        )
      );
    }

    if (!realAuthEmailRef.current && !AUTH_REQUIRED) {
      return { ok: true };
    }
    try {
      const { error } = await supabase.from('stake_directory_entries').delete().eq('id', id);
      if (error) {
        return { ok: false, error: `No se pudo eliminar en la nube: ${error.message}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? `Error de conexión con la base de datos: ${err.message}`
            : 'Error de conexión con la base de datos.',
      };
    }
  };

  const toggleDirectoryAppAccess = async (id: string): Promise<PersistenceResult> => {
    const target = directoryEntriesRef.current.find((e) => e.id === id);
    if (!target) return { ok: false, error: 'Registro no encontrado.' };

    if (target.is_permanent_admin || isSuperAdminEmail(target.email) || target.email === user.email) {
      return {
        ok: false,
        error: 'Por seguridad del sistema, no puedes desactivar a un administrador permanente ni a ti mismo.',
      };
    }

    const nextAccess = !target.has_app_access;
    if (nextAccess && (!target.email || !isValidGmail(target.email))) {
      return {
        ok: false,
        error: 'Ingresa un correo @gmail.com válido antes de activar el Acceso App.',
      };
    }

    return await updateDirectoryEntry(id, { has_app_access: nextAccess });
  };

  const linkDirectoryPerson = async (
    targetEntryId: string,
    sourceEntryId: string
  ): Promise<PersistenceResult> => {
    const source = directoryEntriesRef.current.find((e) => e.id === sourceEntryId);
    if (!source) return { ok: false, error: 'Persona de origen no encontrada.' };
    return await updateDirectoryEntry(targetEntryId, {
      first_name: source.first_name,
      last_name: source.last_name,
      phone: source.phone || '',
      email: source.email || '',
      linked_entry_id: source.id,
    });
  };

  const clearDirectoryEntryWithCascade = async (
    id: string,
    options?: { clearCounselors?: boolean }
  ): Promise<{ clearedLinkedCallings: string[]; clearedCounselors: string[]; error?: string }> => {
    const target = directoryEntries.find((e) => e.id === id);
    if (!target) return { clearedLinkedCallings: [], clearedCounselors: [] };

    const idsToClear = new Set<string>([id]);
    const clearedLinkedCallings: string[] = [];
    const clearedCounselors: string[] = [];
    const emailsToDeactivate = new Set<string>();

    // Si se limpia un miembro del Sumo Consejo, limpiar también cualquier puesto vinculado a él
    if (target.directory_org === 'SUMO_CONSEJO') {
      for (const entry of directoryEntries) {
        if (entry.linked_entry_id === target.id) {
          idsToClear.add(entry.id);
          clearedLinkedCallings.push(
            `${DIRECTORY_ORG_BY_CODE[entry.directory_org].shortLabel} · ${entry.calling}`
          );
        }
      }
    }

    // Si algún puesto limpiado es Presidente/a con consejeros y aplica cascada, limpiar sus 2 consejeros
    const shouldClearCounselors = options?.clearCounselors ?? true;
    if (shouldClearCounselors) {
      for (const clearId of Array.from(idsToClear)) {
        const clearedEntry = directoryEntries.find((e) => e.id === clearId);
        if (!clearedEntry) continue;
        const counselorKeys = PRESIDENCY_COUNSELOR_SLOTS[clearedEntry.slot_key];
        if (counselorKeys) {
          for (const cKey of counselorKeys) {
            const counselorEntry = directoryEntries.find((e) => e.slot_key === cKey);
            if (counselorEntry) {
              idsToClear.add(counselorEntry.id);
              clearedCounselors.push(counselorEntry.calling);
            }
          }
        }
      }
    }

    const updatedRows: StakeDirectoryEntry[] = [];
    const next = directoryEntriesRef.current.map((entry) => {
      if (!idsToClear.has(entry.id)) return entry;
      if (entry.email && !isSuperAdminEmail(entry.email)) {
        emailsToDeactivate.add(entry.email.toLowerCase());
      }
      const cleared: StakeDirectoryEntry = {
        ...entry,
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        has_app_access: false,
        linked_entry_id: undefined,
        assigned_unit: entry.directory_org === 'SUMO_CONSEJO' ? '' : entry.assigned_unit,
        assigned_org_notes:
          entry.directory_org === 'SUMO_CONSEJO' ? '' : entry.assigned_org_notes,
      };
      updatedRows.push(cleared);
      return cleared;
    });
    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    if (emailsToDeactivate.size > 0) {
      setProfiles((prev) =>
        prev.map((p) =>
          emailsToDeactivate.has(p.email.toLowerCase()) ? { ...p, is_active: false } : p
        )
      );
      try {
        for (const em of emailsToDeactivate) {
          await supabase.from('users_profiles').update({ is_active: false }).eq('email', em);
        }
      } catch {
        // Fallback local
      }
    }

    let cloudError: string | undefined;
    if (realAuthEmailRef.current || AUTH_REQUIRED) {
      try {
        if (updatedRows.length > 0) {
          const { error } = await supabase
            .from('stake_directory_entries')
            .upsert(updatedRows.map(toDbDirectoryRow), { onConflict: 'id' });
          if (error) {
            cloudError = error.message;
          }
        }
      } catch (err) {
        cloudError = err instanceof Error ? err.message : 'Error de conexión';
      }
    }

    return { clearedLinkedCallings, clearedCounselors, error: cloudError };
  };

  const releasePresidencyCounselors = async (
    presidentSlotKey: string
  ): Promise<{ clearedCounselors: string[]; error?: string }> => {
    const counselorKeys = PRESIDENCY_COUNSELOR_SLOTS[presidentSlotKey];
    if (!counselorKeys || counselorKeys.length === 0) return { clearedCounselors: [] };

    const clearedCounselors: string[] = [];
    const emailsToDeactivate = new Set<string>();
    const updatedRows: StakeDirectoryEntry[] = [];

    const next = directoryEntriesRef.current.map((entry) => {
      if (!counselorKeys.includes(entry.slot_key)) return entry;
      if (entry.email && !isSuperAdminEmail(entry.email)) {
        emailsToDeactivate.add(entry.email.toLowerCase());
      }
      clearedCounselors.push(entry.calling);
      const cleared: StakeDirectoryEntry = {
        ...entry,
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        has_app_access: false,
        linked_entry_id: undefined,
      };
      updatedRows.push(cleared);
      return cleared;
    });
    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    if (emailsToDeactivate.size > 0) {
      setProfiles((prev) =>
        prev.map((p) =>
          emailsToDeactivate.has(p.email.toLowerCase()) ? { ...p, is_active: false } : p
        )
      );
      try {
        for (const em of emailsToDeactivate) {
          await supabase.from('users_profiles').update({ is_active: false }).eq('email', em);
        }
      } catch {
        // Fallback local
      }
    }

    let cloudError: string | undefined;
    if (realAuthEmailRef.current || AUTH_REQUIRED) {
      try {
        if (updatedRows.length > 0) {
          const { error } = await supabase
            .from('stake_directory_entries')
            .upsert(updatedRows.map(toDbDirectoryRow), { onConflict: 'id' });
          if (error) {
            cloudError = error.message;
          }
        }
      } catch (err) {
        cloudError = err instanceof Error ? err.message : 'Error de conexión';
      }
    }

    return { clearedCounselors, error: cloudError };
  };

  const incompleteContactsCount = React.useMemo(
    () => directoryEntries.filter(isEntryIncomplete).length,
    [directoryEntries]
  );

  const canAccessSeminario =
    user.role === 'ADMIN' ||
    user.role === 'PRESIDENCIA' ||
    user.organization === 'MJ' ||
    user.organization === 'HJ';

  // En producción con Google OAuth activo (realAuthEmail !== null), SOLO pablosud52@gmail.com
  // tiene acceso al Selector de Cambio de Rol. En desarrollo/simulación local sin sesión OAuth,
  // permanece habilitado para pruebas.
  const canUseRoleSwitcher = realAuthEmail ? isSuperAdminEmail(realAuthEmail) : true;

  const allowedOrganizations: OrganizationCode[] = React.useMemo(() => {
    if (!user.is_active || user.role === 'NO_AUTORIZADO' || user.role === 'CONSULTA') return [];
    if (user.role === 'ADMIN' || user.role === 'PRESIDENCIA' || isSuperAdminEmail(user.email)) {
      return ['MJ', 'HJ', 'SEMINARIO', 'SS', 'PRIMARIA', 'JAS', 'AS', 'CFS', 'ESTACA'];
    }
    if (user.organization === 'MJ' || user.organization === 'HJ') {
      return [user.organization, 'SEMINARIO'];
    }
    return [user.organization];
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profiles,
        directoryEntries,
        incompleteContactsCount,
        authStatus,
        isAuthRequired: AUTH_REQUIRED,
        switchProfileById,
        updateUserProfile,
        addUserProfile,
        updateDirectoryEntry,
        addExtraDirectoryEntry,
        removeExtraDirectoryEntry,
        toggleDirectoryAppAccess,
        linkDirectoryPerson,
        clearDirectoryEntryWithCascade,
        releasePresidencyCounselors,
        signInWithGoogle,
        signOut,
        isSimulating,
        realAuthEmail,
        canUseRoleSwitcher,
        isRoleSwitcherVisible,
        toggleRoleSwitcherVisibility,
        allowedOrganizations,
        canAccessSeminario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return ctx;
}
