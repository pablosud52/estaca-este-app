# FTD 2.2 — Visibilidad compartida de Seminario y MeetUP en filtros de HJ y MJ

## Intención
Asegurar que las actividades de **Seminario** y **MeetUP** (en variantes como `MeetUP`, `Meet UP`, `Meet-UP`, `Meetup`, sin importar tildes ni mayúsculas) aparezcan siempre al filtrar por **Hombres Jóvenes (HJ)** o **Mujeres Jóvenes (MJ)**, tanto cuando se importan desde LCR como cuando se cargan en la app desde HJ, MJ o Presidencia/Estaca.

## Alcance
- `src/lib/activityFilters.ts`: helper compartido (`isSeminarioActivityText`, `isMeetupActivityText`, `isSharedYouthActivity`) para detectar Seminario, MeetUP y actividades conjuntas de jóvenes.
- `src/services/lcrSyncService.ts`: clasificación automática de eventos LCR con Seminario o MeetUP.
- `src/views/CalendarView.tsx`: filtro de calendario (`matchesSelectedOrganizations`) usando `isSharedYouthActivity` cuando se selecciona HJ o MJ.
- `src/views/LeaderView.tsx`: agenda propia de líderes HJ/MJ (`isOwnOrgOrYouthJointActivity`) usando `isSharedYouthActivity`.

## Checklist
- [x] Crear helper compartido `src/lib/activityFilters.ts` sin duplicar reglas entre componentes.
- [x] Actualizar `inferOrganizationFromText` en `src/services/lcrSyncService.ts` para reconocer variantes de Seminario y MeetUP.
- [x] Actualizar `matchesSelectedOrganizations` en `src/views/CalendarView.tsx` para mostrar Seminario y MeetUP bajo HJ y MJ sin importar la categoría de origen.
- [x] Actualizar `isOwnOrgOrYouthJointActivity` en `src/views/LeaderView.tsx` para incluir Seminario y MeetUP en la próxima actividad de líderes HJ y MJ.
- [x] Verificar compilación completa (`npm run build`).

## Evidencia
- `npm run build` (`tsc -b && vite build`) ejecutado tras el último cambio: **exit code 0**, `1679 modules transformed`, `built in 17.53s`.

## Siguiente paso
- Probar en la interfaz del calendario filtrando por HJ y MJ con un evento de prueba de MeetUP/Seminario, o continuar con el siguiente punto pendiente del listado.
