---
author: Pablo Lamela
branch: main
status: in-progress
---
# Fase 6.1 y 6.2: AuthContext, Selector Rápido de Roles y Vista Móvil del Líder

## Intent
Implementar el sistema de autenticación RBAC con selector rápido de roles en desarrollo (`AuthContext` + `DevRoleSwitcher`) y la experiencia móvil completa para Líderes de organización (`LeaderView`), cumpliendo las reglas contables de la Estaca Montevideo Este, la confidencialidad de presupuestos y los estándares de diseño y microinteracciones mobile-native.

## Scope
- **Incluido**:
  - Configuración mobile-native en `index.html` y `src/index.css` (`viewport-fit=cover`, `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, curvas `ease-out`, prevención de zoom en inputs con `16px`).
  - Utilidades de formato canónico (`$ #.##0,00` y `dd/mm/aaaa`) y datos semilla de respaldo sincronizados con Supabase (`src/lib/formatters.ts`, `src/types/database.ts`, `src/data/seedData.ts`).
  - `AuthContext` con conexión a Supabase + conmutador instantáneo de perfiles en desarrollo (`DevRoleSwitcher`) y pantalla de Acceso Restringido oficial.
  - `LeaderView` con:
    1. Cabecera institucional + toggle de Seminario para líderes de `MJ` y `HJ`.
    2. Tarjeta de Saldo Disponible estilo billetera digital con barra de uso y evolución trimestral acumulativa (`T1`-`T4`).
    3. Tarjeta de Próxima Actividad Programada con acción rápida `+ Proponer Actividad`.
    4. Historial Anual de Gastos en acordeón colapsable con filtro por trimestre y soporte de gastos netos multiestaca y actividades generales de Estaca.
    5. Calendario Anual de Actividades en acordeón colapsable con regla estricta de confidencialidad de costos (`💰 Con Presupuesto` y monto ocultos para líderes de otras organizaciones).
    6. Modal nativo `<dialog>` para proponer nueva actividad con checkbox especial `"Actividad conjunta de Seminario"` para `MJ` y `HJ`.
- **Excluido (Pasos 6.3+)**:
  - Dashboard Ejecutivo completo de Presidencia, Bandeja de Aprobación de Actividades, Gestión de Usuarios y Centro de Edición y Carga Operativa del Administrador (tendrán vista puente limpia mientras se aprueba el Paso 6.2).

## Checklist
- [x] `src/lib/formatters.ts` y `src/types/database.ts` creados y verificados con formato `$ #.##0,00` y `dd/mm/aaaa`.
- [x] `AuthContext` y `DevRoleSwitcher` funcionando con los 9 perfiles de prueba (incluyendo Administradores Permanentes Inmutables, Líderes MJ/HJ con Seminario, Líder Primaria y Usuario No Autorizado).
- [x] `LeaderView` y `ProposeActivityModal` construidos con microinteracciones fluidas, acordeones colapsables y confidencialidad de costos en calendario.
- [x] Suite de pruebas E2E en Playwright (`tests/leader-view.spec.ts`) pasando al 100% en viewport móvil y auditoría visual completada.
- [x] Compilación `npm run build` sin errores TypeScript, commit en `main` y respaldo en Google Drive ejecutado.

## Evidence
- `npx playwright test tests/leader-view.spec.ts --project="Mobile Chrome"`: `5 passed (18.0s)`.
  - Test 1: Carga de Líder MJ (`$ 124.000,00` asignado, `$ 72.563,00` gastado, `$ 51.437,00` disponible) + activación de checkbox de Seminario (`+ $ 10.000,00` -> `$ 61.437,00` disponible).
  - Test 2: Acordeón de Historial Anual de Gastos colapsado por defecto y desplegable con gasto neto multiestaca (`$ 4.750,00` sobre factura de `$ 10.750,00` el `10/09/2026`).
  - Test 3: Confidencialidad estricta de costos en calendario verificada con Líder de Primaria visualizando la Agenda General de Estaca (`confidential-budget-badge` = 0, `confidential-budget-amount` = 0 en eventos de AS y HJ).
  - Test 4: Creación de propuesta en modal `<dialog>` nativo con checkbox de Seminario y visibilidad compartida en vivo tanto en MJ como en HJ.
  - Test 5: Mensaje oficial exacto para Usuario No Autorizado y distinción de Administrador Permanente Inmutable.
- `npm run build`: Compilación limpia (`tsc -b && vite build`, PWA `sw.js` generado sin errores).

## Next
Aguardar aprobación del usuario sobre los Pasos 6.1 y 6.2 para avanzar al Paso 6.3 (Hub Ejecutivo de Presidencia: KPIs globales, acumulación trimestral, gráfico interactivo y Bandeja de Aprobación de Actividades con alerta parpadeante).
