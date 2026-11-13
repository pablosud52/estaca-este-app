import React, { useEffect, useRef, useState } from 'react';
import { Shield, Users, UserCheck, Lock, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEV_PROFILES } from '../data/seedData';
import { OrganizationCode, UserRole } from '../types/database';

export interface SimplifiedRoleItem {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  role: UserRole;
  organization: OrganizationCode;
  is_permanent_admin?: boolean;
}

/**
 * Listado canónico y simplificado de roles para el conmutador de Super Admin.
 * Orden estricto (de arriba hacia abajo):
 * 1. yo (super admin)
 * 2. Presidencia de Estaca
 * 3. Sociedad de Socorro
 * 4. Hombres Jóvenes
 * 5. Mujeres Jóvenes
 * 6. Primaria
 * 7. JAS
 * 8. AS
 * 9. CFS
 */
export const SIMPLIFIED_ROLES: SimplifiedRoleItem[] = [
  {
    id: 'admin-pablo-01',
    label: 'yo (super admin)',
    subtitle: 'Pablo Lamela · Secretario Financiero',
    badge: 'ADMIN',
    role: 'ADMIN',
    organization: 'TODAS',
    is_permanent_admin: true,
  },
  {
    id: 'presidencia-consejero1-01',
    label: 'Presidencia de Estaca',
    subtitle: 'Primer Consejero',
    badge: 'PRESIDENCIA',
    role: 'PRESIDENCIA',
    organization: 'TODAS',
  },
  {
    id: 'lider-ss-01',
    label: 'Sociedad de Socorro',
    subtitle: 'Valeria Silva',
    badge: 'SS',
    role: 'LIDER',
    organization: 'SS',
  },
  {
    id: 'lider-hj-01',
    label: 'Hombres Jóvenes',
    subtitle: 'Martín Rodríguez',
    badge: 'HJ',
    role: 'LIDER',
    organization: 'HJ',
  },
  {
    id: 'lider-mj-01',
    label: 'Mujeres Jóvenes',
    subtitle: 'Carolina Méndez',
    badge: 'MJ',
    role: 'LIDER',
    organization: 'MJ',
  },
  {
    id: 'lider-primaria-01',
    label: 'Primaria',
    subtitle: 'Lucía Fernández',
    badge: 'PRIMARIA',
    role: 'LIDER',
    organization: 'PRIMARIA',
  },
  {
    id: 'lider-jas-01',
    label: 'JAS',
    subtitle: 'Mateo Morales',
    badge: 'JAS',
    role: 'LIDER',
    organization: 'JAS',
  },
  {
    id: 'lider-as-01',
    label: 'AS',
    subtitle: 'Diego Pereira',
    badge: 'AS',
    role: 'LIDER',
    organization: 'AS',
  },
  {
    id: 'lider-cfs-01',
    label: 'CFS',
    subtitle: 'Gonzalo Silva',
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

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'PRESIDENCIA':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'LIDER':
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
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
          className="mb-2.5 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-2xl border border-slate-700/80 overflow-hidden transition-all duration-200 ease-out-expo origin-bottom-right"
        >
          <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-200">
              Selector de Rol
            </span>
            <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              Super Admin
            </span>
          </div>

          <div
            data-testid="dev-role-list"
            className="max-h-96 overflow-y-auto divide-y divide-slate-800/80 p-1.5"
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
                  className={`pressable w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition ${
                    isSelected
                      ? 'bg-emerald-950/90 border border-emerald-500/40 text-white'
                      : 'hover:bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{item.label}</span>
                      {item.is_permanent_admin && (
                        <span
                          title="Administrador Permanente Inmutable (Regla Sagrada #1)"
                          className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30"
                        >
                          Inmutable
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRoleBadgeStyle(
                        item.role
                      )}`}
                    >
                      {item.badge}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
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
        className="pressable flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/95 text-white shadow-xl border border-slate-700/80 backdrop-blur-md text-xs font-semibold"
      >
        {user.role === 'ADMIN' ? (
          <Shield className="w-3.5 h-3.5 text-amber-400" />
        ) : user.role === 'PRESIDENCIA' ? (
          <Users className="w-3.5 h-3.5 text-sky-400" />
        ) : user.role === 'LIDER' ? (
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-rose-400" />
        )}
        <span className="max-w-[140px] truncate">{user.full_name}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRoleBadgeStyle(
            user.role
          )}`}
        >
          {user.role === 'LIDER' ? user.organization : user.role}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>
    </div>
  );
};
