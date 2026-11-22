-- Permisos RLS en app_config para guardar y actualizar el catálogo de rubros de proveedores (2026-11-21)
CREATE POLICY "Permitir insertar supplier_categories"
ON public.app_config
FOR INSERT
TO anon, authenticated
WITH CHECK (key = 'supplier_categories');

CREATE POLICY "Permitir modificar supplier_categories"
ON public.app_config
FOR UPDATE
TO anon, authenticated
USING (key = 'supplier_categories')
WITH CHECK (key = 'supplier_categories');
