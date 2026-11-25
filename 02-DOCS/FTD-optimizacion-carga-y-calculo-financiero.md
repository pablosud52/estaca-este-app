# FTD — Optimización de carga global y cálculo financiero instantáneo

## Intención
Hacer que toda la aplicación cargue sustancialmente más rápido y eliminar la demora y los parpadeos engañosos del cálculo financiero al ingresar al Panel de Presidencia (y a la Vista de Líderes), donde anteriormente se mostraban montos semilla (`SEED_DATA`) o estados intermedios incompletos mientras el navegador esperaba tablas secundarias y la sincronización externa con el calendario iCal de LCR.

## Alcance
- `src/App.tsx`: code-splitting (`React.lazy` + `Suspense`) de todas las vistas principales.
- `src/context/AuthContext.tsx`: desbloqueo inmediato del inicio de sesión sin esperar la descarga del directorio completo (`stake_directory_entries` en segundo plano, solo con sesión activa, más recarga post-login e indicador `isDirectoryLoading`).
- `src/services/lcrSyncService.ts`: importación dinámica de `ical.js` (~82 KB) bajo demanda y deduplicación *single-flight* (`inFlightBackgroundLcrSync`).
- `src/hooks/useAutoLcrSync.ts`: soporte de `enabled` para evitar sincronizaciones duplicadas en Modo Espejo o durante la carga inicial.
- `src/components/AuditLogsPanel.tsx`: importación dinámica de `xlsx` (~430 KB) solo al pulsar Exportar, con protección `isExporting` y `try/catch/finally`.
- `src/views/PresidencyHub.tsx`:
  - Carga en 2 fases: Fase 1 crítica (solo las 4 tablas financieras en paralelo con actualización atómica en un único render) y Fase 2 no bloqueante (retiros, proveedores, rubros y sincronización iCal LCR en segundo plano).
  - Cero datos semilla en producción: skeleton claro `"Calculando estado financiero real..."` mientras llega Fase 1 y pantalla de reintento sin `$ 0,00` falsos si falla la conexión (`hasLoadedFinancialData`).
  - Optimización O(N) en `executiveMetrics` (una sola pasada en lugar de 45 filtros) y precomputación `nextActivityByOrg` en `useMemo`.
  - Carga diferida (`React.lazy`) de todas las pestañas secundarias y de `OrgDistributionChart` (`chart.js` ~163 KB).
  - Modo Espejo instantáneo pasando datos ya cargados y callback `onSharedActivitiesChange` a `LeaderView`.
- `src/views/LeaderView.tsx`: misma carga atómica en 2 fases, skeleton en producción, soporte de datos compartidos bidireccionales en Modo Espejo y preservación de propuestas en `useAutoLcrSync`.
- `src/views/ConsultaView.tsx`: eliminación de fugas de `SEED_ACTIVITIES`/`SEED_SUPPLIERS` en producción y carga diferida de pestañas.
- `src/views/LeadersDirectoryView.tsx`: indicador de carga cuando `isDirectoryLoading` está activo sin caché previa.

## Lista de verificación
- [x] Reducir drásticamente el paquete JS inicial mediante code-splitting (`index.js` de 1.133 KB a 94 KB, -92%).
- [x] Desacoplar `syncLcrCalendarWithShield` del cálculo financiero inicial en `PresidencyHub`, `LeaderView` y `ConsultaView`.
- [x] Eliminar la visualización de datos `SEED_*` o `$ 0,00` falsos en producción mientras carga o si falla la red.
- [x] Optimizar `executiveMetrics` y `nextActivityByOrg` a O(N) preservando exactitud al centavo.
- [x] Someter la implementación a auditoría adversarial (Ronda 1: `RECHAZADO` con 8 hallazgos; Ronda 2 tras correcciones: `APROBADO`).
- [x] Verificar compilado de producción (`npm run build`) sin errores ni advertencias de tamaño.
- [x] Verificar pruebas E2E de Playwright.

## Evidencia observada
- **Build de producción (`npm run build`)**:
  - Antes: `index-*.js` = **1.133,17 kB** (gzip 313,25 kB) con advertencia de chunk > 500 kB.
  - Después: `index-*.js` = **94,32 kB** (gzip 25,15 kB), `PresidencyHub-*.js` = **82,69 kB** (gzip 20,97 kB), `xlsx-*.js` = **429,52 kB** (bajo demanda), `ical-*.js` = **81,63 kB** (bajo demanda), `OrgDistributionChart-*.js` + `vendor-charts` (bajo demanda). Cero advertencias.
- **Auditoría Adversarial**:
  - Ronda 1: 8 hallazgos (1 crítico: `$ 0,00` en error de red; 3 altos: sincronización Modo Espejo, fuga `SEED` en `ConsultaView`, race/stale closure en cambio de `isSimulating`; 3 medios: `useAutoLcrSync` duplicado/single-flight, `suppliers` sin gate `updated_at` + carga Fase 2, `AuthContext` query en Login + `isDirectoryLoading`; 1 bajo: `isExporting` en `AuditLogsPanel`) + lazy-load de `OrgDistributionChart`.
  - Ronda 2: `VEREDICTO: APROBADO` tras verificar directamente todos los archivos en disco.

## Siguiente paso
Desplegar a producción (`vercel` / `git push`) cuando el usuario lo indique y confirmar tiempos de carga reales desde móvil.
