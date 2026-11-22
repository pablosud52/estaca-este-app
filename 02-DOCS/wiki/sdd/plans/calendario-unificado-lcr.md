---
type: plan
title: Plan — Calendario Unificado y Edición Complementaria LCR
description: Plan técnico y lista de tareas verificables para implementar la especificación calendario-unificado-lcr (v2).
tags: [sdd, plan, calendario, lcr]
timestamp: 2026-11-22T16:15:00Z
topic: sdd
slug: calendario-unificado-lcr
status: ready
---

# Plan — Calendario Unificado y Edición Complementaria LCR

> Spec: [calendario-unificado-lcr.md](../specs/calendario-unificado-lcr.md) · Created: 2026-11-22

## Arquitectura de la solución (simple y modular)

1. **Separación limpia entre datos oficiales de LCR y datos complementarios de la app:**
   - Nueva columna `app_notes text` en `public.activities` (`02-DOCS/database/08_activities_app_notes.sql`).
   - `description` queda como descripción oficial de LCR (o texto base en eventos locales); `app_notes` guarda las notas complementarias creadas en la app, visibles para todos los usuarios y jamás sobrescritas por LCR.
   - `lcrSyncService.ts` nunca sobrescribe `organization`, `estimated_cost`, `has_budget` ni `app_notes` en filas existentes, y tras persistir eventos nuevos recarga IDs reales de Supabase para evitar IDs sintéticos en memoria.
2. **Módulo puro `src/lib/calendarHelpers.ts`:**
   - Centraliza: normalización de títulos (sin tildes, minúsculas, espacios colapsados), detección de eventos globales (`CHURCHWIDE`), detección de eventos vinculados a LCR, emparejamiento automático por fecha + nombre normalizado y filtrado por rango de fechas (`Desde` / `Hasta`).
3. **Modal reutilizable `src/components/ActivityEditModal.tsx`:**
   - Un solo formulario de edición para Tarjetas y Lista:
     - Evento de Estaca vinculado a LCR → Título, Fecha, Horario, Lugar y descripción de LCR en solo lectura con aviso *"Dato oficial de LCR — se edita en LCR"*; Organización, Presupuesto estimado y Notas complementarias editables.
     - Evento aún no vinculado a LCR → Todos los campos editables.
     - Evento global (`CHURCHWIDE`) → Nunca editable.
4. **Vista única `src/views/CalendarView.tsx`:**
   - Modo Lectura (Tarjetas) por defecto para todos los usuarios + filtro por rango de fechas (`Desde` / `Hasta`).
   - Botón interruptor `Gestionar` exclusivo para Presidencia, Secretarios y Administradores (con contador pulsante de pendientes).
   - Al activar `Gestionar`: selector `Tarjetas / Lista`, filtros rápidos (`Todas`, `Esperando aprobación`, `Pendientes en LCR`, `Quitadas de LCR` + interruptor `Canceladas / Rechazadas`), `+ Crear Evento` y acciones directas (Editar, Aprobar/Rechazar, Vincular con LCR, No requiere LCR, Cancelar/Eliminar/Mantener).
5. **Unificación en `src/views/PresidencyHub.tsx`:**
   - Elimina la pestaña/menú duplicado `APPROVALS` ("Panel de Control del Calendario") y deja un único botón `Calendario` con contador pulsante.
   - Conecta alertas del Dashboard directamente al `Calendario` abriendo con `Gestionar` activado y el filtro correspondiente.

## Tareas y criterios de verificación

- [x] **T1 — Base de datos y tipos (`app_notes`):**
  - Crear `02-DOCS/database/08_activities_app_notes.sql` y aplicarla en Supabase.
  - Agregar `app_notes?: string | null` en `src/types/database.ts`.
  - *Check:* La columna existe en `public.activities` y `tsc` compila sin errores.
- [x] **T2 — Helpers puros + Sincronización y vinculación automática LCR:**
  - Crear `src/lib/calendarHelpers.ts` y pruebas unitarias.
  - Actualizar `src/services/lcrSyncService.ts` (emparejamiento por fecha + nombre normalizado, preservación de `organization`/`app_notes`, recarga de IDs reales tras persistir).
  - *Check:* Pruebas unitarias en verde para normalización, auto-vinculación, protección `CHURCHWIDE`, preservación de `app_notes` y rango de fechas.
- [x] **T3 — Modal unificado `ActivityEditModal.tsx`:**
  - Crear `src/components/ActivityEditModal.tsx` respetando bloqueo de campos LCR, edición completa en eventos locales y bloqueo por gastos rendidos.
  - *Check:* Compilación limpia y verificación de ambos modos (LCR vs local).
- [x] **T4 — `CalendarView.tsx` unificado (Modo Lectura + `Gestionar` + `Tarjetas/Lista` + rango de fechas):**
  - Integrar filtro `Desde` / `Hasta`, notas complementarias visibles para todos, interruptor `Gestionar`, selector `Tarjetas / Lista`, filtros rápidos con contadores y acciones operativas inline/modal.
  - *Check:* AC-1 a AC-9 verificables en el mismo componente.
- [x] **T5 — Integración en `PresidencyHub.tsx`, `LeaderView.tsx` y `ConsultaView.tsx`:**
  - Eliminar la entrada duplicada `Panel de Control del Calendario` del menú y redirigir alertas del Dashboard al `Calendario` con `Gestionar` + filtro pre-aplicado.
  - Actualizar `handleUpdateApprovedActivity` (auto-fusión al coincidir fecha + nombre normalizado con LCR + guardado de `app_notes`) y `handleLinkWithLcrEvent` (adoptar título oficial de LCR y conservar `app_notes`/org/presupuesto).
  - *Check:* `npm run build` en verde sin warnings ni referencias rotas.
- [x] **T6 — Verificación completa en navegador y cierre:**
  - Probar todos los criterios AC-1 a AC-9 en PC y móvil (`tests/calendar-unified-lcr.spec.ts`: 12/12 en verde) y actualizar `02-DOCS/ROADMAP_PROGRESS.md`.
