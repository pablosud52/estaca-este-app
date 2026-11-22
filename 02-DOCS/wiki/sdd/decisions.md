# SDD Decisions Log

## 2026-11-22 — Spec `calendario-unificado-lcr` (v2)
- **Decisión 1 (Sección única + Modo Lectura por defecto):** Se unifican `Calendario` y `Panel de Control del Calendario` en una sola sección `Calendario` del menú principal. Abre siempre en Modo Lectura (Tarjetas) y ofrece a Presidencia, Secretarios y Administradores un botón interruptor `Gestionar` (con contador pulsante si hay pendientes) que habilita el selector `Tarjetas / Lista`, los filtros de gestión y las acciones operativas.
- **Decisión 2 (Filtro por fecha / rango de fechas):** Se agrega filtro `Desde` / `Hasta` en el calendario para cualquier usuario.
- **Decisión 3 (Jerarquía LCR y Notas complementarias públicas):** LCR es la fuente oficial de verdad. En eventos de Estaca vinculados a LCR, título, fecha, horario y lugar son de solo lectura con aviso "Se edita en LCR"; la app permite editar Organización, Presupuesto estimado y Notas complementarias (separadas de la descripción de LCR, preservadas ante sincronizaciones y visibles para todos los que ven el evento).
- **Decisión 4 (Protección de eventos globales):** Los eventos `CHURCHWIDE` (globales de la Iglesia) son de solo lectura absoluta y no se editan ni eliminan desde la app.
- **Decisión 5 (Vinculación automática y manual):** Los eventos creados en la app pendientes de LCR son totalmente editables y se vinculan automáticamente por fecha + nombre normalizado (ignorando mayúsculas, tildes y espacios) al sincronizar o al guardar una edición, además de permitir vinculación manual en 1 clic.
- **Decisión 6 (Permisos):** Todos los miembros de Presidencia (incluidos Secretarios) y Administradores tienen acceso a `Gestionar`, alineado al árbol de permisos vigente.
- **Artefacto:** [calendario-unificado-lcr.md](specs/calendario-unificado-lcr.md)
