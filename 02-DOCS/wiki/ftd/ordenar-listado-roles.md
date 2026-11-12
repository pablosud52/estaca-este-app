---
author: Pablo Lamela
branch: main
status: completed
---
# FTD: Ordenar y Simplificar Listado de Roles (Super Admin)

## Intent
Simplificar el menú desplegable del conmutador de roles (`DevRoleSwitcher`) accesible exclusivamente por el Super Administrador (`pablosud52@gmail.com`), organizando los llamamientos y organizaciones en un orden jerárquico canónico estricto de arriba hacia abajo, e incorporando los perfiles faltantes de Jóvenes Adultos Solteros (JAS) y Centro FamilySearch (CFS).

## Scope
- **Incluido**:
  - Reordenamiento canónico y simplificación de las 9 opciones de roles en `src/components/DevRoleSwitcher.tsx`:
    1. `yo (super admin)` (Pablo Lamela · Administrador Permanente)
    2. `Presidencia de Estaca` (Primer Consejero / Presidencia Ejecutiva)
    3. `Sociedad de Socorro` (Valeria Silva)
    4. `Hombres Jóvenes` (Martín Rodríguez)
    5. `Mujeres Jóvenes` (Carolina Méndez)
    6. `Primaria` (Lucía Fernández)
    7. `JAS` (Mateo Morales)
    8. `AS` (Diego Pereira)
    9. `CFS` (Gonzalo Silva)
  - Incorporación de los perfiles de líderes de `JAS` y `CFS` en `src/data/seedData.ts` con sus datos oficiales y de contacto.
  - Formato visual depurado en el menú: títulos directos y limpios, subtítulos descriptivos con nombre y llamamiento, distintivos organizacionales estilizados y distintivo "Inmutable" para el Super Admin.
  - Cobertura de pruebas automatizadas en Playwright (`tests/leader-view.spec.ts`) verificando el orden exacto de los 9 roles, la cantidad de opciones y la conmutación funcional a JAS y CFS.

- **Excluido**:
  - Modificación de reglas RBAC o seguridad en Supabase (se mantienen intactas las reglas sagradas de administradores inmutables y confidencialidad).

## Checklist
- [x] Perfiles de `JAS` y `CFS` añadidos a `src/data/seedData.ts`.
- [x] `DevRoleSwitcher.tsx` refactorizado con la constante `SIMPLIFIED_ROLES` en el orden exacto especificado (1 a 9).
- [x] Prueba E2E en Playwright agregada para validar las 9 opciones en su orden estricto.
- [x] `npm run build` ejecutado exitosamente sin errores de TypeScript ni empaquetado Vite.
- [x] Suite completa de pruebas E2E en Playwright ejecutada y validada al 100% (30 passed en Chrome móvil y de escritorio).

## Evidence
- `npx playwright test`: 30 pruebas pasadas exitosamente (48.7s).
- `npm run build`: compilación limpia (`tsc -b && vite build`) con PWA `sw.js` generado correctamente.

## Next
- Trabajo completado y verificado. Esperando siguientes indicaciones del usuario.
