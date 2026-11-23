---
type: spec
title: Spec — Directorio Unificado con Modo Lectura, Gestionar y Badges Simplificados
description: WHAT and WHY para unificar Directorio y Gestión de Usuarios en un solo botón del menú principal, con Modo Lectura por defecto, interruptor Gestionar exclusivo de Administradores y simplificación visual de badges/roles.
tags: [sdd, spec, directorio, usuarios]
timestamp: 2026-11-22T22:25:00Z
topic: sdd
slug: directorio-unificado
status: planned
---

# Spec — Directorio Unificado con Modo Lectura, Gestionar y Badges Simplificados

> Slug: `directorio-unificado` · Status: planned · Created: 2026-11-22
> Inherits: [constitution](../constitution.md)

## Problem & why
Hoy `Directorio` está dividido en dos entradas y dos pantallas separadas: `Directorio` en el menú principal (solo lectura) y `Directorio` dentro de *Administración* (panel de gestión de usuarios y llamamientos). Además, el panel de gestión acumula varias etiquetas y colores por fila que dificultan ver rápido quién tiene acceso a la app y qué rol posee.

## Cost of not building it
Queda una última sección duplicada en el menú (rompiendo el patrón unificado que ya tienen `Calendario` y `Proveedores`), y los Administradores siguen leyendo filas sobrecargadas de badges cuando necesitan revisar accesos o completar contactos faltantes.

## The cheapest alternative
Quitar solo el botón duplicado en *Administración* y agregar el interruptor `Gestionar` sin limpiar los badges del panel de gestión. No alcanza porque deja pendiente la simplificación visual que hace más rápida y segura la lectura de permisos y accesos.

## Goals
- Dejar un único botón **`Directorio`** en el menú principal (escritorio y móvil), eliminando el acceso duplicado dentro de *Administración*.
- Abrir siempre `Directorio` en **Modo Lectura limpio** para todos los usuarios (acordeón de organizaciones con buscador, WhatsApp, llamada y copia de teléfono).
- Agregar un botón interruptor **`Gestionar`** (exclusivo para Administradores y Super Admin, con contador pulsante si hay contactos incompletos) que muestra en la misma pantalla el panel completo de gestión de puestos, relevos y accesos.
- Simplificar visualmente los badges y colores del modo gestión para que se distinga de un vistazo **quién tiene acceso a la app** y **qué rol posee**, sin alterar ninguna regla de negocio ni de seguridad.

## Non-goals / out of scope
- Cambiar las reglas de negocio de relevos en cascada, vinculación de personas existentes, auto-protección de administradores permanentes ni validaciones de Gmail/celular.
- Habilitar la gestión del Directorio a miembros de Presidencia no Administradores, Líderes o Consulta.
- Capturar correos de usuarios no autorizados que intentan entrar con Google (pendiente separado en el roadmap).

## Users & context
- **Administradores y Super Admin (Presidente, Secretario de Estaca y Super Admin):** Consultan contactos rápidamente en Modo Lectura y activan `Gestionar` cuando necesitan actualizar llamamientos, completar datos faltantes o habilitar/quitar acceso a la app.
- **Presidencia (no Admin), Líderes y Consulta:** Consultan el Directorio en Modo Lectura limpio; nunca ven el botón `Gestionar` ni contadores de contactos incompletos.

## Qué podrá hacer el usuario
- **Todos los usuarios en `Directorio` (Modo Lectura por defecto):**
  - Acceder desde un único botón **`Directorio`** en el menú principal.
  - Filtrar por organizaciones, buscar por nombre o llamamiento, copiar celular, abrir WhatsApp o llamar directamente sin controles de edición visibles.
- **Administradores y Super Admin mediante el botón `Gestionar`:**
  - Ver un contador pulsante en el botón **`Directorio`** del menú y en el botón **`Gestionar`** cuando hay contactos con datos incompletos.
  - Activar **`Gestionar`** para pasar en el mismo lugar al panel completo de gestión (puestos fijos y extras por organización, edición, relevos, vinculación de persona existente, altas/bajas de acceso y filtro *"Solo incompletos"*).
  - Distinguir de un vistazo en cada fila, con una paleta sobria y menos etiquetas: el **estado de acceso a la app** (con acceso / sin acceso) y el **rol efectivo** (`Admin`, `Presidencia`, `Líder`, `Consulta`), más el candado solo cuando es un administrador protegido.
  - Desactivar **`Gestionar`** (`Gestionando`) para volver de inmediato al Modo Lectura limpio.

## Qué resultado obtiene
- En el menú principal (escritorio y móvil) desaparece `Directorio` dentro de *Administración*; el botón único **`Directorio`** lleva el contador pulsante de contactos incompletos (solo para Administradores).
- Al entrar a `Directorio`, todos ven el Modo Lectura limpio. Al pulsar **`Gestionar`**, aparece en la misma pantalla el panel de gestión con badges simplificados y claros; al volver a pulsarlo, regresa al Modo Lectura.
- Si se entra desde una alerta de contactos incompletos, abre `Directorio` con `Gestionar` activado y el filtro de incompletos aplicado.

## Qué debe respetar
- **Constitución del proyecto (`02-DOCS/wiki/sdd/constitution.md`):**
  - Regla de Administradores Permanentes y auto-protección inmutable (ningún administrador puede revocar sus propios permisos ni eliminarse).
  - Diseño mobile-first limpio, táctil y con contraste WCAG AA.
- **Reglas previas del Directorio:**
  - Solo Administradores y Super Admin tienen acceso a `Gestionar`.
  - Sumo Consejo ordenado alfabéticamente sin numeración; organizaciones plegadas por defecto.
  - Todos los flujos existentes de edición inline, relevo de Presidente/a, vinculación de persona existente y alta de secretarios/asesores siguen funcionando sin regresiones.

## Cómo lo demuestra
- Compilación sin errores de TypeScript y Vite.
- Verificación automatizada en navegador (PC y móvil) comprobando: acceso único en menú (sin duplicado en *Administración*), Modo Lectura por defecto para Admin, activación/desactivación de `Gestionar`, visibilidad clara de accesos y roles simplificados, y ausencia total de `Gestionar` para Presidencia no Admin y Líderes.

## Behaviour
- **Main path (consulta):** Cualquier usuario entra a `Directorio` → despliega una organización o busca por texto → llama, abre WhatsApp o copia teléfono sin ver botones administrativos.
- **Main path (gestión):** Admin pulsa `Gestionar` → se muestra el panel de gestión completo con badges simplificados (acceso + rol claros, sin mezcla de colores llamativos) → edita puestos o permisos → desactiva `Gestionar` y vuelve a Modo Lectura.
- **Edge cases:**
  - *Contactos incompletos:* el botón `Directorio` en el menú (solo para Admins) y el botón `Gestionar` muestran el contador pulsante; al activar `Gestionar` puede filtrarse directo a incompletos.
  - *Puesto vacío (sin persona cargada):* se muestra discreto y limpio, sin badges de acceso innecesarios.
  - *Administrador permanente / propia cuenta:* mantiene el candado de protección y deshabilita revocación propia.
- **Error paths:**
  - Si falla una validación (Gmail inválido, celular uruguayo inválido) o el guardado en Supabase, muestra el aviso en la misma fila sin perder los datos escritos.

## Acceptance criteria
- **AC-1 (Acceso único en menú):** Given un Administrador o miembro de Presidencia abre el menú principal (escritorio o móvil), When revisa la barra y el bloque *Administración*, Then existe un único botón `Directorio` en la navegación principal y no existe un botón duplicado de `Directorio` dentro de *Administración*.
- **AC-2 (Modo Lectura por defecto):** Given un Administrador entra a `Directorio`, When carga la pantalla, Then ve el directorio en Modo Lectura y el botón `Gestionar`, sin controles de edición de puestos ni botones de permisos visibles.
- **AC-3 (Activación y salida de `Gestionar`):** Given un Administrador en `Directorio`, When pulsa `Gestionar`, Then se muestra en la misma pantalla el panel de gestión completo (con edición, filtro de incompletos y control de accesos) junto al botón `Gestionando`; When vuelve a pulsarlo, Then regresa al Modo Lectura limpio.
- **AC-4 (Badges simplificados en modo gestión):** Given un Administrador con `Gestionar` activado despliega una organización, When observa las personas cargadas, Then cada persona muestra de forma limpia y sobria su estado de acceso y su rol efectivo sin sobrecarga de colores ni etiquetas repetitivas, manteniendo el candado en cuentas protegidas.
- **AC-5 (Aislamiento de permisos):** Given un miembro de Presidencia no Admin, un Líder o un usuario de Consulta entra a `Directorio`, When carga la pantalla, Then nunca ve el botón `Gestionar`, ni contadores de contactos incompletos, ni controles de gestión.

## Points to clarify
- **suposición tomada** — El contador de contactos incompletos en el botón `Directorio` del menú es visible únicamente para Administradores y Super Admin (quienes pueden editarlos). *Base:* misma regla aplicada en `Proveedores` y en las alertas actuales de `PresidencyHub`. *Riesgo:* ninguno; evita mostrar alertas a quien no puede resolverlas.
