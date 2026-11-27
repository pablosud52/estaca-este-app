# SDD Decisions Log

## 2026-11-22 — Spec `calendario-unificado-lcr` (v2)
- **Decisión 1 (Sección única + Modo Lectura por defecto):** Se unifican `Calendario` y `Panel de Control del Calendario` en una sola sección `Calendario` del menú principal. Abre siempre en Modo Lectura (Tarjetas) y ofrece a Presidencia, Secretarios y Administradores un botón interruptor `Gestionar` (con contador pulsante si hay pendientes) que habilita el selector `Tarjetas / Lista`, los filtros de gestión y las acciones operativas.
- **Decisión 2 (Filtro por fecha / rango de fechas):** Se agrega filtro `Desde` / `Hasta` en el calendario para cualquier usuario.
- **Decisión 3 (Jerarquía LCR y Notas complementarias públicas):** LCR es la fuente oficial de verdad. En eventos de Estaca vinculados a LCR, título, fecha, horario y lugar son de solo lectura con aviso "Se edita en LCR"; la app permite editar Organización, Presupuesto estimado y Notas complementarias (separadas de la descripción de LCR, preservadas ante sincronizaciones y visibles para todos los que ven el evento).
- **Decisión 4 (Protección de eventos globales):** Los eventos `CHURCHWIDE` (globales de la Iglesia) son de solo lectura absoluta y no se editan ni eliminan desde la app.
- **Decisión 5 (Vinculación automática y manual):** Los eventos creados en la app pendientes de LCR son totalmente editables y se vinculan automáticamente por fecha + nombre normalizado (ignorando mayúsculas, tildes y espacios) al sincronizar o al guardar una edición, además de permitir vinculación manual en 1 clic.
- **Decisión 6 (Permisos):** Todos los miembros de Presidencia (incluidos Secretarios) y Administradores tienen acceso a `Gestionar`, alineado al árbol de permisos vigente.
- **Artefacto:** [calendario-unificado-lcr.md](specs/calendario-unificado-lcr.md)

## 2026-11-22 — Spec `proveedores-unificado`
- **Decisión 1 (Acceso único en menú):** Se elimina el botón duplicado de `Proveedores` dentro de *Administración* (PC y móvil), dejando un único botón `Proveedores` en la barra principal con contador discreto de pendientes visible solo para Administradores.
- **Decisión 2 (Modo Lectura + interruptor `Gestionar`):** `Proveedores` abre siempre en Modo Lectura limpio. Solo Administradores y Super Admin ven el botón `Gestionar`, que habilita `+ Nuevo Proveedor`, `Categorías / Rubros`, `Directorio / Pendientes`, `Editar / Eliminar` y un switch `Tarjetas / Lista`.
- **Artefacto:** [proveedores-unificado.md](specs/proveedores-unificado.md)

## 2026-11-22 — Spec `directorio-unificado`
- **Decisión 1 (Acceso único en menú):** Se elimina el botón duplicado de `Directorio` dentro de *Administración* (PC y móvil), dejando un único botón `Directorio` en la barra principal con contador pulsante de contactos incompletos visible solo para Administradores.
- **Decisión 2 (Modo Lectura + interruptor `Gestionar`):** `Directorio` abre siempre en Modo Lectura limpio. Solo Administradores y Super Admin ven el botón `Gestionar`, que habilita en la misma pantalla el panel completo de gestión de puestos, relevos y accesos.
- **Decisión 3 (Simplificación visual de badges):** En modo gestión se reducen colores y etiquetas redundantes para mostrar claramente de un vistazo quién tiene acceso a la app y qué rol posee.
- **Artefacto:** [directorio-unificado.md](specs/directorio-unificado.md)

## 2026-11-22 — Spec `finanzas-fechas-estetica`
- **Decisión 1 (Orden por fecha en Gastos y Movimientos):** Más recientes primero por defecto; en Gastos los Pendientes de LCR quedan siempre arriba y el resto se ordena al tocar el encabezado `Fecha` (o botón compacto `Fecha ↓/↑` en móvil).
- **Decisión 2 (Filtro por fechas):** Botón compacto `Fechas` independiente en Gastos y Movimientos que despliega `Desde` / `Hasta` y `Limpiar fechas`, igual que en Calendario.
- **Decisión 3 (Fecha de referencia en Gastos):** Se ordena y filtra por fecha contable / LCR (`expense_date`).
- **Decisión 4 (Estética unificada):** Paleta azul marino institucional (`#072B52` / `#083563`) en controles y botones operativos, reservando verde solo para importes y confirmaciones positivas.
- **Artefacto:** [finanzas-fechas-estetica.md](specs/finanzas-fechas-estetica.md)

## 2026-11-23 — Spec `normativas-rediseno`
- **Decisión 1 (Nombre, ubicación y visibilidad):** La sección se llama **`Normativas`**, vive dentro de **`Administración`** (junto a Finanzas y Logs) y vuelve a habilitarse para **Presidencia de Estaca (incluidos Secretarios) y Administradores** (quitando el aviso de borrador).
- **Decisión 2 (3 pestañas limpias):** `Uso Apropiado de los Fondos` (abierta por defecto), `Cierre Anual` y `Excepción de Dinero`.
- **Decisión 3 (Consulta interactiva):** `Uso Apropiado de los Fondos` incluye buscador en tiempo real, filtros por las 5 categorías y las notas `(A)`–`(L)` integradas directamente dentro de cada uno de los 27 conceptos.
- **Decisión 4 (Respaldo PDF):** Cada pestaña incluye en su cabecera el botón **`Ver PDF oficial`** que abre el PDF original en pestaña nueva.
- **Artefacto:** [normativas-rediseno.md](specs/normativas-rediseno.md)

## 2026-11-26 — bug: PDFs abren el panel en Vercel  (feature: fix-pdf-service-worker-vercel)
Repro      — En build de producción (`npm run build` + `vite preview` con Service Worker activo), navegar a `/docs/normativas/uso-apropiado-fondos-2026.pdf` devolvió `200 text/html;charset=utf-8` (`#root` presente) en lugar de `application/pdf`.
Cause      — `VitePWA` en `vite.config.ts` generaba `NavigationRoute(createHandlerBoundToURL("index.html"))` sin `navigateFallbackDenylist` y sin precachear `*.pdf`, interceptando navegaciones en `<iframe>` y pestañas nuevas hacia `index.html`.
Fix        — Agregado `workbox.navigateFallbackDenylist: [/^\/docs\//, /^\/api\//, /\.pdf($|\?)/i]` en `vite.config.ts` + prueba de regresión `tests/normativas-sw.spec.ts` contra `vite preview`.
Why missed — `tests/normativas.spec.ts` corre sobre `vite dev`, donde el Service Worker de `VitePWA` no se registra.
