# FTD — Detección de Pagos Duplicados y Doble Revisión

## Intención
Evitar que un mismo gasto o pago se registre dos veces en el panel de control de finanzas, sin frenar el ritmo de carga de comprobantes y ofreciendo una ventana de doble revisión lado a lado.

## Alcance
1. **Motor de detección (`src/lib/duplicateDetection.ts`)**:
   - Agrupación unificada de gastos simples y compartidos (`shared_group_id`).
   - Detección de coincidencia alta: mismo número de comprobante en pagos directos/transferencias, o mismo monto + mismo proveedor + fechas dentro de 7 días.
   - Detección de coincidencia probable: mismo monto + misma organización + fechas dentro de 7 días.
   - Agrupación en casos de revisión y persistencia local de pares ignorados (`estaca_este_dismissed_duplicates_v1`).
2. **Prevención al cargar (`src/components/ExpenseFormModal.tsx`)**:
   - Al guardar un gasto real, muestra alerta inline si hay coincidencias existentes.
   - Opciones: **Eliminar gasto ingresado** o **Continuar igualmente (doble revisión)**.
3. **Ventana de doble revisión (`src/components/DuplicateReviewModal.tsx` y `src/components/AdminOperationsCenter.tsx`)**:
   - Aviso superior con contador en el Centro de Operaciones cuando hay casos pendientes.
   - Modal comparador lado a lado en PC (apilado en móvil con detalle desplegable) y resaltado de diferencias.
   - Acciones: **Eliminar este gasto** (con confirmación) o **No es duplicado (Ignorar)**.

## Checklist de verificación
- [x] Lógica de detección y agrupación de duplicados implementada (`src/lib/duplicateDetection.ts`).
- [x] Alerta previa en el formulario de carga (`src/components/ExpenseFormModal.tsx`).
- [x] Modal de doble revisión lado a lado y aviso en panel (`src/components/DuplicateReviewModal.tsx`, `src/components/AdminOperationsCenter.tsx`).
- [x] Compilación TypeScript y build de producción sin errores (`npm run build`).
- [x] Verificación funcional / E2E del flujo completo (`tests/duplicate-detection.spec.ts`).

## Evidencia
- `npm run build` (`tsc -b && vite build`): exitoso sin errores (1674 módulos transformados).
- `npx playwright test tests/duplicate-detection.spec.ts --project="Desktop Chrome"`: 1 passed (20.0s) — valida alerta previa en formulario, envío a doble revisión, comparación lado a lado en modal y eliminación del duplicado con desaparición de la alerta.

## Siguiente paso
Revisar visualmente en el panel de finanzas o confirmar si deseas ajustar algún criterio de detección (por ejemplo, margen de días).
