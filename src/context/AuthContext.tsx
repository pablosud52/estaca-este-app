import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEV_PROFILES, isSuperAdminEmail, SUPER_ADMIN_EMAIL } from '../data/seedData';
import { supabase } from '../lib/supabase';
import { OrganizationCode, UserProfile } from '../types/database';

interface AuthContextValue {
  user: UserProfile;
  profiles: UserProfile[];
  switchProfileById: (profileId: string) => void;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  addUserProfile: (newProfile: Omit<UserProfile, 'id'>) => Promise<void>;
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(DEV_PROFILES);
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
    if (!user.is_active || user.role === 'NO_AUTORIZADO') return [];
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
        switchProfileById,
        updateUserProfile,
        addUserProfile,
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
