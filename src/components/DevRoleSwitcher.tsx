import React, { useEffect, useRef, useState } from 'react';
import { Shield, Users, UserCheck, Lock, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEV_PROFILES, isSuperAdminEmail } from '../data/seedData';
import { OrganizationCode, UserRole } from '../types/database';

export interface SimplifiedRoleItem {
  id: string;
  label: string;
  badge: string;
  role: UserRole;
  organization: OrganizationCode;
  is_super_admin?: boolean;
}

/**
 * Listado canónico y simplificado de roles para el conmutador de Super Admin.
 * Orden estricto (de arriba hacia abajo):
 * 1. Super Admin
 * 2. Admin
 * 3. Presidencia de Estaca
 * 4. Sociedad de Socorro
 * 5. Hombres Jóvenes
 * 6. Mujeres Jóvenes
 * 7. Primaria
 * 8. Jóvenes Adultos Solteros
 * 9. Adultos Solteros
 * 10. Centro FamilySearch
 */
export const SIMPLIFIED_ROLES: SimplifiedRoleItem[] = [
  {
    id: 'admin-pablo-01',
    label: 'Super Admin',
    badge: 'SUPER ADMIN',
    role: 'ADMIN',
    organization: 'TODAS',
    is_super_admin: true,
  },
  {
    id: 'admin-presidente-01',
    label: 'Admin',
    badge: 'ADMIN',
    role: 'ADMIN',
    organization: 'TODAS',
  },
  {
    id: 'presidencia-consejero1-01',
    label: 'Presidencia de Estaca',
    badge: 'PRESIDENCIA',
    role: 'PRESIDENCIA',
    organization: 'TODAS',
  },
  {
    id: 'lider-ss-01',
    label: 'Sociedad de Socorro',
    badge: 'SS',
    role: 'LIDER',
    organization: 'SS',
  },
  {
    id: 'lider-hj-01',
    label: 'Hombres Jóvenes',
    badge: 'HJ',
    role: 'LIDER',
    organization: 'HJ',
  },
  {
    id: 'lider-mj-01',
    label: 'Mujeres Jóvenes',
    badge: 'MJ',
    role: 'LIDER',
    organization: 'MJ',
  },
  {
    id: 'lider-primaria-01',
    label: 'Primaria',
    badge: 'PRIMARIA',
    role: 'LIDER',
    organization: 'PRIMARIA',
  },
  {
    id: 'lider-jas-01',
    label: 'Jóvenes Adultos Solteros',
    badge: 'JAS',
    role: 'LIDER',
    organization: 'JAS',
  },
  {
    id: 'lider-as-01',
    label: 'Adultos Solteros',
    badge: 'AS',
    role: 'LIDER',
    organization: 'AS',
  },
  {
    id: 'lider-cfs-01',
    label: 'Centro FamilySearch',
    badge: 'CFS',
    role: 'LIDER',
    organization: 'CFS',
  },
];

export const DevRoleSwitcher: React.FC = () => {
  const { user, switchProfileById, canUseRoleSwitcher, isRoleSwitcherVisible, profiles } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierre automático al hacer clic fuera del menú o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // En producción, solo pablosud52@gmail.com tiene acceso al cambio rápido de rol
  if (!canUseRoleSwitcher || !isRoleSwitcherVisible) {
    return null;
  }

  const activeItem = SIMPLIFIED_ROLES.find((item) => {
    const targetProfile =
      profiles.find((p) => p.id === item.id) ||
      DEV_PROFILES.find((p) => p.id === item.id);
    return targetProfile
      ? user.email.toLowerCase() === targetProfile.email.toLowerCase()
      : false;
  });

  const activeTriggerLabel =
    activeItem?.label ??
    (user.role === 'ADMIN'
      ? isSuperAdminEmail(user.email)
        ? 'Super Admin'
        : 'Admin'
      : user.role === 'PRESIDENCIA'
      ? 'Presidencia de Estaca'
      : user.organization);

  const activeTriggerBadge =
    activeItem?.badge ??
    (user.role === 'ADMIN'
      ? isSuperAdminEmail(user.email)
        ? 'SUPER ADMIN'
        : 'ADMIN'
      : user.role === 'LIDER'
      ? user.organization
      : user.role);

  const getRoleBadgeStyle = (role: UserRole, isSuperAdmin?: boolean) => {
    if (isSuperAdmin) {
      return 'bg-amber-400/20 text-amber-200 border-amber-300/40';
    }
    switch (role) {
      case 'ADMIN':
        return 'bg-sky-300/20 text-sky-100 border-sky-200/40';
      case 'PRESIDENCIA':
        return 'bg-white/15 text-white border-white/25';
      case 'LIDER':
      default:
        return 'bg-sky-400/15 text-sky-200 border-sky-300/30';
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="dev-role-switcher"
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Expanded Menu */}
      {isOpen && (
        <div
          data-testid="dev-role-menu"
          className="mb-2.5 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-gradient-to-br from-[#083563] via-[#072B52] to-[#051E3B] backdrop-blur-md text-white shadow-2xl border border-white/15 overflow-hidden transition-all duration-200 ease-out-expo origin-bottom-right"
        >
          <div className="px-4 py-3 bg-white/5 border-b border-white/12 flex items-center justify-between">
            <span className="text-xs font-extrabold tracking-wider uppercase text-white">
              Selector de Rol
            </span>
            <span className="text-[10px] font-mono bg-white/15 text-sky-200 border border-white/20 px-2 py-0.5 rounded-full font-bold">
              Vista previa
            </span>
          </div>

          <div
            data-testid="dev-role-list"
            className="max-h-96 overflow-y-auto divide-y divide-white/10 p-1.5 space-y-0.5"
          >
            {SIMPLIFIED_ROLES.map((item) => {
              const targetProfile =
                profiles.find((p) => p.id === item.id) ||
                DEV_PROFILES.find((p) => p.id === item.id);
              const isSelected = targetProfile
                ? user.email.toLowerCase() === targetProfile.email.toLowerCase()
                : false;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`switch-role-${item.id}`}
                  onClick={() => {
                    switchProfileById(item.id);
                    setIsOpen(false);
                  }}
                  className={`pressable w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition ${
                    isSelected
                      ? 'bg-white/15 border border-sky-300/40 text-white shadow-sm'
                      : 'border border-transparent hover:bg-white/10 text-sky-100/85'
                  }`}
                >
                  <div className="w-[92px] flex-shrink-0 flex items-center justify-start">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${getRoleBadgeStyle(
                        item.role,
                        item.is_super_admin
                      )}`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <span className="text-xs font-bold truncate min-w-0 flex-1 text-left">
                    {item.label}
                  </span>

                  {isSelected && <Check className="w-4 h-4 text-sky-300 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Pill Trigger */}
      <button
        type="button"
        data-testid="dev-role-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className="pressable flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#083563] via-[#072B52] to-[#051E3B] text-white shadow-xl border border-white/15 backdrop-blur-md text-xs font-semibold hover:brightness-110 transition"
      >
        {user.role === 'ADMIN' ? (
          <Shield className="w-3.5 h-3.5 text-sky-300" />
        ) : user.role === 'PRESIDENCIA' ? (
          <Users className="w-3.5 h-3.5 text-sky-300" />
        ) : user.role === 'LIDER' ? (
          <UserCheck className="w-3.5 h-3.5 text-sky-300" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-rose-300" />
        )}
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${getRoleBadgeStyle(
            user.role,
            user.role === 'ADMIN' && isSuperAdminEmail(user.email)
          )}`}
        >
          {activeTriggerBadge}
        </span>
        <span className="max-w-[160px] truncate font-bold">{activeTriggerLabel}</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-sky-200/80" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-sky-200/80" />
        )}
      </button>
    </div>
  );
};
