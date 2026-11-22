-- 09_cleanup_seed_duplicate_activities.sql
-- Limpia las 8 filas semilla iniciales (LCR-2026-001 .. LCR-2026-008) que duplicaban
-- eventos reales ya sincronizados desde LCR (@calendar.churchofjesuschrist.org),
-- transfiriendo primero sus presupuestos estimados a los eventos reales correspondientes.

-- 1. Transferir presupuesto estimado ($15.000) de "Actividad AS de Fin de Año" (id=3)
--    al evento real de LCR "Noche de hogar para AS" (id=42, movido al 22/11/2026)
UPDATE public.activities
SET estimated_cost = 15000.00, has_budget = true
WHERE id = 42 AND estimated_cost = 0;

-- 2. Transferir presupuesto estimado ($10.000) de "Campeonato de Vóley HHJJ y MMJJ" (id=8)
--    al evento real de LCR "Campeonato de Voley de HH y MM JJ de estaca" (id=66, 12/12/2026)
UPDATE public.activities
SET estimated_cost = 10000.00, has_budget = true
WHERE id = 66 AND estimated_cost = 0;

-- 3. Eliminar las 8 filas semilla duplicadas (ninguna tiene gastos rendidos vinculados)
DELETE FROM public.activities
WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8)
  AND ical_uid LIKE 'LCR-2026-00%';
