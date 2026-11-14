---
type: plan
title: Plan — Rediseño de Gestión de Usuarios y Directorio de Líderes
description: Technical plan and task breakdown for fase-6-5-gestion-usuarios-directorio.
tags: [sdd, plan, users, directory, rbac]
timestamp: 2026-11-13T23:51:00-03:00
topic: sdd
slug: fase-6-5-gestion-usuarios-directorio
status: active
---

# Plan — Rediseño de Gestión de Usuarios y Directorio de Líderes

> Slug: `fase-6-5-gestion-usuarios-directorio` · Spec: [fase-6-5-gestion-usuarios-directorio.md](../specs/fase-6-5-gestion-usuarios-directorio.md)

## Architecture & Approach
1. **Modelado de Tipos y Validadores (`database.ts`, `formatters.ts`)**:
   - Agregar rol `CONSULTA` a `UserRole` y definir `DirectoryOrgCode` + `StakeDirectoryEntry`.
   - Implementar validadores puros: `isValidGmail(email)` (estricto `@gmail.com`), `isValidUruguayanMobile(phone)` (`09xxxxxxx`, 9 dígitos sin espacios), `formatUruguayanMobile(phone)` (`09X XXX XXX` en grupos de 3 dígitos), `toWhatsAppUrl(phone)` (`https://wa.me/598...`).
2. **Estructura Canónica del Organigrama (`src/data/stakeOrgStructure.ts`)**:
   - Definir las 12 organizaciones/comités con sus puestos fijos exactos, límites de agregados (`3` general, `2` CFS, `0` Sumo Consejo), unidades conocidas de la Estaca y mapeo de `DirectoryOrgCode` a `OrganizationCode` y rol por defecto.
3. **Estado Unificado y Persistencia (`AuthContext.tsx`, `seedData.ts`, `02-DOCS/database/03_users_directory_redesign.sql`)**:
   - Exponer `directoryEntries`, `updateDirectoryEntry`, `addExtraDirectoryEntry`, `removeExtraDirectoryEntry`, `toggleDirectoryAppAccess`, `linkDirectoryPerson` e `incompleteContactsCount` en `AuthContext`.
   - Sincronizar automáticamente entradas con `has_app_access = true` y `@gmail.com` hacia `profiles` (`users_profiles`), respetando inmutabilidad de `pablosud52@gmail.com` y auto-protección de administradores.
4. **Rediseño de Gestión de Usuarios (`UserManagementPanel.tsx`)**:
   - Vista agrupada por las 12 organizaciones con puestos fijos, botón de agregados (máx. 3 / máx. 2 en CFS) con selector `Secretario Auxiliar | Asesor | Ingresar manualmente`, inputs separados de Nombre y Apellido, validación estricta `@gmail.com` y `09xxxxxxx`, switch universal `Acceso App`, selector para vincular persona existente en Sumo Consejo/HJ/ED, y filtro superior de contactos incompletos.
5. **Directorio de Líderes (`LeadersDirectoryView.tsx`) y Ruteo RBAC (`ConsultaView.tsx`, `PresidencyHub.tsx`, `LeaderView.tsx`, `App.tsx`)**:
   - Vista de solo lectura para todos los usuarios autenticados con búsqueda en tiempo real, números formateados `09X XXX XXX`, botón **Copiar** y botón **WhatsApp**.
   - Vista dedicada para rol `CONSULTA` con acceso exclusivo a Directorio de Líderes, Calendario General (sin costos) y Proveedores.
   - Aviso parpadeante de contactos incompletos en `PresidencyHub` que navega directo a Gestión de Usuarios filtrado.

## Tasks
- [x] T1: Tipos, validadores (`@gmail.com`, `09xxxxxxx` -> `09X XXX XXX`, WhatsApp) y estructura canónica de las 12 organizaciones (`stakeOrgStructure.ts`).
- [x] T2: Actualizar `seedData.ts`, `AuthContext.tsx` y crear migración SQL `02-DOCS/database/03_users_directory_redesign.sql`.
- [x] T3: Rediseñar `UserManagementPanel.tsx` con tarjetas por organización, puestos fijos/extras, Sumo Consejo y switch universal `Acceso App`.
- [x] T4: Crear `LeadersDirectoryView.tsx`, `ConsultaView.tsx` e integrar navegación + alerta parpadeante en `PresidencyHub.tsx`, `LeaderView.tsx` y `App.tsx`.
- [x] T5: Verificación de compilación TypeScript (`npm run build`) y pruebas E2E de flujos críticos (`playwright test`).
