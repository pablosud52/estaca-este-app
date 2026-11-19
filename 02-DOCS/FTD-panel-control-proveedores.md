# FTD: Panel de Control de Proveedores y Sugerencias desde Finanzas

- **Estado**: Completado (pendiente de prueba visual por el usuario)
- **Fecha**: 2026-11-19
- **Alcance**: `src/types/database.ts`, `src/index.css`, `src/components/SupplierFormModal.tsx`, `src/views/SuppliersView.tsx`, `src/views/PresidencyHub.tsx`, `src/components/ExpenseFormModal.tsx`, `02-DOCS/database/05_suppliers_status.sql`

## Intención
Habilitar la gestión completa de proveedores (alta, edición, baja y revisión de sugerencias enviadas desde la carga de gastos en Finanzas) dentro de la sección `Proveedores` para Administradores, manteniendo la vista limpia y de solo lectura para Líderes, Presidencia y Consulta.

## Checklist
- [x] Agregar campo `status?: 'ACTIVO' | 'PENDIENTE'` en `SupplierRecord` y script SQL `05_suppliers_status.sql`
- [x] Crear modal nativo `<dialog>` `SupplierFormModal.tsx` con 3 bloques (Datos principales, Contacto y sucursales, Datos fiscales)
- [x] Actualizar `SuppliersView.tsx` con modo administrador en formato de tabla/lista (igual que Finanzas y Calendario): botón `+ Nuevo proveedor`, pestañas `Directorio` y `Pendientes` (con contador discreto), columnas (`Revisión`, `Proveedor`, `Rubro`, `Teléfono`, `RUT`, `+ Más` desplegable y `Acciones` de editar/eliminar/aprobar)
- [x] Conectar `handleCreateSupplier`, `handleUpdateSupplier` y `handleDeleteSupplier` en `PresidencyHub.tsx` con Supabase y fallback local
- [x] Ajustar atajo `+ Nuevo` en `ExpenseFormModal.tsx` para enviar sugerencia no bloqueante (`Nombre` + `Rubro` opcional) con `status: 'PENDIENTE'`
- [x] Verificar compilación (`npm run build`)

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (`✓ built in 10.09s`, `1668 modules transformed`).

## Siguiente paso
Probar el Panel de Control de Proveedores en el navegador (alta, edición, eliminación y sugerencia desde Finanzas) y ejecutar `02-DOCS/database/05_suppliers_status.sql` en Supabase si aún no se aplicó.
