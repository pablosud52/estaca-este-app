import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  buildInitialDirectoryEntries,
  DEV_PROFILES,
  isSuperAdminEmail,
  SUPER_ADMIN_EMAIL,
} from '../data/seedData';
import { DIRECTORY_ORG_BY_CODE } from '../data/stakeOrgStructure';
import { isValidGmail } from '../lib/formatters';
import { supabase } from '../lib/supabase';
import {
  DirectoryOrgCode,
  ExtraRoleType,
  OrganizationCode,
  StakeDirectoryEntry,
  UserProfile,
} from '../types/database';

interface AuthContextValue {
  user: UserProfile;
  profiles: UserProfile[];
  directoryEntries: StakeDirectoryEntry[];
  incompleteContactsCount: number;
  switchProfileById: (profileId: string) => void;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  addUserProfile: (newProfile: Omit<UserProfile, 'id'>) => Promise<void>;
  updateDirectoryEntry: (id: string, updates: Partial<StakeDirectoryEntry>) => Promise<void>;
  addExtraDirectoryEntry: (
    org: DirectoryOrgCode,
    extraRoleType: ExtraRoleType,
    callingLabel: string,
    data: Pick<StakeDirectoryEntry, 'first_name' | 'last_name' | 'phone' | 'email' | 'has_app_access'>
  ) => Promise<{ ok: boolean; error?: string }>;
  removeExtraDirectoryEntry: (id: string) => Promise<void>;
  toggleDirectoryAppAccess: (id: string) => Promise<{ ok: boolean; error?: string }>;
  linkDirectoryPerson: (targetEntryId: string, sourceEntryId: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

const loadInitialDirectory = (): StakeDirectoryEntry[] => {
  if (typeof window === 'undefined') return buildInitialDirectoryEntries();
  try {
    const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StakeDirectoryEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback a semilla
  }
  return buildInitialDirectoryEntries();
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(DEV_PROFILES);
  const [directoryEntries, setDirectoryEntries] = useState<StakeDirectoryEntry[]>(loadInitialDirectory);
  const [user, setUser] = useState<UserProfile>(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return DEV_PROFILES.find((p) => p.id === savedId) || DEV_PROFILES.find((p) => p.id === 'lider-mj-01') || DEV_PROFILES[0];
  });
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [realAuthEmail, setRealAuthEmail] = useState<string | null>(null);
  const [isRoleSwitcherVisible, setIsRoleSwitcherVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(SWITCHER_VISIBILITY_KEY);
    return saved === null ? true : saved === 'true';
  });

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
      try {
        // 1. Verificar sesión real de Google OAuth si existe
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData?.session?.user?.email?.toLowerCase() || null;
        if (mounted && sessionEmail) {
          setRealAuthEmail(sessionEmail);
        }

        // 2. Sincronizar perfiles desde Supabase y asegurar correo oficial pablosud52@gmail.com
        const { data, error } = await supabase
          .from('users_profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (!error && data && data.length > 0 && mounted) {
          // Si en Supabase aún figuraba el correo anterior pablo.lamela@gmail.com, actualizarlo a pablosud52@gmail.com
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
              // Blindaje vitalicio para pablosud52@gmail.com sin importar su llamamiento u organización
              role: isSuper ? 'ADMIN' : (d.role as UserProfile['role']),
              is_permanent_admin: isSuper ? true : Boolean(d.is_permanent_admin),
              can_approve_activities: isSuper ? true : Boolean(d.can_approve_activities),
              is_active: isSuper ? true : Boolean(d.is_active),
            };
          });

          setProfiles((prev) => {
            const prevById = new Map(prev.map((item) => [item.id, item]));
            const merged: UserProfile[] = [
              ...DEV_PROFILES.filter((p) => !remoteEmails.has(p.email.toLowerCase())),
              ...normalizedRemote,
            ];
            return merged.map((item) => {
              const existing = prevById.get(item.id) || item;
              if (isSuperAdminEmail(existing.email)) {
                return {
                  ...existing,
                  email: SUPER_ADMIN_EMAIL,
                  role: 'ADMIN',
                  is_permanent_admin: true,
                  can_approve_activities: true,
                  is_active: true,
                };
              }
              return existing;
            });
          });
        }
      } catch {
        // Fallback silencioso a DEV_PROFILES en caso de desconexión local
      }
    }

    initAuthAndProfiles();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const email = session?.user?.email?.toLowerCase() || null;
      setRealAuthEmail(email);
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

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    switchProfileById(DEV_PROFILES[0].id);
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

  const updateDirectoryEntry = async (id: string, updates: Partial<StakeDirectoryEntry>) => {
    let updatedTarget: StakeDirectoryEntry | null = null;
    setDirectoryEntries((prev) => {
      const next = prev.map((entry) => {
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
      saveDirectoryLocal(next);
      return next;
    });

    if (updatedTarget) {
      await syncEntryToProfiles(updatedTarget);
      try {
        await supabase.from('stake_directory_entries').upsert(updatedTarget);
      } catch {
        // Fallback local
      }
    }
  };

  const addExtraDirectoryEntry = async (
    org: DirectoryOrgCode,
    extraRoleType: ExtraRoleType,
    callingLabel: string,
    data: Pick<StakeDirectoryEntry, 'first_name' | 'last_name' | 'phone' | 'email' | 'has_app_access'>
  ): Promise<{ ok: boolean; error?: string }> => {
    const orgDef = DIRECTORY_ORG_BY_CODE[org];
    const currentExtras = directoryEntries.filter((e) => e.directory_org === org && !e.is_fixed_slot);
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

    setDirectoryEntries((prev) => {
      const next = [...prev, created];
      saveDirectoryLocal(next);
      return next;
    });

    await syncEntryToProfiles(created);
    try {
      await supabase.from('stake_directory_entries').upsert(created);
    } catch {
      // Fallback local
    }
    return { ok: true };
  };

  const removeExtraDirectoryEntry = async (id: string) => {
    const target = directoryEntries.find((e) => e.id === id && !e.is_fixed_slot);
    if (!target) return;

    setDirectoryEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveDirectoryLocal(next);
      return next;
    });

    if (target.email) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.email.toLowerCase() === target.email?.toLowerCase() ? { ...p, is_active: false } : p
        )
      );
    }

    try {
      await supabase.from('stake_directory_entries').delete().eq('id', id);
    } catch {
      // Fallback local
    }
  };

  const toggleDirectoryAppAccess = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const target = directoryEntries.find((e) => e.id === id);
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

    await updateDirectoryEntry(id, { has_app_access: nextAccess });
    return { ok: true };
  };

  const linkDirectoryPerson = async (targetEntryId: string, sourceEntryId: string) => {
    const source = directoryEntries.find((e) => e.id === sourceEntryId);
    if (!source) return;
    await updateDirectoryEntry(targetEntryId, {
      first_name: source.first_name,
      last_name: source.last_name,
      phone: source.phone || '',
      email: source.email || '',
      linked_entry_id: source.id,
    });
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
        switchProfileById,
        updateUserProfile,
        addUserProfile,
        updateDirectoryEntry,
        addExtraDirectoryEntry,
        removeExtraDirectoryEntry,
        toggleDirectoryAppAccess,
        linkDirectoryPerson,
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
