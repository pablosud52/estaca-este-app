-- ==============================================================================
-- MIGRACIÓN 03: REDISEÑO DE GESTIÓN DE USUARIOS Y DIRECTORIO DE LÍDERES
-- ==============================================================================

-- 1. Ampliar users_profiles con first_name, last_name, rol CONSULTA y validación Gmail
ALTER TABLE public.users_profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE public.users_profiles
  DROP CONSTRAINT IF EXISTS users_profiles_role_check;

ALTER TABLE public.users_profiles
  ADD CONSTRAINT users_profiles_role_check
  CHECK (role IN ('ADMIN', 'PRESIDENCIA', 'LIDER', 'CONSULTA', 'NO_AUTORIZADO'));

ALTER TABLE public.users_profiles
  DROP CONSTRAINT IF EXISTS users_profiles_gmail_only_check;

ALTER TABLE public.users_profiles
  ADD CONSTRAINT users_profiles_gmail_only_check
  CHECK (lower(email) ~ '^[a-z0-9._%+-]+@gmail\.com$');

-- 2. Tabla unificada del organigrama de la Estaca (Fuente Única de Verdad)
CREATE TABLE IF NOT EXISTS public.stake_directory_entries (
  id text PRIMARY KEY,
  directory_org text NOT NULL CHECK (
    directory_org IN (
      'PRESIDENCIA', 'SUMO_CONSEJO', 'SS', 'HJ', 'MJ',
      'ESCUELA_DOMINICAL', 'PRIMARIA', 'JAS', 'AS',
      'BIENESTAR', 'MUSICA', 'CFS'
    )
  ),
  slot_key text NOT NULL,
  calling text NOT NULL,
  is_fixed_slot boolean NOT NULL DEFAULT true,
  extra_role_type text CHECK (extra_role_type IN ('SECRETARIO_AUXILIAR', 'ASESOR', 'MANUAL')),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text CHECK (phone IS NULL OR phone = '' OR phone ~ '^09\d{7}$'),
  email text CHECK (email IS NULL OR email = '' OR lower(email) ~ '^[a-z0-9._%+-]+@gmail\.com$'),
  has_app_access boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'LIDER' CHECK (role IN ('ADMIN', 'PRESIDENCIA', 'LIDER', 'CONSULTA', 'NO_AUTORIZADO')),
  can_approve_activities boolean NOT NULL DEFAULT false,
  is_permanent_admin boolean NOT NULL DEFAULT false,
  assigned_unit text,
  assigned_org_notes text,
  linked_entry_id text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.stake_directory_entries ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados activos (Directorio de Líderes)
DROP POLICY IF EXISTS "Lectura directorio usuarios activos" ON public.stake_directory_entries;
CREATE POLICY "Lectura directorio usuarios activos"
  ON public.stake_directory_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower(auth.jwt() ->> 'email')
        AND up.is_active = true
        AND up.role <> 'NO_AUTORIZADO'
    )
  );

-- Escritura exclusiva para Administradores activos
DROP POLICY IF EXISTS "Escritura directorio solo admin" ON public.stake_directory_entries;
CREATE POLICY "Escritura directorio solo admin"
  ON public.stake_directory_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profiles up
      WHERE lower(up.email) = lower(auth.jwt() ->> 'email')
        AND up.role = 'ADMIN'
        AND up.is_active = true
    )
  );
