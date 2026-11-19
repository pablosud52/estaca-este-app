import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { LoginView } from './components/LoginView';
import { UnauthorizedView } from './components/UnauthorizedView';
import { LeaderView } from './views/LeaderView';
import { PresidencyHub } from './views/PresidencyHub';
import { ConsultaView } from './views/ConsultaView';

const AppRouter: React.FC = () => {
  const { user, authStatus } = useAuth();

  if (authStatus === 'loading') {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-5">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-800 animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Verificando sesión...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <LoginView />;
  }

  // 1. Usuario No Autorizado o Inactivo -> Mensaje Oficial de Bloqueo
  if (!user.is_active || user.role === 'NO_AUTORIZADO') {
    return <UnauthorizedView />;
  }

  // 2. Perfil Consulta (sin presupuesto: Sumo Consejo sin HJ, Esc. Dominical, Bienestar, Música)
  if (user.role === 'CONSULTA') {
    return <ConsultaView />;
  }

  // 3. Perfil Líder -> Ingresa directo a la Vista Móvil de su Organización (Paso 6.2)
  if (user.role === 'LIDER') {
    return <LeaderView />;
  }

  // 4. Perfil Presidencia o Administrador -> Ingresa al Hub Ejecutivo de Presidencia (Paso 6.3)
  return <PresidencyHub />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <DevRoleSwitcher />
    </AuthProvider>
  );
}
