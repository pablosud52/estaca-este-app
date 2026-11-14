import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { UnauthorizedView } from './components/UnauthorizedView';
import { LeaderView } from './views/LeaderView';
import { PresidencyHub } from './views/PresidencyHub';
import { ConsultaView } from './views/ConsultaView';

const AppRouter: React.FC = () => {
  const { user } = useAuth();

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
