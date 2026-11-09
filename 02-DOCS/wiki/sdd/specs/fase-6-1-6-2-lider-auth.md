---
type: spec
title: Spec — Control de Acceso por Roles y Vista Móvil del Líder
description: WHAT and WHY for RBAC role simulation and the mobile leader experience — problem, goals, behaviour, acceptance criteria.
tags: [sdd, spec]
timestamp: 2026-11-08T23:18:00Z
topic: sdd
slug: fase-6-1-6-2-lider-auth
branch: main
status: clarified
---

# Spec — Control de Acceso por Roles y Vista Móvil del Líder

> Slug: `fase-6-1-6-2-lider-auth` · Status: clarified · Created: 2026-11-08
> Inherits: [constitution](../constitution.md)

## Problem & why
Los líderes de organizaciones de la Estaca Montevideo Este necesitan consultar al instante desde sus teléfonos su saldo disponible real, su próxima actividad programada, su historial de gastos y su agenda anual sin depender de planillas de escritorio complejas ni exponer cifras presupuestarias de otras organizaciones. A la vez, durante la construcción y auditoría del sistema es indispensable alternar entre perfiles de usuario (Líderes, Presidencia, Administradores Permanentes y Usuarios No Autorizados) para verificar el aislamiento de datos y las reglas de negocio.

## Cost of not building it
Los líderes continúan consultando por mensaje al Secretario Financiero para conocer su saldo antes de cada actividad, las propuestas de eventos carecen de un canal estructurado vinculado al presupuesto y no existe forma ágil de comprobar las restricciones de confidencialidad por rol antes del uso en producción.

## The cheapest alternative
Compartir capturas estáticas de la planilla de finanzas por mensajería cada mes. Resulta insuficiente porque queda desactualizado tras cada rendición o retiro, no permite proponer actividades desde el móvil ni garantiza la confidencialidad interactiva del calendario general.

## Goals
- Permitir a cada líder visualizar en segundos su saldo disponible, presupuesto anual asignado, gastos ejecutados y evolución acumulada por trimestre en formato `$ #.##0,00`.
- Mostrar la próxima actividad programada de su organización con fecha `dd/mm/aaaa`, horario, lugar y costo estimado, junto a la acción para proponer nuevas actividades.
- Facilitar a los líderes de Mujeres Jóvenes y Hombres Jóvenes la inclusión y vinculación del fondo común de Seminario mediante una casilla de verificación simple.
- Mantener la pantalla móvil despejada mediante secciones colapsables para el historial anual de gastos y el calendario anual de actividades.
- Proteger estrictamente la confidencialidad de los costos estimados en el calendario frente a líderes de otras organizaciones y bloquear el acceso a usuarios no autorizados con el mensaje institucional exacto.

## Non-goals / out of scope
- Carga o subida de comprobantes de gastos por parte de los líderes desde el teléfono (la carga de gastos es exclusiva del Administrador Financiero según ADR-004).
- Almacenamiento o visualización de números de cuentas bancarias personales (prohibido por ADR-002).
- Panel de edición administrativa, conciliación de retiros y bandeja de aprobación de la Presidencia (correspondientes a los pasos siguientes de la Fase 6).

## Users & context
- **Líderes de Organizaciones (MJ, HJ, Primaria, Sociedad de Socorro, JAS, AS, CFS)**: Consultan desde su smartphone el estado de su presupuesto y agenda antes o durante reuniones de presidencia de su organización.
- **Presidencia de Estaca y Administradores Permanentes (Presidente y Secretario Financiero)**: Inspeccionan en modo espejo la vista de cualquier organización y verifican que sus cuentas permanentes conserven su protección inmutable.
- **Usuarios No Autorizados o Inactivos**: Personas que intentan ingresar sin perfil activo y reciben la indicación de contacto directo.

## What the user can do
Un líder autenticado y activo puede consultar el saldo y desglose trimestral de su organización, alternar la inclusión del fondo de Seminario (si pertenece a Mujeres Jóvenes u Hombres Jóvenes), desplegar u ocultar su historial de gastos y el calendario anual, y enviar una nueva propuesta de actividad indicando nombre, fecha, hora, lugar, costo estimado y si corresponde a Seminario. En entorno de desarrollo, el evaluador puede cambiar de perfil activo en un toque para verificar cada rol.

## What result they get
El usuario observa una interfaz móvil estilo billetera digital con importes en formato `$ #.##0,00` y fechas `dd/mm/aaaa`, acordeones colapsados por defecto que se despliegan suavemente al tocarlos, confirmación inmediata al proponer una actividad y ocultamiento total de montos y distintivos de presupuesto en actividades de otras organizaciones, verificado contra capturas y pruebas de extremo a extremo aprobadas por el usuario.

## What it must respect
- **Regla Sagrada #1 (Administradores Permanentes Inmutables)**: El Presidente de Estaca y el Secretario Financiero son administradores permanentes no revocables (`PROJECT_CONTEXT.md` §2 y `constitution.md` §2.1).
- **Regla Sagrada #2 / #9 (Confidencialidad de Costos en Calendario)**: El costo estimado y el distintivo `💰 Con Presupuesto` solo son visibles para Administradores, Presidencia y líderes de la organización anfitriona (o MJ/HJ para Seminario).
- **Regla Sagrada #4 (Formato Monetario y de Fecha)**: Importes con formato `$ #.##0,00` y fechas `dd/mm/aaaa`.
- **Regla de Gastos Reembolsables y Multiestaca (ADR-007 y ADR-013)**: Los gastos reembolsables externos no descuentan del presupuesto local, y los gastos compartidos multiestaca descuentan únicamente el gasto neto de la organización.

## How it proves it
Una batería de pruebas automatizadas de extremo a extremo en navegador móvil verifica los cinco escenarios críticos: cálculo de saldo y regla de Seminario en MJ/HJ, historial colapsable con gasto neto multiestaca, confidencialidad de costos en calendario vista desde otra organización, creación de propuesta de actividad compartida con Seminario y pantalla de bloqueo oficial para usuarios no autorizados.

## Behaviour
- **Main path**: Al ingresar como líder activo, el sistema muestra directamente la tarjeta de saldo de su organización, la tarjeta de próxima actividad y los dos acordeones colapsados (Historial de Gastos y Calendario Anual). Si el líder pertenece a MJ o HJ, puede activar la casilla de Seminario para sumar su disponibilidad o vincular una nueva propuesta de actividad a Seminario.
- **Edge cases**: Cuando un líder explora la agenda general de toda la Estaca, visualiza el título, fecha, hora y lugar de las actividades de otras organizaciones, pero el sistema omite por completo sus montos y el indicador de presupuesto. Cuando un gasto tiene reintegro de otras estacas, el líder ve el importe neto descontado de su presupuesto junto a la aclaración del total facturado.
- **Error paths**: Si un usuario no está registrado o se encuentra inactivo, el sistema bloquea toda información financiera y presenta únicamente el mensaje oficial: *"Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca."* Si el formulario de propuesta se envía sin título, fecha o lugar, informa el dato faltante sin cerrar la ventana.

## Acceptance criteria
- Given una líder activa de Mujeres Jóvenes, When visualiza su tarjeta de saldo y activa la casilla de Seminario, Then el saldo disponible pasa de `$ 51.437,00` a `$ 61.437,00` respetando el formato `$ #.##0,00`.
- Given un líder en la vista móvil inicial, When toca el encabezado de Historial Anual de Gastos, Then la sección se despliega mostrando los comprobantes con fecha `dd/mm/aaaa` y el gasto neto multiestaca de `$ 4.750,00`.
- Given una líder activa de Primaria que abre el Calendario Anual en vista Agenda General Estaca, When observa actividades con presupuesto de Adultos Solteros u Hombres Jóvenes, Then ve el nombre, fecha y lugar del evento pero no ve el importe ni el distintivo `💰 Con Presupuesto`.
- Given una líder de Mujeres Jóvenes en el formulario de Proponer Actividad, When registra una actividad marcando la casilla de Seminario y cambia al perfil de Hombres Jóvenes, Then la actividad propuesta y su presupuesto estimado aparecen automáticamente en la agenda de Hombres Jóvenes.
- Given un usuario no autorizado o inactivo, When intenta acceder a la aplicación, Then visualiza únicamente la pantalla de restricción con el texto exacto *"Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca."*

## Points to clarify
- **suposición tomada** — El selector flotante de perfiles permanece accesible en la esquina inferior derecha durante toda la Fase 6 para facilitar la auditoría inmediata de cada rol. *Base:* Requerimiento explícito del Paso 6.1 en `ROADMAP_PROGRESS.md`. *Riesgo:* Si en producción final se desea ocultar para usuarios estándar, se condicionará a variable de entorno o sesión de administrador.
- **decisión diferida** — La aprobación, edición o rechazo de las actividades propuestas se ejecutará desde la Bandeja de Aprobación de Presidencia en el Paso 6.3.
