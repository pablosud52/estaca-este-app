# FTD — Unificación Estética con Tarjeta Azul (`#083563` → `#051E3B`)

## Intención
Alinear el ícono de la app y toda la interfaz visual con la nueva estética de las tarjetas principales de Presidencia y Líderes (degradado azul marino `#083563` → `#072B52` → `#051E3B`, textos blancos y acentos en celeste suave), reemplazando el verde/dorado anterior y reservando verde/ámbar/rojo solo para estados semánticos.

## Alcance por partes
- [x] **Parte 1 — Ícono de la app y barra del navegador**: Opción A (`EE` + línea fina + `ESTACA ESTE` sobre degradado azul `#083563`→`#051E3B`), `favicon.svg`, `mask-icon.svg`, PNGs de favicon/Apple/PWA, `theme-color` en `index.html` y `vite.config.ts`.
- [x] **Parte 2 — Cabecera, menú y paleta base**: tokens en `tailwind.config.js`, Estilo 1 en badge de Estaca (`#083563`), tabs activos (`#072B52`), dropdown Administración y drawer móvil en `PresidencyHub.tsx` y `LeaderView.tsx`.
- [x] **Parte 3 — Pantalla de ingreso y paneles principales**: Opción 1 en `LoginView.tsx` (ícono `/favicon.svg`, etiqueta `#083563`, botón degradado azul) y alineación de `PresidencyHub.tsx` y `LeaderView.tsx` (trimestres, botones de acción y modales).
- [x] **Parte 4 — Resto de vistas y ventanas**: `CalendarView`, `SuppliersView`, `LeadersDirectoryView`, `AdminOperationsCenter`, `FinancialInfoSection`, `OrgDistributionChart`, `PwaInstallBanner`, `UnauthorizedView`, `ProposeActivityModal`, `ExpenseFormModal`, `NewMovementModal`, `ActivityEditModal`, `SupplierFormModal`, `SupplierCategoriesModal` y `DuplicateReviewModal`.

## Evidencia
- Parte 1: `npm run build` exitoso (0 errores, PWA manifest y precache de 16 entradas generados) e inspección visual de `public/pwa-512x512.png` y `public/pwa-maskable-512x512.png`.
- Parte 2: `npm run build` exitoso tras aplicar Estilo 1 en `tailwind.config.js`, `PresidencyHub.tsx` y `LeaderView.tsx`.
- Parte 3: `npm run build` exitoso tras aplicar Opción 1 en `LoginView.tsx` y alinear botones, trimestres y modales en `PresidencyHub.tsx` y `LeaderView.tsx`.
- Parte 4: `npm run build` exitoso tras alinear vistas (`CalendarView`, `SuppliersView`, `LeadersDirectoryView`), centro de Administración (`AdminOperationsCenter`, `FinancialInfoSection`), gráficos, banner PWA y modales.

## Próximo paso
Revisión visual en navegador por el usuario y commit/despliegue cuando esté conforme.
