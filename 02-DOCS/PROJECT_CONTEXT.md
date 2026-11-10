# PROJECT_CONTEXT.md - Especificación Técnica y Reglas de Negocio

> **Última actualización**: 2026-11-05  
> **Estado**: En reestructuración y definición de arquitectura moderna (Fase 1-3 redefinidas)

---

## 1. Visión y Alcance del Proyecto

El **Sistema de Finanzas y Calendario de la Estaca** es una solución web moderna, intuitiva y ágil para:
1. Permitir a los **líderes de organizaciones** consultar en segundos su saldo disponible, próximas actividades con presupuesto y proponer nuevas actividades desde sus teléfonos.
2. Permitir a la **Presidencia de Estaca** monitorear mediante un dashboard ejecutivo el presupuesto global, las asignaciones trimestrales, la evolución de gastos y el estado de cada organización.
3. Permitir al **Administrador (Secretario Financiero y Presidente)** gestionar altas/bajas de usuarios por organización, aprobar actividades, registrar egresos/retiros y conciliar comprobantes pendientes en el sistema oficial (LCR).

---

## 2. Definición de Usuarios y Perfiles de Acceso

### Universo de Usuarios (Estimado: ~35 a 45 personas):
- **Propietario / Super-Administrador Vitalicio del Sistema**:
  - **Pablo Lamela (`pablosud52@gmail.com`)**: Administrador permanente inmutable vinculado directamente a su identidad de correo (`pablosud52@gmail.com`), **independientemente de su llamamiento u organización actual o futura** (incluso si en el futuro deja de ser Secretario Financiero o miembro de la Presidencia). Es además el **único usuario con acceso exclusivo al Selector Rápido de Cambio de Rol (Simulador RBAC)** en producción.
- **Presidencia de Estaca (6 integrantes)**:
  - Presidente *(Administrador permanente no revocable)*
  - Secretario Financiero - Usuario principal *(Administrador permanente no revocable)*
  - Secretario de Estaca *(Administrador por defecto, gestionable)*
  - Primer Consejero *(Lectura ejecutiva / Dashboard / Aprobación de actividades)*
  - Segundo Consejero *(Lectura ejecutiva / Dashboard / Aprobación de actividades)*
  - Secretario Ejecutivo *(Lectura ejecutiva / Dashboard)*
  *Regla estricta*: El rol de Administrador solo puede asignarse a miembros de la Presidencia de Estaca (con la única excepción vitalicia del propietario del sistema `pablosud52@gmail.com`); queda bloqueado para líderes de organizaciones.
  *Permiso granular en Presidencia*: Permiso específico de "Aprobar Actividades Propuestas" (los secretarios no pueden aprobarlas por defecto, a menos que la Presidencia les habilite explícitamente este permiso).
- **Líderes de Organizaciones**:
  - Cada organización cuenta habitualmente con 4 integrantes (Presidente/a, 1° y 2° Consejeros/as, Secretario/a), pudiendo sumar asesores o secretarios adicionales.
  - Organizaciones oficiales:
    1. Mujeres Jóvenes (MJ)
    2. Hombres Jóvenes (HJ)
    3. Seminario *(fondo común para la juventud / MJ y HJ)*
    4. Sociedad de Socorro (SS)
    5. Primaria (Prim)
    6. Jóvenes Adultos Solteros (JAS)
    7. Adultos Solteros (AS)
    8. Centro FamilySearch (CFS)
    9. Estaca (Fondos generales)

---

## 3. Matriz de Capacidades y Flujos de Ingreso por Perfil

### Flujo de Acceso Inicial (Landing tras Login con Gmail):
1. **LÍDERES**:
   - Ingresan automáticamente a la vista de su propia organización.
2. **PRESIDENCIA DE ESTACA**:
   - Ingresan a un **Hub / Menú de Inicio con botones de acceso directo**:
     - Botón `📊 Dashboard Ejecutivo` (visión global consolidada).
     - Botón `🔔 Aprobación de Actividades` (con **borde o indicador pulsante/parpadeante** cuando hay propuestas pendientes de revisión).
     - Botones individuales para cada una de las `Organizaciones` (para verla en detalle como su líder).
3. **ADMINISTRADORES**:
   - En su Hub de Inicio cuentan con los accesos de Presidencia más dos botones exclusivos:
     - Botón `⚙️ Gestión de Usuarios` (altas, bajas y gestión de roles en Presidencia).
     - Botón `✏️ Centro de Edición y Carga Operativa` (cargar retiros, gastos, ingresos de presupuesto trimestral, ajustes LCR y actividades).
4. **USUARIO NO AUTORIZADO / INACTIVO**:
   - Mensaje oficial exacto: *"Acceso restringido. Ponte en contacto con el administrador o un miembro de la presidencia de Estaca."* (Sin botones de solicitud, comunicación directa por WhatsApp/teléfono/presencial).

---

## 4. Detalle de Vistas y Experiencia de Usuario

1. **LÍDERES (Por Organización)**:
   - Vista móvil limpia y compacta estilo tarjeta:
     1. **Saldo Disponible Actual**: Monto visible en formato `#.##0,00`.
     2. **Próxima Actividad Programada**: Nombre, fecha, lugar y costo estimado (o *"Sin costo presupuestado"*).
     3. **Historial Anual de Gastos (Desplegable / Acordeón)**: Sección colapsable que al tocarse despliega la tabla con Fecha, Detalle y Monto. Mantiene la pantalla limpia por defecto.
     4. **Calendario Anual de Actividades (Desplegable / Acordeón)**: Sección colapsable con la agenda anual aprobada.
     5. **Botón `+ Proponer Actividad`**: Formulario ágil (Fecha, Hora, Nombre, Lugar, Costo estimado).
     - **Regla Especial de Seminario (MJ y HJ)**: En lugar de pestañas separadas, disponen de una **casilla de verificación (checkbox) "Seminario"**. Al marcarla en una propuesta o gasto, dicho evento se asocia a Seminario y se visualiza automáticamente tanto en el calendario de Mujeres Jóvenes como en el de Hombres Jóvenes.

2. **PRESIDENCIA DE ESTACA**:
   - **Hub de Inicio**: Selector con botones para entrar al Dashboard, a la Bandeja de Aprobación o a cualquier organización.
   - **Dashboard Ejecutivo**:
     - Presupuesto actual global.
     - Apertura anual + Ingresos trimestrales acumulativos (T1 a T4, con arrastre automático de remanentes no ejecutados).
     - Gráfico de porcentaje asignado a cada organización por trimestre (T1 incluye el saldo inicial de apertura).
     - Tarjetas de cada organización con saldo actual, fecha de próxima actividad y costo estimado.
     - **Barra de Progreso Visual**: Largo total en verde con llenado en rojo según el consumo ejecutado.
   - **Bandeja de Aprobación de Actividades**:
     - Acceso desde el botón con alerta parpadeante en el Hub.
     - Permite ver las propuestas pendientes, revisarlas y cuenta con 3 opciones por actividad: **Aprobar**, **Rechazar** o **Editar** (ajustar fecha, hora, lugar o presupuesto antes de aprobar).
     - Habilitada para Presidente y Consejeros; los secretarios solo acceden si se les activó el permiso específico en Gestión de Usuarios.

3. **ADMINISTRADOR (Presidente y Secretario Financiero)**:
   - **Botón `Gestión de Usuarios`**:
     - Altas y bajas lógicas de líderes por organización.
     - Asignación de rol de Administrador (solo disponible para miembros de Presidencia).
     - Asignación del permiso de aprobación de actividades.
     - **Regla de Auto-Protección Inmutable**: Ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Un administrador puede gestionar a los demás, pero para relevarse debe existir otro administrador activo que realice la acción.
     - *Texto informativo en cabecera*: `"Por seguridad del sistema, ningún administrador puede revocar sus propios permisos ni eliminarse a sí mismo. Las modificaciones de administradores deben ser realizadas por otro administrador activo."`
   - **Botón `Centro de Edición y Carga Operativa`**:
     - Carga de retiros de fondos (`MMDD-MONTO`).
     - Carga de gastos y rendición de comprobantes con **autocompletado inteligente**:
       - *Por defecto*: al ingresar Fecha y Monto, el sistema autogenera el código de referencia con el formato de retiro `MMDD-MONTO`.
       - *Casilla `[ ] Gasto Directo (Tarjeta / Transferencia)`*: al marcarla, libera el campo a formato numérico continuo libre (sin guiones), correspondiente a la secuencia de dígitos del comprobante o cupón de tarjeta, omitiendo la vinculación a retiros de efectivo.
     - Carga de ingresos trimestrales y saldo inicial.
     - Carga directa de actividades de calendario.
     - Semáforo y conciliación de comprobantes pendientes en LCR.

---

## 5. Reglas de Negocio Contables y Operativas Fundamentales

1. **Regla de Seminario**:
   - Seminario es un fondo común para la juventud. Los líderes de MJ y HJ pueden visualizar y alternar entre su organización y Seminario (marcando la casilla de verificación correspondiente).
2. **Regla de Acumulación Trimestral**:
   - El saldo no utilizado al finalizar un trimestre no se pierde; se acumula automáticamente a la disponibilidad del siguiente trimestre.
3. **Indicador Visual de Conciliación LCR**:
   - Todo gasto que aún no haya sido cargado en el sistema oficial (LCR) mantiene alerta visual prioritaria hasta que el Administrador confirme su registro.
4. **Política de Cuentas Bancarias**:
   - No se almacenan números de cuenta bancaria ni datos confidenciales en el sistema.
5. **Actividades Generales de Estaca con Fondos Compartidos (Opción B Aprobada)**:
   - Los eventos generales organizados por la Estaca que involucren aportes de varias organizaciones **no modifican el presupuesto asignado original**.
   - Se registran mediante la herramienta del Administrador `Distribuir Gasto de Actividad de Estaca`, que genera un registro de gasto en cada organización involucrada bajo la denominación `Actividad General de Estaca: [Nombre Evento]`.
   - Esto preserva los porcentajes del Dashboard de Presidencia, explica con total transparencia al líder la deducción en su historial de gastos y concilia de forma idéntica con las subcategorías contables de LCR.
6. **Formato de Referencias (Retiros de Efectivo vs. Pagos Directos con Tarjeta)**:
   - **Retiros en efectivo de cajero**: Sintaxis `MMDD-MONTO` (ej. `1012-25000`).
   - **Pagos directos con tarjeta de débito/crédito oficial o transferencias**: Toman el número de referencia, cupón POS o código LCR (ej. `TX-1094` o número de autorización bancaria). No se asocian a la tabla de retiros en efectivo pues ya impactan directo en el banco.
7. **Retiros Encadenados con Excedentes Acumulados**:
   - Cuando sobra efectivo de un retiro ($2.000 de $15.000) y se realiza un segundo retiro ($6.000) para una nueva actividad estimada en $8.000, el sistema contempla el enlace o traspaso del excedente para que ambas operaciones cuadren a $0,00 de forma limpia al efectuar el redepósito final ($900), sin necesidad de fraccionar facturas individuales.
8. **Gastos Compartidos con Otras Estacas/Unidades (Solución 1 Aprobada)**:
   - Cuando la Estaca abona una factura completa en LCR (ej. $60.000) correspondiente a un evento multiestaca y recibe reintegros de otras unidades (ej. $40.000), el gasto se asienta registrando el `Monto_Total_Factura` y el `Reintegro_Externo`.
   - El sistema calcula automáticamente el `Gasto_Neto_Organizacion` ($20.000), siendo este último el único valor que impacta en el presupuesto de la organización local, mientras que en la conciliación LCR y búsqueda administrativa se mantiene el comprobante por su valor bruto ($60.000).
9. **Confidencialidad de Costo Estimado en Actividades de Calendario**:
   - El campo `Costo_Estimado` y el distintivo visual `💰 Con Presupuesto` son **estrictamente confidenciales**.
   - **Visibilidad autorizada**: Únicamente los Administradores (Secretario Financiero y Presidente), los miembros de la Presidencia de Estaca y los líderes de la organización anfitriona/responsable de la actividad.
   - **Líderes de otras organizaciones**: Solo visualizan los datos generales del evento (Título, Fecha, Hora, Lugar, Descripción y Organización convocante), idéntico al calendario oficial de la Iglesia, sin visibilidad ni acceso a montos ni indicadores de presupuesto.

---

## 6. Modelo de Datos Relacional

El backend en Google Sheets almacena **5 tablas maestras normalizadas**:

### A. `USUARIOS_PERMISOS`
- `Email` (PK): Correo Google del usuario (utilizado para autenticación nativa).
- `Nombre`: Nombre del líder.
- `Rol`: `ADMIN` | `PRESIDENCIA` | `LIDER`.
- `Organizacion`: Organización asignada (`MJ`, `HJ`, `SS`, `Prim`, `JAS`, `AS`, `CFS`, `Estaca` o `TODAS`).
- `Estado`: `ACTIVO` | `INACTIVO`.

### B. `PRESUPUESTO_ASIGNACION`
- `ID_Asignacion` (PK)
- `Anio`: Ej. 2026.
- `Trimestre`: `T1` | `T2` | `T3` | `T4`.
- `Organizacion`
- `Porcentaje_Sugerido`: % de prueba/simulación.
- `Monto_Estimado_Porcentaje`: Monto calculado automáticamente según %.
- `Monto_Asignado`: Monto real fijado por el admin.

### C. `ACTIVIDADES_CALENDARIO`
- `ID_Actividad` (PK)
- `Anio`: Ej. 2026.
- `Fecha`: Fecha del evento.
- `Hora`: Horario de inicio.
- `Nombre_Actividad`: Nombre del evento.
- `Lugar`: Lugar físico de la actividad.
- `Organizacion`: Organización responsable.
- `Presupuesto_Estimado`: Presupuesto proyectado.
- `Estado`: `SOLICITADA` | `APROBADA` | `REALIZADA` | `CANCELADA`.
- `Creado_Por`: Email del usuario que la registró.

### D. `MOVIMIENTOS_GASTOS`
- `ID_Gasto` (PK)
- `Anio`: Ej. 2026.
- `Trimestre`: `T1` | `T2` | `T3` | `T4`.
- `Nro_Referencia_Retiro`: Vínculo con el retiro de origen o código LCR. Formato retiro: `MMDD-MONTO`.
- `Fecha_Registro_Gasto`: Fecha en que se rinde el comprobante.
- `Organizacion`
- `Proposito_Actividad`: Detalle/motivo del gasto.
- `Monto`: Importe del comprobante.
- `Pagado_A`: Proveedor o comercio emisor del comprobante.
- `Es_Reembolsable`: Booleano (`SI` | `NO`). Si es `SI` (ej. MeetUP multiestaca), no descuenta del presupuesto asignado a la organización en `PRESUPUESTO_ASIGNACION`.
- `Registrado_LCR`: Booleano (`SI` | `NO`). *(Si es `NO`, activa indicador visual rojo de pendiente)*.
- `Observaciones`: Notas o recordatorios.

### E. `RETIROS_FONDOS`
- `ID_Retiro` (PK)
- `Fecha_Retiro`: Parseada según sintaxis `MMDD` (mes y día). Formato `dd/mm/aaaa`.
- `Monto_Retirado`
- `Nro_Referencia`: Ej. `1018-5000` o código de sistema.
- `Total_Gastos_Rendidos`: Calculado a partir de los gastos vinculados (`=SUMIF(...)`).
- `Fecha_Devolucion`: Fecha en que se realizó el redepósito del sobrante en la cuenta.
- `Devolucion_Deposito`: Dinero sobrante redepositado para cuadrar en cero.
- `Saldo_A_Rendir`: `= Monto_Retirado - Total_Gastos_Rendidos - Devolucion_Deposito`.
- `Estado`: `Cerrado en Cero` | `Saldo por Rendir` | `Ajuste Pendiente`.

---

## 5. Arquitectura del Front-end

- **Diseño Mobile-First**: Estructura de tarjetas estilo billetera virtual optimizada para teléfonos móviles (PWA instalable).
- **Vista Líder**:
  1. Saldo actual del trimestre y saldo acumulado anual.
  2. Barra de progreso visual (Presupuesto asignado vs. Gastado).
  3. Historial de gastos simplificado: solo **Fecha**, **Monto** y **Actividad**.
  4. Próximas actividades agendadas con su presupuesto estimado.
  5. Proyección estimada para trimestres futuros.
  6. Botón flotante `+ Proponer Actividad`: formulario para cargar Fecha, Hora, Nombre, Lugar y Presupuesto estimado.
- **Vista Administrador / Presidencia**:
  1. Filtro desplegable con **selección múltiple de organizaciones** y botón "Ver Todo".
  2. Selector de año histórico (2024, 2025, 2026).
  3. Panel de conciliación de retiros y alertas en rojo de comprobantes pendientes de ingresar en LCR.
  4. Simulador interactivo de asignaciones porcentuales por trimestre.
