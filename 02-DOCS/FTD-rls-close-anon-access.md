# FTD: Cierre de acceso público (`anon`) y protección RLS en tablas operativas (3.1)

## Intención
Cerrar el acceso público (`anon`) en todas las tablas operativas de Supabase (`activities`, `budget_allocations`, `budget_incomes`, `cash_withdrawals`, `expenses`, `suppliers`, `app_config` y `audit_logs`) para que solo usuarios autenticados con Google OAuth y habilitados en `users_profiles` puedan consultar o modificar datos.

## Alcance
- Proyecto Supabase: `kgerggplkdxfwjqpctsi` (`estaca-este-app`).
- Tablas operativas: `activities`, `budget_allocations`, `budget_incomes`, `cash_withdrawals`, `expenses`, `suppliers`, `app_config`, `audit_logs`.
- Secuencias: `activities_id_seq`, `budget_allocations_id_seq`, `budget_incomes_id_seq`, `cash_withdrawals_id_seq`, `expenses_id_seq`, `suppliers_id_seq`.
- Archivo SQL versionado: [07_close_anon_rls_operational_tables.sql](file:///c:/Proyectos/estaca-este-app/02-DOCS/database/07_close_anon_rls_operational_tables.sql).

## Checklist
- [x] Auditar políticas RLS y `GRANT` actuales de todas las tablas de `public`.
- [x] Revocar permisos de `anon` sobre tablas operativas y sus secuencias.
- [x] Reemplazar políticas `TO anon, authenticated` abiertas (`true`) por políticas `TO authenticated` basadas en `users_profiles` (`is_active = true` y rol autorizado).
- [x] Verificar con consultas SQL y `get_advisors` que `anon` quedó sin acceso y no hay regresiones.
- [x] Actualizar [ROADMAP_PROGRESS.md](file:///c:/Proyectos/estaca-este-app/02-DOCS/ROADMAP_PROGRESS.md) marcando 3.1 como completado.

## Evidencia
- Script [07_close_anon_rls_operational_tables.sql](file:///c:/Proyectos/estaca-este-app/02-DOCS/database/07_close_anon_rls_operational_tables.sql) ejecutado en Supabase SQL Editor.
- Verificación en `information_schema.role_table_grants`: `anon` tiene **0 privilegios** en las 8 tablas (`activities`, `app_config`, `audit_logs`, `budget_allocations`, `budget_incomes`, `cash_withdrawals`, `expenses`, `suppliers`); solo `authenticated` conserva acceso.
- Verificación en `pg_policies`: todas las políticas de esas 8 tablas quedaron con rol `{authenticated}` y validación contra `users_profiles` (`is_active = true` y rol autorizado).
- Verificación con `get_advisors(security)`: sin alertas RLS en tablas.

## Siguiente paso
Avanzar al punto **3.3** (completar íconos y configuración PWA) y luego al **3.2** (subir cambios a Vercel y probar en vivo).
