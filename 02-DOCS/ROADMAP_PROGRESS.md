# ROADMAP_PROGRESS.md - Estado y Plan de Avance del Proyecto

> **Fase Actual**: Fase 6 — Desarrollo e Implementación del Frontend (Pasos 6.1, 6.2, 6.3 y 6.4 Completados)  
> **Última Actualización**: 2026-11-09

---

## 📊 Estado de las Fases del Nuevo Enfoque

```mermaid
flowchart TD
    P1["1. Quiénes Acceden (Perfiles y Universo de Usuarios)"] --> P2["2. Cómo Acceden (Auth Gmail y Gestión de Altas/Bajas)"]
    P2 --> P3["3. A Qué Acceden (Vistas Líder, Presidencia, Admin)"]
    P3 --> P4["4. Operativa Especial (Gastos Compartidos Estaca)"]
    P4 --> P5["5. Arquitectura Técnica (DB, API y Sincronización Excel)"]
    P5 --> P6["6. Desarrollo e Implementación"]

    style P1 fill:#4ade80,stroke:#16a34a,color:#000
    style P2 fill:#4ade80,stroke:#16a34a,color:#000
    style P3 fill:#4ade80,stroke:#16a34a,color:#000
    style P4 fill:#4ade80,stroke:#16a34a,color:#000
    style P5 fill:#38bdf8,stroke:#0284c7,color:#000
    style P6 fill:#e2e8f0,stroke:#94a3b8,color:#000
```

---

## 📝 Estado de Definición Paso a Paso

### ✅ Paso 1: Quiénes Acceden (Completado y Aprobado)
- [x] Catálogo completo de roles: Líderes, Presidencia, Administradores.
- [x] Definición de integrantes de Presidencia (6 miembros: Presidente, Secretario Financiero, Secretario, 1° y 2° Consejero, Secretario Ejecutivo).
- [x] Regla de protección inmutable: Presidente y Secretario Financiero son administradores permanentes no revocables.
- [x] Estructura de equipos por organización (Presidente/a, consejeros, secretarios, asesores; ~4 integrantes o más).
- [x] Universo total de usuarios estimado: ~38 a 46 personas.

### ✅ Paso 2: Cómo Acceden y Gestión de Usuarios (Completado y Aprobado)
- [x] Flujo de autenticación con Google (Google Sign-In nativo sin pantallas rojas de riesgo).
- [x] Mensaje oficial para no autorizados: *"Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca."* (contacto directo vía WhatsApp/teléfono).
- [x] Hub de Inicio diferenciado para Presidencia (Dashboard + Organizaciones) y Administradores (agrega Gestión de Usuarios y Centro de Edición y Carga).
- [x] Panel de Gestión de Usuarios: Rol de Administrador exclusivo para miembros de Presidencia (imposible para líderes).
- [x] Permiso granular en Presidencia para "Aprobar Actividades Propuestas" (restringido para secretarios salvo delegación expresa).
- [x] Bajas lógicas (desactivación de cuenta) para preservar trazabilidad histórica.

### ✅ Paso 3: A Qué Acceden según su perfil (Completado y Aprobado)
- [x] Vista del Líder:
  - Saldo actual y próxima actividad con costo visible.
  - Historial anual de gastos y Calendario anual en secciones colapsables (desplegables) para mantener la interfaz despejada.
  - Checkbox "Seminario" en MJ y HJ para vincular eventos visibles en ambas organizaciones simultáneamente.
- [x] Hub de Presidencia:
  - Botón a Dashboard Ejecutivo (presupuesto global, apertura anual + ingresos trimestrales acumulativos, gráfico de asignación porcentual, tarjetas de organizaciones con barras de progreso verde/rojo).
  - Botón a Bandeja de Aprobación de Actividades con borde/indicador parpadeante de alerta cuando hay propuestas pendientes (con opciones: Aprobar, Rechazar, Editar).
  - Botones a cada Organización (vista espejo idéntica a la del líder).
- [x] Vista de Administrador:
  - Botón `Gestión de Usuarios` con regla de auto-protección (ningún admin puede quitarse sus propios permisos ni eliminarse; texto explicativo en cabecera).
  - Botón `Centro de Edición y Carga Operativa` (gastos, retiros, ingresos trimestrales, ajustes LCR, actividades directas).

### ✅ Paso 4: Operativa Especial (Gastos Compartidos Estaca) (Completado y Aprobado)
- [x] Aprobada la **Opción B**: Las actividades generales de Estaca no alteran el presupuesto asignado original de las organizaciones.
- [x] Formulario administrativo `Distribuir Gasto de Actividad de Estaca` para prorratear importes entre las organizaciones involucradas.
- [x] Asiento como gasto transparente en cada organización con la etiqueta `Actividad General de Estaca: [Nombre Evento]`, cuadrando con LCR y la barra visual.

### ✅ Paso 5: Arquitectura Técnica y Configuración de Entorno (100% Completado y Verificado)
- [x] Repositorio oficial en GitHub: `pablosud52/estaca-este-app` activo y sincronizado.
- [x] Despliegue en Vercel activo y funcionando en vivo: **`https://estacaeste.vercel.app`**.
- [x] Variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas en Vercel.
- [x] Base de datos en Supabase (São Paulo) inicializada, auditada y comunicada en tiempo real:
  - 2 parámetros de configuración oficial del feed de calendario.
  - 6 usuarios iniciales con administradores permanentes inmutables (Pablo Lamela y Presidente).
  - 9 organizaciones con presupuestos 2026 cargados.
  - 35 comprobantes de gastos auditados en LCR.
  - 13 retiros de fondos con conciliaciones a cero y pendientes.
  - 17 proveedores reales con RUT y calificación.
  - 8 actividades en agenda oficial.
- [x] Harness `rsc-harness` inicializado con target `gemini` y perfil incremental.
- [x] Skills instaladas y configuradas:
  - `pbakaus/impeccable`: Diseño visual, layouts y prevención de anti-patrones.
  - `emilkowalski/skills`: 18 skills de motion y microinteracciones fluidas.
  - `netresearch/context7-skill`: Consulta de documentación actualizada y dependencias en tiempo real.
  - `@playwright/cli` (Microsoft v0.1.23) + `@playwright/test`: Herramienta CLI de automatización de navegador y paquete de skills en `.agents/skills/playwright-cli`, `.gemini/skills/playwright-cli` y `.claude/skills/playwright-cli`.
- [x] Respaldo automático con `robocopy` hacia Google Drive (`G:\Mi unidad\GitHub\estaca-este-app`) validado en 1 segundo sin `node_modules`.

---

## 🚀 Fase 6: Desarrollo e Implementación del Frontend (En Curso)
- [x] Módulo de Autenticación y Selector de Rol para desarrollo (simulación fluida y Google OAuth).
- [x] Vista 1: Pantalla Móvil del Líder (`LeaderView`):
  - Tarjeta Maestra `"PRESUPUESTO DISPONIBLE"` con saldo destacado, línea sobria `"Gastos realizados: $ ..."`, desglose trimestral limpio (`"Asignado: $ ... | Gastos: $ ..."`) y línea discreta al pie exclusiva para Hombres Jóvenes y Mujeres Jóvenes: `"🏛️ Fondo Seminario: $ 26.000,00 (Fondo conjunto, no incluido en este presupuesto)"`.
  - Calendario Anual completo (26 actividades 2026: de la organización + generales de Estaca, pasadas atenuadas con estado `"Realizada"` y futuras) con auto-enfoque suave (`scrollTo`) hacia la próxima actividad programada.
  - Selector de año dinámico (`2026` / `2027`) y confidencialidad estricta de presupuestos entre organizaciones.
- [x] Vista 2: Hub Ejecutivo de Presidencia (`Panel`) y Rediseño "Menos es Más":
  - Cabecera minimalista con botón `"Panel"`, selector dinámico de año (`2025/2026/2027` para Presidencia/Admin; `2026/2027` para Líderes; leyenda `"Presupuesto 2027 pendiente de asignación"`) y menú hamburguesa móvil (`☰` → `✕`) con Drawer vertical y `backdrop-blur`.
  - Tarjeta Maestra `"PRESUPUESTO DISPONIBLE"` (`$ 114.168,09`) con alerta `"⚠️ $ 15.506,00 pendientes de rendir"` y enlace directo a la sección de rendiciones.
  - Posición 1 debajo de KPI: Gráfica `"Asignación de fondos a cada organización"` iniciando por defecto en Porcentaje (`%`), con etiquetas X a 45º, montos/porcentajes impresos en cada barra, filtros `[ Global ] [ T1 ] [ T2 ] [ T3 ] [ T4 ]`, barras cálidas para Hombres Jóvenes, Mujeres Jóvenes y Seminario, y pastilla `"Total Destinado a Jóvenes (HJ + MJ + Seminario): $ 146.000,00 (34,8%)"`.
  - Posición 2: Sección `"Resumen por trimestre"` (abierta en grid en PC y colapsable tipo acordeón cerrada por defecto en móvil), mostrando el **Ingreso del trimestre** en grande y debajo: `Saldo inicial / Remanente anterior`, `Monto total de fondos` y `Gastos del período` con modal interactivo (`"Gastos de Trimestre [X] · Total: $ [Monto]"`).
  - Posición 3: Sección `"Estado por Organización"` (grid en PC y acordeones compactos en móvil con fila `[Nombre de Organización] ····· [$ Saldo Disponible] [▾]`, desplegando fluidamente la próxima actividad y el botón `"ABRIR [ORGANIZACIÓN]"`).
  - Regla sagrada de Bandeja de Aprobación: eventos de LCR (`origin = 'lcr'`) nunca van a la bandeja; solo van propuestas de líderes locales (`origin = 'propuesta_lider'`).
- [x] Vista 3: Centro de Edición y Carga para Administradores (gestión de usuarios con regla de auto-protección inmutable, conciliación LCR en vivo, carga ágil MMDD-MONTO, prorrateo de gasto general de Estaca Opción B, retiros a cero y sincronización bidireccional con Excel).
- [ ] Vista 4: Calendario de Actividades sincronizado con feed LCR (distintivo de presupuesto confidencial).
- [ ] Vista 5: Directorio de Proveedores y Directorio de Líderes.
  - Impacto en el indicador porcentual real asignado vs. ejecutado.
  - Visualización del movimiento para el líder de la organización afectada.
- [ ] Aprobación formal del usuario para avanzar al Paso 5.

### ⏸️ Paso 3: A Qué Acceden según su perfil
- [ ] Pantalla móvil del líder (saldo, próxima actividad, historial simple, proponer actividad).
- [ ] Pantalla de Presidencia (selector inicial: Dashboard ejecutivo o vista por organización).
- [ ] Dashboard de Presidencia (presupuesto global, acumulación trimestral, distribución porcentual, tarjetas y barras de progreso verde/rojo).
- [ ] Panel de Administrador (aprobación de actividades, carga ágil de gastos/retiros, conciliación LCR).

### ⏸️ Paso 4: Operativa Especial (Gastos Compartidos)
- [ ] Metodología para actividades generales de Estaca que descuentan fondos a organizaciones.

### ⏸️ Paso 5: Arquitectura Técnica y Modelo de Datos
- [ ] Definición del motor de Base de Datos y sincronización/exportación a Excel simplificado.

---

## 📝 Detalle de Tareas

### ✅ Fase 1: Análisis y Diagnóstico Funcional (Completada)
- [x] Inspección técnica y descompilación de código VBA de `2024.xlsm` (Agenda dinámica, `Worksheet_SelectionChange`, `frmCRUD`, `frmBuscar`, matrices dinámicas `FILTER`/`MMULT`).
- [x] Análisis de datos y fórmulas de `2026 Finanzas.xlsm` (`Dashboard`, `Panel Cont`, `Registro Cont`).
- [x] Identificación de referencias huérfanas `#REF!` y elementos descartables (`CuentasDepo`).
- [x] Relevamiento del intento inicial con Gemini Spark y sus archivos `.gdoc`/`.gsheet`.

### ✅ Fase 2: Definición de Requerimientos y Arquitectura (Completada)
- [x] Definición de perfiles de usuario (Líder móvil vs. Administrador PC/móvil).
- [x] Establecimiento de la matriz RBAC para 22 usuarios con aislamiento por organización.
- [x] Definición de la regla especial de Seminario (fondo común para MJ y HJ).
- [x] Definición de la regla de Estaca (remanente de asignaciones de organizaciones).
- [x] Modelo de datos relacional normalizado en 5 tablas maestras.
- [x] Selección del stack: Google Sheets (BD) + Google Apps Script Web App (Frontend PWA).

### ✅ Fase 3: Organización de Workspace y Configuración del Harness (Completada)
- [x] Evaluación y descarte justificado de `rsc-harness`.
- [x] Reorganización de la carpeta `APP_DB`:
  - `_ARCHIVADO/OLD_SPARK/`: Respaldo de los 4 archivos de la planificación inicial de Spark.
  - `_ARCHIVADO/REFERENCIA_EXCEL/`: Copia de respaldo de `2024.xlsm` y `2026 Finanzas.xlsm`.
- [x] Creación del sistema de memoria persistente en `.gemini/`:
  - [`GEMINI.md`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/GEMINI.md)
  - [`PROJECT_CONTEXT.md`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/.gemini/PROJECT_CONTEXT.md)
  - [`DECISION_LOG.md`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/.gemini/DECISION_LOG.md)
  - [`ROADMAP_PROGRESS.md`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/.gemini/ROADMAP_PROGRESS.md)

---

### ✅ Fase 4: Creación de la Base de Datos Maestra y Migración (Completada y Auditada)
- [x] Creación del archivo maestro [`DB_Finanzas_Calendario.xlsx`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/DB_Finanzas_Calendario.xlsx) en la raíz de `APP_DB`.
- [x] Reconstrucción v2 con correcciones exhaustivas solicitadas por el usuario:
  - **Convención MMDD-MONTO corregida**: Interpretación exacta de fechas de retiro y gastos (`1012-25000` = 12/10/2026, `1017-12500` = 17/10/2026). Formato visual `dd/mm/aaaa`.
  - **Devoluciones de sobrantes**: Incorporación de `Fecha_Devolucion` en `RETIROS_FONDOS` (01/06/2026 para $1.241 y 02/08/2026 para $1.506), conciliando a $0.00 (`Cerrado en Cero`).
  - **Gastos reembolsables**: Campo `Es_Reembolsable` ("SI"/"NO"). Los egresos reembolsables (como MeetUP) no descuentan del presupuesto de las organizaciones (`=SUMIFS(..., Es_Reembolsable, "NO")`).
  - **Alertas rojas LCR precisas**: Marcadas únicamente en los 2 egresos pendientes de asentar en LCR ($12.394 Primaria y $3.112 Coro Estaca).
  - **Depuración de Calendario**: 18 actividades reales ejecutadas en 2026 (sin fechas inventadas futuras). Columna `Lugar` agregada.
- [x] Formato de fecha uniforme `dd/mm/aaaa` y formato numérico oficial sin símbolo pesos `#.##0,00` configurado por el usuario.
- [x] Cuadre financiero total verificado contra `2026 Finanzas.xlsm`.

---

### ✅ Fase 5: Backend y Lógica de Negocio (Google Apps Script) (Completada)
- [x] Creación de la estructura del backend en carpeta [`gas/`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas):
  - [`appsscript.json`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas/appsscript.json): Manifiesto V8 con zona horaria `America/Montevideo` y configuración Web App.
  - [`Database.js`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas/Database.js): Capa de acceso a datos (DAL) para Google Sheets (`getAll`, `insertRow`, `updateRowById`, conversor de fechas/horas).
  - [`Auth.js`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas/Auth.js): Control de acceso por roles (RBAC) validando correo Google, aislamiento de organizaciones para líderes, regla de Seminario compartida (`MJ` y `HJ`), y permisos ampliados para Presidencia y Admin.
  - [`Code.js`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas/Code.js):
    - `doGet(e)`: Servicio de la Web App HTML5 responsiva.
    - `apiGetInitialContext()`: Validación de sesión y perfil de usuario activo.
    - `apiGetDashboardData(anio, orgs)`: Agregación de presupuesto anual y trimestral, historial de gastos (simplificado para líderes, detallado para Presidencia), calendario de actividades y resumen de conciliación de retiros y alertas LCR.
    - `apiProponerActividad(datos)`: Inserción validada de propuestas de eventos con generación automática de correlativo `ACT-YYYY-XXX`.
    - `apiGuardarGasto(datos)` y `apiConciliarLCR(idGasto, estado)`: Operaciones financieras exclusivas del Administrador.

---

### ✅ Fase 6: Frontend Responsivo Mobile-First (Completada)
- [x] Creación de [`Index.html`](file:///g:/Mi%20unidad/Estaca/Finanzas/APP_DB/gas/Index.html) en `gas/`:
  - **Diseño Mobile-First**: Estilo tarjeta de billetera digital con gradiente, tipografía Inter y Tailwind CSS.
  - **Formato Oficial de Importes**: Todos los montos renderizados como `#.##0,00` (sin `$`, punto para miles, coma para dos decimales).
  - **Pestaña Presupuesto**: Saldo anual disponible, progreso porcentual con colores dinámicos, desglose trimestral (T1-T4) y gráfico comparativo Chart.js.
  - **Pestaña Gastos**: Vista móvil simplificada (Fecha, Monto, Actividad) para líderes; vista ampliada con estado LCR para Presidencia/Admin.
  - **Pestaña Calendario**: Tarjetas de actividades con fecha, hora, lugar y presupuesto estimado.
  - **Pestaña Control/Retiros**: Resumen de fondos retirados, devoluciones redepositadas y saldos a rendir con alertas visuales de comprobantes sin registrar en LCR.
  - **Modal Nativo `<dialog>`**: Formulario `+ Proponer Actividad` siguiendo los estándares de *Modern Web Guidance* (backdrop blur, focus trap automático, accesibilidad y cierre al pulsar fuera).
  - **Mejoras Visuales Aplicadas (31/10)**:
    - Encabezado con pastilla azul `"Estaca Montevideo Uruguay Este"` y `"Finanzas y Calendario"`.
    - Selector de año reubicado debajo del badge del usuario.
    - Recuadro principal con contraste oscuro sólido (sin destellos blancos que dificulten la lectura).
    - Textos oficiales actualizados: `SALDO ACTUAL`, `Disponible para utilizar`, `Anual Asignado`, `Gasto Realizados` y `Uso del presupuesto`.
    - Gráfica de distribución con selector interactivo de `Montos` y `Porcentajes (%)` para análisis de la Presidencia.
  - **Modo Simulación Local integrado**: Permite previsualizar e interactuar con la app directamente abriendo el archivo en Chrome o Edge sin necesidad de publicar primero.

---

### ⏳ Fase 7: Pruebas, Verificación y Despliegue en Google (Siguiente)
- [ ] Guardar `DB_Finanzas_Calendario.xlsx` como Hoja de Cálculo nativa de Google Sheets en Google Drive.
- [ ] Abrir el editor de Google Apps Script vinculado e importar los archivos de `gas/`.
- [ ] Implementar la Web App y verificar el flujo de autenticación con cuentas de líderes y presidencia.
- [ ] Probar la instalación como PWA en dispositivo móvil.
