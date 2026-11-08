---
type: constitution
title: Estaca_App — Constitution
description: Ratified project constitution defining stack, security floor, business rules, and UI conventions.
tags: [sdd, constitution]
timestamp: 2026-11-08T19:30:00Z
topic: sdd
status: ratified
version: 1.0.0
---

# Estaca_App — Constitution

> **Estatuto y Reglas Fundamentales del Proyecto Sistema de Finanzas y Calendario de Estaca**

## 1. Stack Canon
- **Frontend**: React 18/19 + TypeScript + Vite. Progressive Web App (PWA) instalable en Android e iOS.
- **Styling**: Tailwind CSS + Lucide Icons.
- **Micro-interacciones y UI Craft**: Estándares de `pbakaus/impeccable` y `emilkowalski/skills`.
- **Backend & Database**: PostgreSQL 15+ en **Supabase** con Row Level Security (RLS) y Auth nativo con Google OAuth 2.0.
- **Hosting & CI/CD**: **Vercel** conectado al repositorio GitHub.
- **Sincronización Externa**:
  - Feed iCal RFC 5545 oficial de LCR (`group/cd92d6817fa64d25bc2f55aec4fea180`).
  - Importación y exportación de libro Excel (`xlsx` / SheetJS) compatible con `02-DOCS/data/Ejemplo_DB_Finanzas.xlsx`.

## 2. Reglas Sagradas de Negocio y Seguridad (Floor)
1. **Regla de Administradores Permanentes**: El Presidente de Estaca y el Secretario Financiero (Pablo Lamela) son administradores inmutables; ningún administrador puede revocarse sus propios permisos ni eliminarse.
2. **Confidencialidad de Costos en Calendario**: El campo `Costo_Estimado` y el distintivo `💰 Con Presupuesto` son visibles **únicamente** para Presidencia, Administradores y líderes de la organización anfitriona.
3. **Cero Datos Bancarios**: Queda terminantemente prohibido almacenar números de cuenta bancaria o datos bancarios sensibles (ADR-002).
4. **Formato Monetario Oficial**: `#.##0,00` (punto para miles, coma para decimales). En interfaz se antepone `$`.
5. **Aislamiento Organizacional**: Un líder solo accede y visualiza los datos de su propia organización (a excepción de MJ y HJ que comparten vista de Seminario).
6. **Gastos Compartidos Estaca**: Se registran con `Actividad General de Estaca: [Nombre]` sin alterar la cuota de asignación presupuestaria original de las organizaciones.
7. **Gastos Multiestaca**: Manejados vía `Monto_Total_Factura` vs. `Reintegro_Externo` -> `Gasto_Neto_Organizacion`.

## 3. UI & Accessibility Standard
- Mobile-first, táctil, limpio y sin elementos recargados.
- Secciones colapsables para balances e historiales en pantallas móviles.
- Animaciones fluidas (150-250ms con curvas `ease-out`, sin layout shifts).
- Contraste WCAG AA garantizado tanto en modo claro como en modo oscuro.

## 4. Branching & Shipping
- Desarrollo continuo directo en `main` para iteración ágil, con commits semánticos y respaldos automáticos hacia Google Drive (`G:\Mi unidad\GitHub\Estaca_App`).
