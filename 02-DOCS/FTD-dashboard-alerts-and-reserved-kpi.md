# FTD: Limpieza de alertas del Panel y rediseño de la tarjeta Presupuesto Disponible

- **Estado**: Completado
- **Fecha**: 2026-11-19
- **Alcance**: `src/views/PresidencyHub.tsx`, `tests/presidency-hub.spec.ts`, `tests/users-directory.spec.ts`

## Intención
1. Quitar las alertas grandes del Dashboard (contactos incompletos, aprobaciones/LCR de calendario y pendientes de rendir en la tarjeta de presupuesto) y trasladarlas como indicadores parpadeantes a los botones de **Administración** (y dentro de su menú a **Calendario**, **Directorio** y **Finanzas**, dejando **Proveedores** sin alerta) y al botón hamburguesa en móvil.
2. En la tarjeta maestra **PRESUPUESTO DISPONIBLE**, quitar el ícono de billetera y mostrar:
   - Columna izquierda: monto disponible, **Reservado en actividades** (trimestre actual, descontando automáticamente actividades cuyo gasto real ya fue cargado) y **Saldo libre estimado** (`Disponible − Reservado`).
   - Columna derecha (tanto en escritorio como en móvil aprovechando el tercio libre): listado compacto con organizaciones abreviadas y su monto reservado en el trimestre actual.

## Checklist
- [x] Quitar alertas de Directorio, Calendario y Finanzas del Dashboard
- [x] Agregar punto parpadeante unificado en botón `Administración` (PC) y menú hamburguesa (móvil), y puntos individuales en `Calendario`, `Directorio` y `Finanzas` (sin alertas en la barra principal ni en `Proveedores`)
- [x] Quitar ícono de billetera en la tarjeta `PRESUPUESTO DISPONIBLE`
- [x] Calcular `Reservado en actividades` y `Saldo libre estimado` para el trimestre actual, descontando actividades con gasto real aplicado vinculado
- [x] Mostrar listado compacto por organización abreviada a la derecha en escritorio y móvil
- [x] Actualizar `tests/presidency-hub.spec.ts` y `tests/users-directory.spec.ts`
- [x] `npm run build` sin errores

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (17.04s).

## Siguiente paso
Revisar el Panel en computadora y en celular para confirmar que los avisos parpadeantes y la nueva tarjeta de presupuesto se ven tal como esperabas.
