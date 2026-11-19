# FTD — Sincronización LCR con `www.`, permiso `app_config` y fechas dinámicas por año

## Intención
Resolver el bloqueo de sincronización en vivo con el calendario oficial de LCR (que impedía descargar eventos globales de 2027), habilitar el guardado de `LAST_SYNCED_AT` en Supabase y reemplazar fechas y años fijos en `2026` por valores dinámicos basados en la fecha actual.

## Alcance
- Migración Supabase `allow_app_config_sync_upsert` (`public.app_config`)
- `src/services/lcrSyncService.ts`
- `src/components/LcrSyncButton.tsx`
- `src/views/CalendarView.tsx`
- `src/views/LeaderView.tsx`
- `src/views/PresidencyHub.tsx`
- `src/views/ConsultaView.tsx`
- `src/components/ProposeActivityModal.tsx`
- `src/components/ExcelSyncPanel.tsx`
- `src/lib/formatters.ts`

## Checklist
- [x] Corregir `OFFICIAL_LCR_ICAL_URL` con `www.` (`https://www.churchofjesuschrist.org/...`) para evitar el desvío `301` sin cabecera CORS.
- [x] Guardar `LAST_SYNCED_AT` en `app_config` únicamente cuando la sincronización en vivo sea exitosa (`source === 'lcr_live_ical'`).
- [x] Habilitar políticas RLS de `INSERT` y `UPDATE` para `LAST_SYNCED_AT` en `public.app_config` mediante migración Supabase.
- [x] Mostrar aviso discreto en `LcrSyncButton` cuando la sincronización caiga en respaldo local.
- [x] Reemplazar años y fechas de referencia fijos (`2026`, `'2026-11-08'`, `'2026-11-01'`, `'2026-11-25'`) por `new Date()` en vistas, modales y utilidades.
- [x] Verificar compilación (`npm run build`) y pruebas de calendario (`tests/calendar-view.spec.ts`).

## Evidencia
- `npm run build` (`tsc -b && vite build`): aprobado sin errores (13.74s).
- `npx playwright test tests/calendar-view.spec.ts --reporter=list`: 4/4 pruebas aprobadas (Desktop Chrome y Mobile Chrome, 17.1s).
- Verificación en Supabase: `public.activities` pasó de 8 a 45 actividades, con **19 eventos de 2027** (hasta `2027-12-05`), y `public.app_config` registró `LAST_SYNCED_AT`.

## Siguiente paso
Probar en la app pulsando «Sincronizar» y seleccionando el año `2027` para confirmar la aparición de los eventos globales.
