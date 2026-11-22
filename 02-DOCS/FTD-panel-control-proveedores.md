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
- `npm run build` (`tsc -b && vite build`): exit code `0` (`✓ built in 12.13s`, `1677 modules transformed`).

## Siguiente paso
Probar el Panel de Control de Proveedores en el navegador (alta, edición, rubros, teléfonos, duplicados, autocompletado de dirección y sugerencia desde Finanzas) y ejecutar `02-DOCS/database/05_suppliers_status.sql` en Supabase si aún no se aplicó.

## Acordado para la próxima modificación (Gestión de Rubros / Categorías)
- [x] Convertir **Rubro / Categoría** (en `SupplierFormModal.tsx` y en el atajo `+ Nuevo` de `ExpenseFormModal.tsx`) en un desplegable real ordenado alfabéticamente con la opción `+ Añadir nuevo rubro`.
- [x] Validar duplicados ignorando mayúsculas y tildes al crear o renombrar rubros.
- [x] Agregar ventana **`Administrar rubros`** (`SupplierCategoriesModal.tsx`) para Administradores (renombrar con actualización automática/fusión de proveedores existentes, y eliminar con reasignación a otro rubro o a `Varios` si tiene comercios asociados).
- [x] Persistir la lista oficial de rubros en `app_config` (`supplier_categories`) de Supabase para compartirla entre todos los dispositivos.
- [x] Unir bloque 3 (*Datos fiscales*) dentro del bloque 1 (*Datos principales*) y quitar **Correo electrónico** de `SupplierFormModal.tsx` y `SuppliersView.tsx`.
- [x] Validar celular (9 dígitos) y teléfono fijo (8 dígitos), mostrar alertas ámbar no bloqueantes de datos repetidos (`supplierHelpers.ts`) y agregar autocompletado gratuito de direcciones (`AddressAutocompleteInput.tsx` con Photon/OpenStreetMap).
