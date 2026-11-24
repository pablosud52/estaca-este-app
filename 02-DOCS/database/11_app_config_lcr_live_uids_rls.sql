-- ==============================================================================
-- MIGRACIÓN 11 (APLICADA EN SUPABASE): COMPARTIR LCR_LIVE_UIDS EN public.app_config
-- Fecha: 2026-11-24
-- Propósito:
--   1. Permitir guardar la lista compartida de UIDs activos (`LCR_LIVE_UIDS`) en
--      `app_config` para que la alerta "Quitadas de LCR" funcione en todos los
--      navegadores y dispositivos (incluso al caer en el escudo de 10 minutos).
--   2. Alinear los permisos de escritura de `LAST_SYNCED_AT` y `LCR_LIVE_UIDS`
--      con la Migración 10 (solo ADMIN y PRESIDENCIA persisten sincronización LCR
--      en BD; LIDER y CONSULTA siguen leyendo con SELECT).
-- Nota: Aplicada de forma atómica y sin caída usando `ALTER POLICY`.
-- ==============================================================================

ALTER POLICY "Insercion config autenticados"
  ON public.app_config
  WITH CHECK (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (
      lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.users_profiles up
        WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
          AND up.is_active = true
          AND up.role IN ('ADMIN', 'PRESIDENCIA')
      )
    )
  );

ALTER POLICY "Insercion config autenticados"
  ON public.app_config
  RENAME TO "Insercion config admin o presidencia";

ALTER POLICY "Actualizacion config autenticados"
  ON public.app_config
  USING (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (
      lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.users_profiles up
        WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
          AND up.is_active = true
          AND up.role IN ('ADMIN', 'PRESIDENCIA')
      )
    )
  )
  WITH CHECK (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (
      lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.users_profiles up
        WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
          AND up.is_active = true
          AND up.role IN ('ADMIN', 'PRESIDENCIA')
      )
    )
  );

ALTER POLICY "Actualizacion config autenticados"
  ON public.app_config
  RENAME TO "Actualizacion config admin o presidencia";
