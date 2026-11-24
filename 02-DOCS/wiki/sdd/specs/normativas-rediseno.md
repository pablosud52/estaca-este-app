---
type: spec
title: Spec — Rediseño de Normativas con Consulta Interactiva y Acceso a PDFs
description: WHAT and WHY para renombrar y rediseñar la sección Normativas en 3 pestañas (Uso Apropiado de los Fondos, Cierre Anual y Excepción de Dinero), con buscador/filtros interactivos y acceso al PDF oficial en cada normativa.
tags: [sdd, spec, normativas, ui]
timestamp: 2026-11-23T22:25:00Z
topic: sdd
slug: normativas-rediseno
status: implemented
---

# Spec — Rediseño de Normativas con Consulta Interactiva y Acceso a PDFs

> Slug: `normativas-rediseno` · Status: implemented · Created: 2026-11-23 · Revised: 2026-11-23
> Inherits: [constitution](../constitution.md)

## Problem & why
La sección actual de información financiera tiene un nombre largo (`Información y Normativas Financieras`), está oculta en estado borrador solo para Super Admin, contiene únicamente un documento desplegable sin acceso al PDF original y no incluye las otras dos normativas oficiales clave (*Uso Apropiado de los Fondos Sagrados* y *Excepción de Dinero*).

## Cost of not building it
La Presidencia de Estaca y los Secretarios siguen dependiendo de buscar archivos sueltos en WhatsApp o correo cada vez que necesitan confirmar si un gasto corresponde a Presupuesto u Ofrendas de Ayuno, cómo funciona el cierre anual o cuál es el trámite de excepción de dinero.

## The cheapest alternative
Pegar el texto plano o imágenes estáticas de los tres documentos uno debajo del otro. No alcanza porque la tabla de 27 conceptos con 12 notas aclaratorias `(A)`–`(L)` resulta incómoda de leer en celular sin buscador ni filtros, y no ofrece acceso directo al PDF original para confirmación oficial.

## Goals
- Renombrar la sección simplemente a **`Normativas`** dentro del menú **`Administración`** (escritorio y móvil) y habilitarla para **Presidencia de Estaca (incluidos Secretarios) y Administradores**, quitando el cartel temporal de borrador.
- Organizar las 3 normativas oficiales en **3 pestañas limpias** (mostrando una a la vez, con la estética azul marino institucional `#072B52` / `#083563`):
  1. **`Uso Apropiado de los Fondos`** *(abierta por defecto)*
  2. **`Cierre Anual`**
  3. **`Excepción de Dinero`**
- Convertir **`Uso Apropiado de los Fondos`** (marzo 2026) en una guía interactiva con buscador en tiempo real, filtros por categoría y las notas aclaratorias `(A)`–`(L)` integradas directamente dentro de cada concepto.
- Incluir en la cabecera de cada normativa un botón **`Ver PDF oficial`** que abre el documento directamente dentro de la propia app (visor modal integrado) con botones para **Descargar**, **Compartir** y **Abrir aparte**.

## Non-goals / out of scope
- Incluir correos electrónicos acompañantes en la interfaz (solo el contenido oficial resumido y el PDF oficial).
- Habilitar esta sección para Líderes de Organizaciones o usuarios de Consulta.
- Crear un panel de carga/edición de normativas desde la app (las normativas oficiales se actualizan solo cuando el Área emite nuevas versiones).

## Users & context
- **Presidencia de Estaca (Presidente, Consejeros, Secretarios) y Administradores:** Consultan rápidamente una regla antes de aprobar un gasto, orientar a un obispo o planificar el cierre de año, desde celular o PC, con respaldo inmediato del PDF oficial.

## Qué podrá hacer el usuario
- Acceder a **`Normativas`** dentro del menú **`Administración`** (en escritorio y menú móvil).
- Alternar con un clic entre las 3 pestañas: **`Uso Apropiado de los Fondos`** (inicial), **`Cierre Anual`** y **`Excepción de Dinero`**.
- En **`Uso Apropiado de los Fondos`**:
  - Buscar por palabra clave (concepto, referencia al Manual General o texto de nota).
  - Filtrar por categoría con un toque: `Todos`, `Presupuesto`, `Ofrendas de Ayuno`, `Gastos Reembolsables`, `Otros` y `A cargo del miembro`.
  - Ver de inmediato en cada uno de los 27 conceptos qué categoría aplica (`SÍ` / `NO` / `N/A` / `FPE` / `Propiedades` / `Aprob. PA`), su referencia al Manual General y el texto completo de sus notas aclaratorias `(A)`–`(L)` integrado sin tener que buscar letras al pie.
- En **`Cierre Anual`**:
  - Consultar de forma resumida y clara la regla del tope del 50% al 31 de diciembre, la tabla de ejemplos oficiales y las recomendaciones de cierre.
- En **`Excepción de Dinero`**:
  - Consultar la prohibición vigente de traspaso de fondos entre unidades, la alternativa estándar (esperar 30–40 días o reembolso personal), los 3 pasos exactos del trámite de excepción y los casos en que no aplica (tarjeta inhabilitada o dinero pendiente de rendir).
- En cualquiera de las 3 pestañas, pulsar **`Ver PDF oficial`** en la cabecera para abrir el documento PDF original en una nueva pestaña.

## Qué resultado obtiene
- La sección aparece en el menú `Administración` como **`Normativas`** para toda la Presidencia y Administradores, sin el cartel de "sección en reforma".
- Al abrirla, muestra directamente **`Uso Apropiado de los Fondos`** con buscador, filtros y tarjetas/filas limpias en paleta azul marino.
- Cada pestaña tiene su propio resumen claro y su botón **`Ver PDF oficial`** apuntando al archivo PDF real correspondiente.

## Qué debe respetar
- **Constitución del proyecto (`02-DOCS/wiki/sdd/constitution.md`):** Diseño mobile-first limpio, táctil, contraste WCAG AA y coherencia estética con el azul marino `#072B52` / `#083563`.
- **Fidelidad documental:** No alterar ni inventar reglas respecto a los documentos oficiales del Departamento de Finanzas y Membresía de Unidades Locales (Manual General cap. 20, 22, 24, 34, 38 y cartas de Área vigentes).
- **Aislamiento de roles:** Líderes y usuarios de Consulta siguen sin ver el menú `Administración` ni `Normativas`.

## Cómo lo demuestra
- Compilación limpia (`tsc -b && vite build`).
- Verificación en navegador (PC y móvil) comprobando: acceso visible para Presidencia y Admin bajo `Administración → Normativas`, ausencia del cartel de borrador, navegación entre las 3 pestañas, búsqueda y filtrado por categoría en `Uso Apropiado de los Fondos` con notas `(A)`–`(L)` visibles, y enlaces válidos en los 3 botones `Ver PDF oficial`.

## Behaviour
- **Main path (consulta rápida de fondos):** Presidencia/Admin entra a `Administración → Normativas` → escribe "templo" o toca el filtro `Presupuesto` → ve al instante los conceptos aplicables con su referencia al Manual General y la nota aclaratoria integrada → si necesita el respaldo textual completo, pulsa `Ver PDF oficial`.
- **Main path (cambio de normativa):** Toca la pestaña `Cierre Anual` o `Excepción de Dinero` → la vista cambia al resumen estructurado de ese documento con su propio botón `Ver PDF oficial`.
- **Edge cases:**
  - *Búsqueda sin coincidencias en Uso Apropiado de los Fondos:* muestra estado vacío claro con botón para limpiar búsqueda y filtros.
  - *Conceptos que aplican a más de una categoría* (ej. #17 Garments no por primera vez: Ofrendas de Ayuno y A cargo del miembro; #21 Celular: Reembolsables y A cargo del miembro; #23 Materiales: Presupuesto y A cargo del miembro): aparecen al filtrar por cualquiera de las categorías donde tienen `SÍ` y muestran claramente todas las que aplican.
  - *Enlace externo en Nota (H):* el enlace oficial de límites de aprobación médica en churchofjesuschrist.org es clicable y abre en pestaña nueva.
- **Error paths:**
  - Si alguno de los 3 archivos PDF aún no fue provisto antes de publicar, el botón indica claramente que el PDF está pendiente de adjuntar en lugar de abrir una página 404 rota.

## Acceptance criteria
- **AC-1 (Nombre, ubicación y visibilidad):** Given un miembro de Presidencia (incluidos Secretarios) o un Administrador abre `Administración`, When ve las opciones, Then aparece **`Normativas`** (sin el cartel de "en reforma" al entrar); Given un Líder o usuario de Consulta, When navega la app, Then no ve `Normativas`.
- **AC-2 (3 pestañas con orden e inicio acordado):** Given un usuario entra a `Normativas`, When carga la pantalla, Then ve 3 pestañas (`Uso Apropiado de los Fondos`, `Cierre Anual`, `Excepción de Dinero`) con **`Uso Apropiado de los Fondos`** abierta por defecto.
- **AC-3 (Consulta interactiva en Uso Apropiado de los Fondos):** Given el usuario está en `Uso Apropiado de los Fondos`, When busca un término (ej. "Templo" o "Primaria") o selecciona una categoría (ej. `Presupuesto`), Then se filtran en tiempo real los 27 conceptos oficiales mostrando qué categorías aplican, su referencia al Manual General y las notas aclaratorias `(A)`–`(L)` integradas dentro del concepto.
- **AC-4 (Resúmenes de Cierre Anual y Excepción de Dinero):** Given el usuario cambia a `Cierre Anual` o `Excepción de Dinero`, When lee cada vista, Then encuentra el resumen estructurado y claro del documento oficial correspondiente (sin textos de correos internos).
- **AC-5 (Acceso a PDF oficial en cada normativa):** Given el usuario está en cualquiera de las 3 pestañas, When observa la cabecera de la normativa, Then encuentra el botón **`Ver PDF oficial`** que abre el PDF original correspondiente en una nueva pestaña.

## Points to clarify
- **pregunta abierta** — Ubicación o entrega de los 3 archivos PDF originales (*Uso Apropiado de los Fondos marzo 2026*, *Cierre Anual* y *Excepción de Dinero 2024*) para copiarlos dentro de `public/docs/normativas/` y que los 3 botones `Ver PDF oficial` abran los documentos reales.
