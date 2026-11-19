# FTD — Inicio de Sesión con Google y Persistencia Real del Directorio

- **Fecha:** 2026-11-19
- **Carril:** FTD (Feature-Targeted Development)
- **Estado:** En progreso

## 1. Intención y Problema
1. Los datos cargados en **Gestión de Usuarios / Directorio** se guardaban solo en `localStorage` del navegador y nunca se leían desde Supabase al iniciar, además de fallar silenciosamente por falta de políticas RLS de escritura en `users_profiles` y por el correo desactualizado (`pablo.lamela@gmail.com` en lugar de `pablosud52@gmail.com`).
2. La aplicación iniciaba abierta en modo simulado sin exigir inicio de sesión con Google en producción.

## 2. Alcance
- **Base de datos (Supabase):**
  - Actualizar el perfil de `pablo.lamela@gmail.com` a `pablosud52@gmail.com` en `users_profiles`.
  - Habilitar políticas RLS de escritura (`INSERT`, `UPDATE`) en `users_profiles` para administradores activos.
  - Verificar/asegurar política RLS de escritura (`ALL` con `USING` y `WITH CHECK`) en `stake_directory_entries` para administradores activos.
- **Autenticación y Login (`LoginView`, `UnauthorizedView`, `supabase.ts`, `AuthContext.tsx`, `App.tsx`, cabeceras):**
  - En producción (`import.meta.env.PROD` o `VITE_REQUIRE_AUTH=true`), exigir sesión real de Google OAuth antes de mostrar la app.
  - Casilla opcional **"Recordarme en este dispositivo"** (activada por defecto usando `localStorage`; si se desmarca usa `sessionStorage`).
  - Al tocar **"Salir"**, cerrar sesión y forzar selector de cuenta de Google (`prompt: 'select_account'`) en el próximo ingreso para que no entre automáticamente.
  - Botón **"Salir"** y correo conectado visible en las vistas principales y en `UnauthorizedView`.
  - Mantener el selector de roles (`DevRoleSwitcher`) exclusivo para `pablosud52@gmail.com` en producción y disponible en desarrollo local para pruebas E2E.
- **Persistencia del Directorio (`AuthContext.tsx`, `UserManagementPanel.tsx`):**
  - Leer `stake_directory_entries` desde Supabase al iniciar la app y fusionar con los puestos fijos.
  - Corregir la actualización optimista para no depender de `setState` asíncrono al construir el registro a enviar.
  - Verificar `{ error }` en todas las escrituras a Supabase y mostrar toast de error si falla el guardado en la nube.

## 3. Checklist
- [x] Correo de Super-Admin actualizado en Supabase (`pablosud52@gmail.com`) + script RLS guardado en `02-DOCS/sql/fix_users_profiles_rls.sql`
- [x] `LoginView` con "Recordarme en este dispositivo" y botón Google OAuth
- [x] `signOut` con limpieza de sesión y `prompt: 'select_account'` al reingresar
- [x] Lectura de `stake_directory_entries` desde Supabase al iniciar y verificación de errores en escritura
- [x] Botón "Salir" visible en `PresidencyHub`, `LeaderView`, `ConsultaView` y `UnauthorizedView`
- [x] `npm run build` sin errores de TypeScript/Vite
- [x] Tests E2E (`npx playwright test tests/users-directory.spec.ts`: 8 passed)
