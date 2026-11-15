---
author: Pablo Lamela
branch: main
status: completed
---
# FTD: Menú Desplegable "Administración" y Reordenamiento Canónico de Secciones

## Intent
Optimizar el espacio visual en la cabecera y unificar la experiencia de navegación para todos los roles mediante:
1. Agrupación de las secciones de comando administrativo en un desplegable superior compacto denominado **"Administración"** exclusivo para Presidencia y Administradores.
2. Reordenamiento general y armónico de las secciones visibles para todos los roles:
   * **Secciones Generales / Consulta**: 1. Mi Organización (o Panel), 2. Calendario, 3. Directorio, 4. Proveedores.
   * **Secciones de Administración (desplegable)**: 1. Calendario (Aprobaciones), 2. Directorio (Gestión de Usuarios), 3. Proveedores, 4. Finanzas (Operaciones y Carga).

## Scope
- **Incluido**:
  - `src/views/LeaderView.tsx`:
    - Reordenar botones en barra de escritorio y drawer móvil a: `Mi Organización` (`SUMMARY`), `Calendario` (`CALENDAR`), `Directorio` (`DIRECTORY`), `Proveedores` (`SUPPLIERS`).
  - `src/views/PresidencyHub.tsx`:
    - Reordenar barra general a: `Panel` (`DASHBOARD`), `Calendario` (`CALENDAR`), `Directorio` (`DIRECTORY`), `Proveedores` (`SUPPLIERS`).
    - Implementar desplegable interactivo `Administración ▾` en la barra superior con las 4 secciones administrativas:
      1. `Calendario` (Bandeja de aprobaciones y sincronización LCR) -> `APPROVALS`
      2. `Directorio` (Gestión de usuarios y llamamientos) -> `USERS`
      3. `Proveedores` (Gestión de proveedores) -> `SUPPLIERS`
      4. `Finanzas` (Centro de Operaciones y Carga) -> `OPERATIONS`
    - Reorganizar el Drawer lateral móvil en dos bloques claros: Navegación General y Grupo `ADMINISTRACIÓN`.
  - Cobertura de pruebas en Playwright:
    - Actualizar selectores y asistentes de navegación en `tests/presidency-hub.spec.ts`, `tests/admin-panel.spec.ts`, `tests/leader-view.spec.ts`, `tests/users-directory.spec.ts`.
  - Sincronización con GitHub y copia de Google Drive.

- **Excluido**:
  - Modificación de la lógica de negocio, reglas de cálculo o esquemas de datos.

## Checklist
- [x] Reordenar navegación de Líder en `src/views/LeaderView.tsx`.
- [x] Implementar desplegable `Administración ▾` y reordenar navegación en `src/views/PresidencyHub.tsx`.
- [x] Reorganizar Drawer móvil de Presidencia en dos bloques claros (General y Administración).
- [x] Actualizar y validar tests E2E en Playwright (`40 passed`).
- [x] Ejecutar compilación exitosa (`npm run build`).
- [x] Realizar commit y push a GitHub (`main`).
- [x] Sincronizar directorio en Google Drive (`g:\Mi unidad\GitHub\estaca-este-app`).

## Evidence
- **E2E Playwright Suite**:
  - `npm run test:e2e`: **40 passed** en Desktop Chrome y Mobile Chrome (1.7m).
  - Verificado el orden exacto de los botones en escritorio y cajón móvil.
  - Verificada la apertura del desplegable de Administración y el acceso a las 4 sub-secciones.
  - Verificada la regla sagrada de auto-protección y permisos granulares de aprobación.
- **Compilación de Producción**:
  - `npm run build`: `tsc -b && vite build` completado exitosamente en 16.06s.

## Next
- Entrega al usuario y verificación en entorno productivo Vercel.
