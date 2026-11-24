-- =============================================================================
-- 13_harden_rls_security_performance_and_constraints.sql
-- Endurecimiento de seguridad RLS, rendimiento (initplan) e integridad financiera
-- Proyecto: Estaca Este App (Supabase)
-- =============================================================================

BEGIN;

-- 1. Cerrar ejecución pública de public.rls_auto_enable() (lints 0028 y 0029)
--    y revocar permisos residuales de tabla al rol anon en tablas de usuarios/directorio
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.users_profiles, public.stake_directory_entries FROM anon;

-- 2. Esquema privado no expuesto para helpers RBAC estables
--    - Elimina los 33 avisos auth_rls_initplan (lint 0003)
--    - Evita recursión RLS al consultar public.users_profiles
--    - No queda expuesto en la API REST de Supabase (a diferencia de public)
CREATE SCHEMA IF NOT EXISTS app_auth;
REVOKE ALL ON SCHEMA app_auth FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_auth TO authenticated;

CREATE OR REPLACE FUNCTION app_auth.current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE lower(nullif(auth.jwt() ->> 'email', ''))
  END;
$$;

CREATE OR REPLACE FUNCTION app_auth.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_auth.current_email() = 'pablosud52@gmail.com';
$$;

CREATE OR REPLACE FUNCTION app_auth.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_auth.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = app_auth.current_email()
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    );
$$;

CREATE OR REPLACE FUNCTION app_auth.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_auth.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = app_auth.current_email()
        AND up.is_active = true
        AND up.role = 'ADMIN'
    );
$$;

CREATE OR REPLACE FUNCTION app_auth.is_admin_or_presidencia()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_auth.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = app_auth.current_email()
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    );
$$;

CREATE OR REPLACE FUNCTION app_auth.can_edit_finances()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_auth.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = app_auth.current_email()
        AND up.is_active = true
        AND (
          up.role = 'ADMIN'
          OR (
            up.role = 'PRESIDENCIA'
            AND lower(coalesce(up.calling, '')) LIKE '%secretario financiero%'
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION app_auth.current_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_auth.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_auth.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_auth.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_auth.is_admin_or_presidencia() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_auth.can_edit_finances() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_auth.current_email() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.is_admin_or_presidencia() TO authenticated;
GRANT EXECUTE ON FUNCTION app_auth.can_edit_finances() TO authenticated;

-- 3. Políticas RLS por tabla (solo authenticated; cero acceso anon/public; cero políticas duplicadas)

-- 3.1 users_profiles (cierra fuga de correos/teléfonos a usuarios no autenticados)
DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.users_profiles;
DROP POLICY IF EXISTS "Lectura perfiles solo autenticados" ON public.users_profiles;
DROP POLICY IF EXISTS "Lectura perfiles usuarios autenticados" ON public.users_profiles;
DROP POLICY IF EXISTS "Admin puede insertar perfiles" ON public.users_profiles;
DROP POLICY IF EXISTS "Admin puede actualizar perfiles" ON public.users_profiles;

CREATE POLICY "Lectura perfiles usuarios autenticados"
  ON public.users_profiles FOR SELECT TO authenticated
  USING (
    lower(email) = (SELECT app_auth.current_email())
    OR (SELECT app_auth.is_active_user())
  );

CREATE POLICY "Admin puede insertar perfiles"
  ON public.users_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.is_admin()));

CREATE POLICY "Admin puede actualizar perfiles"
  ON public.users_profiles FOR UPDATE TO authenticated
  USING ((SELECT app_auth.is_admin()))
  WITH CHECK ((SELECT app_auth.is_admin()));

-- 3.2 stake_directory_entries (separa SELECT de escritura, elimina 5 avisos multiple_permissive_policies)
DROP POLICY IF EXISTS "Lectura directorio usuarios activos" ON public.stake_directory_entries;
DROP POLICY IF EXISTS "Escritura directorio solo admin" ON public.stake_directory_entries;
DROP POLICY IF EXISTS "Insercion directorio solo admin" ON public.stake_directory_entries;
DROP POLICY IF EXISTS "Actualizacion directorio solo admin" ON public.stake_directory_entries;
DROP POLICY IF EXISTS "Eliminacion directorio solo admin" ON public.stake_directory_entries;

CREATE POLICY "Lectura directorio usuarios activos"
  ON public.stake_directory_entries FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion directorio solo admin"
  ON public.stake_directory_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.is_admin()));

CREATE POLICY "Actualizacion directorio solo admin"
  ON public.stake_directory_entries FOR UPDATE TO authenticated
  USING ((SELECT app_auth.is_admin()))
  WITH CHECK ((SELECT app_auth.is_admin()));

CREATE POLICY "Eliminacion directorio solo admin"
  ON public.stake_directory_entries FOR DELETE TO authenticated
  USING ((SELECT app_auth.is_admin()));

-- 3.3 expenses
--     - Gastos reales y planificados: exclusivos de can_edit_finances() (Admin, Super Admin y Secretario Financiero)
--     - Reservas proyectadas de calendario (PROYECTADO_ACTIVIDAD, is_applied = false): también permitidas a Presidencia
--       para que Consejeros y Secretarios puedan aprobar, editar, vincular o cancelar actividades con presupuesto estimado.
DROP POLICY IF EXISTS "Lectura gastos usuarios activos" ON public.expenses;
DROP POLICY IF EXISTS "Insercion gastos admin o presidencia" ON public.expenses;
DROP POLICY IF EXISTS "Actualizacion gastos admin o presidencia" ON public.expenses;
DROP POLICY IF EXISTS "Eliminacion gastos admin o presidencia" ON public.expenses;
DROP POLICY IF EXISTS "Insercion gastos editores finanzas" ON public.expenses;
DROP POLICY IF EXISTS "Actualizacion gastos editores finanzas" ON public.expenses;
DROP POLICY IF EXISTS "Eliminacion gastos editores finanzas" ON public.expenses;

CREATE POLICY "Lectura gastos usuarios activos"
  ON public.expenses FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion gastos editores finanzas"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT app_auth.can_edit_finances())
    OR (
      (SELECT app_auth.is_admin_or_presidencia())
      AND expense_type = 'PROYECTADO_ACTIVIDAD'
      AND is_applied = false
    )
  );

CREATE POLICY "Actualizacion gastos editores finanzas"
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    (SELECT app_auth.can_edit_finances())
    OR (
      (SELECT app_auth.is_admin_or_presidencia())
      AND expense_type = 'PROYECTADO_ACTIVIDAD'
      AND is_applied = false
    )
  )
  WITH CHECK (
    (SELECT app_auth.can_edit_finances())
    OR (
      (SELECT app_auth.is_admin_or_presidencia())
      AND expense_type = 'PROYECTADO_ACTIVIDAD'
      AND is_applied = false
    )
  );

CREATE POLICY "Eliminacion gastos editores finanzas"
  ON public.expenses FOR DELETE TO authenticated
  USING (
    (SELECT app_auth.can_edit_finances())
    OR (
      (SELECT app_auth.is_admin_or_presidencia())
      AND expense_type = 'PROYECTADO_ACTIVIDAD'
      AND is_applied = false
    )
  );

-- 3.4 cash_withdrawals (escritura alineada a canEditFinances)
DROP POLICY IF EXISTS "Lectura retiros usuarios activos" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Insercion retiros admin o presidencia" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Actualizacion retiros admin o presidencia" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Eliminacion retiros admin o presidencia" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Insercion retiros editores finanzas" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Actualizacion retiros editores finanzas" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Eliminacion retiros editores finanzas" ON public.cash_withdrawals;

CREATE POLICY "Lectura retiros usuarios activos"
  ON public.cash_withdrawals FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion retiros editores finanzas"
  ON public.cash_withdrawals FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Actualizacion retiros editores finanzas"
  ON public.cash_withdrawals FOR UPDATE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()))
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Eliminacion retiros editores finanzas"
  ON public.cash_withdrawals FOR DELETE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()));

-- 3.5 budget_allocations (escritura alineada a canEditFinances)
DROP POLICY IF EXISTS "Lectura presupuestos usuarios activos" ON public.budget_allocations;
DROP POLICY IF EXISTS "Insercion presupuestos admin o presidencia" ON public.budget_allocations;
DROP POLICY IF EXISTS "Actualizacion presupuestos admin o presidencia" ON public.budget_allocations;
DROP POLICY IF EXISTS "Eliminacion presupuestos admin o presidencia" ON public.budget_allocations;
DROP POLICY IF EXISTS "Insercion presupuestos editores finanzas" ON public.budget_allocations;
DROP POLICY IF EXISTS "Actualizacion presupuestos editores finanzas" ON public.budget_allocations;
DROP POLICY IF EXISTS "Eliminacion presupuestos editores finanzas" ON public.budget_allocations;

CREATE POLICY "Lectura presupuestos usuarios activos"
  ON public.budget_allocations FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion presupuestos editores finanzas"
  ON public.budget_allocations FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Actualizacion presupuestos editores finanzas"
  ON public.budget_allocations FOR UPDATE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()))
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Eliminacion presupuestos editores finanzas"
  ON public.budget_allocations FOR DELETE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()));

-- 3.6 budget_incomes (escritura alineada a canEditFinances)
DROP POLICY IF EXISTS "Lectura ingresos presupuesto usuarios activos" ON public.budget_incomes;
DROP POLICY IF EXISTS "Insercion ingresos presupuesto admin o presidencia" ON public.budget_incomes;
DROP POLICY IF EXISTS "Actualizacion ingresos presupuesto admin o presidencia" ON public.budget_incomes;
DROP POLICY IF EXISTS "Eliminacion ingresos presupuesto admin o presidencia" ON public.budget_incomes;
DROP POLICY IF EXISTS "Insercion ingresos presupuesto editores finanzas" ON public.budget_incomes;
DROP POLICY IF EXISTS "Actualizacion ingresos presupuesto editores finanzas" ON public.budget_incomes;
DROP POLICY IF EXISTS "Eliminacion ingresos presupuesto editores finanzas" ON public.budget_incomes;

CREATE POLICY "Lectura ingresos presupuesto usuarios activos"
  ON public.budget_incomes FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion ingresos presupuesto editores finanzas"
  ON public.budget_incomes FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Actualizacion ingresos presupuesto editores finanzas"
  ON public.budget_incomes FOR UPDATE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()))
  WITH CHECK ((SELECT app_auth.can_edit_finances()));

CREATE POLICY "Eliminacion ingresos presupuesto editores finanzas"
  ON public.budget_incomes FOR DELETE TO authenticated
  USING ((SELECT app_auth.can_edit_finances()));

-- 3.7 activities (activos leen; Presidencia/Admins escriben y eliminan; LIDER solo inserta PROPUESTA de su org o SEMINARIO si es HJ/MJ)
DROP POLICY IF EXISTS "Lectura actividades usuarios activos" ON public.activities;
DROP POLICY IF EXISTS "Insercion actividades usuarios activos" ON public.activities;
DROP POLICY IF EXISTS "Insercion actividades admin presidencia o propuesta lider" ON public.activities;
DROP POLICY IF EXISTS "Actualizacion actividades usuarios activos" ON public.activities;
DROP POLICY IF EXISTS "Actualizacion actividades admin o presidencia" ON public.activities;
DROP POLICY IF EXISTS "Eliminacion actividades admin o presidencia" ON public.activities;

CREATE POLICY "Lectura actividades usuarios activos"
  ON public.activities FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion actividades admin presidencia o propuesta lider"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT app_auth.is_admin_or_presidencia())
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((SELECT auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role = 'LIDER'
        AND activities.status = 'PROPUESTA'
        AND (
          activities.organization = up.organization
          OR (up.organization IN ('HJ', 'MJ') AND activities.organization = 'SEMINARIO')
        )
    )
  );

CREATE POLICY "Actualizacion actividades admin o presidencia"
  ON public.activities FOR UPDATE TO authenticated
  USING ((SELECT app_auth.is_admin_or_presidencia()))
  WITH CHECK ((SELECT app_auth.is_admin_or_presidencia()));

CREATE POLICY "Eliminacion actividades admin o presidencia"
  ON public.activities FOR DELETE TO authenticated
  USING ((SELECT app_auth.is_admin_or_presidencia()));

-- 3.8 suppliers
DROP POLICY IF EXISTS "Lectura proveedores usuarios activos" ON public.suppliers;
DROP POLICY IF EXISTS "Insercion proveedores admin o presidencia" ON public.suppliers;
DROP POLICY IF EXISTS "Actualizacion proveedores admin o presidencia" ON public.suppliers;
DROP POLICY IF EXISTS "Eliminacion proveedores admin o presidencia" ON public.suppliers;

CREATE POLICY "Lectura proveedores usuarios activos"
  ON public.suppliers FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion proveedores admin o presidencia"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.is_admin_or_presidencia()));

CREATE POLICY "Actualizacion proveedores admin o presidencia"
  ON public.suppliers FOR UPDATE TO authenticated
  USING ((SELECT app_auth.is_admin_or_presidencia()))
  WITH CHECK ((SELECT app_auth.is_admin_or_presidencia()));

CREATE POLICY "Eliminacion proveedores admin o presidencia"
  ON public.suppliers FOR DELETE TO authenticated
  USING ((SELECT app_auth.is_admin_or_presidencia()));

-- 3.9 app_config (activos leen; solo Presidencia y Admins escriben LAST_SYNCED_AT, LCR_LIVE_UIDS y supplier_categories)
DROP POLICY IF EXISTS "Lectura config usuarios activos" ON public.app_config;
DROP POLICY IF EXISTS "Insercion config autenticados" ON public.app_config;
DROP POLICY IF EXISTS "Insercion config admin o presidencia" ON public.app_config;
DROP POLICY IF EXISTS "Actualizacion config autenticados" ON public.app_config;
DROP POLICY IF EXISTS "Actualizacion config admin o presidencia" ON public.app_config;

CREATE POLICY "Lectura config usuarios activos"
  ON public.app_config FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_active_user()));

CREATE POLICY "Insercion config admin o presidencia"
  ON public.app_config FOR INSERT TO authenticated
  WITH CHECK (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (SELECT app_auth.is_admin_or_presidencia())
  );

CREATE POLICY "Actualizacion config admin o presidencia"
  ON public.app_config FOR UPDATE TO authenticated
  USING (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (SELECT app_auth.is_admin_or_presidencia())
  )
  WITH CHECK (
    key IN ('LAST_SYNCED_AT', 'LCR_LIVE_UIDS', 'supplier_categories')
    AND (SELECT app_auth.is_admin_or_presidencia())
  );

-- 3.10 audit_logs (lectura exclusiva de Admins / Super Admin, igual que canViewLogs)
DROP POLICY IF EXISTS "Lectura logs admin o presidencia" ON public.audit_logs;
DROP POLICY IF EXISTS "Lectura logs solo admin" ON public.audit_logs;
DROP POLICY IF EXISTS "Insercion logs usuarios activos" ON public.audit_logs;

CREATE POLICY "Lectura logs solo admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT app_auth.is_admin()));

CREATE POLICY "Insercion logs usuarios activos"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT app_auth.is_active_user()));

-- 4. Restricciones de integridad financiera e índices faltantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_gross_amount_nonneg_check') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_gross_amount_nonneg_check CHECK (gross_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_external_reimbursement_bounds_check') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_external_reimbursement_bounds_check CHECK (external_reimbursement >= 0 AND external_reimbursement <= gross_amount);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_withdrawals_amount_pos_check') THEN
    ALTER TABLE public.cash_withdrawals ADD CONSTRAINT cash_withdrawals_amount_pos_check CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_withdrawals_returned_nonneg_check') THEN
    ALTER TABLE public.cash_withdrawals ADD CONSTRAINT cash_withdrawals_returned_nonneg_check CHECK (returned_amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_activity_id ON public.expenses (activity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_incomes_one_opening_per_year
  ON public.budget_incomes (year)
  WHERE entry_type = 'SALDO_INICIAL';

COMMIT;
