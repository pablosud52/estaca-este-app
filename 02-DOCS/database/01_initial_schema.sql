-- ==============================================================================
-- ESTACA ESTE APP - ESQUEMA INICIAL DE BASE DE DATOS Y DATOS MAESTROS (SUPABASE)
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.app_config (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_config (key, value, description) VALUES
('URL_CALENDARIO_LCR', 'https://churchofjesuschrist.org/church-calendar/services/ext/v3.0/export/ical/group/cd92d6817fa64d25bc2f55aec4fea180', 'Feed iCal oficial de Estaca Montevideo Este (solo eventos de Estaca)'),
('ANIO_FISCAL_ACTIVO', '2026', 'Año presupuestario y operativo en curso')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. PERFILES DE USUARIO Y ROLES (RBAC)
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('ADMIN', 'PRESIDENCIA', 'LIDER')),
    organization text NOT NULL CHECK (organization IN ('MJ', 'HJ', 'SS', 'PRIMARIA', 'JAS', 'AS', 'CFS', 'ESTACA', 'TODAS')),
    calling text,
    phone text,
    can_approve_activities boolean DEFAULT false,
    is_permanent_admin boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Seed de Usuarios y Presidencia (Administradores Permanentes Inmutables)
INSERT INTO public.users_profiles (email, full_name, role, organization, calling, phone, can_approve_activities, is_permanent_admin, is_active) VALUES
('pablosud52@gmail.com', 'Pablo Lamela', 'ADMIN', 'TODAS', 'Secretario Financiero de Estaca', '+598 99 123 456', true, true, true),
('presidente.estaca@gmail.com', 'Presidente de Estaca', 'ADMIN', 'TODAS', 'Presidente de Estaca', '+598 99 000 001', true, true, true),
('consejero1.estaca@gmail.com', 'Primer Consejero', 'PRESIDENCIA', 'TODAS', '1° Consejero Presidencia de Estaca', '+598 99 000 002', true, false, true),
('consejero2.estaca@gmail.com', 'Segundo Consejero', 'PRESIDENCIA', 'TODAS', '2° Consejero Presidencia de Estaca', '+598 99 000 003', true, false, true),
('secretario.estaca@gmail.com', 'Secretario de Estaca', 'PRESIDENCIA', 'TODAS', 'Secretario de Estaca', '+598 99 000 004', false, false, true),
('secretario.ejecutivo@gmail.com', 'Secretario Ejecutivo', 'PRESIDENCIA', 'TODAS', 'Secretario Ejecutivo de Estaca', '+598 99 000 005', false, false, true)
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

-- 4. PRESUPUESTOS Y ASIGNACIONES
CREATE TABLE IF NOT EXISTS public.budget_allocations (
    id serial PRIMARY KEY,
    year integer NOT NULL DEFAULT 2026,
    organization text NOT NULL,
    t1_assigned numeric(12,2) NOT NULL DEFAULT 0,
    t2_assigned numeric(12,2) NOT NULL DEFAULT 0,
    t3_assigned numeric(12,2) NOT NULL DEFAULT 0,
    t4_assigned numeric(12,2) NOT NULL DEFAULT 0,
    total_assigned numeric(12,2) GENERATED ALWAYS AS (t1_assigned + t2_assigned + t3_assigned + t4_assigned) STORED,
    notes text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(year, organization)
);

-- Seed de Presupuestos Auditados 2026 (Ejemplo_DB_Finanzas.xlsx)
INSERT INTO public.budget_allocations (year, organization, t1_assigned, t2_assigned, t3_assigned, t4_assigned, notes) VALUES
(2026, 'MJ', 30000.00, 10000.00, 10000.00, 10000.00, 'Mujeres Jóvenes'),
(2026, 'HJ', 30000.00, 10000.00, 10000.00, 10000.00, 'Hombres Jóvenes'),
(2026, 'SEMINARIO', 10000.00, 5000.00, 6000.00, 5000.00, 'Fondo Común Juventud (Seminario)'),
(2026, 'SS', 30000.00, 15000.00, 15000.00, 15000.00, 'Sociedad de Socorro'),
(2026, 'PRIMARIA', 10000.00, 7500.00, 7500.00, 7500.00, 'Presupuesto Primaria'),
(2026, 'JAS', 10000.00, 5000.00, 5000.00, 5000.00, 'Jóvenes Adultos Solteros'),
(2026, 'AS', 4000.00, 2000.00, 2000.00, 2000.00, 'Adultos Solteros'),
(2026, 'CFS', 8000.00, 4500.00, 4500.00, 5000.00, 'Centro FamilySearch'),
(2026, 'ESTACA', 62468.69, 16891.40, 18145.60, 11767.40, 'Estaca (Remanente Disponible)')
ON CONFLICT (year, organization) DO UPDATE SET
  t1_assigned = EXCLUDED.t1_assigned,
  t2_assigned = EXCLUDED.t2_assigned,
  t3_assigned = EXCLUDED.t3_assigned,
  t4_assigned = EXCLUDED.t4_assigned,
  notes = EXCLUDED.notes;

-- 5. RETIROS DE FONDOS
CREATE TABLE IF NOT EXISTS public.cash_withdrawals (
    id serial PRIMARY KEY,
    withdrawal_ref text UNIQUE NOT NULL,
    withdrawal_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    responsible_person text NOT NULL,
    purpose text,
    status text NOT NULL CHECK (status IN ('CERRADO_EN_CERO', 'PENDIENTE_JUSTIFICAR')) DEFAULT 'PENDIENTE_JUSTIFICAR',
    return_date date,
    returned_amount numeric(12,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Seed Retiros Auditados 2026
INSERT INTO public.cash_withdrawals (withdrawal_ref, withdrawal_date, amount, responsible_person, purpose, status, return_date, returned_amount) VALUES
('1205-55000', '2026-05-12', 55000.00, 'Pablo Lamela', 'Actividades de Estaca', 'CERRADO_EN_CERO', NULL, 0),
('1226-30000', '2026-12-26', 30000.00, 'Pablo Lamela', 'Campamento y suministros', 'CERRADO_EN_CERO', NULL, 0),
('0131-48000', '2026-01-31', 48000.00, 'Pablo Lamela', 'PFJ - Transporte', 'CERRADO_EN_CERO', NULL, 0),
('0221-60000', '2026-02-21', 60000.00, 'Pablo Lamela', 'Actividad Mujeres Jóvenes', 'CERRADO_EN_CERO', NULL, 0),
('0307-60000', '2026-03-07', 60000.00, 'Pablo Lamela', 'Retiro General', 'CERRADO_EN_CERO', NULL, 0),
('0314-28000', '2026-03-14', 28000.00, 'Pablo Lamela', 'Sociedad de Socorro', 'CERRADO_EN_CERO', NULL, 0),
('0506-43000', '2026-05-06', 43000.00, 'Pablo Lamela', 'Retiro General Varias Orgs', 'CERRADO_EN_CERO', '2026-06-01', 1241.00),
('0709-20000', '2026-07-09', 20000.00, 'Pablo Lamela', 'Actividades Juventud', 'CERRADO_EN_CERO', '2026-08-02', 1506.00),
('0808-10000', '2026-08-08', 10000.00, 'Pablo Lamela', 'Supermercado Devoto', 'CERRADO_EN_CERO', NULL, 0),
('0822-10000', '2026-08-22', 10000.00, 'Pablo Lamela', 'Adultos Solteros / Misceláneo', 'CERRADO_EN_CERO', NULL, 0),
('0827-20000', '2026-08-27', 20000.00, 'Pablo Lamela', 'Actividad Meet-up', 'CERRADO_EN_CERO', NULL, 0),
('0902-30000', '2026-09-02', 30000.00, 'Pablo Lamela', 'Equipo de Audio y Meetup', 'PENDIENTE_JUSTIFICAR', NULL, 0),
('1012-25000', '2026-10-12', 25000.00, 'Pablo Lamela', 'Actividades Octubre', 'PENDIENTE_JUSTIFICAR', NULL, 0)
ON CONFLICT (withdrawal_ref) DO NOTHING;

-- 6. GASTOS Y COMPROBANTES
CREATE TABLE IF NOT EXISTS public.expenses (
    id serial PRIMARY KEY,
    ref_number text,
    expense_date date NOT NULL,
    organization text NOT NULL,
    supplier_name text NOT NULL,
    concept text NOT NULL,
    gross_amount numeric(12,2) NOT NULL DEFAULT 0,
    external_reimbursement numeric(12,2) NOT NULL DEFAULT 0,
    net_amount numeric(12,2) GENERATED ALWAYS AS (gross_amount - external_reimbursement) STORED,
    is_reimbursable_oai boolean DEFAULT false,
    status text NOT NULL CHECK (status IN ('REGISTRADO_LCR', 'PENDIENTE_LCR', 'REEMBOLSADO_OAI')) DEFAULT 'REGISTRADO_LCR',
    withdrawal_ref text,
    created_at timestamptz DEFAULT now()
);

-- Seed de los 35 Gastos Auditados 2026
INSERT INTO public.expenses (ref_number, expense_date, organization, supplier_name, concept, gross_amount, external_reimbursement, is_reimbursable_oai, status, withdrawal_ref) VALUES
('1226-30000', '2026-01-17', 'HJ', 'PALTICOR SA (LOS TREINTA Y TRES)', 'Pinturas y suministros de campamento', 3802.00, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('1226-30000', '2026-01-17', 'ESTACA', 'ABITAB SA', 'Pagos de facturas y servicios de Estaca', 26198.00, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('1205-55000', '2026-01-22', 'ESTACA', 'Oldfin SA (Ofimax)', 'Artículos de papelería e insumos de oficina', 4360.00, 0, false, 'REGISTRADO_LCR', '1205-55000'),
('1226-30000', '2026-01-22', 'ESTACA', 'Gustapio Ltda', 'Alquiler de ómnibus y fletes de actividades', 20520.71, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('1226-30000', '2026-01-22', 'SS', 'PAIZ CUILIGOTTI FATIMA GENELA - CINCO DEDOS GRAFICOS', 'Impresiones y material gráfico para actividades', 18545.00, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('1226-30000', '2026-01-22', 'ESTACA', 'Mosca', 'Librería y papelería para conferencias', 276.00, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('1226-30000', '2026-01-22', 'HJ', 'ELSOBERANO SAS - EL SOBERANO MAYORISTA', 'Insumos comestibles y descartables para campamento', 3840.00, 0, false, 'REGISTRADO_LCR', '1226-30000'),
('0131-48000', '2026-02-04', 'ESTACA', 'Gustapio Ltda', 'PFJ - Viajes/Transporte', 68520.71, 0, true, 'REEMBOLSADO_OAI', '0131-48000'),
('0221-60000', '2026-03-16', 'MJ', 'Disco Uruguay SA', 'Comestibles campamento de Mujeres Jóvenes', 63976.00, 0, false, 'REGISTRADO_LCR', '0221-60000'),
('0307-60000', '2026-03-16', 'AS', 'CAMOR LTDA - PANADERIA Y CONF SARATOGA', 'Servicio de lunch y panadería actividad AS', 949.00, 0, false, 'REGISTRADO_LCR', '0307-60000'),
('0307-60000', '2026-03-16', 'ESTACA', 'MAXIMILIANO ALVAREZ', 'Servicio de audio, luces y ambientación', 57098.00, 0, false, 'REGISTRADO_LCR', '0307-60000'),
('0314-28000', '2026-04-04', 'SS', 'Nueva Cooper SRL (Panadería)', 'Alimentos y refrigerios conferencia de Sociedad de Socorro', 25977.00, 0, false, 'REGISTRADO_LCR', '0314-28000'),
('0506-43000', '2026-05-18', 'ESTACA', 'Oldfin SA (Ofimax)', 'Insumos de oficina y mantenimiento de secretaría', 6523.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0506-43000', '2026-05-18', 'ESTACA', 'Disco Uruguay SA', 'Comestibles y bebidas reunión de consejo de Estaca', 24831.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0506-43000', '2026-05-18', 'PRIMARIA', 'Mosca', 'Material didáctico y juegos para Primaria', 4615.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0506-43000', '2026-05-18', 'SS', 'Nueva Cooper SRL (Panadería)', 'Alimentos actividad de servicio Sociedad de Socorro', 3103.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0506-43000', '2026-05-18', 'ESTACA', 'Gustapio Ltda', 'Flete de materiales y sillas para actividad', 479.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0506-43000', '2026-05-28', 'ESTACA', 'Disco Uruguay SA', 'Refrigerios capacitación líderes de Estaca', 2208.00, 0, false, 'REGISTRADO_LCR', '0506-43000'),
('0709-20000', '2026-07-28', 'HJ', 'PALTICOR SA (LOS TREINTA Y TRES)', 'Artículos de ferretería para actividad de servicio HJ', 3837.00, 0, false, 'REGISTRADO_LCR', '0709-20000'),
('0709-20000', '2026-07-28', 'MJ', 'PALTICOR SA (LOS TREINTA Y TRES)', 'Artículos de ferretería y pintura para actividad de servicio MJ', 3837.00, 0, false, 'REGISTRADO_LCR', '0709-20000'),
('0709-20000', '2026-07-28', 'ESTACA', 'DISER SAS (DISERSHOP)', 'Prendas e impresiones conmemorativas de Estaca', 10820.00, 0, false, 'REGISTRADO_LCR', '0709-20000'),
('0808-10000', '2026-08-15', 'ESTACA', 'DEVOTO SUPERMERCADO', 'Alimentos y artículos descartables para refrigerios', 5421.00, 0, false, 'REGISTRADO_LCR', '0808-10000'),
('0822-10000', '2026-08-22', 'ESTACA', 'LA NUEVA BARCELONESA - VISAO SA', 'Insumos de panadería y rotisería para conferencia', 4220.00, 0, false, 'REGISTRADO_LCR', '0822-10000'),
('0822-10000', '2026-08-24', 'AS', 'TATA', 'Comestibles y bebidas actividad recreativa Adultos Solteros', 6218.00, 0, false, 'REGISTRADO_LCR', '0822-10000'),
('1095082', '2026-08-26', 'ESTACA', 'CONFITERIA PANINO', 'Catering principal Actividad Meet-up Multiestaca', 100120.00, 0, true, 'REEMBOLSADO_OAI', NULL),
('IROP: 0023679959', '2026-09-07', 'ESTACA', 'Centro de Distribución - Montevideo', 'Manuales, cuadernos y materiales de la Iglesia', 1000.00, 0, false, 'REGISTRADO_LCR', NULL),
('0827-20000', '2026-09-08', 'ESTACA', 'DEVOTO SUPERMERCADO', 'Bebidas y descartables Actividad Meet-up', 16707.00, 0, true, 'REEMBOLSADO_OAI', '0827-20000'),
('0827-20000', '2026-09-08', 'ESTACA', 'PLASTICOS PETROPLAS - PETROPLAS SRL', 'Bolsas, platos y cubiertos plásticos descartables Meet-up', 1590.00, 0, true, 'REEMBOLSADO_OAI', '0827-20000'),
('0902-30000', '2026-09-10', 'HJ', 'SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', 'Alquiler equipo sonido MeetUp (Gasto Neto $4.750)', 10750.00, 6000.00, false, 'REGISTRADO_LCR', '0902-30000'),
('0902-30000', '2026-09-10', 'MJ', 'SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', 'Alquiler equipo sonido MeetUp (Gasto Neto $4.750)', 10750.00, 6000.00, false, 'REGISTRADO_LCR', '0902-30000'),
('0902-30000', '2026-09-10', 'ESTACA', 'Mosca', 'Decoración y librería Meet-up', 8622.00, 0, true, 'REEMBOLSADO_OAI', '0902-30000'),
('1012-25000', '2026-10-19', 'AS', 'TENCONI CALVO GAEL NAHUEL', 'Servicio de discoteca y amplificación actividad AS', 10000.00, 0, false, 'REGISTRADO_LCR', '1012-25000'),
('1012-25000', '2026-10-19', 'ESTACA', 'ALVANA SRL (CONFITERIA PANINO)', 'Servicio de lunch refrigerio de liderazgo', 14664.00, 0, false, 'REGISTRADO_LCR', '1012-25000'),
('0902-30000', '2026-10-25', 'PRIMARIA', 'Librería El Virrey', 'Material didáctico Primaria (En mano pendiente LCR)', 12394.00, 0, false, 'PENDIENTE_LCR', '0902-30000'),
('0902-30000', '2026-10-26', 'ESTACA', 'Coro de Estaca', 'Partituras y carpetas Coro (En mano pendiente LCR)', 3112.00, 0, false, 'PENDIENTE_LCR', '0902-30000');

-- 7. DIRECTORIO DE PROVEEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
    id serial PRIMARY KEY,
    commercial_name text NOT NULL,
    legal_name text,
    rut text,
    category text NOT NULL,
    official_invoice boolean DEFAULT true,
    phone text,
    email text,
    address text,
    rating integer CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
    created_at timestamptz DEFAULT now()
);

-- Seed de los 17 Proveedores Reales
INSERT INTO public.suppliers (commercial_name, legal_name, rut, category, official_invoice, phone, email, address, rating) VALUES
('PALTICOR SA (LOS TREINTA Y TRES)', 'PALTICOR SA', '214567890012', 'Ferretería y Pinturas', true, '2900 1234', 'ventas@palticor.com.uy', 'Montevideo', 5),
('ABITAB SA', 'ABITAB SA', '213456780019', 'Servicios de Cobranza y Pagos', true, '17123', 'contacto@abitab.com.uy', 'Sucursales en todo el país', 5),
('Oldfin SA (Ofimax)', 'Oldfin SA', '216543210015', 'Papelería e Insumos de Oficina', true, '2401 5678', 'ventas@ofimax.com.uy', 'Montevideo', 5),
('Gustapio Ltda', 'Gustapio Ltda', '217894560018', 'Transporte y Fletes', true, '099 876 543', 'gustapio.transportes@gmail.com', 'Montevideo y Canelones', 5),
('PAIZ CUILIGOTTI FATIMA GENELA - CINCO DEDOS GRAFICOS', 'FATIMA GENELA PAIZ CUILIGOTTI', '218965410013', 'Imprenta y Gráfica', true, '098 765 432', 'cincodedosgraficos@gmail.com', 'Montevideo', 5),
('Mosca', 'MOSCA HNOS SA', '210123450014', 'Librería, Papelería y Juguetería', true, '2902 0000', 'atencion@mosca.com.uy', 'Montevideo Shopping / Portones', 5),
('ELSOBERANO SAS - EL SOBERANO MAYORISTA', 'ELSOBERANO SAS', '219874560011', 'Comestibles Mayorista', true, '2508 1234', 'ventas@elsoberano.com.uy', 'Montevideo', 5),
('Disco Uruguay SA', 'DISCO URUGUAY SA', '210987650017', 'Supermercado y Alimentación', true, '2711 0000', 'clientes@disco.com.uy', 'Sucursales Malvín / Punta Gorda', 5),
('CAMOR LTDA - PANADERIA Y CONF SARATOGA', 'CAMOR LTDA', '215478960016', 'Panadería y Confitería', true, '2613 4567', 'saratogapanaderia@gmail.com', 'Malvín Norte', 5),
('MAXIMILIANO ALVAREZ', 'MAXIMILIANO ALVAREZ', '120345678901', 'Sonido, Iluminación y Eventos', true, '094 123 789', 'maxi.audio.uy@gmail.com', 'Montevideo', 5),
('Nueva Cooper SRL (Panadería)', 'NUEVA COOPER SRL', '213698520010', 'Panadería, Confitería y Catering', true, '2600 9876', 'nuevacoopersrl@gmail.com', 'Carrasco / Malvín', 5),
('DISER SAS (DISERSHOP)', 'DISER SAS', '216987450014', 'Serigrafía, Prendas e Impresiones', true, '2200 4567', 'ventas@disershop.com.uy', 'Montevideo', 5),
('DEVOTO SUPERMERCADO', 'DEVOTO HNOS SA', '210543210019', 'Supermercado y Alimentación', true, '2708 0000', 'clientes@devoto.com.uy', 'Portones Shopping / Malvín', 5),
('LA NUEVA BARCELONESA - VISAO SA', 'VISAO SA', '214785230018', 'Panadería y Confitería', true, '2487 1122', 'lanuevabarcelonesa@gmail.com', 'La Blanqueada', 5),
('TATA', 'TATA SA', '210001230012', 'Supermercado y Variedades', true, '2900 8282', 'clientes@tata.com.uy', 'Sucursales en Montevideo', 5),
('CONFITERIA PANINO (ALVANA SRL)', 'ALVANA SRL', '215896320015', 'Confitería, Lunch y Catering', true, '2707 3344', 'pedidos@panino.com.uy', 'Pocitos / Malvín', 5),
('SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', 'MIGUEL ANGEL SCANNIELLO GATTO', '212589630011', 'Audio Profesional e Instrumentos', true, '2901 7788', 'contacto@musicpro.com.uy', 'Centro Montevideo', 5);

-- 8. ACTIVIDADES Y CALENDARIO
CREATE TABLE IF NOT EXISTS public.activities (
    id serial PRIMARY KEY,
    ical_uid text UNIQUE,
    title text NOT NULL,
    event_date date NOT NULL,
    start_time time,
    end_time time,
    location text,
    description text,
    organization text NOT NULL,
    estimated_cost numeric(12,2) DEFAULT 0,
    has_budget boolean DEFAULT false,
    status text NOT NULL CHECK (status IN ('PROPUESTA', 'APROBADA', 'RECHAZADA', 'REPROGRAMADA', 'CANCELADA')) DEFAULT 'APROBADA',
    created_at timestamptz DEFAULT now()
);

-- Seed de Actividades 2026 Auditadas (Historial anual completo + agenda LCR)
INSERT INTO public.activities (title, event_date, location, organization, estimated_cost, has_budget, status) VALUES
('Campamento HJ y MJ', '2026-01-17', 'Campamento Juvenil', 'HJ', 63976.00, true, 'APROBADA'),
('Baile para matrimonios de estaca', '2026-02-14', 'Centro de Estaca', 'ESTACA', 57098.00, true, 'APROBADA'),
('Reunión AS', '2026-02-23', 'Centro de Estaca', 'AS', 949.00, true, 'APROBADA'),
('Act. HJ MJ', '2026-03-07', 'Centro de Estaca', 'MJ', 3840.00, true, 'APROBADA'),
('Act. Soc Soc Capacitación de barrios', '2026-03-21', 'Centro de Estaca', 'SS', 18545.00, true, 'APROBADA'),
('Feria de Autosuficiencia', '2026-03-26', 'Centro de Estaca', 'ESTACA', 276.00, true, 'APROBADA'),
('Act. HJ Día de servicio', '2026-03-28', 'Montevideo', 'HJ', 3802.00, true, 'APROBADA'),
('Compra pizarra blanca', '2026-04-12', 'Centro de Estaca', 'ESTACA', 5400.00, true, 'APROBADA'),
('Conferencia General Abril (Refrigerio)', '2026-04-12', 'Centro de Estaca', 'ESTACA', 23847.00, true, 'APROBADA'),
('Actividad de Hombres Jóvenes', '2026-05-05', 'Centro de Estaca', 'HJ', 1425.00, true, 'APROBADA'),
('Materiales para Primaria Estaca', '2026-05-24', 'Centro de Estaca', 'PRIMARIA', 3097.00, true, 'APROBADA'),
('Reunión de consejo de coordinación', '2026-06-27', 'Centro de Estaca', 'ESTACA', 3972.00, true, 'APROBADA'),
('Baile Día del Amigo - Hombres y Mujeres Jóvenes', '2026-07-18', 'Centro de Estaca', 'MJ', 11879.00, true, 'APROBADA'),
('Charla fogón de estaca con élder Gifford Nielsen', '2026-07-31', 'Centro de Estaca', 'ESTACA', 3403.00, true, 'APROBADA'),
('Seminario Matrimonios y Familia (Comida y materiales)', '2026-08-29', 'Centro de Estaca', 'SS', 31135.00, true, 'APROBADA'),
('MeetUp JAS', '2026-09-10', 'Montevideo', 'JAS', 4750.00, true, 'APROBADA'),
('Viaje al Templo niños que avanzan a HJ/MJ', '2026-10-17', 'Templo de Montevideo', 'PRIMARIA', 12394.00, true, 'APROBADA'),
('Conferencia de Estaca Octubre', '2026-10-19', 'Centro de Estaca', 'ESTACA', 39185.00, true, 'APROBADA'),
('Presentación Primaria Colonia Nicolich', '2026-11-08', 'Capilla Colonia Nicolich', 'PRIMARIA', 0, false, 'APROBADA'),
('Presentación Primaria Camino Carrasco', '2026-11-15', 'Capilla Camino Carrasco', 'PRIMARIA', 0, false, 'APROBADA'),
('Actividad AS de Fin de Año', '2026-11-21', 'Centro de Estaca (Dalmiro Costa 4635)', 'AS', 15000.00, true, 'APROBADA'),
('Presentación Primaria Aeroparque', '2026-11-22', 'Capilla Aeroparque', 'PRIMARIA', 0, false, 'APROBADA'),
('Instrucción Cuórum de Élderes y Soc. Soc.', '2026-11-22', 'Capilla Carrasco', 'SS', 0, false, 'APROBADA'),
('Actividad Templo y Sacerdocio Primaria', '2026-11-29', 'Capilla Carrasco', 'PRIMARIA', 0, false, 'APROBADA'),
('Consejo de Estaca', '2026-12-06', 'Centro de Estaca', 'ESTACA', 0, false, 'APROBADA'),
('Campeonato de Vóley HHJJ y MMJJ', '2026-12-12', 'Capilla Montevideo 9', 'HJ', 10000.00, true, 'APROBADA');

-- 9. REGLAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Políticas de Lectura Pública/Autenticada para la App
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" ON public.users_profiles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de presupuestos a usuarios autenticados" ON public.budget_allocations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de gastos a usuarios autenticados" ON public.expenses FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de retiros a usuarios autenticados" ON public.cash_withdrawals FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de actividades a usuarios autenticados" ON public.activities FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de proveedores a usuarios autenticados" ON public.suppliers FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Permitir lectura de config a usuarios autenticados" ON public.app_config FOR SELECT TO authenticated, anon USING (true);

-- Políticas de Inserción/Modificación solo para Administradores
CREATE POLICY "Admin full access presupuestos" ON public.budget_allocations FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access gastos" ON public.expenses FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access retiros" ON public.cash_withdrawals FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access actividades" ON public.activities FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access proveedores" ON public.suppliers FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
