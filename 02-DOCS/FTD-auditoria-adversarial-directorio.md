# FTD — Auditoría Adversarial del Directorio (Guardado, Seguridad y Funcionamiento)

- **Fecha**: 2026-11-24
- **Carril**: FTD (auditoría integral + correcciones iterativas con árbitro adversarial independiente)
- **Árbitro**: Subagente independiente `adversarial-referee` (3 rondas: Ronda 1 RECHAZADO → Ronda 2 RECHAZADO → Ronda 3 **APROBADO**)

---

## 1. Intención y Alcance
Auditar a fondo la sección **Directorio** (Modo Lectura y Modo Gestión), el guardado en la nube (`stake_directory_entries` y sincronización con `users_profiles`), la seguridad RLS en Supabase y las pruebas E2E, corrigiendo todos los hallazgos hasta obtener la aprobación explícita del árbitro adversarial.

### Archivos intervenidos
- `src/context/AuthContext.tsx`
- `src/components/UserManagementPanel.tsx`
- `src/views/LeadersDirectoryView.tsx`
- `02-DOCS/database/12_harden_directory_and_profiles_rls.sql`
- `tests/users-directory.spec.ts`

---

## 2. Resumen de Rondas Adversariales

### Ronda 1 — Veredicto: RECHAZADO (5 Críticos, 5 Altos, 5 Medios, 3 Bajos)
Principales fallos detectados y corregidos:
- **[C-1] Exposición pública (`anon`) de `users_profiles`**: Preparada migración `12_harden_directory_and_profiles_rls.sql` con funciones `SECURITY DEFINER`, `REVOKE ALL FROM anon` y políticas `TO authenticated`.
- **[C-2] Mutación optimista sin rollback**: Todas las escrituras del directorio ahora persisten en Supabase primero y solo actualizan el estado local/`localStorage` si la nube confirma éxito.
- **[C-3] Fallos silenciosos en `users_profiles`**: Nuevo reconciliador `reconcileProfilesForEmails` que verifica `{ error }` en cada `upsert`/`update` contra Supabase.
- **[C-4] Cuentas huérfanas al cambiar/borrar correo**: Al cambiar o quitar un correo, el correo anterior se desactiva automáticamente en `users_profiles` si no ocupa otro puesto activo.
- **[C-5] Eliminación de extras sin confirmación ni desactivación en nube**: Agregado modal de confirmación, manejo de error con toast y desactivación real en `users_profiles`.
- **[A-1] & [A-2] RLS y esquema de `stake_directory_entries`**: Políticas `TO authenticated` con `WITH CHECK` + respaldo `pablosud52@gmail.com`, `UNIQUE(slot_key)`, `FK(linked_entry_id -> id ON DELETE SET NULL)` y desactivación de 5 cuentas seed huérfanas.
- **[A-3] Doble llamamiento (`linked_entry_id`)**: Priorización de roles/accesos en `reconcileProfilesForEmails` (nunca degrada a `CONSULTA` ni desactiva si otro llamamiento sigue activo), propagación bidireccional de datos de contacto y cascada simétrica.
- **[A-4] Elevación accidental de privilegios al reemplazar al Super-Admin**: `isSuper` ahora evalúa solo `nextEmail` y degrada limpiamente `pres-secretario-financiero` si cambia el titular.
- **[A-5] Doble clic, colisión de `slot_key` y closure vieja**: Estado `isSaving` bloqueando acciones concurrentes, `slot_key` único por índice libre, uso consistente de `directoryEntriesRef.current` y audit log preciso.
- **[M-1..M-5] & [B-1..B-3]**: Verificación de resultado en Modal Presidente y Vincular persona; corrección de `useEffect` que colapsaba acordeones; búsqueda insensible a acentos y por sigla corta; validación que impide guardar teléfono/correo sin Nombre ni Apellido; actualización de `tests/users-directory.spec.ts`; limpieza de código muerto, timers y aviso de error de carga con "Reintentar".

### Ronda 2 — Veredicto: RECHAZADO (1 Alto, 2 Medios)
- **[R2-A1] Corrupción de puesto vinculado al relevar Presidente**: Corregido pasando `{ linked_entry_id: undefined }` en `"Nuevo Presidente/a (relevo)"` y desactivando la propagación de contacto cuando `updates` modifica `linked_entry_id`.
- **[R2-M1] Filtro de Presidencia activo antes de buscar en Test 4**: Corregido limpiando el filtro antes de probar la búsqueda por acento/sigla.
- **[R2-M2] Rollback incompleto de `users_profiles` ante fallo parcial con 2+ correos**: Agregado rollback best-effort `reconcileProfilesForEmails(..., prevEntries)` tras restaurar `stake_directory_entries`.

### Ronda 3 — Veredicto: **APROBADO**
- 0 Críticos, 0 Altos, 0 Medios pendientes en el código fuente.

---

## 3. Checklist de Verificación
- [x] `npx tsc --noEmit` sin errores
- [x] `npm run build` exitoso (TypeScript + Vite + PWA)
- [x] Auditoría adversarial aprobada en Ronda 3
- [x] Suite E2E `tests/directory-unified.spec.ts` y `tests/users-directory.spec.ts` (14/14 pruebas pasadas en PC y móvil)
- [ ] Ejecutar `02-DOCS/database/12_harden_directory_and_profiles_rls.sql` en Supabase producción (`kgerggplkdxfwjqpctsi`) con autorización del usuario

---

## 4. Próximo Paso
Aplicar la migración SQL `02-DOCS/database/12_harden_directory_and_profiles_rls.sql` en Supabase producción para cerrar en vivo el acceso público (`anon`) a `users_profiles` y activar las restricciones de integridad en `stake_directory_entries`.
