# FTD — Calendario Completo, Creación de Eventos y Puente Real LCR

## Intención
Habilitar la creación directa de eventos desde el Panel de Control del Calendario y la vista Calendario para Presidencia y Administradores, resolver la sincronización en vivo con LCR mediante un puente en servidor (`/api/lcr-calendar`) sin bloqueos CORS, y completar los detalles de persistencia y edición del ciclo de actividades.

## Alcance
- `api/lcr-calendar.js` (puente serverless en Vercel hacia el feed iCal oficial de LCR)
- `vite.config.ts` (proxy local `/api/lcr-calendar` para desarrollo y pruebas)
- `src/services/lcrSyncService.ts` (consumo de `/api/lcr-calendar` y soporte de `PENDIENTE_LCR-`)
- `src/components/ProposeActivityModal.tsx` (modo `PROPOSE` para líderes y `DIRECT_CREATE` para Presidencia/Admin, con hora de fin, descripción, selector de organización y opción LCR)
- `src/components/CalendarControlPanel.tsx` (botón `+ Crear Evento` en cabecera)
- `src/components/ActivityApprovalTray.tsx` (edición de `end_time` en actividades aprobadas)
- `src/views/CalendarView.tsx` (etiqueta configurable de botón crear/proponer y visualización de notas/rechazos)
- `src/views/PresidencyHub.tsx` (handler `handleCreateDirectActivity`, sincronización de reserva `PROYECTADO_ACTIVIDAD` al editar actividad aprobada, y conexión en `APPROVALS` y `CALENDAR`)
- `src/views/LeaderView.tsx` (persistencia de `origin: 'propuesta_lider'` y recuperación del `id` real desde Supabase)

## Checklist
- [x] Crear puente serverless `api/lcr-calendar.js` y proxy en `vite.config.ts`.
- [x] Actualizar `lcrSyncService.ts` para usar `/api/lcr-calendar` en primer lugar y reconocer `PENDIENTE_LCR-` como pendiente de LCR.
- [x] Ampliar `ProposeActivityModal.tsx` con `mode: 'PROPOSE' | 'DIRECT_CREATE'`, hora de fin, descripción, selector de organización y marca de LCR.
- [x] Agregar botón `+ Crear Evento` en `CalendarControlPanel.tsx` y en `CalendarView.tsx` para Presidencia/Admin.
- [x] Sincronizar reserva `PROYECTADO_ACTIVIDAD` al editar fecha/monto/org de una actividad aprobada en `PresidencyHub.tsx` y agregar `end_time` en `ActivityApprovalTray.tsx`.
- [x] Corregir inserción de propuestas en `LeaderView.tsx` (`origin` e `id` real de Supabase).
- [x] Verificar compilación (`npm run build`) y pruebas E2E (`tests/calendar-view.spec.ts`).

## Evidencia
- `npm run build` (`tsc -b && vite build`): aprobado sin errores (16.59s).
- `npx playwright test tests/calendar-view.spec.ts --reporter=list`: 6/6 pruebas aprobadas en Desktop Chrome y Mobile Chrome (25.1s), incluyendo la creación directa de eventos desde el Panel de Control del Calendario (`cal-ctrl-create-event-btn`).

## Siguiente paso
Subir los cambios al repositorio (`git push`) para que Vercel publique el puente `/api/lcr-calendar` en producción y probar el botón «Sincronizar» en `https://estacaeste.vercel.app`.
