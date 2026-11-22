---
type: spec
title: Spec — Calendario Unificado y Edición Complementaria LCR
description: WHAT and WHY para unificar el Calendario en una sola sección con Modo Lectura por defecto, interruptor Gestionar (Tarjetas/Lista), filtro por rango de fechas, edición complementaria LCR y vinculación automática/manual.
tags: [sdd, spec, calendario, lcr]
timestamp: 2026-11-22T16:10:00Z
topic: sdd
slug: calendario-unificado-lcr
status: planned
---

# Spec — Calendario Unificado y Edición Complementaria LCR

> Slug: `calendario-unificado-lcr` · Status: planned · Created: 2026-11-22 · Revised: 2026-11-22
> Inherits: [constitution](../constitution.md)

## Problem & why
Hoy el calendario está partido en dos pantallas distintas (`Calendario` solo para leer y `Panel de Control del Calendario` con tres pestañas separadas: `Aprobados`, `Esperando Aprobación` y `Pendientes en LCR`). Quien administra la agenda tiene que saltar entre pantallas, no tiene buscador ni filtro por fechas en la tabla de control, no puede editar un evento que creó en la app desde `Pendientes en LCR` para igualar su nombre al de LCR, y no distingue con claridad qué datos de un evento de LCR son propios de la app frente a los oficiales de LCR.

## Cost of not building it
Presidencia, Secretarios y Administradores siguen saltando entre dos secciones redundantes, perdiendo tiempo buscando eventos sin filtro de fechas, sufriendo duplicados cuando un evento se carga en la app con otro nombre que en LCR, y arriesgando que la sincronización con LCR pise sus ediciones.

## The cheapest alternative
Agregar un botón de editar en `Pendientes en LCR` y un buscador en `Aprobados`, manteniendo las dos pantallas y las tres pestañas actuales. No alcanza porque conserva la duplicación de pantallas y código, mantiene la confusión entre qué se hace en `Calendario` y qué en `Panel de Control`, no protege eventos globales y no separa las notas propias de la app respecto a los datos oficiales de LCR.

## Goals
- Unificar `Calendario` y `Panel de Control del Calendario` en una sola sección `Calendario` del menú principal.
- Mantener una experiencia limpia de **Modo Lectura en Tarjetas** por defecto para todos los usuarios, con un botón interruptor **`Gestionar`** para Presidencia, Secretarios y Administradores que habilita el cambio `Tarjetas / Lista`, los filtros de gestión y las acciones operativas.
- Agregar filtro por fecha o rango de fechas (`Desde` / `Hasta`) junto con el buscador y el filtro de organizaciones.
- Respetar la jerarquía de LCR como fuente oficial de verdad mientras se permite editar sin pérdida la información complementaria de la app (Organización, Presupuesto estimado y Notas complementarias visibles para todos) en eventos de Estaca.
- Eliminar duplicados mediante vinculación automática (por fecha y nombre normalizado) y vinculación manual en un clic.
- Proteger los eventos globales (`Churchwide Events`) como estrictamente de solo lectura.

## Non-goals / out of scope
- Escribir, crear o modificar eventos directamente dentro del sistema oficial de LCR (la app solo lee de LCR).
- Cambios temporales en título, fecha, horario o lugar de eventos ya vinculados a LCR con alertas de vencimiento (se mantienen en solo lectura con aviso claro).
- Modificar los módulos de Finanzas, Proveedores, Directorio o el árbol de permisos vigente fuera del calendario.
- Cambiar el funcionamiento interno del escudo de espera de sincronización con LCR.

## Users & context
- **Presidencia de Estaca, Secretarios y Administradores:** Consultan el calendario rápidamente en modo lectura y, cuando necesitan intervenir, activan `Gestionar` para aprobar propuestas, crear eventos, asignar organización/presupuesto/notas a eventos de LCR y vincular pendientes sin duplicados, desde celular o computadora.
- **Líderes de Organizaciones y usuarios de Consulta:** Consultan el calendario en tarjetas limpias (con filtro de organizaciones, buscador y rango de fechas) y, en el caso de Líderes, proponen actividades; nunca ven el botón `Gestionar` ni controles administrativos.

## Qué podrá hacer el usuario
- **Todos los usuarios en `Calendario` (Modo Lectura por defecto):**
  - Ver las actividades del año seleccionado en tarjetas, enfocadas automáticamente en la próxima actividad futura (con pasadas arriba atenuadas).
  - Filtrar por organizaciones, buscar por texto (nombre, lugar u organización) y filtrar por fecha o rango de fechas (`Desde` / `Hasta`).
  - Ver las **Notas complementarias** agregadas en la app en eventos de Estaca (además de la descripción oficial de LCR cuando exista).
- **Presidencia, Secretarios y Administradores mediante el botón `Gestionar`:**
  - Activar o desactivar **`Gestionar`** en cualquier momento (el botón muestra un punto pulsante con contador cuando hay propuestas esperando aprobación, pendientes en LCR o quitadas de LCR).
  - Con `Gestionar` activado:
    - Alternar entre vista **Tarjetas** (inicial) y vista **Lista** (compacta tipo tabla/listado).
    - Usar filtros rápidos de estado con contador: `Todas`, `Esperando aprobación`, `Pendientes en LCR`, `Quitadas de LCR`, más un interruptor para incluir o excluir `Canceladas / Rechazadas`.
    - Crear un evento directo (`+ Crear Evento`).
    - Aprobar, editar antes de aprobar o rechazar propuestas de líderes.
    - Editar cualquier actividad de Estaca:
      - Si **ya está vinculada a LCR**: ver título, fecha, horario y lugar en solo lectura (con aviso *"Dato oficial de LCR — se edita en LCR"*) y editar **Organización**, **Presupuesto estimado** y **Notas complementarias** (sin que LCR las sobrescriba).
      - Si **aún no está vinculada a LCR** (creada en la app o propuesta): editar todos sus campos (título, fecha, horario, lugar, organización, presupuesto estimado y descripción/notas).
    - Vincular manualmente en un clic una actividad pendiente de LCR con su equivalente de LCR, o marcarla como *"No requiere LCR"*.
    - Cancelar, eliminar o mantener una actividad (respetando el bloqueo por gastos rendidos, salvo para Super Admin).
  - Al pulsar un aviso de calendario desde el Dashboard (por ejemplo *"Propuestas pendientes"* o *"Pendientes en LCR"*), abrir el mismo `Calendario` con `Gestionar` ya activado y ese filtro seleccionado.
- **Eventos globales (`Churchwide Events`):**
  - Incluso con `Gestionar` activado, ningún usuario ve botón de editar ni de cancelar/eliminar sobre eventos globales.

## Qué resultado obtiene
- En el menú principal existe un único acceso `Calendario` (con indicador pulsante si hay pendientes) y desaparece la sección duplicada *"Panel de Control del Calendario"*.
- Al abrir `Calendario`, la vista inicia siempre limpia en Tarjetas (Modo Lectura). Al pulsar `Gestionar`, aparecen en el mismo lugar el cambio `Tarjetas / Lista`, los filtros de estado y las acciones de edición/aprobación/vinculación.
- Al filtrar por fecha o rango (`Desde` / `Hasta`), la lista muestra únicamente los eventos dentro de ese período.
- Al editar Organización, Presupuesto estimado o Notas complementarias de un evento de Estaca vinculado a LCR y sincronizar luego con LCR, esos tres datos permanecen intactos mientras LCR mantiene actualizados título, fecha, horario, lugar y descripción oficial.
- Al editar el nombre o fecha de un evento pendiente de LCR para hacerlo coincidir con uno de LCR (ignorando mayúsculas, tildes y espacios extra), o al sincronizar tras cargarlo en LCR, ambos se fusionan automáticamente en un solo registro sin duplicados.

## Qué debe respetar
- **Constitución del proyecto (`02-DOCS/wiki/sdd/constitution.md`):**
  - Confidencialidad del presupuesto estimado en Calendario (visible solo para Presidencia, Administradores y líderes de la organización anfitriona).
  - Formato monetario `#.##0,00` con `$` en interfaz.
  - Aislamiento organizacional para líderes y regla compartida de Seminario (MJ y HJ).
  - Diseño mobile-first limpio, táctil y sin sobrecarga visual.
- **Reglas previas del calendario y permisos:**
  - Todos los miembros de Presidencia (incluidos Secretarios) y Administradores tienen permiso de gestión en el calendario.
  - Los eventos provenientes de LCR nunca ingresan como propuestas a `Esperando aprobación`.
  - Reuniones reservadas (Sumo Consejo, Presidencia de Estaca) siguen ocultas para Líderes y Consulta.
  - Las actividades con gastos ya rendidos siguen bloqueadas para edición y eliminación salvo para el Super Admin (`pablosud52@gmail.com`).
  - Al cambiar presupuesto estimado, fecha u organización de una actividad aprobada, su reserva proyectada asociada en Finanzas se actualiza en sincronía.

## Cómo lo demuestra
- Pruebas unitarias automatizadas para normalización de nombres, vinculación automática por fecha y nombre, preservación de notas complementarias frente a sincronización LCR y filtrado por rango de fechas.
- Compilación sin errores de TypeScript y Vite.
- Verificación visual y funcional en navegador (PC y móvil) comprobando cada criterio de aceptación (AC-1 a AC-9), con evidencia registrada en el reporte de verificación.

## Behaviour
- **Main path (consulta rápida):** Cualquier usuario entra a `Calendario` → ve Tarjetas del año seleccionado enfocadas en la próxima actividad → puede filtrar por organización, texto o rango de fechas (`Desde` / `Hasta`) sin controles administrativos estorbando.
- **Main path (gestión de calendario):** Presidencia/Secretario/Admin pulsa `Gestionar` → aparecen el selector `Tarjetas / Lista`, filtros rápidos (`Todas`, `Esperando aprobación`, `Pendientes en LCR`, `Quitadas de LCR`, interruptor `Canceladas / Rechazadas`), `+ Crear Evento` y acciones en cada actividad editable.
- **Main path (editar evento LCR de Estaca):** Con `Gestionar` activo, pulsa editar → título, fecha, horario y lugar figuran en solo lectura con aviso de LCR → edita Organización, Presupuesto estimado y/o Notas complementarias → guarda → las notas se muestran a todos los usuarios que ven el evento y sobreviven a futuras sincronizaciones con LCR.
- **Main path (crear/editar evento local y vincular con LCR):** Crea un evento pendiente de LCR → puede editar todos sus campos (incluido el nombre) → si al guardar o al sincronizar coincide en fecha y nombre normalizado con un evento de LCR, se fusionan automáticamente en un único evento conservando organización, presupuesto y notas de la app y adoptando los datos oficiales de LCR; si el nombre es distinto, lo vincula en 1 clic con *"Vincular con LCR"*.
- **Edge cases:**
  - *Evento global (`Churchwide`):* visible como referencia en Tarjetas y Lista, sin botones de edición ni acciones destructivas.
  - *Evento con gastos ya rendidos:* muestra candado y deshabilita edición/eliminación para usuarios que no sean Super Admin.
  - *Rango de fechas invertido o sin resultados:* muestra estado vacío claro con botón rápido para limpiar filtros.
  - *Descripción de LCR + Notas de la app:* cuando un evento de LCR tiene descripción oficial y también notas complementarias de la app, se muestran ambos contenidos claramente sin que uno pise al otro.
  - *Entrada desde alerta del Dashboard:* activa `Gestionar` automáticamente con el filtro correspondiente aplicado.
- **Error paths:**
  - Si falla el guardado en el servidor o no hay conexión, se muestra un aviso claro sin perder los datos escritos en el formulario.
  - Si falla la sincronización en vivo con LCR, el calendario conserva los datos actuales y no borra ediciones complementarias locales.

## Acceptance criteria
- **AC-1 (Sección única y Modo Lectura por defecto):** Given Presidencia, Secretario o Admin abre el menú principal y entra a `Calendario`, When carga la pantalla, Then no existe una sección separada "Panel de Control del Calendario", el calendario abre en Modo Lectura (Tarjetas) sin botones de edición visibles, y muestra el botón interruptor `Gestionar` (con contador pulsante si hay pendientes).
- **AC-2 (Activación de Modo Gestión y cambio Tarjetas/Lista):** Given Presidencia, Secretario o Admin pulsa `Gestionar`, When el modo se activa, Then aparecen el selector `Tarjetas / Lista` (iniciando en Tarjetas), los filtros rápidos con contador (`Todas`, `Esperando aprobación`, `Pendientes en LCR`, `Quitadas de LCR`), el interruptor `Canceladas / Rechazadas`, el botón `+ Crear Evento` y las acciones por actividad; al desactivar `Gestionar`, vuelve a Modo Lectura en Tarjetas.
- **AC-3 (Filtro por fecha o rango de fechas):** Given cualquier usuario en `Calendario`, When ingresa una fecha `Desde`, `Hasta` o ambas, Then solo se muestran las actividades cuya fecha cae dentro de ese rango y existe una acción rápida para limpiar el filtro.
- **AC-4 (Edición complementaria en evento LCR de Estaca):** Given una actividad de Estaca ya vinculada a LCR y `Gestionar` activado, When el operador abre su edición, Then título, fecha, horario y lugar aparecen en solo lectura con aviso de que se editan en LCR, mientras que Organización, Presupuesto estimado y Notas complementarias sí pueden guardarse, las notas quedan visibles para todos los que ven el evento, y los tres campos sobreviven intactos a una nueva sincronización con LCR.
- **AC-5 (Protección de eventos globales):** Given un evento global (`Churchwide Events`), When cualquier usuario lo ve (incluso con `Gestionar` activado), Then no aparece botón de editar ni de cancelar/eliminar.
- **AC-6 (Edición completa en eventos no vinculados a LCR):** Given una actividad pendiente de LCR o marcada como "No requiere LCR" con `Gestionar` activado, When el operador pulsa editar, Then puede modificar todos sus campos (título, fecha, horario, lugar, organización, presupuesto y notas) y guardar los cambios.
- **AC-7 (Vinculación automática por fecha y nombre normalizado):** Given un evento pendiente de LCR con organización, presupuesto o notas cargados en la app, When llega un evento de LCR en la misma fecha con el mismo nombre (ignorando mayúsculas, tildes y espacios extra) o cuando el usuario edita el nombre/fecha del evento local para hacerlo coincidir, Then ambos se fusionan automáticamente en un solo registro sin duplicados, tomando título/fecha/hora/lugar/descripción oficial de LCR y conservando organización, presupuesto y notas complementarias de la app.
- **AC-8 (Vinculación manual en 1 clic):** Given un evento pendiente de LCR cuyo nombre difiere del cargado en LCR, When el operador pulsa "Vincular con LCR" y elige el evento equivalente, Then ambos se fusionan en un único registro adoptando los datos oficiales de LCR y conservando organización, presupuesto y notas complementarias de la app.
- **AC-9 (Aislamiento para Líderes/Consulta y bloqueo por gastos rendidos):** Given un Líder o usuario de Consulta en `Calendario`, When visualiza la pantalla, Then no ve el botón `Gestionar` ni controles de edición; Given una actividad con gastos ya rendidos, When un usuario no Super Admin activa `Gestionar`, Then la edición y eliminación de esa actividad permanecen bloqueadas.

## Points to clarify
- **suposición tomada** — El botón `+ Crear Evento` para Presidencia/Secretarios/Admins se muestra al activar `Gestionar` (dejando el Modo Lectura 100% limpio para consulta rápida). *Base:* pedido del usuario de entrar en modo lectura limpio y habilitar controles al activar el modo de gestión. *Riesgo:* requiere un toque extra (`Gestionar` → `+ Crear Evento`) si se entra solo a crear un evento.
- **decisión diferida** — Habilitar al futuro rol delegable "Editor de Finanzas" para editar solo el presupuesto estimado de actividades aprobadas (pendiente en el backlog general al concluir todas las secciones).

## Revisions
- **2026-11-22 (v2):** Unificación total en una sola sección `Calendario` con Modo Lectura (Tarjetas) por defecto e interruptor `Gestionar` que habilita `Tarjetas / Lista`, filtros y acciones; incorporación de filtro por fecha o rango de fechas; notas complementarias separadas y visibles para todos; confirmación de permisos de gestión para Secretarios de Presidencia.
