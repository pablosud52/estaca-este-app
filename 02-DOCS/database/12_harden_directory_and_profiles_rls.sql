-- ==============================================================================
-- MIGRACIÓN 12: ENDURECIMIENTO DE RLS, INTEGRIDAD DE DIRECTORIO Y USERS_PROFILES
-- Resuelve hallazgos de auditoría adversarial:
--   - C-1: Cierra lectura pública (anon) en users_profiles
--   - A-1: Restringe políticas de stake_directory_entries a authenticated,
--          agrega WITH CHECK explícito y respaldo de Super-Admin (pablosud52@gmail.com)
--   - A-2: Agrega UNIQUE(slot_key), FK(linked_entry_id -> id ON DELETE SET NULL),
--          índice parcial y desactiva cuentas seed huérfanas en users_profiles
-- ==============================================================================

-- 1. Funciones helper SECURITY DEFINER (evitan recursión RLS y cachean auth.jwt())
CREATE OR REPLACE FUNCTION public.is_active_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'pablosud52@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.users_profiles up
      WHERE lower(up.email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
        AND up.role = 'ADMIN'
        AND up.is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_app_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_app_user() TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_admin_user() TO authenticated;

-- 2. Defensa en profundidad: revocar privilegios de anon en tablas sensibles
REVOKE ALL ON TABLE public.users_profiles FROM anon;
REVOKE ALL ON TABLE public.stake_directory_entries FROM anon;

-- 3. Endurecer políticas RLS en users_profiles (solo authenticated)
DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.users_profiles;
DROP POLICY IF EXISTS "Lectura perfiles solo autenticados" ON public.users_profiles;
CREATE POLICY "Lectura perfiles solo autenticados"
  ON public.users_profiles
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    OR public.is_active_app_user()
  );

DROP POLICY IF EXISTS "Admin puede actualizar perfiles" ON public.users_profiles;
CREATE POLICY "Admin puede actualizar perfiles"
  ON public.users_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_active_admin_user())
  WITH CHECK (public.is_active_admin_user());

DROP POLICY IF EXISTS "Admin puede insertar perfiles" ON public.users_profiles;
CREATE POLICY "Admin puede insertar perfiles"
  ON public.users_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_admin_user());

-- 4. Endurecer políticas RLS en stake_directory_entries (solo authenticated + WITH CHECK)
DROP POLICY IF EXISTS "Lectura directorio usuarios activos" ON public.stake_directory_entries;
CREATE POLICY "Lectura directorio usuarios activos"
  ON public.stake_directory_entries
  FOR SELECT
  TO authenticated
  USING (public.is_active_app_user());

DROP POLICY IF EXISTS "Escritura directorio solo admin" ON public.stake_directory_entries;
CREATE POLICY "Escritura directorio solo admin"
  ON public.stake_directory_entries
  FOR ALL
  TO authenticated
  USING (public.is_active_admin_user())
  WITH CHECK (public.is_active_admin_user());

-- 5. Integridad relacional en stake_directory_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stake_directory_entries'::regclass
      AND conname = 'stake_directory_entries_slot_key_key'
  ) THEN
    ALTER TABLE public.stake_directory_entries
      ADD CONSTRAINT stake_directory_entries_slot_key_key UNIQUE (slot_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stake_directory_entries'::regclass
      AND conname = 'stake_directory_entries_linked_entry_id_fkey'
  ) THEN
    ALTER TABLE public.stake_directory_entries
      ADD CONSTRAINT stake_directory_entries_linked_entry_id_fkey
      FOREIGN KEY (linked_entry_id)
      REFERENCES public.stake_directory_entries(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stake_directory_entries_linked_entry_id
  ON public.stake_directory_entries (linked_entry_id)
  WHERE linked_entry_id IS NOT NULL;

-- 6. Desactivar cuentas seed huérfanas que no existen en el directorio real
UPDATE public.users_profiles up
SET is_active = false
WHERE lower(up.email) IN (
  'presidente.estaca@gmail.com',
  'consejero1.estaca@gmail.com',
  'consejero2.estaca@gmail.com',
  'secretario.ejecutivo@gmail.com',
  'secretario.estaca@gmail.com'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.stake_directory_entries d
  WHERE lower(d.email) = lower(up.email)
);
