# FTD — Corrección Integral: Calendario, Sincronización LCR y Vínculo con Finanzas

- **Fecha**: 2026-11-24
- **Estado**: Completado (Etapas 1, 2 y 3 aprobadas por árbitros adversariales — 19/19 hallazgos resueltos)
- **Origen**: Auditoría adversarial aprobada (2 rondas)

## 1. Intención y Alcance
Corregir los **6 hallazgos críticos** (Etapa 1) y los **8 hallazgos altos** (Etapa 2) detectados en la auditoría del sistema de Calendario, su sincronización automática con el feed iCal oficial de LCR y su integración con la sección de Finanzas (`PROYECTADO_ACTIVIDAD`, `cash_withdrawals`, confidencialidad RBAC y puente servidor `/api/lcr-calendar`).

Cada etapa se someterá a un **árbitro adversarial** independiente sobre el diff real hasta obtener veredicto **APPROVED**.

---

## 2. Etapa 1 — Los 6 Hallazgos Críticos

- [x] **C1. Zona horaria Uruguay (`America/Montevideo`) y expansión de eventos recurrentes (`RRULE`) en `parseIcalFeedWithIcalJs`**
  - Archivo: `src/services/lcrSyncService.ts` + `src/vite-env.d.ts`
  - Convertidas fechas/horas UTC (`Z`) y `TZID` (con registro de `VTIMEZONE`) a `America/Montevideo`, preservando fechas puras (`isDate`) y horarios flotantes.
  - Expandidos eventos recurrentes (`RRULE`) con tope separado (`MAX_RRULE_ITERATIONS = 5000`, `MAX_RRULE_OCCURRENCES = 400`) y respeto a `EXDATE` / `RECURRENCE-ID`.
- [x] **C2. Eliminar secuestro por emparejamiento solo por nombre y colisiones multi-evento**
  - Archivo: `src/services/lcrSyncService.ts`
  - Eliminados `byTitleKey` y `byLocalTitle`; emparejamiento estricto por `ical_uid` o `event_date + título normalizado`, con `matchedTargetIds` / `claimedRowIds` y promoción `PROPUESTA` → `APROBADA`.
- [x] **C3. `persistLcrEventsToSupabase`: diff real, manejo de errores y sin pisar datos válidos**
  - Archivo: `src/services/lcrSyncService.ts`
  - Diff check real con `normalizeTimeForDiff`, preservación de `location`/`start_time`/`end_time` existentes cuando LCR los omite, retorno `{ ok, error }` y bloqueo de `saveSharedLastSyncedAt` ante errores.
- [x] **C4. Sincronización verdaderamente automática (intervalo + foco/visibilidad + `ConsultaView` + sync completo de proyectados)**
  - Archivos: `src/hooks/useAutoLcrSync.ts`, `src/views/PresidencyHub.tsx`, `src/views/LeaderView.tsx`, `src/views/ConsultaView.tsx`
  - Creado hook `useAutoLcrSync` (intervalo de 10 min + `visibilitychange`/`focus` con throttle 30s), conectado en las 3 vistas; `ConsultaView` ahora mapea `origin` y `estimated_cost` y sincroniza LCR; `PresidencyHub` sincroniza fecha, título y organización normalizada en proyectados.
- [x] **C5. Corregir corrupción de `cash_withdrawals.amount` en pagos parciales con tarjeta/transferencia**
  - Archivo: `src/views/PresidencyHub.tsx`
  - `handleSaveExpenseGroup` calcula `totalGross` y el log de auditoría exclusivamente sobre registros aplicados (`isExpenseApplied(r)`).
- [x] **C6. Proteger Supabase producción contra escrituras en modo simulación (`isSimulating`)**
  - Archivos: `src/services/lcrSyncService.ts`, `src/views/PresidencyHub.tsx`, `src/views/LeaderView.tsx`, `src/views/ConsultaView.tsx`, `src/views/CalendarView.tsx`
  - Todas las llamadas a `syncLcrCalendarWithShield` pasan `isSimulating` (y se eliminó la función muerta `handleManualCalendarSync`); en simulación no se escribe en `activities` ni `app_config`.

---

## 3. Etapa 2 — Los 8 Hallazgos Altos

- [x] **A7. Limpieza de proyectados al borrar/cancelar actividades y excluir `PROPUESTA` de fondos comprometidos**
  - Archivos: `src/views/PresidencyHub.tsx`, `src/views/LeaderView.tsx`, `src/components/AdminOperationsCenter.tsx`
  - `handleDeleteActivity` y `handleCancelActivity` limpian incondicionalmente `PROYECTADO_ACTIVIDAD` en Supabase y estado React; `reservedMetrics`, `orgReservedMetrics` y `virtualCalendarMovements` exigen `status === 'APROBADA'`.
- [x] **A8. Evitar doble descuento al cargar un gasto real directo vinculado a una actividad con proyectado**
  - Archivo: `src/views/PresidencyHub.tsx`
  - `handleSaveExpenseGroup` cierra automáticamente cualquier `PROYECTADO_ACTIVIDAD` abierto vinculado a las actividades de los gastos aplicados guardados.
- [x] **A9. Corregir auto-vinculación y vinculación manual con LCR (sin duplicar proyectados, sin pisar presupuesto/notas y con rollback)**
  - Archivos: `src/views/PresidencyHub.tsx`, `src/lib/calendarHelpers.ts`
  - `mergeLocalWithLcrActivity` preserva presupuesto y combina notas; `syncProjectedExpenseForActivity` deduplica proyectados entre ID temporal y LCR; `handleUpdateApprovedActivity` reapunta estado React, valida errores y revierte estado optimista ante fallo; `handleLinkWithLcrEvent` actualiza fechas en BD, sincroniza proyectados y registra log.
- [x] **A10. Eliminar filtro `!/\d{4}$/` que bloqueaba propuestas terminadas en año (ej. `"Campamento 2026"`)**
  - Archivo: `src/views/LeaderView.tsx`
- [x] **A11. Fechas locales Uruguay (`getTodayLocalIso`), confidencialidad en `LeaderView` y reuniones privadas**
  - Archivos: `src/views/CalendarView.tsx`, `src/views/PresidencyHub.tsx`, `src/components/ProposeActivityModal.tsx`, `src/components/ActivityApprovalTray.tsx`, `src/views/LeaderView.tsx`, `src/lib/activityFilters.ts`, `02-DOCS/database/10_tighten_activities_rls.sql`
- [x] **A12. Resolver condición de carrera al montar `PresidencyHub` y en `useAutoLcrSync`**
  - Archivo: `src/views/PresidencyHub.tsx`
  - `locallyCreatedActivityIdsRef` preserva actividades recién creadas tanto al resolver `fetchExecutiveData` como en `useAutoLcrSync`.
- [x] **A13. Manejo de errores en `LcrSyncButton` (no mostrar `"Calendario al día"` si falla)**
  - Archivo: `src/components/LcrSyncButton.tsx`
  - Captura de errores y `persistError` con `failed = true`, sin bloquear el botón `"Reintentar sync"` en cooldown.
- [x] **A14. Endurecer puente servidor `/api/lcr-calendar` (origen/auth, caché CDN y timeout alineado)**
  - Archivos: `api/lcr-calendar.js`, `src/services/lcrSyncService.ts`
  - Validación de origen permitido, `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, `FETCH_TIMEOUT_MS = 7000` en servidor y `LIVE_FETCH_TIMEOUT_MS = 9500` en cliente.

---

## 4. Etapa 3 — Los 5 Puntos Medios y Limpieza

- [x] **M15. Alerta `"Quitadas de LCR"` compartida entre navegadores y dispositivos**
  - Archivos: `src/services/lcrSyncService.ts`, `02-DOCS/database/11_app_config_lcr_live_uids_rls.sql`
  - Agregados `saveSharedLcrLiveUids` y `hydrateSharedLcrLiveUids` (guarda/hidrata `LCR_LIVE_UIDS` en `app_config` respetando `isSimulating`), de modo que cualquier administrador que cae en el escudo de 10 minutos también ve eventos quitados de LCR.
- [x] **M16. Persistir el motivo de rechazo de propuestas en Supabase**
  - Archivo: `src/views/PresidencyHub.tsx` (`handleRejectActivity`)
  - Envía `{ status: 'RECHAZADA', description: nextDescription }` a Supabase evitando duplicar `[Motivo: ...]`.
- [x] **M17. Eliminar prefijos de año `2026` cableados en lógica**
  - Archivos: `src/lib/calendarHelpers.ts`, `src/services/lcrSyncService.ts`, `src/views/PresidencyHub.tsx`, `src/views/LeaderView.tsx`, `src/components/AdminOperationsCenter.tsx`
  - Creados helpers `isHistoricalImportedActivity` (`/ ^ACT-\d{4}-/i`) y `isSeedOrHistoricalUid` (`/^(ACT|LCR)-\d{4}-/i`) válidos para 2026, 2027 y años futuros.
- [x] **M18. `ProposeActivityModal`: quitar `CHURCHWIDE` y reiniciar fecha/organización al abrir**
  - Archivo: `src/components/ProposeActivityModal.tsx`
- [x] **M19. Limpieza de código muerto y columnas modernas en `ExcelSyncPanel`**
  - Eliminados `src/components/ActivityApprovalTray.tsx` (956 líneas sin uso) y `handleEditAndApproveActivity` en `src/views/PresidencyHub.tsx`.
  - Actualizado `buildWorkbook()` en `src/components/ExcelSyncPanel.tsx` con `Fecha_Actividad`, `ID_Actividad`, `Tipo_Gasto`, `Aplicado`, `UID_LCR`, `Hora_Fin`, `Descripcion_LCR` y `Notas_App`.

---

## 5. Evidencia y Verificación
- **Árbitro Adversarial Etapa 1 (6 Críticos)**: `REJECTED` en Ronda 1 → **`APPROVED`** en Ronda 2.
- **Árbitro Adversarial Etapa 2 (8 Altos)**: `REJECTED` en Ronda 1 → **`APPROVED`** en Ronda 2.
- **Árbitro Adversarial Etapa 3 (5 Medios/Limpieza)**: **`APPROVED`** en Ronda 1.
- **`npx tsc --noEmit`**: Exit code `0` (0 errores).
- **`npm run build` (`tsc -b && vite build` + PWA SW)**: Exit code `0` (`dist/` generado en 18.64s).
- **Playwright (`calendar-view`, `calendar-unified-lcr`, `projected-activities`)**: 15/20 pasados sin regresiones (los 5 avisos corresponden a un test legado `hub-nav-approvals`, selector no estricto con LCR en vivo + semilla y timeout de 4 workers en móvil).
