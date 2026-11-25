import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  buildEmptyDirectoryEntries,
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
import { recordAuditLog, recordSessionLoginOnce } from '../services/auditLogService';
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
  directoryLoadError: string | null;
  isDirectoryLoading: boolean;
  reloadDirectory: () => Promise<void>;
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
    const normalizedCalling =
      entry.directory_org === 'SUMO_CONSEJO' ? 'Miembro del Sumo Consejo' : entry.calling;
    if (entry.slot_key === 'pres-presidente') {
      return {
        ...entry,
        calling: normalizedCalling,
        role: 'ADMIN',
        is_permanent_admin: true,
        can_approve_activities: true,
      };
    }
    if (entry.slot_key === 'pres-secretario') {
      return {
        ...entry,
        calling: normalizedCalling,
        role: 'ADMIN',
        is_permanent_admin: true,
        can_approve_activities: Boolean(entry.can_approve_activities),
      };
    }
    if (entry.slot_key === 'pres-secretario-financiero') {
      return {
        ...entry,
        calling: normalizedCalling,
        role: isSuper ? 'ADMIN' : entry.role === 'ADMIN' ? 'PRESIDENCIA' : entry.role,
        is_permanent_admin: isSuper,
        can_approve_activities: isSuper ? true : entry.can_approve_activities,
      };
    }
    return normalizedCalling !== entry.calling ? { ...entry, calling: normalizedCalling } : entry;
  });

const ROLE_PRIORITY: Record<UserProfile['role'], number> = {
  ADMIN: 4,
  PRESIDENCIA: 3,
  LIDER: 2,
  CONSULTA: 1,
  NO_AUTORIZADO: 0,
};

const loadInitialDirectory = (): StakeDirectoryEntry[] => {
  if (typeof window === 'undefined') {
    return AUTH_REQUIRED ? buildEmptyDirectoryEntries() : buildInitialDirectoryEntries();
  }
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
  return normalizeDirectoryEntries(
    AUTH_REQUIRED ? buildEmptyDirectoryEntries() : buildInitialDirectoryEntries()
  );
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
  const base = buildEmptyDirectoryEntries();
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
  const baseIds = new Set(base.map((b) => b.id));

  const mergedFixed = base.map((slot) => {
    const remote = remoteById.get(slot.id);
    if (!remote) return slot;
    return {
      ...slot,
      ...remote,
      calling: slot.directory_org === 'SUMO_CONSEJO' ? slot.calling : remote.calling || slot.calling,
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
  const [directoryLoadError, setDirectoryLoadError] = useState<string | null>(null);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState<boolean>(false);
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
    if (authStatus === 'authenticated' && user.is_active && user.role !== 'NO_AUTORIZADO') {
      void recordSessionLoginOnce(user);
    }
  }, [authStatus, user]);

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

        // 2. Disparar directorio en paralelo SOLO si hay sesión o no se requiere auth (evita query innecesaria en Login)
        const shouldFetchDirectory = Boolean(sessionEmail || !AUTH_REQUIRED);
        if (mounted && shouldFetchDirectory) {
          setIsDirectoryLoading(true);
        }
        const directoryPromise = shouldFetchDirectory
          ? supabase.from('stake_directory_entries').select('*')
          : null;

        // Sincronizar perfiles desde Supabase y asegurar correo oficial pablosud52@gmail.com
        const { data, error } = await supabase
          .from('users_profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0 && mounted) {
          const legacyRow = data.find(
            (d) => String(d.email || '').toLowerCase() === 'pablo.lamela@gmail.com'
          );
          if (legacyRow) {
            void supabase
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

        // 3. Resolver directorio en segundo plano (sin demorar el render del Dashboard)
        if (directoryPromise) {
          void Promise.resolve(directoryPromise)
            .then(({ data: dirData, error: dirError }) => {
              if (!mounted) return;
              if (dirError && (sessionEmail || AUTH_REQUIRED)) {
                setDirectoryLoadError(
                  `No se pudo cargar el directorio desde la nube (${dirError.message}).`
                );
              } else if (
                !dirError &&
                Array.isArray(dirData) &&
                (dirData.length > 0 || sessionEmail || AUTH_REQUIRED)
              ) {
                const mergedDir = mergeDirectoryFromRemote(dirData as StakeDirectoryEntry[]);
                directoryEntriesRef.current = mergedDir;
                setDirectoryEntries(mergedDir);
                saveDirectoryLocal(mergedDir);
                setDirectoryLoadError(null);
              }
            })
            .catch((err) => {
              if (mounted && (sessionEmail || AUTH_REQUIRED)) {
                setDirectoryLoadError(
                  err instanceof Error
                    ? `Error de conexión al cargar el directorio (${err.message}).`
                    : 'Error de conexión al cargar el directorio.'
                );
              }
            })
            .finally(() => {
              if (mounted) {
                setIsDirectoryLoading(false);
              }
            });
        }
      } catch (err) {
        if (mounted && (sessionEmail || AUTH_REQUIRED)) {
          setDirectoryLoadError(
            err instanceof Error
              ? `Error de conexión al cargar el directorio (${err.message}).`
              : 'Error de conexión al cargar el directorio.'
          );
        }
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
      const prevEmail = realAuthEmailRef.current;
      const email = session?.user?.email?.toLowerCase() || null;
      setRealAuthEmail(email);
      if (email) {
        const resolved = resolveUserByEmail(email, profilesRef.current);
        setUser(resolved);
        setIsSimulating(false);
        setAuthStatus('authenticated');
        if (!prevEmail || prevEmail !== email) {
          void reloadDirectory();
        }
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

  const reloadDirectory = async () => {
    setIsDirectoryLoading(true);
    try {
      const { data: dirData, error: dirError } = await supabase
        .from('stake_directory_entries')
        .select('*');
      if (dirError) {
        setDirectoryLoadError(
          `No se pudo cargar el directorio desde la nube (${dirError.message}).`
        );
        return;
      }
      if (Array.isArray(dirData)) {
        const mergedDir = mergeDirectoryFromRemote(dirData as StakeDirectoryEntry[]);
        directoryEntriesRef.current = mergedDir;
        setDirectoryEntries(mergedDir);
        saveDirectoryLocal(mergedDir);
        setDirectoryLoadError(null);
      }
    } catch (err) {
      setDirectoryLoadError(
        err instanceof Error
          ? `Error de conexión al cargar el directorio (${err.message}).`
          : 'Error de conexión al cargar el directorio.'
      );
    } finally {
      setIsDirectoryLoading(false);
    }
  };

  const reconcileProfilesForEmails = async (
    rawEmails: Array<string | undefined | null>,
    entriesSnapshot: StakeDirectoryEntry[]
  ): Promise<PersistenceResult> => {
    const uniqueEmails = Array.from(
      new Set(
        rawEmails
          .map((e) => (e || '').trim().toLowerCase())
          .filter((e) => Boolean(e) && isValidGmail(e))
      )
    );
    if (uniqueEmails.length === 0) return { ok: true };

    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);
    const localProfilePatches: Array<
      | { kind: 'deactivate'; email: string }
      | { kind: 'upsert'; profile: UserProfile }
    > = [];

    for (const email of uniqueEmails) {
      const matching = entriesSnapshot.filter(
        (entry) => (entry.email || '').trim().toLowerCase() === email
      );

      if (matching.length === 0) {
        if (isSuperAdminEmail(email)) continue;
        if (shouldPersistCloud) {
          try {
            const { error } = await supabase
              .from('users_profiles')
              .update({ is_active: false })
              .eq('email', email);
            if (error) {
              return {
                ok: false,
                error: `No se pudo desactivar el perfil en la nube (${error.message}).`,
              };
            }
          } catch (err) {
            return {
              ok: false,
              error:
                err instanceof Error
                  ? `Error de conexión al desactivar perfil: ${err.message}`
                  : 'Error de conexión al desactivar perfil.',
            };
          }
        }
        localProfilePatches.push({ kind: 'deactivate', email });
        continue;
      }

      const sorted = [...matching].sort((a, b) => {
        const accessDiff =
          Number(b.has_app_access || b.is_permanent_admin) -
          Number(a.has_app_access || a.is_permanent_admin);
        if (accessDiff !== 0) return accessDiff;
        const roleDiff = ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role];
        if (roleDiff !== 0) return roleDiff;
        return (
          Number(DIRECTORY_ORG_BY_CODE[b.directory_org].hasBudget) -
          Number(DIRECTORY_ORG_BY_CODE[a.directory_org].hasBudget)
        );
      });

      const primary = sorted[0];
      const orgDef = DIRECTORY_ORG_BY_CODE[primary.directory_org];
      const isSuper = isSuperAdminEmail(email);
      const effectivePermanent = isSuper || matching.some((e) => e.is_permanent_admin);
      const effectiveRole: UserProfile['role'] =
        isSuper || effectivePermanent ? 'ADMIN' : primary.role;
      const effectiveActive =
        isSuper || effectivePermanent || matching.some((e) => e.has_app_access);
      const effectiveApprove =
        isSuper ||
        effectiveRole === 'ADMIN' ||
        matching.some((e) => e.can_approve_activities);
      const effectiveOrg: OrganizationCode = isSuper ? 'TODAS' : orgDef.budgetOrgCode;
      const fullName =
        `${primary.first_name.trim()} ${primary.last_name.trim()}`.trim() || primary.calling;

      if (shouldPersistCloud) {
        try {
          const { error } = await supabase.from('users_profiles').upsert(
            {
              email,
              full_name: fullName,
              first_name: primary.first_name.trim(),
              last_name: primary.last_name.trim(),
              phone: primary.phone?.trim() || null,
              calling: primary.calling,
              organization: effectiveOrg,
              role: effectiveRole,
              can_approve_activities: effectiveApprove,
              is_permanent_admin: effectivePermanent,
              is_active: effectiveActive,
            },
            { onConflict: 'email' }
          );
          if (error) {
            return {
              ok: false,
              error: `No se pudo sincronizar el perfil de acceso en la nube (${error.message}).`,
            };
          }
        } catch (err) {
          return {
            ok: false,
            error:
              err instanceof Error
                ? `Error de conexión al sincronizar perfil: ${err.message}`
                : 'Error de conexión al sincronizar perfil.',
          };
        }
      }

      localProfilePatches.push({
        kind: 'upsert',
        profile: {
          id: `user-${primary.id}`,
          email,
          full_name: fullName,
          first_name: primary.first_name.trim(),
          last_name: primary.last_name.trim(),
          phone: primary.phone?.trim() || undefined,
          calling: primary.calling,
          organization: effectiveOrg,
          role: effectiveRole,
          can_approve_activities: effectiveApprove,
          is_permanent_admin: effectivePermanent,
          is_active: effectiveActive,
        },
      });
    }

    if (localProfilePatches.length > 0) {
      setProfiles((prev) => {
        let nextProfiles = [...prev];
        for (const patch of localProfilePatches) {
          if (patch.kind === 'deactivate') {
            nextProfiles = nextProfiles.map((p) =>
              p.email.toLowerCase() === patch.email ? { ...p, is_active: false } : p
            );
          } else {
            const existingIdx = nextProfiles.findIndex(
              (p) => p.email.toLowerCase() === patch.profile.email
            );
            if (existingIdx >= 0) {
              nextProfiles[existingIdx] = {
                ...nextProfiles[existingIdx],
                ...patch.profile,
                id: nextProfiles[existingIdx].id,
              };
            } else {
              nextProfiles.push(patch.profile);
            }
          }
        }
        return nextProfiles;
      });
    }

    return { ok: true };
  };

  const updateDirectoryEntry = async (
    id: string,
    updates: Partial<StakeDirectoryEntry>
  ): Promise<PersistenceResult> => {
    const prevEntries = directoryEntriesRef.current;
    const prevTarget = prevEntries.find((entry) => entry.id === id);
    if (!prevTarget) {
      return { ok: false, error: 'Registro no encontrado en el directorio.' };
    }

    const nextEmail =
      updates.email !== undefined
        ? updates.email.trim().toLowerCase()
        : (prevTarget.email || '').trim().toLowerCase();
    const isSuper = isSuperAdminEmail(nextEmail);
    const wasSuperOnFinanceSlot =
      prevTarget.slot_key === 'pres-secretario-financiero' &&
      isSuperAdminEmail(prevTarget.email) &&
      !isSuper;
    const isPermAdmin = isSuper
      ? true
      : wasSuperOnFinanceSlot
        ? false
        : updates.is_permanent_admin ?? prevTarget.is_permanent_admin;
    const autoAccessForPermAdmin = Boolean(isPermAdmin && nextEmail);

    const updatedTarget: StakeDirectoryEntry = {
      ...prevTarget,
      ...updates,
      email: nextEmail,
      role:
        isSuper || isPermAdmin
          ? 'ADMIN'
          : wasSuperOnFinanceSlot
            ? updates.role ?? (prevTarget.role === 'ADMIN' ? 'PRESIDENCIA' : prevTarget.role)
            : updates.role ?? prevTarget.role,
      is_permanent_admin: isPermAdmin,
      can_approve_activities: isSuper
        ? true
        : updates.can_approve_activities ?? prevTarget.can_approve_activities,
      has_app_access:
        isSuper || autoAccessForPermAdmin
          ? true
          : nextEmail
            ? updates.has_app_access ?? prevTarget.has_app_access
            : false,
    };

    const isChangingLink = Object.prototype.hasOwnProperty.call(updates, 'linked_entry_id');
    const contactFieldUpdated =
      !isChangingLink &&
      (updates.first_name !== undefined ||
        updates.last_name !== undefined ||
        updates.phone !== undefined ||
        updates.email !== undefined);

    const linkedPeerIds = new Set<string>();
    if (contactFieldUpdated) {
      const groupRootId = updatedTarget.linked_entry_id || updatedTarget.id;
      for (const entry of prevEntries) {
        if (entry.id === updatedTarget.id) continue;
        if (
          entry.id === updatedTarget.linked_entry_id ||
          entry.linked_entry_id === updatedTarget.id ||
          (updatedTarget.linked_entry_id && entry.linked_entry_id === groupRootId)
        ) {
          linkedPeerIds.add(entry.id);
        }
      }
    }

    const changedRows: StakeDirectoryEntry[] = [];
    const prevChangedRows: StakeDirectoryEntry[] = [];
    const affectedEmails = new Set<string>();
    if (prevTarget.email) affectedEmails.add(prevTarget.email);
    if (updatedTarget.email) affectedEmails.add(updatedTarget.email);

    const next = prevEntries.map((entry) => {
      if (entry.id === id) {
        prevChangedRows.push(entry);
        changedRows.push(updatedTarget);
        return updatedTarget;
      }
      if (linkedPeerIds.has(entry.id)) {
        const peerEmail =
          updates.email !== undefined
            ? nextEmail
            : (entry.email || '').trim().toLowerCase();
        const peerIsSuper = isSuperAdminEmail(peerEmail);
        const peerIsPerm = peerIsSuper ? true : entry.is_permanent_admin;
        const syncedPeer: StakeDirectoryEntry = {
          ...entry,
          first_name:
            updates.first_name !== undefined ? updatedTarget.first_name : entry.first_name,
          last_name:
            updates.last_name !== undefined ? updatedTarget.last_name : entry.last_name,
          phone: updates.phone !== undefined ? updatedTarget.phone : entry.phone,
          email: peerEmail,
          has_app_access:
            peerIsSuper || (peerIsPerm && Boolean(peerEmail))
              ? true
              : peerEmail
                ? entry.has_app_access
                : false,
        };
        if (entry.email) affectedEmails.add(entry.email);
        if (syncedPeer.email) affectedEmails.add(syncedPeer.email);
        prevChangedRows.push(entry);
        changedRows.push(syncedPeer);
        return syncedPeer;
      }
      return entry;
    });

    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);
    if (shouldPersistCloud) {
      try {
        const { error } = await supabase
          .from('stake_directory_entries')
          .upsert(changedRows.map(toDbDirectoryRow), { onConflict: 'id' });
        if (error) {
          return {
            ok: false,
            error: `No se pudo guardar en la base de datos (${error.message}).`,
          };
        }
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? `Error de conexión con la base de datos: ${err.message}`
              : 'Error de conexión con la base de datos.',
        };
      }

      const profileRes = await reconcileProfilesForEmails(Array.from(affectedEmails), next);
      if (!profileRes.ok) {
        // Rollback best-effort en stake_directory_entries y users_profiles para mantener consistencia
        try {
          await supabase
            .from('stake_directory_entries')
            .upsert(prevChangedRows.map(toDbDirectoryRow), { onConflict: 'id' });
          await reconcileProfilesForEmails(Array.from(affectedEmails), prevEntries);
        } catch {
          // Best-effort rollback
        }
        return profileRes;
      }
    } else {
      await reconcileProfilesForEmails(Array.from(affectedEmails), next);
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    const personLabel =
      `${updatedTarget.first_name || ''} ${updatedTarget.last_name || ''}`.trim() ||
      updatedTarget.calling;
    if (updates.has_app_access !== undefined && Object.keys(updates).length === 1) {
      void recordAuditLog({
        actor: user,
        actionType: 'UPDATE',
        section: 'DIRECTORIO',
        summary: `${updates.has_app_access ? 'Activó' : 'Desactivó'} Acceso App de ${personLabel} (${updatedTarget.calling})`,
      });
    } else {
      void recordAuditLog({
        actor: user,
        actionType: 'UPDATE',
        section: 'DIRECTORIO',
        summary: `Actualizó datos de ${updatedTarget.calling}: ${personLabel}`,
      });
    }

    return { ok: true };
  };

  const addExtraDirectoryEntry = async (
    org: DirectoryOrgCode,
    extraRoleType: ExtraRoleType,
    callingLabel: string,
    data: Pick<StakeDirectoryEntry, 'first_name' | 'last_name' | 'phone' | 'email' | 'has_app_access'>
  ): Promise<PersistenceResult> => {
    const orgDef = DIRECTORY_ORG_BY_CODE[org];
    const currentEntries = directoryEntriesRef.current;
    const currentExtras = currentEntries.filter(
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

    const existingSlotKeys = new Set(currentEntries.map((e) => e.slot_key));
    let slotIndex = 1;
    while (existingSlotKeys.has(`${org.toLowerCase()}-extra-${slotIndex}`)) {
      slotIndex += 1;
    }

    const created: StakeDirectoryEntry = {
      id: `dir-${org.toLowerCase()}-extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      directory_org: org,
      slot_key: `${org.toLowerCase()}-extra-${slotIndex}`,
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

    const next = [...currentEntries, created];
    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);

    if (shouldPersistCloud) {
      try {
        const { error } = await supabase
          .from('stake_directory_entries')
          .upsert(toDbDirectoryRow(created), { onConflict: 'id' });
        if (error) {
          return {
            ok: false,
            error: `No se pudo guardar en la nube (${error.message}).`,
          };
        }
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? `Error de conexión con la base de datos: ${err.message}`
              : 'Error de conexión con la base de datos.',
        };
      }

      const profileRes = await reconcileProfilesForEmails([created.email], next);
      if (!profileRes.ok) {
        try {
          await supabase.from('stake_directory_entries').delete().eq('id', created.id);
        } catch {
          // Best-effort rollback
        }
        return profileRes;
      }
    } else {
      await reconcileProfilesForEmails([created.email], next);
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    void recordAuditLog({
      actor: user,
      actionType: 'CREATE',
      section: 'DIRECTORIO',
      summary: `Agregó llamamiento adicional: ${created.calling} (${created.first_name} ${created.last_name})`,
    });

    return { ok: true };
  };

  const removeExtraDirectoryEntry = async (id: string): Promise<PersistenceResult> => {
    const prevEntries = directoryEntriesRef.current;
    const target = prevEntries.find((e) => e.id === id && !e.is_fixed_slot);
    if (!target) return { ok: false, error: 'Integrante adicional no encontrado.' };

    const next = prevEntries
      .filter((e) => e.id !== id)
      .map((e) => (e.linked_entry_id === id ? { ...e, linked_entry_id: undefined } : e));

    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);
    if (shouldPersistCloud) {
      try {
        const { error } = await supabase.from('stake_directory_entries').delete().eq('id', id);
        if (error) {
          return { ok: false, error: `No se pudo eliminar en la nube: ${error.message}` };
        }
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? `Error de conexión con la base de datos: ${err.message}`
              : 'Error de conexión con la base de datos.',
        };
      }

      const profileRes = await reconcileProfilesForEmails([target.email], next);
      if (!profileRes.ok) {
        try {
          await supabase
            .from('stake_directory_entries')
            .upsert(toDbDirectoryRow(target), { onConflict: 'id' });
        } catch {
          // Best-effort rollback
        }
        return profileRes;
      }
    } else {
      await reconcileProfilesForEmails([target.email], next);
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    void recordAuditLog({
      actor: user,
      actionType: 'DELETE',
      section: 'DIRECTORIO',
      summary: `Quitó llamamiento adicional: ${target.calling} (${target.first_name} ${target.last_name})`,
    });

    return { ok: true };
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
    if (targetEntryId === sourceEntryId) {
      return { ok: false, error: 'No puedes vincular un puesto consigo mismo.' };
    }
    const source = directoryEntriesRef.current.find((e) => e.id === sourceEntryId);
    if (!source) return { ok: false, error: 'Persona de origen no encontrada.' };
    const canonicalRootId =
      source.linked_entry_id && source.linked_entry_id !== targetEntryId
        ? source.linked_entry_id
        : source.id;
    return await updateDirectoryEntry(targetEntryId, {
      first_name: source.first_name,
      last_name: source.last_name,
      phone: source.phone || '',
      email: source.email || '',
      linked_entry_id: canonicalRootId,
    });
  };

  const clearDirectoryEntryWithCascade = async (
    id: string,
    options?: { clearCounselors?: boolean }
  ): Promise<{ clearedLinkedCallings: string[]; clearedCounselors: string[]; error?: string }> => {
    const prevEntries = directoryEntriesRef.current;
    const target = prevEntries.find((e) => e.id === id);
    if (!target) return { clearedLinkedCallings: [], clearedCounselors: [] };

    const idsToClear = new Set<string>([id]);
    const clearedLinkedCallings: string[] = [];
    const clearedCounselors: string[] = [];
    const affectedEmails = new Set<string>();

    // Si se limpia cualquier puesto origen, limpiar también cualquier puesto vinculado a él
    for (const entry of prevEntries) {
      if (entry.linked_entry_id === target.id && !idsToClear.has(entry.id)) {
        idsToClear.add(entry.id);
        clearedLinkedCallings.push(
          `${DIRECTORY_ORG_BY_CODE[entry.directory_org].shortLabel} · ${entry.calling}`
        );
      }
    }

    // Si algún puesto limpiado es Presidente/a con consejeros y aplica cascada, limpiar sus 2 consejeros
    const shouldClearCounselors = options?.clearCounselors ?? true;
    if (shouldClearCounselors) {
      for (const clearId of Array.from(idsToClear)) {
        const clearedEntry = prevEntries.find((e) => e.id === clearId);
        if (!clearedEntry) continue;
        const counselorKeys = PRESIDENCY_COUNSELOR_SLOTS[clearedEntry.slot_key];
        if (counselorKeys) {
          for (const cKey of counselorKeys) {
            const counselorEntry = prevEntries.find((e) => e.slot_key === cKey);
            if (counselorEntry && !idsToClear.has(counselorEntry.id)) {
              idsToClear.add(counselorEntry.id);
              clearedCounselors.push(counselorEntry.calling);
            }
          }
        }
      }
    }

    const updatedRows: StakeDirectoryEntry[] = [];
    const prevRows: StakeDirectoryEntry[] = [];
    const next = prevEntries.map((entry) => {
      if (!idsToClear.has(entry.id)) return entry;
      if (entry.email) {
        affectedEmails.add(entry.email.toLowerCase());
      }
      prevRows.push(entry);
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

    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);
    if (shouldPersistCloud) {
      try {
        if (updatedRows.length > 0) {
          const { error } = await supabase
            .from('stake_directory_entries')
            .upsert(updatedRows.map(toDbDirectoryRow), { onConflict: 'id' });
          if (error) {
            return {
              clearedLinkedCallings: [],
              clearedCounselors: [],
              error: `No se pudo vaciar en la nube (${error.message}).`,
            };
          }
        }
      } catch (err) {
        return {
          clearedLinkedCallings: [],
          clearedCounselors: [],
          error: err instanceof Error ? err.message : 'Error de conexión',
        };
      }

      const profileRes = await reconcileProfilesForEmails(Array.from(affectedEmails), next);
      if (!profileRes.ok) {
        try {
          if (prevRows.length > 0) {
            await supabase
              .from('stake_directory_entries')
              .upsert(prevRows.map(toDbDirectoryRow), { onConflict: 'id' });
          }
          await reconcileProfilesForEmails(Array.from(affectedEmails), prevEntries);
        } catch {
          // Best-effort rollback
        }
        return {
          clearedLinkedCallings: [],
          clearedCounselors: [],
          error: profileRes.error,
        };
      }
    } else {
      await reconcileProfilesForEmails(Array.from(affectedEmails), next);
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    const auditParts: string[] = [];
    if (clearedCounselors.length > 0) {
      auditParts.push(`consejeros: ${clearedCounselors.join(', ')}`);
    }
    if (clearedLinkedCallings.length > 0) {
      auditParts.push(`vínculos: ${clearedLinkedCallings.join(', ')}`);
    }
    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'DIRECTORIO',
      summary:
        auditParts.length > 0
          ? `Vació puesto ${target.calling} (${auditParts.join(' · ')})`
          : `Vació puesto ${target.calling}`,
    });

    return { clearedLinkedCallings, clearedCounselors };
  };

  const releasePresidencyCounselors = async (
    presidentSlotKey: string
  ): Promise<{ clearedCounselors: string[]; error?: string }> => {
    const counselorKeys = PRESIDENCY_COUNSELOR_SLOTS[presidentSlotKey];
    if (!counselorKeys || counselorKeys.length === 0) return { clearedCounselors: [] };

    const prevEntries = directoryEntriesRef.current;
    const clearedCounselors: string[] = [];
    const affectedEmails = new Set<string>();
    const updatedRows: StakeDirectoryEntry[] = [];
    const prevRows: StakeDirectoryEntry[] = [];

    const next = prevEntries.map((entry) => {
      if (!counselorKeys.includes(entry.slot_key)) return entry;
      if (entry.email) {
        affectedEmails.add(entry.email.toLowerCase());
      }
      clearedCounselors.push(entry.calling);
      prevRows.push(entry);
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

    const shouldPersistCloud = Boolean(realAuthEmailRef.current || AUTH_REQUIRED);
    if (shouldPersistCloud) {
      try {
        if (updatedRows.length > 0) {
          const { error } = await supabase
            .from('stake_directory_entries')
            .upsert(updatedRows.map(toDbDirectoryRow), { onConflict: 'id' });
          if (error) {
            return {
              clearedCounselors: [],
              error: `No se pudieron liberar los consejeros en la nube (${error.message}).`,
            };
          }
        }
      } catch (err) {
        return {
          clearedCounselors: [],
          error: err instanceof Error ? err.message : 'Error de conexión',
        };
      }

      const profileRes = await reconcileProfilesForEmails(Array.from(affectedEmails), next);
      if (!profileRes.ok) {
        try {
          if (prevRows.length > 0) {
            await supabase
              .from('stake_directory_entries')
              .upsert(prevRows.map(toDbDirectoryRow), { onConflict: 'id' });
          }
          await reconcileProfilesForEmails(Array.from(affectedEmails), prevEntries);
        } catch {
          // Best-effort rollback
        }
        return {
          clearedCounselors: [],
          error: profileRes.error,
        };
      }
    } else {
      await reconcileProfilesForEmails(Array.from(affectedEmails), next);
    }

    directoryEntriesRef.current = next;
    setDirectoryEntries(next);
    saveDirectoryLocal(next);

    void recordAuditLog({
      actor: user,
      actionType: 'UPDATE',
      section: 'DIRECTORIO',
      summary: `Liberó consejeros de Presidencia (${clearedCounselors.join(', ')})`,
    });

    return { clearedCounselors };
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
        directoryLoadError,
        isDirectoryLoading,
        reloadDirectory,
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
