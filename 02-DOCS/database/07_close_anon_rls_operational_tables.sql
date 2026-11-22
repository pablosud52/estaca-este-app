-- ==============================================================================
-- MIGRACIÓN 07: CIERRE DE ACCESO PÚBLICO (anon) Y POLÍTICAS RLS OPERATIVAS
-- Fecha: 2026-11-21
-- Objetivo: Revocar acceso anónimo (anon) en tablas operativas y restringir
--           lectura/escritura a usuarios autenticados activos en users_profiles.
-- ==============================================================================

-- 1. Asegurar RLS habilitado en todas las tablas operativas
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 2. Revocar todos los privilegios del rol público (anon) en tablas y secuencias operativas
REVOKE ALL ON TABLE
  public.activities,
  public.app_config,
  public.audit_logs,
  public.budget_allocations,
  public.budget_incomes,
  public.cash_withdrawals,
  public.expenses,
  public.suppliers
FROM anon;

REVOKE ALL ON SEQUENCE
  public.activities_id_seq,
  public.budget_allocations_id_seq,
  public.budget_incomes_id_seq,
  public.cash_withdrawals_id_seq,
  public.expenses_id_seq,
  public.suppliers_id_seq
FROM anon;

-- 3. Asegurar privilegios mínimos necesarios para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.activities,
  public.app_config,
  public.budget_allocations,
  public.budget_incomes,
  public.cash_withdrawals,
  public.expenses,
  public.suppliers
TO authenticated;

GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE
  public.activities_id_seq,
  public.budget_allocations_id_seq,
  public.budget_incomes_id_seq,
  public.cash_withdrawals_id_seq,
  public.expenses_id_seq,
  public.suppliers_id_seq
TO authenticated;

-- 4. ACTIVITIES
DROP POLICY IF EXISTS "Full access actividades" ON public.activities;
DROP POLICY IF EXISTS "Permitir lectura de actividades a usuarios autenticados" ON public.activities;

CREATE POLICY "Lectura actividades usuarios activos"
  ON public.activities FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion actividades usuarios activos"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Actualizacion actividades usuarios activos"
  ON public.activities FOR UPDATE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  )
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Eliminacion actividades admin o presidencia"
  ON public.activities FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 5. BUDGET_ALLOCATIONS
DROP POLICY IF EXISTS "Full access presupuestos" ON public.budget_allocations;
DROP POLICY IF EXISTS "Permitir lectura de presupuestos a usuarios autenticados" ON public.budget_allocations;

CREATE POLICY "Lectura presupuestos usuarios activos"
  ON public.budget_allocations FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion presupuestos admin o presidencia"
  ON public.budget_allocations FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Actualizacion presupuestos admin o presidencia"
  ON public.budget_allocations FOR UPDATE TO authenticated
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

CREATE POLICY "Eliminacion presupuestos admin o presidencia"
  ON public.budget_allocations FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 6. BUDGET_INCOMES
DROP POLICY IF EXISTS "Full access ingresos de presupuesto" ON public.budget_incomes;
DROP POLICY IF EXISTS "Permitir lectura de ingresos de presupuesto" ON public.budget_incomes;

CREATE POLICY "Lectura ingresos presupuesto usuarios activos"
  ON public.budget_incomes FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion ingresos presupuesto admin o presidencia"
  ON public.budget_incomes FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Actualizacion ingresos presupuesto admin o presidencia"
  ON public.budget_incomes FOR UPDATE TO authenticated
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

CREATE POLICY "Eliminacion ingresos presupuesto admin o presidencia"
  ON public.budget_incomes FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 7. CASH_WITHDRAWALS
DROP POLICY IF EXISTS "Full access retiros" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Permitir lectura de retiros a usuarios autenticados" ON public.cash_withdrawals;

CREATE POLICY "Lectura retiros usuarios activos"
  ON public.cash_withdrawals FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion retiros admin o presidencia"
  ON public.cash_withdrawals FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Actualizacion retiros admin o presidencia"
  ON public.cash_withdrawals FOR UPDATE TO authenticated
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

CREATE POLICY "Eliminacion retiros admin o presidencia"
  ON public.cash_withdrawals FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 8. EXPENSES
DROP POLICY IF EXISTS "Full access gastos" ON public.expenses;
DROP POLICY IF EXISTS "Permitir lectura de gastos a usuarios autenticados" ON public.expenses;

CREATE POLICY "Lectura gastos usuarios activos"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion gastos admin o presidencia"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Actualizacion gastos admin o presidencia"
  ON public.expenses FOR UPDATE TO authenticated
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

CREATE POLICY "Eliminacion gastos admin o presidencia"
  ON public.expenses FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 9. SUPPLIERS
DROP POLICY IF EXISTS "Full access proveedores" ON public.suppliers;
DROP POLICY IF EXISTS "Permitir lectura de proveedores a usuarios autenticados" ON public.suppliers;

CREATE POLICY "Lectura proveedores usuarios activos"
  ON public.suppliers FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion proveedores admin o presidencia"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Actualizacion proveedores admin o presidencia"
  ON public.suppliers FOR UPDATE TO authenticated
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

CREATE POLICY "Eliminacion proveedores admin o presidencia"
  ON public.suppliers FOR DELETE TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

-- 10. APP_CONFIG
DROP POLICY IF EXISTS "Permitir actualizar LAST_SYNCED_AT" ON public.app_config;
DROP POLICY IF EXISTS "Permitir insertar supplier_categories" ON public.app_config;
DROP POLICY IF EXISTS "Permitir lectura de config a usuarios autenticados" ON public.app_config;
DROP POLICY IF EXISTS "Permitir modificar LAST_SYNCED_AT" ON public.app_config;
DROP POLICY IF EXISTS "Permitir modificar supplier_categories" ON public.app_config;

CREATE POLICY "Lectura config usuarios activos"
  ON public.app_config FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

CREATE POLICY "Insercion config autenticados"
  ON public.app_config FOR INSERT TO authenticated
  WITH CHECK (
    (
      key = 'LAST_SYNCED_AT'
      AND (
        lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
        OR EXISTS (
          SELECT 1 FROM public.users_profiles up
          WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
            AND up.is_active = true
            AND up.role <> 'NO_AUTORIZADO'
        )
      )
    )
    OR (
      key = 'supplier_categories'
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
  );

CREATE POLICY "Actualizacion config autenticados"
  ON public.app_config FOR UPDATE TO authenticated
  USING (
    (
      key = 'LAST_SYNCED_AT'
      AND (
        lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
        OR EXISTS (
          SELECT 1 FROM public.users_profiles up
          WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
            AND up.is_active = true
            AND up.role <> 'NO_AUTORIZADO'
        )
      )
    )
    OR (
      key = 'supplier_categories'
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
  )
  WITH CHECK (
    (
      key = 'LAST_SYNCED_AT'
      AND (
        lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
        OR EXISTS (
          SELECT 1 FROM public.users_profiles up
          WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
            AND up.is_active = true
            AND up.role <> 'NO_AUTORIZADO'
        )
      )
    )
    OR (
      key = 'supplier_categories'
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
  );

-- 11. AUDIT_LOGS
DROP POLICY IF EXISTS "Permitir insercion de logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Permitir lectura de logs" ON public.audit_logs;

CREATE POLICY "Lectura logs admin o presidencia"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role IN ('ADMIN', 'PRESIDENCIA')
    )
  );

CREATE POLICY "Insercion logs usuarios activos"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    lower((select auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower((select auth.jwt() ->> 'email'))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );
