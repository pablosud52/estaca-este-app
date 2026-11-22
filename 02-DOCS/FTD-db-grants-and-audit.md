# FTD: Corrección de permisos en Supabase y auditoría completa de tablas

## Intención
Habilitar los permisos faltantes en la base de datos en la nube (`stake_directory_entries` y tablas relacionadas) para que los cambios del directorio y demás módulos se guarden correctamente, y auditar todas las conexiones entre la aplicación y Supabase.

## Alcance
- Base de datos en Supabase (`kgerggplkdxfwjqpctsi` / `estaca-este-app`).
- Todas las tablas (`public.*`) y secuencias utilizadas por `src/`.
- Script de documentación en [03_users_directory_redesign.sql](file:///c:/Proyectos/estaca-este-app/02-DOCS/database/03_users_directory_redesign.sql).

## Checklist
- [x] Auditar las 10 tablas de `public` y sus 7 secuencias contra todas las llamadas `supabase.from(...)` en `src/`.
- [x] Aplicar migración `fix_missing_table_and_sequence_grants` en Supabase para otorgar permisos de tabla y secuencia a `stake_directory_entries`, `budget_incomes` y `audit_logs`.
- [x] Verificar post-migración que las 10 tablas tienen `rls_enabled = true` y permisos activos, y las 7 secuencias tienen `USAGE` habilitado.
- [x] Sincronizar [03_users_directory_redesign.sql](file:///c:/Proyectos/estaca-este-app/02-DOCS/database/03_users_directory_redesign.sql) con el `GRANT` de `stake_directory_entries`.

## Evidencia
- **Migración aplicada**: `fix_missing_table_and_sequence_grants` (exitosa).
- **Tablas reparadas**:
  - `stake_directory_entries`: ahora tiene `SELECT, INSERT, UPDATE, DELETE` para `authenticated` (y `ALL` para `service_role`).
  - `budget_incomes` + secuencia `budget_incomes_id_seq`: ahora tienen permisos de lectura/escritura y uso de secuencia para `authenticated` y `anon`.
  - `audit_logs` + secuencia `audit_logs_id_seq`: ahora tienen permisos de lectura/inserción y uso de secuencia para `authenticated` y `anon`.
- **Tablas ya operativas (verificadas)**: `activities`, `app_config` (claves `LAST_SYNCED_AT` y `supplier_categories`), `budget_allocations`, `cash_withdrawals`, `expenses`, `suppliers`, `users_profiles` (lectura, alta y actualización de perfiles).

## Siguiente paso
Probar en la aplicación (Gestión de Usuarios) volver a guardar un cambio en el directorio y confirmar que desaparece el cartel rojo de error en la nube.
