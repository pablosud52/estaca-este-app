-- 08_activities_app_notes.sql
-- Agrega la columna app_notes a public.activities para almacenar notas complementarias
-- propias de la app (visibles para todos los usuarios) sin que la sincronización con LCR las sobrescriba.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS app_notes text;

COMMENT ON COLUMN public.activities.app_notes IS
  'Notas complementarias cargadas en Estaca Este App. Nunca se sobrescriben al sincronizar con LCR.';
