# FTD: Sincronización del Directorio y Mejoras Visuales (Acordeón + Sumo Consejo)

- **Fecha:** 2026-11-21
- **Carril:** FTD (Feature Document)
- **Estado:** Completado

## 1. Intención y Alcance
1. **Sincronización real con la nube (Supabase):**
   - Evitar que `AuthContext` rellene puestos vacíos o ausentes con datos de ejemplo (`DEV_PROFILES` / `SEED_SUMO_CONSEJO_DEFAULTS`) cuando hay sesión real o en la mezcla remota.
   - Propagar errores de guardado en la nube al vaciar puestos en `UserManagementPanel`.
2. **Sumo Consejo sin numeración y ordenado:**
   - Eliminar `#1`..`#12` del llamamiento en `stakeOrgStructure.ts` y normalizar en `AuthContext.tsx` para mostrar `"Miembro del Sumo Consejo"`.
   - Ordenar alfabéticamente por nombre completo los miembros cargados del Sumo Consejo en `LeadersDirectoryView.tsx`.
3. **Mejoras visuales del Directorio (`LeadersDirectoryView.tsx`):**
   - Organizaciones plegadas en acordeón por defecto, con punto de color e indicador de cantidad de integrantes.
   - Auto-despliegue al seleccionar una o varias organizaciones en el filtro (desplegable o pastillas rápidas) y al escribir en el buscador.
   - Ocultar puestos sin persona cargada (`isEntryPersonLoaded`).
   - Enlace directo `tel:` en el número de teléfono, junto a `Copiar` y `WhatsApp`.
   - Eliminar el scroll interno anidado para una navegación natural en móviles.

## 2. Checklist de Tareas
- [x] Actualizar `src/data/stakeOrgStructure.ts` (quitar numeración de Sumo Consejo).
- [x] Actualizar `src/data/seedData.ts` y `src/context/AuthContext.tsx` (`buildEmptyDirectoryEntries`, `mergeDirectoryFromRemote` sin datos demo, y sincronización con `sessionEmail`).
- [x] Actualizar `src/components/UserManagementPanel.tsx` (reportar errores de nube en `clearDirectoryEntryWithCascade`).
- [x] Rediseñar `src/views/LeadersDirectoryView.tsx` (acordeones, auto-despliegue, pastillas rápidas, orden alfabético en Sumo Consejo, `tel:`, sin scroll anidado).
- [x] Actualizar/verificar tests en `tests/users-directory.spec.ts` y compilar (`npm run build`).

## 3. Evidencia
- `npm run build` (`tsc -b && vite build`): exitoso (`dist/` generado sin errores).
- `npx playwright test tests/users-directory.spec.ts`: **8 passed** (4 en Mobile Chrome y 4 en Desktop Chrome).

## 4. Siguiente Paso
Desplegar/subir cambios y verificar en `estacaeste.vercel.app` que al guardar/editar un integrante en Gestión de Usuarios se refleje en `stake_directory_entries` de Supabase.
