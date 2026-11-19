-- Soporte de estado ACTIVO / PENDIENTE para sugerencias desde Finanzas (2026-11-19)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVO';
UPDATE public.suppliers SET status = 'ACTIVO' WHERE status IS NULL;
