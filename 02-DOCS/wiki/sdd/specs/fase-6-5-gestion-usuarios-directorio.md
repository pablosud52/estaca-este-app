---
type: spec
title: Spec — Rediseño de Gestión de Usuarios y Directorio de Líderes
description: WHAT and WHY for unifying stake user access management with the leaders directory, organization callings structure, strict Gmail rule, and incomplete-contact alerts.
tags: [sdd, spec, users, directory, rbac]
timestamp: 2026-11-13T23:45:00-03:00
topic: sdd
slug: fase-6-5-gestion-usuarios-directorio
status: clarified
---

# Spec — Rediseño de Gestión de Usuarios y Directorio de Líderes

> Slug: `fase-6-5-gestion-usuarios-directorio` · Status: clarified (approved in autopilot) · Created: 2026-11-13
> Inherits: [constitution](../constitution.md)

## Problem & why
Actualmente la gestión de usuarios muestra una lista plana que no refleja la estructura real de organizaciones y llamamientos de la Estaca, no separa Nombre y Apellido, no exige correos `@gmail.com` y obligaría a cargar dos veces a las mismas personas cuando se implemente el Directorio de Líderes. Además, existen líderes (Sumo Consejo, Escuela Dominical, Bienestar y Autosuficiencia, Música) que no manejan presupuesto pero necesitan figurar en el directorio y eventualmente acceder al calendario y proveedores.

## Cost of not building it
Cada relevo de liderazgo exige buscar manualmente quién ocupa cada puesto, se corre el riesgo de registrar correos no válidos para el inicio de sesión con Google, y se duplica la carga administrativa entre permisos de la app y el directorio de contactos de la Estaca.

## The cheapest alternative
Mantener la tabla plana actual de usuarios y gestionar el Directorio de Líderes en una planilla externa. No resuelve la sincronización automática cuando hay relevos, ni permite activar/desactivar el acceso a la app con un clic, ni avisa a la Presidencia cuando faltan datos de contacto.

## Goals
- Unificar en una sola fuente de verdad la carga de líderes por organización y la habilitación de acceso a la aplicación.
- Reflejar fielmente la estructura de llamamientos de las 12 organizaciones/comités de la Estaca, incluyendo las asignaciones del Sumo Consejo y el límite de integrantes adicionales (3 en general, 2 en CFS).
- Garantizar que todo correo ingresado para autenticación sea estrictamente `@gmail.com` y que todo teléfono sea de telefonía móvil.
- Dar visibilidad inmediata a la Presidencia sobre contactos con datos incompletos mediante un aviso parpadeante en su panel principal.

## Non-goals / out of scope
- Carga o edición del Directorio de Proveedores (ya cuenta con su propia vista).
- Envío automático de correos o mensajes de WhatsApp de bienvenida al activar un usuario (la comunicación sigue siendo directa).
- Cambio de las reglas contables de presupuestos, retiros, conciliación LCR o confidencialidad de costos en calendario.
- Asignación de presupuestos propios a organizaciones sin presupuesto (Sumo Consejo, Escuela Dominical, Bienestar y Autosuficiencia, Música).

## Users & context
- **Administrador (Presidente de Estaca, Secretario Financiero y Secretario de Estaca si tiene rol Admin):** Gestiona el organigrama completo, carga/edita personas, agrega auxiliares/asesores hasta el máximo permitido, activa o desactiva el interruptor `Acceso App` y asigna roles y permisos de aprobación.
- **Presidencia de Estaca (Consejeros y Secretario Ejecutivo):** Visualiza el aviso parpadeante de contactos incompletos en su Hub y consulta el Directorio de Líderes.
- **Líderes con presupuesto (MJ, HJ, SS, Primaria, JAS, AS, CFS):** Consultan el Directorio de Líderes en modo solo lectura con buscador y acceso directo a WhatsApp.
- **Líderes/Miembros sin presupuesto (rol de consulta):** Acceden únicamente al Directorio de Líderes, al Calendario General (sin costos confidenciales) y al Directorio de Proveedores.

## What the user can do
- **Administrador en Gestión de Usuarios:**
  - Ver las organizaciones separadas en tarjetas/bloques según el organigrama oficial: Presidencia (6 fijos), Sumo Consejo (12 fijos), Sociedad de Socorro (4 fijos), Hombres Jóvenes (4 fijos), Mujeres Jóvenes (4 fijos), Escuela Dominical (4 fijos), Primaria (4 fijos), JAS (2 fijos), AS (2 fijos: varón y mujer), Bienestar y Autosuficiencia (3 fijos), Música (3 fijos) y Centro FamilySearch / CFS (1 fijo: Director/a CFS).
  - Cargar y editar por cada puesto: **Nombre**, **Apellido**, **Teléfono móvil** (opcional; al ingresarse debe validarse como `09xxxxxxx` todo junto sin espacios, 9 dígitos) y **Correo Gmail** (opcional hasta habilitar acceso, obligatorio formato `@gmail.com` si se ingresa).
  - En **Sumo Consejo**, registrar además **Unidad asignada** y **Organización / Comité asignado**, y vincular a una persona ya cargada en otro puesto (por ejemplo, Presidente o Consejero de HJ o ED) sin duplicar sus datos personales.
  - Al final de cada organización (excepto Sumo Consejo), usar el botón para agregar integrantes adicionales con rol seleccionable (`Secretario Auxiliar`, `Asesor` o `Ingresar manualmente`) hasta un máximo de **3** por organización (y máximo **2** auxiliares en **CFS**).
  - Activar o desactivar el interruptor **`Acceso App`** en cualquier persona cargada, manteniendo sus datos intactos en el directorio.
  - Filtrar por contactos incompletos desde el contador superior de advertencia.
- **Cualquier usuario autorizado en Directorio de Líderes:**
  - Consultar la lista organizada por organización y buscar por nombre, llamamiento o unidad asignada en modo solo lectura.
  - Ver el teléfono móvil formateado en grupos de 3 dígitos (`09X XXX XXX`), con un botón para **Copiar** el número y un botón directo para abrir **WhatsApp**.

## What result they get
- Al guardar una persona con correo válido `@gmail.com` y el interruptor `Acceso App` activado, esa persona puede iniciar sesión con su cuenta de Google y ve únicamente las secciones permitidas para su rol (Líder con presupuesto, Presidencia, Admin o Consulta sin presupuesto).
- Al desactivar `Acceso App`, la persona deja de tener acceso a la app inmediatamente sin perder su registro en el directorio.
- Cuando existen contactos sin teléfono móvil o sin correo Gmail, tanto la cabecera de Gestión de Usuarios como el Hub de Presidencia muestran un aviso visible con indicador parpadeante.

## What it must respect
- **Regla de Administradores Permanentes:** El Presidente de Estaca y el Propietario del Sistema (`pablosud52@gmail.com`) son administradores inmutables; ningún administrador puede revocarse sus propios permisos ni desactivarse a sí mismo.
- **Exclusividad de Rol Administrador:** Solo integrantes de la Presidencia de Estaca (y `pablosud52@gmail.com`) pueden recibir el rol `ADMIN`.
- **Aislamiento Organizacional y Confidencialidad:** Quienes tengan rol de consulta (Sumo Consejo sin HJ, Escuela Dominical, Bienestar, Música) nunca ven presupuestos, saldos, gastos ni costos estimados de actividades. Quienes pertenezcan a la presidencia de Hombres Jóvenes mantienen acceso inherente a Seminario.
- **Trazabilidad histórica:** Las desactivaciones son bajas lógicas; no se borran registros históricos.

## How it proves it
- Verificación funcional en navegador y pruebas automatizadas sobre:
  - Validación estricta `@gmail.com` (rechazo de otros dominios, aceptación de `@gmail.com`).
  - Límite de agregados por organización (bloqueo al llegar a 3, y bloqueo al llegar a 2 en CFS).
  - Activación/desactivación del switch `Acceso App` y respeto de auto-protección de administradores.
  - Visibilidad del indicador parpadeante en el Hub de Presidencia cuando hay datos incompletos y desaparición al completarlos.
  - Aislamiento de vistas para el rol de consulta (ve Directorio, Calendario sin costos y Proveedores; no ve Finanzas).

## Behaviour
- **Main path:** El Administrador abre Gestión de Usuarios, ve las organizaciones separadas, completa o actualiza los puestos fijos (o agrega hasta 3 extras / 2 en CFS), valida que el correo sea `@gmail.com`, y decide con el switch `Acceso App` quién entra a la app. Todos los usuarios autorizados ven los cambios reflejados en el Directorio de Líderes.
- **Edge cases:**
  - Un miembro del Sumo Consejo es también Presidente o Consejero de HJ o ED: se vincula la misma persona para no duplicar Nombre/Apellido/Celular/Gmail; si su puesto incluye HJ, su acceso efectivo contempla HJ + Seminario.
  - Una persona se carga sin celular o sin Gmail inicialmente: se permite guardar, queda marcada como contacto incompleto y dispara el recordatorio en Gestión de Usuarios y el indicador parpadeante en Presidencia.
  - Si no tiene Gmail cargado, no puede activarse `Acceso App` hasta ingresar un correo `@gmail.com` válido.
- **Error paths:**
  - Ingresar un correo que no termine en `@gmail.com` bloquea el guardado y muestra un mensaje claro indicando que solo se permiten cuentas de Gmail.
  - Intentar agregar un 4.º extra (o 3.º en CFS) está deshabilitado en la interfaz y rechazado por validación.
  - Ingresar un número fijo o con formato inválido en el campo de teléfono móvil muestra un aviso de validación.

## Acceptance criteria
- Given un puesto en cualquier organización, When el Administrador ingresa un correo `@hotmail.com` o `@outlook.com` e intenta guardar, Then el sistema rechaza el guardado y muestra el mensaje de que solo se permiten correos `@gmail.com`.
- Given una organización con límite de 3 extras (o CFS con límite de 2), When ya existen el máximo de integrantes adicionales, Then el botón de agregar queda deshabilitado y no permite sumar más.
- Given cualquier persona cargada con Gmail válido, When el Administrador apaga el switch `Acceso App`, Then la persona conserva sus datos en el Directorio de Líderes pero su acceso a la app queda bloqueado.
- Given al menos un contacto en el organigrama al que le falta teléfono móvil o Gmail, When un miembro de la Presidencia abre su Hub, Then visualiza el recordatorio parpadeante de datos incompletos.
- Given un usuario con rol de consulta (por ejemplo Música o Sumo Consejo sin HJ), When inicia sesión, Then puede navegar al Directorio de Líderes, Calendario General (sin costos) y Proveedores, pero no tiene acceso a vistas ni montos de Finanzas.

## Points to clarify
- **suposición tomada** — Validar teléfonos móviles uruguayos (`09X XXX XXX` o `+598 9X XXX XXX`) permitiendo prefijo internacional si comienza con `+`. *Base:* En los datos actuales del proyecto se usa el formato `+598 99 000 000`. *Riesgo:* Bajo; si se requiere otro formato de país se ajusta la expresión regular.
- **suposición tomada** — En Sumo Consejo, el campo `Unidad asignada` ofrecerá la lista de barrios/ramas de la Estaca (Aeroparque, Carrasco, Malvin, Mvd9, Paso Carrasco, Rama, Sin asignar) con opción editable si aparece otra unidad. *Base:* Captura provista por el usuario. *Riesgo:* Bajo; evita errores de tipeo al filtrar.
- **suposición tomada** — El rol para usuarios sin presupuesto se denominará `CONSULTA` en el modelo interno. *Base:* Mantiene separación clara frente a `LIDER`, `PRESIDENCIA`, `ADMIN` y `NO_AUTORIZADO`. *Riesgo:* Ninguno visible para el usuario final.
