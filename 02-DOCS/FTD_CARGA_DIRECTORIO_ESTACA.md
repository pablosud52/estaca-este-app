# FTD — Carga del Directorio de Estaca y Ajustes de Visualización

## Intención
Cargar en la base de datos (`public.stake_directory_entries`) la nómina oficial validada del Sumo Consejo y las organizaciones auxiliares de la Estaca Este, y ajustar la estructura y visualización del directorio para reflejar asignaciones múltiples, jerarquía de etiquetas y los dos puestos de Especialista en Servicios de Bienestar y Autosuficiencia.

## Alcance
- **Código:**
  - `src/data/stakeOrgStructure.ts`: agregar segundo espacio fijo `bien-esp-servicios-2` en `BIENESTAR`.
  - `src/views/LeadersDirectoryView.tsx`: mostrar en `SUMO_CONSEJO` etiquetas separadas siguiendo la jerarquía: llamamiento en otra organización -> unidad/barrio asignado -> asignación 1 -> asignación 2.
- **Base de datos (`public.stake_directory_entries`):**
  - Mantener intactos los 2 registros existentes de `PRESIDENCIA` (`Maico Fros`, `Pablo Lamela`).
  - Cargar 12 integrantes de `SUMO_CONSEJO` con sus unidades y asignaciones.
  - Cargar 27 registros de organizaciones auxiliares (`HJ`, `ESCUELA_DOMINICAL`, `MJ`, `SS`, `PRIMARIA`, `BIENESTAR`, `MUSICA`, `AS`, `JAS`) con sus vínculos `linked_entry_id`.

## Checklist
- [x] Actualizar `src/data/stakeOrgStructure.ts` con el segundo espacio fijo en `BIENESTAR`.
- [x] Actualizar `src/views/LeadersDirectoryView.tsx` con la jerarquía y etiquetas separadas para `SUMO_CONSEJO`.
- [x] Insertar/actualizar los 39 registros nuevos en `public.stake_directory_entries` sin alterar `PRESIDENCIA`.
- [x] Verificar compilación TypeScript/Vite (`npm run build`) y conteo final en Supabase.

## Evidencia
- `npm run build` (`tsc -b && vite build`): salida con código `0` (1680 módulos transformados, build completado en 19.66s).
- Consulta de verificación en `public.stake_directory_entries` (41 registros totales):
  - `PRESIDENCIA`: 2 (intactos)
  - `SUMO_CONSEJO`: 12
  - `HJ`: 4, `MJ`: 4, `SS`: 4, `PRIMARIA`: 4
  - `ESCUELA_DOMINICAL`: 3, `JAS`: 3
  - `AS`: 2, `BIENESTAR`: 2, `MUSICA`: 1

## Siguiente paso
Completar manualmente los teléfonos, correos y accesos a la app cuando se disponga de los datos de contacto.
