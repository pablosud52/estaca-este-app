---
author: Pablo Lamela
branch: main
status: completed
---
# FTD: Selector de Ingresos/Gastos y Barra Unificada de Jóvenes en Gráfica

## Intent
Mejorar la gráfica ejecutiva de Presidencia (`OrgDistributionChart`) para:
1. Incorporar un selector de métrica que permita alternar independientemente entre ver **Ingresos (Asignación)** y **Gastos Reales** por período (`Global`, `T1`..`T4`), tanto en montos (`$`) como en porcentajes (`%`).
2. Mostrar por defecto una barra unificada para **Jóvenes** (HJ + MJ + Seminario juntos) con un selector interactivo para desglosarlos individualmente si el usuario lo desea.
3. Eliminar la reseña/pastilla inferior de la gráfica, integrando la información con total armonía directamente en el gráfico.

## Scope
- **Incluido**:
  - `src/components/OrgDistributionChart.tsx`:
    - Incorporación en la interfaz de:
      - Selector de métrica: `[ Ingresos ]` (`chart-metric-ingresos`) y `[ Gastos ]` (`chart-metric-gastos`).
      - Selector de agrupación de jóvenes: `[ Juntos ]` (`chart-youth-unified`) y `[ Separados ]` (`chart-youth-split`).
    - Lógica de agregación para modo Jóvenes Unificados vs Desglosados.
    - Adaptación de tooltips, etiquetas en la cúspide de las barras y escalas para Ingresos vs Gastos.
    - Eliminación de la pastilla inferior de `youth-focus-pill` y sustitución por leyenda minimalista.
  - `src/views/PresidencyHub.tsx`:
    - Incorporación de `t1_spent`, `t2_spent`, `t3_spent`, `t4_spent` en `OrgSummaryStat` para permitir filtrado fiel de gastos por trimestre en la gráfica.
  - `tests/presidency-hub.spec.ts`:
    - Actualización de los tests existentes y cobertura de los nuevos controles interactivos (Ingresos/Gastos y Jóvenes Juntos/Separados).
  - Sincronización con GitHub y copia de Google Drive.

- **Excluido**:
  - Modo comparativo en simultáneo (descartado por definición del usuario).

## Checklist
- [x] Ampliar interfaz `OrgSummaryStat` y cálculo en `PresidencyHub.tsx` con desglose trimestral de gastos.
- [x] Implementar controles de Métrica (Ingresos / Gastos) y Jóvenes (Juntos / Separados) en `OrgDistributionChart.tsx`.
- [x] Eliminar la pastilla inferior de Nuevas Generaciones de `OrgDistributionChart.tsx`.
- [x] Actualizar y validar tests E2E en Playwright (`tests/presidency-hub.spec.ts`).
- [x] Ejecutar compilación exitosa (`npm run build`).
- [x] Realizar commit y push a GitHub (`main`).
- [x] Sincronizar directorio en Google Drive (`g:\Mi unidad\GitHub\estaca-este-app`).

## Evidence
- `npm run build`: compilación limpia (`tsc -b && vite build`) en 9.99s, con bundles generados y service worker de PWA generado.
- `npm run test:e2e`: 30 passed (46.6s) en Chrome de escritorio y Chrome móvil.

## Next
- Subir a GitHub y sincronizar con Google Drive.
