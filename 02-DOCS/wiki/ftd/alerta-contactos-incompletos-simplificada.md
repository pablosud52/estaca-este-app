---
author: Pablo Lamela
branch: main
status: completed
---
# FTD: Simplificación de Alerta de Contactos Incompletos en Dashboard

## Intent
Hacer más limpia, directa e interactiva la alerta de contactos incompletos en el Panel Ejecutivo de Presidencia (`PresidencyHub`):
1. Redactar el texto de forma concisa y con concordancia gramatical exacta:
   - Singular: `1 contacto en el Directorio incompleto.`
   - Plural: `${incompleteContactsCount} contactos en el Directorio incompletos.`
2. Convertir todo el contenedor de la alerta en un botón accionable (eliminando el botón individual "Completar ahora"), de modo que al tocar cualquier parte de la alerta se abra la sección de administración del Directorio (`USERS`) con el filtro de incompletos activado.
3. Asegurar que cuando no existan registros afectados (`incompleteContactsCount === 0`), el cartel desaparezca completamente sin dejar espacios vacíos, permitiendo que el resto del dashboard ocupe su lugar de forma fluida.

## Scope
- **Incluido**:
  - `src/views/PresidencyHub.tsx`:
    - Reemplazar el contenedor y botón interno por un botón interactivo único de ancho completo (`w-full text-left`), con `data-testid="presidency-incomplete-contacts-alert"`.
    - Ajustar la lógica del texto según el valor de `incompleteContactsCount` (singular vs plural).
    - Asignar la acción `onClick` que activa `setOpenUsersWithIncompleteFilter(true)` y `setActiveTab('USERS')`.
  - `tests/users-directory.spec.ts`:
    - Validar el texto singular/plural y comprobar que al hacer clic en el cartel se navega al panel de administración del Directorio.
  - Sincronización con GitHub y réplica de Google Drive.

- **Excluido**:
  - Modificación de las reglas de validación de contactos (celular uruguayo y cuenta @gmail.com).

## Checklist
- [x] Actualizar la alerta en `src/views/PresidencyHub.tsx`.
- [x] Actualizar y ejecutar pruebas E2E en Playwright (`40 passed`).
- [x] Ejecutar compilación exitosa (`npm run build`).
- [x] Hacer commit, push a GitHub y sincronizar con Google Drive.

## Evidence
- **E2E Playwright Suite**:
  - `tests/users-directory.spec.ts`: **8 passed** (Mobile y Desktop Chrome).
  - Suite completa `npm run test:e2e`: **40 passed** (1.9m).
- **Compilación de Producción**:
  - `npm run build`: `tsc -b && vite build` completado exitosamente en 16.17s.

## Next
- Entrega y sincronización con el usuario.
