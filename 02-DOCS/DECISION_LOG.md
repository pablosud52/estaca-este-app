# DECISION_LOG.md - Registro de Decisiones de Arquitectura (ADR)

Este registro documenta las decisiones clave tomadas a lo largo del diseño del proyecto, las alternativas consideradas y la justificación de cada elección para evitar retrocesos en sesiones futuras.

---

### [ADR-001] Selección de Google Apps Script Web App sobre Looker Studio y AppSheet
- **Fecha**: 2026-10-25
- **Estado**: Aprobado
- **Contexto**: Se requería una plataforma gratuita dentro del ecosistema Google para mostrar paneles a líderes desde smartphones y a administradores desde PC con control de accesos.
- **Alternativas evaluadas**:
  - *Looker Studio*: Descartado por experiencia deficiente en pantallas móviles (no es responsivo nativo, requiere zoom manual continuo) y configuración rígida de filtrado por usuario.
  - *Google AppSheet*: Descartado por el límite de 10 usuarios en el plan gratuito (la Estaca requiere 22 usuarios).
- **Decisión**: Implementar una Web App en Google Apps Script (HTML5 + Tailwind CSS + Chart.js) alojada en Google Drive.
- **Consecuencias**: Costo $0, autenticación nativa por cuenta Google (`Session.getActiveUser().getEmail()`), diseño mobile-first fluido e instalable como PWA en teléfonos.

---

### [ADR-002] Eliminación definitiva de información bancaria (`CUENTAS_DEPOSITO`)
- **Fecha**: 2026-10-25
- **Estado**: Aprobado
- **Contexto**: El archivo `2026 Finanzas.xlsm` contenía una hoja con números de cuenta bancaria y datos personales de líderes y proveedores.
- **Decisión**: Omitir por completo la tabla `CUENTAS_DEPOSITO`. No se almacenará ningún dato bancario en el sistema.
- **Consecuencias**: Mayor seguridad y privacidad; reducción de complejidad en la base de datos.

---

### [ADR-003] Visibilidad compartida de "Seminario" para Mujeres Jóvenes y Hombres Jóvenes
- **Fecha**: 2026-10-25
- **Estado**: Aprobado
- **Contexto**: Seminario no es una organización independiente, sino un fondo en común que beneficia a las organizaciones juveniles.
- **Decisión**: Los usuarios con rol de líder para **Mujeres Jóvenes (MJ)** y para **Hombres Jóvenes (HJ)** tendrán permiso para consultar los datos de su propia organización y, adicionalmente, los datos de Seminario. Las demás organizaciones mantienen aislamiento estricto.
- **Consecuencias**: La lógica de consulta del backend debe aplicar un filtro especial: `Organizacion == user.Org OR (user.Org IN ['MJ', 'HJ'] AND Organizacion == 'Seminario')`.

---

### [ADR-004] Carga centralizada de comprobantes de gastos por el Administrador
- **Fecha**: 2026-10-25
- **Estado**: Aprobado
- **Contexto**: Se evaluó permitir que los líderes suban fotos de comprobantes y carguen gastos desde el móvil.
- **Decisión**: Descartar por ahora el botón de rendición en el celular de los líderes. El circuito operativo vigente continuará: los líderes entregan comprobantes a la presidencia y el administrador financiero los ingresa y concilia centralizadamente.
- **Consecuencias**: El Front-end del líder solo muestra historial de gastos en modo lectura (Fecha, Monto, Actividad), reduciendo el riesgo de cargas erróneas o duplicadas.

---

### [ADR-005] Incorporación del campo "Lugar" en la propuesta de actividades
- **Fecha**: 2026-10-25
- **Estado**: Aprobado
- **Contexto**: En la versión 2024, la tabla `DB` solo registraba Fecha, Hora, Asunto, Organización y Presupuesto.
- **Decisión**: Agregar el campo `Lugar` en el formulario móvil y en la tabla maestra `ACTIVIDADES_CALENDARIO`.
- **Consecuencias**: Facilita la logística y evita solapamientos de uso de edificios o salones de la Estaca.

---

### [ADR-006] Implementación del Sistema de Memoria Persistente con `.gemini/` y `GEMINI.md`
- **Fecha**: 2026-10-26
- **Estado**: Aprobado
- **Contexto**: Se evaluó instalar la herramienta externa `rsc-harness`.
- **Decisión**: Descartar `rsc-harness` para evitar fricciones con el cliente de escritorio de Google Drive y dependencias externas. Implementar una solución nativa basada en Markdown dentro de `.gemini/` con punto de entrada `GEMINI.md`.
- **Consecuencias**: Persistencia completa del contexto entre chats y sesiones sin costo computacional ni dependencias.

---

### [ADR-007] Tratamiento de Gastos Reembolsables y Exclusión del Presupuesto
- **Fecha**: 2026-10-28
- **Estado**: Aprobado
- **Contexto**: Existen actividades extraordinarias (p. ej., MeetUP) cuyos fondos provienen de retiros o transferencias especiales, pero no deben consumir la cuota de presupuesto asignada a las organizaciones locales.
- **Decisión**: Incorporar el campo `Es_Reembolsable` ("SI" / "NO") en la tabla `MOVIMIENTOS_GASTOS`. En la tabla `PRESUPUESTO_ASIGNACION`, la fórmula de `Total_Egresos_Ejecutados` filtra exclusivamente los movimientos no reembolsables: `=SUMIFS(tbl_Movimientos_Gastos[Monto], tbl_Movimientos_Gastos[Trimestre], Trimestre, tbl_Movimientos_Gastos[Organizacion], Organizacion, tbl_Movimientos_Gastos[Es_Reembolsable], "NO")`.
- **Consecuencias**: Los presupuestos de las organizaciones reflejan con precisión el saldo real disponible sin distorsiones por eventos multiestaca o reintegrables.

---

### [ADR-008] Convención MMDD-MONTO en Referencias y Registro de Devoluciones de Sobrantes
- **Fecha**: 2026-10-28
- **Estado**: Aprobado
- **Contexto**: El número de referencia de retiro se codifica como `MMDD-MONTO` (dos dígitos de mes, dos de día, guion y monto retirado). Además, al rendir gastos, los fondos remanentes se redepositan en el banco para cerrar cuentas en cero.
- **Decisión**: 
  1. Parsear fechas de retiro respetando `MMDD` como mes y día respectivamente, con formato visual uniforme `dd/mm/aaaa`.
  2. Incorporar en `RETIROS_FONDOS` la columna `Fecha_Devolucion` junto a `Devolucion_Deposito` y calcular el saldo como `Monto_Retirado - Total_Gastos_Rendidos - Devolucion_Deposito`.
- **Consecuencias**: Eliminación de fechas erróneas de meses futuros, conciliación bancaria exacta a $0.00 en retiros cerrados, y trazabilidad de las fechas en que se realizaron los depósitos de reintegro.

---

### [ADR-009] Formato Numérico Estándar sin Símbolo Monetario (`#.##0,00`)
- **Fecha**: 2026-10-29
- **Estado**: Aprobado por el Usuario
- **Contexto**: El usuario prefiere no visualizar el símbolo `$` en las columnas de importes, requiriendo un formato numérico limpio con separador de miles con punto (`.`) y dos decimales con coma (`,`).
- **Decisión**: 
  1. Mantener en las tablas de Excel el formato `#.##0,00` configurado por el usuario. No sobrescribir con `$`.
  2. En el Frontend de la Web App, renderizar todos los importes con este formato estándar (p. ej. `33.656,29` y `55.000,00` sin `$`).
- **Consecuencias**: Mayor legibilidad y uniformidad visual acorde a las preferencias del usuario.

---

### [ADR-010] Reevaluación de Arquitectura y Rediseño de Flujos de Usuario
- **Fecha**: 2026-11-05
- **Estado**: Aprobado
- **Contexto**: El enfoque monolítico en Google Apps Script Web App generaba alta fricción: tiempos de carga lentos (cold starts), advertencias de seguridad de Google con cuentas `@gmail.com`, complejidad excesiva en la UI para líderes y administradores, y acoplamiento frágil a Google Sheets.
- **Decisión**: Descartar el despliegue directo de interfaz en Google Apps Script Web App. Transicionar hacia una arquitectura desacoplada: interfaz web moderna y ágil (mobile-first real), base de datos eficiente y estructurada, autenticación nativa con Google sin pantallas de riesgo, y conservación de soporte/exportación a Excel simplificado para el Administrador Financiero.
- **Consecuencias**: Reducción drástica de complejidad para los líderes (solo ven saldo, próximas actividades e historial simple). Panel dedicado para Presidencia y Administrador con gestión de usuarios y roles protegidos (Presidente y Secretario Financiero como administradores inmutables).

---

### [ADR-011] Tratamiento de Fondos Compartidos en Actividades Generales de Estaca (Opción B)
- **Fecha**: 2026-11-06
- **Estado**: Aprobado por el Usuario
- **Contexto**: Cuando la Estaca organiza actividades generales que involucran fondos de varias organizaciones, se evaluó si descontarlo reduciendo el presupuesto asignado inicial (`Monto_Asignado`) o registrándolo como gasto especial prorrateado.
- **Decisión**: Se aprueba la **Opción B**: Mantener intacto el presupuesto asignado original (y sus porcentajes en el Dashboard de Presidencia) y registrar las contribuciones de las organizaciones como **gastos específicos de actividad general de Estaca**.
- **Consecuencias**: 
  1. El líder ve en su historial de gastos una línea clara: `Actividad General de Estaca: [Nombre Evento] | Monto`, explicando la deducción de su saldo.
  2. La barra visual de la tarjeta de la organización refleja con exactitud el gasto consumido (rojo) sobre la asignación original (verde).
  3. Cuadre exacto con las subcategorías contables del sistema oficial de la Iglesia (LCR).

---

### [ADR-012] Elección del Stack Tecnológico Moderno: Vercel + Supabase
- **Fecha**: 2026-11-06
- **Estado**: Aprobado por el Usuario
- **Contexto**: El despliegue de interfaz en Google Apps Script Web App fue descartado por problemas de latencia (cold starts), pantallas de riesgo con Gmail e interfaces monolíticas. Se evaluaron arquitecturas desacopladas gratuitas.
- **Decisión**: 
  1. **Frontend**: React + Vite + Tailwind CSS desplegado en **Vercel** como PWA nativa con dominio limpio y carga instantánea (<500ms).
  2. **Base de Datos y Auth**: **Supabase (PostgreSQL en la nube)** con autenticación oficial de Google OAuth 2.0 (Google Identity Services) y reglas de seguridad por fila (RLS).
  3. **Costo**: $0 de por vida en ambos servicios para el volumen de la Estaca (~45 usuarios).
  4. **Excel**: Soporte de sincronización con la planilla Excel simplificada del Administrador Financiero.
- **Consecuencias**: Acceso transparente sin contraseñas ni pantallas rojas para líderes, rendimiento ultrarrápido y modelo de datos relacional seguro e incorruptible.

---

### [ADR-013] Gestión de Gastos Compartidos con Otras Estacas/Unidades (Solución 1: Bruto vs. Reintegro)
- **Fecha**: 2026-11-07
- **Estado**: Aprobado por el Usuario
- **Contexto**: Cuando la Estaca asume el pago total de una actividad conjunta (ej. $60.000) y recibe posteriormente la cuota correspondiente a otras Estacas/unidades (ej. $40.000), cargar directamente el monto neto ($20.000) impide conciliar el comprobante contra LCR y el extracto bancario. Cargar el importe bruto ($60.000) a la organización distorsiona su presupuesto y genera sobregiro temporal.
- **Decisión**: Se aprueba la **Solución 1**:
  1. En el formulario de carga se registran: `Monto_Total_Factura` (valor oficial en LCR) y `Reintegro_Externo` (aporte de las otras unidades).
  2. El sistema calcula de forma automática el `Gasto_Neto_Organizacion = Monto_Total_Factura - Reintegro_Externo`.
  3. La app del líder descuenta y exhibe únicamente el `Gasto_Neto_Organizacion`, detallando la actividad y los aportes externos.
  4. La vista del Administrador y la conciliación LCR muestran el comprobante por su `Monto_Total_Factura` real, garantizando búsqueda y coincidencia exacta centavo a centavo.
- **Consecuencias**: Conciliación transparente e inmediata con LCR, búsqueda ágil por importe bancario real, y protección total del presupuesto de la organización sin sobregiros artificiales.

---

### [ADR-014] Modelo de Sincronización con Excel: Botones de Importación y Exportación
- **Fecha**: 2026-11-08
- **Estado**: Aprobado por el Usuario
- **Contexto**: Se evaluaron tres opciones de sincronización con Excel (Botones Importar/Exportar, Power Query automático, y Google Sheets en tiempo real).
- **Decisión**: Se adopta la **Opción 1**:
  1. La Web App moderna es el sistema central de gestión operativa para líderes, presidencia y administrador.
  2. El archivo Excel local (`.xlsx`) actúa como **respaldo de seguridad (backup)** en el disco local y como alternativa para cargas masivas cuando sea necesario.
  3. Se incorporan en el Centro de Edición y Carga los botones `📥 Exportar Excel` y `📤 Importar Excel`.
- **Consecuencias**: Cero fragilidad de sincronización en tiempo real, control absoluto en manos del Administrador, y posesión de un libro Excel limpio, auditable e independiente.

---

### [ADR-015] Sincronización del Calendario Oficial de LCR vía iCal Group Feed
- **Fecha**: 2026-11-08
- **Estado**: Aprobado por el Usuario
- **Contexto**: Los líderes de la Estaca cargan actividades en la plataforma web oficial de la Iglesia (`churchofjesuschrist.org/calendar`). Se requería evitar doble carga de datos y sincronizar fechas, salones y horarios con nuestra App de Finanzas.
- **Decisión**:
  1. Se implementa la integración del **endpoint de grupo iCal (`/services/ext/v3.0/export/ical/group/[id]`)** configurado exclusivamente con los calendarios de la Estaca.
  2. La URL es pública, no requiere cookies de sesión y responde en vivo con formato estándar RFC 5545 (`VCALENDAR`).
  3. Los eventos se sincronizan de forma unidireccional y se vinculan a través de su `UID` inmutable. Si una actividad se reprograma, adelanta, posterga o cancela en LCR, la App actualiza automáticamente sus fechas y estado sin alterar los presupuestos ni gastos vinculados internamente.
  4. Los líderes u organizadores pueden enriquecer la actividad agregando el **presupuesto estimado requerido**.
  5. **Confidencialidad Estricta de Presupuesto en Calendario**: El campo `Costo_Estimado` y el distintivo visual `💰 Con Presupuesto` son **visibles únicamente para la organización organizadora, Presidencia de Estaca y Administradores**. Los líderes de otras organizaciones visualizan la actividad como un evento regular informativo sin acceso a cifras monetarias ni indicadores de costo.
- **Consecuencias**: Cero trabajo redundante para los líderes, detección inmediata de reprogramaciones en tiempo real, confidencialidad financiera total entre organizaciones y vinculación transparente entre agenda y presupuesto.

---

### [ADR-016] Arquitectura Frontend Unificada: Single PWA con Enrutamiento RBAC
- **Fecha**: 2026-11-08
- **Estado**: Aprobado por el Usuario
- **Contexto**: Se evaluó si desarrollar dos aplicaciones web desacopladas (una para líderes/presidencia y otra privada para el Administrador) o una sola Progressive Web App (PWA) unificada con control de acceso por roles.
- **Decisión**: Se aprueba la **Opción A (Aplicación Unificada)**:
  1. Un único despliegue y dominio en Vercel (`estaca-montevideo-este.vercel.app`).
  2. Enrutamiento dinámico y seguro según el rol del usuario autenticado vía Google Sign-In:
     - **Líder**: Acceso directo y exclusivo a la vista móvil de su organización.
     - **Presidencia**: Acceso al Hub Ejecutivo (Dashboard de Presidencia, alertas de actividades por aprobar y selector de organizaciones).
     - **Administrador (Secretario Financiero y Presidente)**: Acceso total al Hub Ejecutivo más el panel de Gestión de Usuarios y el Centro de Edición y Carga Operativa (conciliación, gastos, retiros, sincronización Excel y LCR).
- **Consecuencias**: Mantenimiento centralizado, una sola base de código frontend, despliegues continuos simplificados y máxima coherencia visual y de diseño.

---

### [ADR-017] Super-Administrador Vitalicio por Correo (`pablosud52@gmail.com`) y Acceso Exclusivo al Simulador de Roles
- **Fecha**: 2026-11-09
- **Estado**: Aprobado por el Usuario
- **Contexto**: Se requería garantizar que Pablo Lamela (`pablosud52@gmail.com`), actual Secretario Financiero de Estaca, conserve sus permisos totales de `ADMIN` de forma permanente incluso si en el futuro es relevado de su llamamiento o deja de integrar la Presidencia de Estaca, y que ningún otro usuario tenga acceso al selector de cambio de rol (Simulador RBAC) cuando la aplicación opere en producción.
- **Decisión**:
  1. Se declara `SUPER_ADMIN_EMAIL = 'pablosud52@gmail.com'` como identidad propietaria vitalicia del sistema.
  2. Su rol `ADMIN`, estado activo e inmutabilidad (`is_permanent_admin = true`) quedan vinculados directamente a su correo `pablosud52@gmail.com`, desacoplados del llamamiento de Secretario Financiero o de la pertenencia a `organization = 'TODAS'`.
  3. El usuario `pablosud52@gmail.com` puede actualizar su propio llamamiento u organización en el futuro (y dar de alta a un nuevo Secretario Financiero con rol `ADMIN`) sin perder jamás su propio rol `ADMIN`.
  4. El componente de cambio rápido de rol (`DevRoleSwitcher`) valida el correo autenticado real (`realUserEmail`) y solo está disponible para `pablosud52@gmail.com` (con opción de mostrarlo u ocultarlo desde su menú), permaneciendo invisible e inaccesible para el resto de los usuarios en producción.
- **Consecuencias**: Continuidad técnica garantizada ante relevos eclesiásticos futuros y máxima seguridad en el control de simulación de vistas.
