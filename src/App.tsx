import React, { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useModalScrollLock } from './utils/useModalScrollLock';

const DevRoleSwitcher = lazy(() =>
  import('./components/DevRoleSwitcher').then((m) => ({ default: m.DevRoleSwitcher }))
);
const LoginView = lazy(() =>
  import('./components/LoginView').then((m) => ({ default: m.LoginView }))
);
const UnauthorizedView = lazy(() =>
  import('./components/UnauthorizedView').then((m) => ({ default: m.UnauthorizedView }))
);
const LeaderView = lazy(() =>
  import('./views/LeaderView').then((m) => ({ default: m.LeaderView }))
);
const PresidencyHub = lazy(() =>
  import('./views/PresidencyHub').then((m) => ({ default: m.PresidencyHub }))
);
const ConsultaView = lazy(() =>
  import('./views/ConsultaView').then((m) => ({ default: m.ConsultaView }))
);

const ViewLoader: React.FC<{ message?: string }> = ({ message = 'Cargando...' }) => (
  <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5">
    <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-[#083563] animate-spin mb-3" />
    <p className="text-xs font-bold text-slate-500">{message}</p>
  </div>
);

const AppRouter: React.FC = () => {
  const { user, authStatus } = useAuth();

  if (authStatus === 'loading') {
    return <ViewLoader message="Verificando sesión..." />;
  }

  return (
    <Suspense fallback={<ViewLoader message="Cargando panel..." />}>
      {authStatus === 'unauthenticated' ? (
        <LoginView />
      ) : !user.is_active || user.role === 'NO_AUTORIZADO' ? (
        // 1. Usuario No Autorizado o Inactivo -> Mensaje Oficial de Bloqueo
        <UnauthorizedView />
      ) : user.role === 'CONSULTA' ? (
        // 2. Perfil Consulta (sin presupuesto: Sumo Consejo sin HJ, Esc. Dominical, Bienestar, Música)
        <ConsultaView />
      ) : user.role === 'LIDER' ? (
        // 3. Perfil Líder -> Ingresa directo a la Vista Móvil de su Organización (Paso 6.2)
        <LeaderView />
      ) : (
        // 4. Perfil Presidencia o Administrador -> Ingresa al Hub Ejecutivo de Presidencia (Paso 6.3)
        <PresidencyHub />
      )}
    </Suspense>
  );
};

export default function App() {
  useModalScrollLock();

  return (
    <AuthProvider>
      <AppRouter />
      <Suspense fallback={null}>
        <DevRoleSwitcher />
      </Suspense>
    </AuthProvider>
  );
}
