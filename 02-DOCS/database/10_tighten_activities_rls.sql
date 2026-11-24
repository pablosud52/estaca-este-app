-- ==============================================================================
-- MIGRACIÓN 10 (APLICADA EN SUPABASE): ENDURECIMIENTO RLS EN public.activities
-- Fecha: 2026-11-24
-- Propósito:
--   1. Restringir UPDATE en `public.activities` a ADMIN y PRESIDENCIA.
--   2. Permitir INSERT a LIDER únicamente para propuestas (`status = 'PROPUESTA'`).
--   3. Evitar que usuarios con rol CONSULTA escriban en `public.activities`.
-- Nota: Aplicada de forma atómica y sin caída usando `ALTER POLICY`.
-- ==============================================================================

ALTER POLICY "Insercion actividades usuarios activos"
  ON public.activities
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND (
          up.role IN ('ADMIN', 'PRESIDENCIA')
          OR (
            up.role = 'LIDER'
            AND activities.status = 'PROPUESTA'
            AND (
              activities.organization = up.organization
              OR (up.organization IN ('HJ', 'MJ') AND activities.organization = 'SEMINARIO')
            )
          )
        )
    )
  );

ALTER POLICY "Insercion actividades usuarios activos"
  ON public.activities
  RENAME TO "Insercion actividades admin presidencia o propuesta lider";

ALTER POLICY "Actualizacion actividades usuarios activos"
  ON public.activities
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  )
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

ALTER POLICY "Actualizacion actividades usuarios activos"
  ON public.activities
  RENAME TO "Actualizacion actividades admin o presidencia";
