---
type: spec
title: Spec — Finanzas: Orden por Fecha, Filtro por Rango y Estética Unificada
description: WHAT and WHY para agregar orden ascendente/descendente por fecha (con Pendientes LCR siempre arriba), filtro por rango de fechas Desde/Hasta en Gastos y Movimientos, y alineación estética al azul marino institucional.
tags: [sdd, spec, finanzas, fechas, ui]
timestamp: 2026-11-22T23:20:00Z
topic: sdd
slug: finanzas-fechas-estetica
status: planned
---

# Spec — Finanzas: Orden por Fecha, Filtro por Rango y Estética Unificada

> Slug: `finanzas-fechas-estetica` · Status: planned · Created: 2026-11-22
> Inherits: [constitution](../constitution.md)

## Problem & why
En el panel de **Finanzas** (`Gastos` y `Movimientos`) hoy no existe forma de invertir el orden cronológico de las tablas ni de filtrar comprobantes o movimientos por un rango de fechas (`Desde` / `Hasta`). Además, todavía quedan botones y detalles visuales en verde o gris oscuro que no siguen la misma paleta azul marino ni el estilo limpio de las barras de filtros de `Calendario` y `Proveedores`.

## Cost of not building it
Para conciliar comprobantes contra un extracto o cierre mensual en LCR, el Secretario Financiero o Administrador tiene que recorrer manualmente toda la tabla del año en orden fijo, sin poder acotar un mes o quincena ni invertir el orden cronológico.

## The cheapest alternative
Agregar solo un filtro de texto por fecha (`"11/2026"`). No alcanza porque no permite filtrar rangos arbitrarios (`del 10/10 al 25/11`), no permite invertir el orden cronológico con un clic y no resuelve la coherencia estética con el resto de la aplicación.

## Goals
- Permitir ordenar **Gastos** y **Movimientos** por fecha ascendente o descendente tocando el encabezado de la columna **`Fecha`** (y mediante un botón compacto equivalente en celular), manteniendo **más recientes primero por defecto** y dejando siempre los **Pendientes de LCR arriba** en Gastos.
- Agregar un botón compacto **`Fechas`** en **Gastos** y en **Movimientos** (independiente en cada pestaña) que despliega **`Desde`** y **`Hasta`** con botón **`Limpiar fechas`**, igual que en `Calendario`.
- En **Gastos**, aplicar tanto el orden como el filtro por fechas sobre la **fecha contable / LCR** (`expense_date`).
- Unificar la estética de Finanzas a la paleta azul marino institucional (`#072B52` / `#083563`) en botones y controles activos (reservando verde solo para dinero y confirmaciones positivas) y alinear sus barras de filtros con `Calendario` y `Proveedores`.

## Non-goals / out of scope
- Rediseñar los modales de carga de Gastos y Movimientos (`1.1`), auditar alertas (`1.4`) ni revisar importación/exportación Excel (`1.5`), que se abordarán en una etapa posterior.
- Agregar un botón interruptor `Gestionar` en Finanzas.
- Modificar el esquema de base de datos en Supabase.

## Users & context
- **Administradores y Secretario Financiero (con permiso de edición en Finanzas):** Concilian comprobantes con LCR, revisan retiros/transferencias por período y ordenan cronológicamente las tablas desde PC o celular.
- **Presidencia (modo solo lectura en Finanzas):** Consulta el libro de gastos y movimientos pudiendo ordenar y filtrar por fechas sin alterar registros.

## Qué podrá hacer el usuario
- **En `Finanzas` → `Gastos`:**
  - Ver los gastos ordenados por defecto con **Pendientes de LCR primero** y el resto de **más recientes a más antiguos** según la **fecha contable / LCR**.
  - Hacer clic en el encabezado de la columna **`Fecha`** (con indicador visual `↓` / `↑`) en PC, o en el botón compacto **`Fecha ↓ / ↑`** en celular, para invertir el orden del resto de los registros manteniendo siempre los Pendientes de LCR arriba.
  - Pulsar el botón compacto **`Fechas`** para desplegar los campos **`Desde`** y **`Hasta`** (y **`Limpiar fechas`**), filtrando los comprobantes por su **fecha contable / LCR**.
- **En `Finanzas` → `Movimientos`:**
  - Ver los movimientos ordenados por defecto de **más recientes a más antiguos**.
  - Hacer clic en el encabezado de la columna **`Fecha`** (con indicador `↓` / `↑`) en PC, o en el botón compacto **`Fecha ↓ / ↑`** en celular, para invertir el orden.
  - Pulsar el botón compacto **`Fechas`** para desplegar **`Desde`** y **`Hasta`** (y **`Limpiar fechas`**), filtrando los movimientos por su fecha.
- **Estética unificada:**
  - Percibir una interfaz visualmente coherente con `Calendario`, `Proveedores` y `Directorio`: paleta azul marino `#072B52` / `#083563` en controles activos y botones principales/operativos, verde reservado solo para importes/confirmaciones positivas, y barras de filtros limpias.

## Qué resultado obtiene
- Al tocar el encabezado `Fecha` en Gastos o Movimientos, las filas cambian inmediatamente entre orden descendente (`↓`) y ascendente (`↑`), conservando en Gastos los Pendientes de LCR siempre arriba.
- Al cargar `Desde` y/o `Hasta` en el filtro `Fechas`, solo se muestran los registros cuya fecha contable/movimiento cae en ese rango, el botón `Fechas` muestra un indicador de filtro activo, y `Limpiar fechas` restaura la lista completa.
- Los botones de acción de Finanzas y las barras de control comparten la misma paleta azul marino institucional y lenguaje visual del resto de la app.

## Qué debe respetar
- **Constitución del proyecto (`02-DOCS/wiki/sdd/constitution.md`):** Formato monetario `#.##0,00` con `$`, contraste WCAG AA y diseño mobile-first limpio.
- **Reglas previas de Finanzas:**
  - En Gastos, la detección de duplicados, conciliación masiva/individual en LCR, gastos compartidos (`Varios`) y la pestaña `Proyectados` siguen funcionando sin regresiones.
  - Los filtros de fechas de `Gastos` y `Movimientos` son independientes entre sí.

## Cómo lo demuestra
- Compilación sin errores de TypeScript y Vite.
- Verificación automatizada en navegador (PC y móvil) comprobando: orden por defecto (recientes primero + Pendientes LCR arriba), cambio de orden al tocar el encabezado `Fecha` (y botón móvil), filtrado por rango `Desde` / `Hasta` sobre fecha contable LCR en Gastos y sobre fecha en Movimientos, y botón `Limpiar fechas`.

## Behaviour
- **Main path (ordenar por fecha):** El usuario toca el encabezado `Fecha` (o `Fecha ↓/↑` en móvil) → la flecha cambia de `↓` a `↑` → los registros se reordenan de más antiguos a más recientes (en Gastos, dejando siempre los Pendientes de LCR arriba).
- **Main path (filtrar por rango):** El usuario pulsa `Fechas` → elige `Desde` y/o `Hasta` → la tabla muestra solo los registros dentro del rango y el contador de resultados se actualiza → al pulsar `Limpiar fechas`, vuelven todos los registros del año.
- **Edge cases:**
  - *Solo `Desde` o solo `Hasta`:* funciona como límite abierto por el otro extremo.
  - *Rango sin resultados:* muestra estado vacío claro con opción para limpiar filtros.
  - *Cambio entre pestañas `Gastos` y `Movimientos`:* cada pestaña conserva su propio orden y rango de fechas sin interferir con la otra.
- **Error paths:**
  - No requiere llamadas nuevas al servidor; opera sobre los datos cargados sin riesgo de pérdida de información.

## Acceptance criteria
- **AC-1 (Orden por fecha en Gastos con Pendientes LCR arriba):** Given el usuario entra a `Finanzas` → `Gastos`, When observa la tabla por defecto, Then los gastos `Pendiente LCR` aparecen primero y el resto ordenados de más reciente a más antiguo por fecha contable LCR; When hace clic en el encabezado `Fecha` (o botón de orden móvil), Then el resto se ordena de más antiguo a más reciente manteniendo los `Pendiente LCR` arriba.
- **AC-2 (Orden por fecha en Movimientos):** Given el usuario entra a `Finanzas` → `Movimientos`, When observa la tabla por defecto, Then los movimientos aparecen de más reciente a más antiguo; When hace clic en el encabezado `Fecha` (o botón de orden móvil), Then se invierte el orden a más antiguo primero.
- **AC-3 (Filtro por rango `Desde` / `Hasta` en Gastos y Movimientos):** Given el usuario pulsa el botón `Fechas` en `Gastos` o en `Movimientos`, When ingresa una fecha `Desde`, `Hasta` o ambas, Then solo se muestran los registros cuya fecha (contable LCR en Gastos; fecha del movimiento en Movimientos) está dentro del rango y el botón `Limpiar fechas` restaura todos los registros.
- **AC-4 (Estética unificada):** Given el usuario navega por `Finanzas`, When observa las barras de filtros y botones principales/operativos, Then usan la paleta azul marino institucional (`#072B52` / `#083563`) coherente con `Calendario`, `Proveedores` y `Directorio`, reservando el verde únicamente para importes/confirmaciones positivas.

## Points to clarify
- **suposición tomada** — En celular, donde las tablas de Gastos y Movimientos se muestran en formato tarjeta sin encabezado de columnas, se muestra un botón compacto `Fecha ↓ / ↑` junto a `Fechas` para ofrecer exactamente el mismo control de orden que el encabezado clicable en PC. *Base:* asegurar paridad completa entre PC y celular. *Riesgo:* ninguno.
