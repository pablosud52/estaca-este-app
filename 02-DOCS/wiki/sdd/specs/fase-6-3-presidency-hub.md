---
type: spec
title: Spec — Hub Ejecutivo de Presidencia y Bandeja de Aprobación (Paso 6.3)
description: WHAT and WHY for the Presidency Executive Hub, global KPIs, quarterly rollover, distribution chart, organization mirror cards, and activity approval tray.
tags: [sdd, spec]
timestamp: 2026-11-09T00:16:00Z
topic: sdd
slug: fase-6-3-presidency-hub
branch: main
status: clarified
---

# Spec — Hub Ejecutivo de Presidencia y Bandeja de Aprobación (Paso 6.3)

> Slug: `fase-6-3-presidency-hub` · Status: clarified · Created: 2026-11-09
> Inherits: [constitution](../constitution.md)

## Problem & why
La Presidencia de la Estaca Montevideo Este y los Administradores Financieros necesitan un panel ejecutivo consolidado —tanto en sus teléfonos móviles como en tabletas o computadoras de escritorio— que les permita supervisar en tiempo real el presupuesto global de la Estaca, la evolución acumulativa de los fondos del trimestre 1 al 4, el porcentaje de presupuesto asignado y consumido por cada una de las 8 organizaciones más Seminario, y revisar o aprobar las propuestas de actividades enviadas por los líderes sin depender de mensajes dispersos.

## Cost of not building it
La Presidencia carece de visibilidad consolidada sobre qué organizaciones están subejecutando o sobregirando su presupuesto anual, las propuestas de actividades enviadas desde la vista móvil del líder quedan estancadas en estado pendiente sin poder aprobarse ni ajustarse, y el Secretario Financiero debe preparar informes manuales antes de cada reunión de presidencia.

## The cheapest alternative
Revisar individualmente organización por organización usando el selector de perfiles de desarrollo. No es suficiente porque impide comparar el ritmo de gasto global frente a las asignaciones trimestrales, no ofrece una gráfica comparativa de distribución porcentual y carece de una bandeja centralizada para aprobar, editar o rechazar actividades propuestas.

## Goals
- Presentar tarjetas métricas ejecutivas de alto impacto con el Presupuesto Global Asignado, Total Ejecutado Consolidado, Saldo Disponible y alerta de comprobantes pendientes en el sistema oficial, todo en formato `$ #.##0,00`.
- Mostrar el módulo de Apertura Anual más Ingresos Trimestrales Acumulados (`T1` a `T4`) reflejando el arrastre automático de remanentes no ejecutados frente al gasto real de cada trimestre.
- Ofrecer un gráfico interactivo que permita alternar en un toque entre montos asignados/ejecutados (`$ #.##0,00`) y distribución porcentual (`%`).
- Renderizar la cuadrícula de las 8 organizaciones más Seminario con su saldo actual, consumo ejecutado, barra de progreso con semáforo dinámico (verde, ámbar, rojo), próxima actividad y acceso en un clic al Modo Espejo (vista idéntica a la del líder).
- Proveer una Bandeja de Aprobación de Actividades con indicador visual pulsante cuando existan propuestas pendientes, permitiendo Aprobar, Rechazar o Editar (fecha, hora, lugar, descripción y costo estimado) según los permisos del integrante de la Presidencia.

## Non-goals / out of scope
- Carga de nuevos comprobantes de gastos, retiros de efectivo, conciliación bancaria en cero o importación/exportación de libros Excel (correspondientes al Paso 6.4 del Centro de Edición y Carga Operativa del Administrador).
- Alta, baja o modificación de permisos de usuarios (correspondiente al Paso 6.4 de Gestión de Usuarios).

## Users & context
- **Presidente de Estaca, Primer y Segundo Consejero, y Secretario Financiero**: Supervisan el estado financiero global de la Estaca y aprueban, editan o rechazan las propuestas de actividades enviadas por las organizaciones.
- **Secretario de Estaca y Secretario Ejecutivo**: Consultan el Dashboard Ejecutivo, las gráficas y el modo espejo de cada organización para seguimiento de agenda y actas, visualizando la bandeja de propuestas en modo lectura salvo que tengan habilitado el permiso específico de aprobación.

## What the user can do
Un integrante de la Presidencia o Administrador autenticado puede consultar los indicadores globales y trimestrales del año fiscal, alternar la gráfica comparativa entre montos y porcentajes, inspeccionar cualquier organización en Modo Espejo y regresar al Hub en un toque, y abrir la Bandeja de Aprobación de Actividades (destacada con alerta parpadeante cuando hay pendientes) para aprobar, rechazar o editar los datos y el presupuesto estimado de una propuesta si cuenta con permiso de aprobación.

## What result they get
El usuario visualiza un Hub Ejecutivo responsivo (adaptado a pantallas móviles de consejeros y pantallas anchas de secretarios) con importes en formato `$ #.##0,00` y fechas `dd/mm/aaaa`, gráfica interactiva fluida, 9 tarjetas organizacionales con barras de progreso semafóricas y una bandeja de aprobación donde al editar o aprobar una propuesta el contador de alertas pendientes se actualiza al instante y el evento pasa a figurar como aprobado en el calendario, comprobado mediante pruebas automatizadas de extremo a extremo.

## What it must respect
- **Regla Sagrada #1 (Administradores Permanentes Inmutables)**: El Presidente de Estaca y el Secretario Financiero mantienen visible su condición de administradores permanentes inmutables.
- **Permiso Granular de Aprobación en Presidencia (`PROJECT_CONTEXT.md` §2 y §4.2)**: Solo los miembros con permiso `can_approve_activities` activo (Presidente, Secretario Financiero y Consejeros por defecto) pueden ejecutar las acciones de Aprobar, Editar o Rechazar propuestas; los secretarios sin ese permiso ven la bandeja en modo consulta.
- **Regla de Acumulación Trimestral (`PROJECT_CONTEXT.md` §5.2)**: Los saldos no ejecutados de un trimestre se arrastran automáticamente a la disponibilidad del trimestre siguiente.
- **Formato Oficial (`constitution.md` §2.4)**: Todos los montos en `$ #.##0,00` y fechas en `dd/mm/aaaa`.

## How it proves it
Una suite de pruebas automatizadas de extremo a extremo en navegador móvil y de escritorio (`tests/presidency-hub.spec.ts`) verifica la exactitud de los KPIs globales y trimestrales, la conmutación del gráfico entre montos y porcentajes, la entrada y salida del Modo Espejo de las organizaciones, la edición y aprobación interactiva de propuestas pendientes y la restricción de botones de aprobación para perfiles de Presidencia sin permiso delegado.

## Behaviour
- **Main path**: Al autenticarse como miembro de Presidencia o Administrador, el usuario ingresa al Hub Ejecutivo donde observa los KPIs consolidados, la evolución trimestral `T1`–`T4`, el gráfico comparativo y las 9 tarjetas de organizaciones. Si existen propuestas pendientes, el botón de la Bandeja de Aprobación muestra un indicador pulsante con la cantidad pendiente; al abrirla, el usuario autorizado puede editar los detalles o aprobar/rechazar cada propuesta en vivo.
- **Edge cases**: Cuando todas las propuestas pendientes han sido resueltas, el indicador pulsante desaparece y la bandeja muestra un estado limpio de confirmación junto al historial de actividades aprobadas/rechazadas. Cuando el usuario toca "Ver como Líder" en cualquiera de las 9 tarjetas, entra en Modo Espejo viendo exactamente la interfaz móvil de esa organización con un botón superior para volver al Hub.
- **Error paths**: Si un integrante de Presidencia sin permiso de aprobación (`Secretario de Estaca`) abre la Bandeja de Aprobación, visualiza el detalle de las propuestas pendientes y un aviso informativo indicando que la aprobación requiere autorización de Presidencia, con los controles de acción deshabilitados.

## Acceptance criteria
- Given un miembro de Presidencia o Administrador en el Hub Ejecutivo, When consulta las tarjetas superiores y el módulo trimestral, Then visualiza el presupuesto asignado de organizaciones (`$ 484.000,00`), el total ejecutado y el desglose `T1`–`T4` en formato `$ #.##0,00`.
- Given el gráfico de distribución presupuestaria, When el usuario alterna entre los botones "Montos ($)" y "Porcentajes (%)", Then la visualización conmuta su modo activo y las 9 tarjetas de organizaciones muestran su barra de progreso y saldo correspondiente.
- Given la cuadrícula de organizaciones en el Hub Ejecutivo, When el usuario pulsa en una organización para abrir el Modo Espejo, Then se abre la vista individual del líder de esa organización y puede regresar al Hub pulsando el botón "Hub".
- Given existen propuestas pendientes en la Bandeja de Aprobación y el usuario tiene permiso `can_approve_activities`, When edita el costo estimado de una propuesta y la aprueba, Then el contador del indicador pulsante disminuye en 1 y la actividad queda en estado `APROBADA` con el nuevo importe formateado.
- Given un perfil de Presidencia sin permiso de aprobación (`Secretario de Estaca`), When abre la Bandeja de Aprobación de Actividades, Then visualiza las propuestas pendientes y el aviso de solo lectura sin botones activos de aprobar o rechazar.

## Points to clarify
- **suposición tomada** — En las tarjetas KPI superiores se exhibe de forma principal el Presupuesto Operativo Asignado a Organizaciones (`$ 484.000,00`) junto al remanente del Fondo Central de Estaca, para que los porcentajes de distribución por organización sumen el 100% sin distorsión por ajustes contables negativos de la cuenta central. *Base:* Estructura de `01_initial_schema.sql` donde `ESTACA` actúa como bolsa de distribución de trimestres. *Riesgo:* Si se desea alternar entre vista sólo organizaciones vs. consolidado contable total, se incluye el desglose en la propia tarjeta.
- **decisión diferida** — Los botones de acceso a `Gestión de Usuarios` y `Centro de Edición y Carga Operativa` visibles para el rol `ADMIN` abrirán sus módulos completos en el Paso 6.4.
