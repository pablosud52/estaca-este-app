---
type: spec
title: Spec — Proveedores Unificado con Modo Lectura e Interruptor Gestionar
description: WHAT and WHY para eliminar el acceso duplicado de Proveedores en Administración, iniciar en Modo Lectura limpio y habilitar la gestión detrás del botón Gestionar con switch Tarjetas / Lista.
tags: [sdd, spec, proveedores]
timestamp: 2026-11-22T22:00:00Z
topic: sdd
slug: proveedores-unificado
status: planned
---

# Spec — Proveedores Unificado con Modo Lectura e Interruptor Gestionar

> Slug: `proveedores-unificado` · Status: planned · Created: 2026-11-22 · Revised: 2026-11-22
> Inherits: [constitution](../constitution.md)

## Problem & why
Hoy `Proveedores` aparece duplicado en el menú (en la barra principal y otra vez dentro de *Administración*), y para los Administradores la pantalla siempre abre con todos los controles de edición visibles (`+ Nuevo Proveedor`, `Categorías`, `Pendientes`, `Editar` y `Eliminar`), recargando la vista cuando solo se busca un teléfono, dirección o RUT.

## Cost of not building it
El menú mantiene una entrada redundante que rompe la coherencia recién lograda en `Calendario`, y los Administradores siguen expuestos a toques accidentales de edición o borrado al consultar rápidamente un proveedor desde el celular.

## The cheapest alternative
Quitar solamente el enlace duplicado dentro de *Administración* sin agregar el interruptor `Gestionar`. No alcanza porque deja la pantalla de Proveedores siempre en modo edición para Administradores, sin la protección de Modo Lectura por defecto ni la posibilidad de alternar entre Tarjetas y Lista al gestionar.

## Goals
- Dejar un único acceso **`Proveedores`** en el menú principal (PC y móvil), eliminando el enlace repetido dentro de *Administración*.
- Abrir siempre `Proveedores` en **Modo Lectura limpio** para todos los usuarios (sin botones de edición ni pestañas administrativas visibles).
- Agregar un botón interruptor **`Gestionar`** (exclusivo para Administradores y Super Admin, con contador discreto si hay sugerencias pendientes desde Finanzas) que habilita todos los controles de administración en el mismo lugar.
- Ofrecer dentro de `Gestionar` un switch **`Tarjetas / Lista`** para alternar el formato visual cuando sea necesario, manteniendo el comportamiento responsivo actual por defecto.

## Non-goals / out of scope
- Cambiar los permisos de acceso: Presidencia (no Admin), Líderes y Consulta siguen en modo consulta únicamente.
- Modificar el formulario de alta/edición de proveedores, el modal de categorías/rubros ni el flujo de sugerencia desde Finanzas.
- Modificar el esquema de base de datos de proveedores en Supabase.

## Users & context
- **Administradores y Super Admin:** Consultan rápidamente teléfonos, WhatsApp, direcciones y RUT en Modo Lectura, y cuando necesitan dar de alta, editar, aprobar sugerencias pendientes o gestionar rubros, activan `Gestionar` con un clic.
- **Presidencia (no Admin), Líderes y Consulta:** Consultan el directorio de proveedores en Modo Lectura limpio; nunca ven el botón `Gestionar` ni controles de edición.

## Qué podrá hacer el usuario
- **Todos los usuarios en `Proveedores` (Modo Lectura por defecto):**
  - Acceder desde un único botón **`Proveedores`** en el menú principal.
  - Buscar proveedores, filtrar por rubro/categoría, filtrar por WhatsApp, ordenar (relevancia / A-Z / Z-A), copiar teléfonos o RUT, abrir WhatsApp, llamar o abrir ubicación en Maps, sin controles administrativos visibles.
- **Administradores y Super Admin mediante el botón `Gestionar`:**
  - Ver un contador discreto en el botón **`Proveedores`** del menú y en el botón **`Gestionar`** cuando existen sugerencias pendientes (`Pendientes`) provenientes de Finanzas.
  - Activar **`Gestionar`** para habilitar en la misma pantalla:
    - Botón **`+ Nuevo Proveedor`**.
    - Botón **`Categorías / Rubros`**.
    - Pestañas **`Directorio`** y **`Pendientes`** (con contador).
    - Switch **`Tarjetas / Lista`** para alternar entre vista en tarjetas desplegables y vista en tabla/lista (al entrar a `Proveedores` siempre se muestra en **Tarjetas** tanto en celular como en PC, y dentro de `Gestionar` se puede pasar a **Lista** y volver a **Tarjetas**).
    - Botones **`Editar`**, **`Eliminar`** (y **`Aprobar`** en pendientes) en cada proveedor.
  - Desactivar **`Gestionar`** para volver de inmediato a Modo Lectura limpio (restaurando la pestaña `Directorio` y ocultando botones de edición).

## Qué resultado obtiene
- En el menú principal (escritorio y móvil) desaparece el botón repetido de `Proveedores` dentro de *Administración*; queda un solo botón `Proveedores` con indicador discreto cuando hay pendientes (solo visible para Administradores).
- Al entrar a `Proveedores`, cualquier usuario (incluido un Administrador) ve la pantalla limpia en Modo Lectura sin botones de crear, editar ni eliminar.
- Al pulsar `Gestionar`, aparecen todos los controles administrativos y el switch `Tarjetas / Lista`; al salir de `Gestionar`, la pantalla vuelve limpia a Modo Lectura.

## Qué debe respetar
- **Constitución del proyecto (`02-DOCS/wiki/sdd/constitution.md`):** Diseño mobile-first limpio, táctil y sin sobrecarga visual.
- **Reglas previas de Proveedores y permisos:**
  - Solo Administradores y Super Admin tienen permiso de gestión (`canManage`).
  - Las sugerencias enviadas desde Finanzas siguen apareciendo en `Pendientes` para aprobación o descarte sin bloquear la carga de gastos.
  - Todas las acciones existentes (alta, edición, baja, aprobación rápida y gestión de rubros) siguen funcionando sin pérdida de funcionalidad.

## Cómo lo demuestra
- Compilación sin errores de TypeScript y Vite.
- Verificación automatizada en navegador (PC y móvil) comprobando: ausencia del botón duplicado en *Administración*, Modo Lectura limpio por defecto para Admin, activación de `Gestionar` revelando controles + switch `Tarjetas / Lista`, desactivación regresando a Modo Lectura, y ausencia total de `Gestionar` para Líderes y Presidencia no Admin.

## Behaviour
- **Main path (consulta):** Cualquier usuario abre `Proveedores` desde el menú principal → busca o filtra → llama, escribe por WhatsApp o copia el RUT sin ver botones de administración.
- **Main path (gestión):** Admin pulsa `Gestionar` → aparecen `+ Nuevo Proveedor`, `Categorías`, `Directorio / Pendientes`, switch `Tarjetas / Lista` y botones `Editar` / `Eliminar` → realiza sus cambios → desactiva `Gestionar` y vuelve a Modo Lectura.
- **Edge cases:**
  - *Sugerencias pendientes desde Finanzas:* si existen proveedores en estado `PENDIENTE`, el botón `Proveedores` (en el menú, solo para Admins) y el botón `Gestionar` muestran un contador discreto; al entrar en `Gestionar` se puede pasar a `Pendientes` y aprobarlos.
  - *Salir de `Gestionar` estando en `Pendientes`:* vuelve automáticamente a mostrar el `Directorio` activo en Modo Lectura.
  - *Cambio de vista `Tarjetas / Lista` en móvil o PC:* permite forzar vista Tarjetas en PC o vista Lista compacta en móvil mientras `Gestionar` está activo.
- **Error paths:**
  - Si falla una operación de guardado o eliminación, se mantiene el estado sin pérdida de datos del formulario y se informa claramente al operador.

## Acceptance criteria
- **AC-1 (Acceso único en menú):** Given un Administrador o miembro de Presidencia abre el menú principal (escritorio o móvil), When revisa la barra y el bloque *Administración*, Then existe un único botón `Proveedores` en la navegación principal y no existe un botón duplicado de `Proveedores` dentro de *Administración*.
- **AC-2 (Modo Lectura por defecto):** Given un Administrador entra a `Proveedores`, When carga la pantalla, Then ve el botón `Gestionar`, pero no ve `+ Nuevo Proveedor`, `Categorías`, la pestaña `Pendientes` ni botones de `Editar` o `Eliminar` en los proveedores.
- **AC-3 (Activación de `Gestionar` y switch `Tarjetas / Lista`):** Given un Administrador en `Proveedores`, When pulsa `Gestionar`, Then aparecen `+ Nuevo Proveedor`, `Categorías`, las pestañas `Directorio / Pendientes`, el switch `Tarjetas / Lista` (que alterna efectivamente entre tarjetas y lista/tabla) y los botones `Editar` / `Eliminar`; al volver a pulsar `Gestionar`, todos esos controles se ocultan y regresa a `Directorio` en Modo Lectura.
- **AC-4 (Contador discreto de pendientes):** Given existe al menos un proveedor en estado `PENDIENTE`, When un Administrador ve el menú principal o entra a `Proveedores` en Modo Lectura, Then ve el contador discreto en el botón `Proveedores` del menú y en el botón `Gestionar`.
- **AC-5 (Aislamiento de permisos):** Given un Líder, miembro de Presidencia no Admin o usuario de Consulta entra a `Proveedores`, When carga la pantalla, Then nunca ve el botón `Gestionar`, ni contadores de pendientes, ni controles de edición.

## Points to clarify
- **suposición tomada** — El contador de proveedores pendientes en el menú principal es visible solo para Administradores y Super Admin (quienes pueden aprobarlos), no para Presidencia no Admin ni Líderes. *Base:* consistente con la regla de permisos de Proveedores (`canManage`) y con cómo funcionan las alertas de Directorio/Finanzas en el menú. *Riesgo:* ninguno; evita mostrar avisos a quien no puede resolverlos.
