---
type: spec
title: Spec — Panel de Administrador, Conciliación LCR y Sincronización Excel (Paso 6.4)
description: WHAT and WHY for User Management with immutable self-protection, Live LCR Reconciliation Monitor, MMDD-MONTO rapid entry, Stake Shared Expense Distribution, and Excel bidirectional sync.
tags: [sdd, spec]
timestamp: 2026-11-09T00:37:30Z
topic: sdd
slug: fase-6-4-admin-panel
branch: main
status: clarified
---

# Spec — Panel de Administrador, Conciliación LCR y Sincronización Excel (Paso 6.4)

> Slug: `fase-6-4-admin-panel` · Status: clarified · Created: 2026-11-09
> Inherits: [constitution](../constitution.md)

## Problem & why
El Secretario Financiero y el Presidente de la Estaca Montevideo Este necesitan una consola administrativa centralizada para dar de alta o baja a líderes y gestionar permisos de Presidencia sin poner en riesgo los accesos permanentes, conciliar en tiempo real los retiros de efectivo y comprobantes pendientes frente al sistema oficial de la Iglesia (LCR), registrar gastos con rapidez mediante la convención `MMDD-MONTO` o pagos directos, prorratear actividades generales de Estaca entre organizaciones participantes sin alterar sus presupuestos originales, y respaldar o importar toda la contabilidad en un archivo Excel auditable.

## Cost of not building it
El Administrador Financiero tendría que modificar tablas directamente en la base de datos para cargar cada gasto o retiro, carecería de un monitor en tiempo real que alerte sobre descuadres entre efectivo retirado y comprobantes rendidos en LCR, podría revocar accidentalmente sus propios permisos administrativos, y perdería la compatibilidad con su respaldo local en Excel.

## The cheapest alternative
Realizar toda la operatoria mediante consultas manuales en el panel externo de la base de datos y fórmulas en una hoja de cálculo separada. Resulta insuficiente porque rompe la trazabilidad en vivo con las vistas de líderes y Presidencia, exige doble digitación y no aplica las validaciones de negocio (como el bloqueo de auto-eliminación de administradores o el cálculo automático de gastos multiestaca).

## Goals
- Proveer el módulo de Gestión de Usuarios con banner explicativo de seguridad y cumplimiento estricto de la regla de auto-protección inmutable (ningún administrador puede revocar sus propios permisos ni desactivarse, y tanto Pablo Lamela como el Presidente de Estaca están permanentemente protegidos).
- Mostrar el Monitor de Conciliación en Vivo con LCR con tarjetas de Total Retirado vs. Total Rendido, Retiros sin justificar con responsables, Total sin justificar en LCR y semáforo dinámico de cuadratura en formato `$ #.##0,00`.
- Agilizar la carga operativa de gastos mediante el atajo inteligente `MMDD-MONTO` (que autocompleta fecha `dd/mm/aaaa` e importe `$ #.##0,00`), casilla de Gasto Directo, soporte de reintegros multiestaca, selector de proveedores con alta rápida y control de retiros hasta remanente cero.
- Incorporar la herramienta "Distribuir Gasto de Actividad de Estaca" (Opción B) para prorratear eventos generales por partes iguales o montos personalizados bajo la etiqueta `Actividad General de Estaca: [Nombre Evento]`.
- Habilitar la exportación e importación bidireccional con validación previa de libros Excel compatibles con la estructura maestra de finanzas.

## Non-goals / out of scope
- Almacenamiento de números de cuenta bancaria o CBU/IBAN de líderes o proveedores (estrictamente prohibido por ADR-002 y la Constitución del proyecto).
- Eliminación física destructiva de usuarios con historial (se utilizan exclusivamente bajas lógicas para preservar la auditoría).

## Users & context
- **Secretario Financiero de Estaca (`Pablo Lamela`) y Presidente de Estaca**: Administradores permanentes inmutables que operan la carga de retiros, rendición de facturas, conciliación con LCR, distribución de gastos compartidos, gestión de cuentas de usuarios y respaldos en Excel.
- **Otros miembros de Presidencia con rol Administrador delegado**: Pueden operar el panel administrativo respetando el bloqueo sobre sí mismos y sobre los dos administradores permanentes.

## What the user can do
Un usuario con rol `ADMIN` puede abrir desde el Hub Ejecutivo el panel de **Gestión de Usuarios** (para crear usuarios, activar/desactivar cuentas de otros líderes, delegar el permiso de aprobación de actividades en Presidencia o asignar rol de administrador exclusivamente a miembros de Presidencia) y el **Centro de Edición y Carga Operativa** (para conciliar comprobantes pendientes en LCR en un toque, cargar gastos con el atajo `MMDD-MONTO` o como Gasto Directo, registrar retiros y devoluciones de sobrantes, prorratear gastos de actividades generales de Estaca entre organizaciones y exportar o importar el libro Excel con vista previa).

## What result they get
El Administrador observa en Gestión de Usuarios su propia fila y las de los administradores permanentes con los controles de rol y baja bloqueados, junto al banner de seguridad requerido. En el Centro de Edición y Carga observa el monitor de cuadratura en vivo; al escribir `0315-1250` en el campo de atajo rápido se autocompletan la fecha `15/03/2026` y el monto `$ 1.250,00`; al conciliar un gasto pendiente en LCR el indicador rojo disminuye al instante; al distribuir un gasto general de Estaca se crean los asientos individuales con la etiqueta `Actividad General de Estaca: [Nombre Evento]`; y al exportar o importar un archivo Excel se valida y previsualiza el impacto antes de confirmar, todo verificado con pruebas automatizadas de extremo a extremo.

## What it must respect
- **Regla Sagrada #1 (Auto-Protección e Inmutabilidad de Administradores)**: Ningún administrador puede quitarse sus propios permisos ni desactivarse; Pablo Lamela y el Presidente de Estaca son administradores permanentes inmutables (`PROJECT_CONTEXT.md` §2 y §4.3).
- **Restricción de Rol Administrador (`PROJECT_CONTEXT.md` §2)**: El rol `ADMIN` solo puede asignarse a integrantes de la Presidencia de Estaca (`TODAS`), nunca a líderes de organizaciones individuales.
- **Convención `MMDD-MONTO` y Gasto Directo (`ADR-008` y `PROJECT_CONTEXT.md` §4.3)**: El atajo `MMDD-MONTO` interpreta los dos primeros dígitos como mes y los dos siguientes como día; la casilla Gasto Directo habilita referencias libres de tarjeta o transferencia sin vincular a retiros en efectivo.
- **Actividades Generales de Estaca — Opción B (`ADR-011`)**: Los gastos compartidos no modifican el presupuesto asignado original de las organizaciones y se registran como `Actividad General de Estaca: [Nombre Evento]`.
- **Formato Canónico (`constitution.md` §2.4)**: Moneda en `$ #.##0,00` y fechas en `dd/mm/aaaa` en cada tarjeta, tabla y previsualización.

## How it proves it
Una suite de pruebas automatizadas de extremo a extremo en Playwright (`tests/admin-panel.spec.ts`) verifica en móvil y escritorio: el bloqueo de auto-edición y de administradores permanentes en Gestión de Usuarios, el autocompletado del atajo `MMDD-MONTO` (`0315-1250` → `15/03/2026` y `$ 1.250,00`), la conciliación en vivo de un comprobante pendiente en LCR, el prorrateo de una Actividad General de Estaca entre múltiples organizaciones y la exportación/importación con vista previa de Excel.

## Behaviour
- **Main path**: Desde el Hub Ejecutivo, el Administrador accede a Gestión de Usuarios o al Centro de Edición y Carga Operativa. En el Centro Operativo visualiza arriba las 4 tarjetas del Monitor de Conciliación LCR y opera debajo las pestañas de Carga Rápida de Gastos y Retiros, Distribución de Gasto de Estaca y Sincronización Excel.
- **Edge cases**: Si el administrador marca "Gasto Directo", el campo de referencia permite códigos alfanuméricos o numéricos libres sin exigir vínculo a retiro. Si en la distribución de gasto de Estaca elige "Partes Iguales", el sistema divide el importe total exactamente entre las organizaciones marcadas; si elige "Montos Personalizados", verifica que la suma de las partes coincida con el total antes de confirmar.
- **Error paths**: Si un administrador intenta modificar su propio rol o el de un administrador permanente inmutable, los controles permanecen deshabilitados con indicación explícita. Si se sube un archivo Excel sin hojas válidas, el importador muestra un mensaje claro de validación y no altera ningún dato.

## Acceptance criteria
- Given un Administrador conectado en el módulo de Gestión de Usuarios, When inspecciona la tabla de cuentas, Then visualiza el banner oficial de seguridad y los controles de rol y baja están deshabilitados tanto en su propia fila como en las de Pablo Lamela y el Presidente de Estaca.
- Given el formulario de Carga Rápida de Gastos en el Centro Operativo, When el Administrador escribe `0315-1250` en el atajo `MMDD-MONTO`, Then el sistema autocompleta la fecha `2026-03-15` (`15/03/2026`) y el monto `$ 1.250,00`, y permite guardar el comprobante actualizando la tabla en vivo.
- Given el Monitor de Conciliación LCR con comprobantes en estado `PENDIENTE_LCR`, When el Administrador pulsa "Conciliar LCR" sobre un comprobante pendiente, Then su estado pasa a `REGISTRADO_LCR` y el total sin justificar en LCR disminuye exactamente en ese importe.
- Given la herramienta "Distribuir Gasto de Actividad de Estaca", When el Administrador ingresa un evento de `$ 9.000,00` y selecciona prorratear en partes iguales entre 3 organizaciones (`MJ`, `HJ`, `PRIMARIA`), Then se generan 3 registros de gasto de `$ 3.000,00` cada uno con el concepto `Actividad General de Estaca: [Nombre Evento]`.
- Given el panel de Sincronización con Excel, When el Administrador pulsa "Exportar Excel" o carga un archivo `.xlsx` en el área de importación, Then se genera la descarga oficial o se exhibe la vista previa de registros validados antes de impactar los cambios.

## Points to clarify
- **suposición tomada** — Al prorratear un gasto general de Estaca en partes iguales con centavos indivisibles, el sistema redondea a 2 decimales y ajusta el centavo residual en la primera organización seleccionada para que la suma cuadre exactamente al centavo con la factura en LCR. *Base:* Cuadratura contable estricta exigida con LCR. *Riesgo:* Ninguno; el usuario ve el desglose exacto antes de confirmar.
- **decisión diferida** — La vista independiente del Calendario iCal sincronizado con el feed oficial de LCR y el Directorio completo de Proveedores y Líderes se abordarán en los Pasos 6.5 y 6.6.
