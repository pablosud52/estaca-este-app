-- Ejecutar en Supabase SQL Editor si se necesita habilitar la escritura
-- en `users_profiles` desde Gestión de Usuarios para otros administradores.

DROP POLICY IF EXISTS "Admin puede insertar perfiles" ON public.users_profiles;
CREATE POLICY "Admin puede insertar perfiles"
ON public.users_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  lower((SELECT auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
  OR EXISTS (
    SELECT 1
    FROM public.users_profiles up
    WHERE lower(up.email) = lower((SELECT auth.jwt() ->> 'email'))
      AND up.role = 'ADMIN'
      AND up.is_active = true
  )
);

DROP POLICY IF EXISTS "Admin puede actualizar perfiles" ON public.users_profiles;
CREATE POLICY "Admin puede actualizar perfiles"
ON public.users_profiles
FOR UPDATE
TO authenticated
USING (
  lower((SELECT auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
  OR EXISTS (
    SELECT 1
    FROM public.users_profiles up
    WHERE lower(up.email) = lower((SELECT auth.jwt() ->> 'email'))
      AND up.role = 'ADMIN'
      AND up.is_active = true
  )
)
WITH CHECK (
  lower((SELECT auth.jwt() ->> 'email')) = 'pablosud52@gmail.com'
  OR EXISTS (
    SELECT 1
    FROM public.users_profiles up
    WHERE lower(up.email) = lower((SELECT auth.jwt() ->> 'email'))
      AND up.role = 'ADMIN'
      AND up.is_active = true
  )
);
