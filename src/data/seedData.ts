import {
  ActivityRecord,
  BudgetAllocation,
  CashWithdrawalRecord,
  ExpenseRecord,
  SupplierRecord,
  UserProfile,
} from '../types/database';

/**
 * Correo oficial del Super-Administrador / Propietario Vitalicio del Sistema.
 * Conserva el rol ADMIN e inmutabilidad independientemente de cambios futuros de llamamiento
 * u organización, y es el único correo con acceso al selector de cambio de rol en producción.
 */
export const SUPER_ADMIN_EMAIL = 'pablosud52@gmail.com';

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized === SUPER_ADMIN_EMAIL || normalized === 'pablo.lamela@gmail.com';
};

/**
 * Perfiles de desarrollo y simulación rápida (Paso 6.1)
 * Incluye los 6 perfiles oficiales de Presidencia/Admin de `01_initial_schema.sql`,
 * líderes representativos de organizaciones (con y sin Seminario) y un perfil No Autorizado.
 */
export const DEV_PROFILES: UserProfile[] = [
  {
    id: 'lider-mj-01',
    email: 'presidenta.mj@gmail.com',
    full_name: 'Carolina Méndez',
    role: 'LIDER',
    organization: 'MJ',
    calling: 'Presidenta de Mujeres Jóvenes',
    phone: '+598 99 201 101',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'lider-hj-01',
    email: 'presidente.hj@gmail.com',
    full_name: 'Martín Rodríguez',
    role: 'LIDER',
    organization: 'HJ',
    calling: 'Presidente de Hombres Jóvenes',
    phone: '+598 99 202 202',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'lider-primaria-01',
    email: 'presidenta.primaria@gmail.com',
    full_name: 'Lucía Fernández',
    role: 'LIDER',
    organization: 'PRIMARIA',
    calling: 'Presidenta de Primaria',
    phone: '+598 99 203 303',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'lider-ss-01',
    email: 'presidenta.ss@gmail.com',
    full_name: 'Valeria Silva',
    role: 'LIDER',
    organization: 'SS',
    calling: 'Presidenta de Sociedad de Socorro',
    phone: '+598 99 204 404',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'lider-as-01',
    email: 'lider.as@gmail.com',
    full_name: 'Diego Pereira',
    role: 'LIDER',
    organization: 'AS',
    calling: 'Líder de Adultos Solteros',
    phone: '+598 99 205 505',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'admin-pablo-01',
    email: 'pablosud52@gmail.com',
    full_name: 'Pablo Lamela',
    role: 'ADMIN',
    organization: 'TODAS',
    calling: 'Secretario Financiero de Estaca',
    phone: '+598 99 123 456',
    can_approve_activities: true,
    is_permanent_admin: true,
    is_active: true,
  },
  {
    id: 'admin-presidente-01',
    email: 'presidente.estaca@gmail.com',
    full_name: 'Presidente de Estaca',
    role: 'ADMIN',
    organization: 'TODAS',
    calling: 'Presidente de Estaca',
    phone: '+598 99 000 001',
    can_approve_activities: true,
    is_permanent_admin: true,
    is_active: true,
  },
  {
    id: 'presidencia-consejero1-01',
    email: 'consejero1.estaca@gmail.com',
    full_name: 'Primer Consejero',
    role: 'PRESIDENCIA',
    organization: 'TODAS',
    calling: '1° Consejero Presidencia de Estaca',
    phone: '+598 99 000 002',
    can_approve_activities: true,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'presidencia-secretario-01',
    email: 'secretario.estaca@gmail.com',
    full_name: 'Secretario de Estaca',
    role: 'PRESIDENCIA',
    organization: 'TODAS',
    calling: 'Secretario de Estaca (Solo Lectura)',
    phone: '+598 99 000 004',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: true,
  },
  {
    id: 'no-autorizado-01',
    email: 'visitante.externo@gmail.com',
    full_name: 'Usuario No Registrado',
    role: 'NO_AUTORIZADO',
    organization: 'PRIMARIA',
    calling: 'Sin llamamiento habilitado',
    can_approve_activities: false,
    is_permanent_admin: false,
    is_active: false,
  },
];

/**
 * Saldo Inicial de Apertura 2026 (Remanente cierre 2025 en LCR) según 02_Presupuestos de Ejemplo_DB_Finanzas.xlsx.
 * En T1 el total disponible ($ 194.468,69) se compone de:
 * - Remanente inicial (Apertura 2025): $ 123.027,89
 * - 7 ingresos trimestrales LCR T1: $ 71.440,80
 */
export const INITIAL_OPENING_BALANCE_2026 = 123027.89;

export const SEED_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
  { id: 1, year: 2026, organization: 'MJ', t1_assigned: 30000.00, t2_assigned: 10000.00, t3_assigned: 10000.00, t4_assigned: 10000.00, total_assigned: 60000.00, notes: 'Mujeres Jóvenes' },
  { id: 2, year: 2026, organization: 'HJ', t1_assigned: 30000.00, t2_assigned: 10000.00, t3_assigned: 10000.00, t4_assigned: 10000.00, total_assigned: 60000.00, notes: 'Hombres Jóvenes' },
  { id: 3, year: 2026, organization: 'SEMINARIO', t1_assigned: 10000.00, t2_assigned: 5000.00, t3_assigned: 6000.00, t4_assigned: 5000.00, total_assigned: 26000.00, notes: 'Fondo Común Juventud (Seminario)' },
  { id: 4, year: 2026, organization: 'SS', t1_assigned: 30000.00, t2_assigned: 15000.00, t3_assigned: 15000.00, t4_assigned: 15000.00, total_assigned: 75000.00, notes: 'Sociedad de Socorro' },
  { id: 5, year: 2026, organization: 'PRIMARIA', t1_assigned: 10000.00, t2_assigned: 7500.00, t3_assigned: 7500.00, t4_assigned: 7500.00, total_assigned: 32500.00, notes: 'Presupuesto Primaria' },
  { id: 6, year: 2026, organization: 'JAS', t1_assigned: 10000.00, t2_assigned: 5000.00, t3_assigned: 5000.00, t4_assigned: 5000.00, total_assigned: 25000.00, notes: 'Jóvenes Adultos Solteros' },
  { id: 7, year: 2026, organization: 'AS', t1_assigned: 4000.00, t2_assigned: 2000.00, t3_assigned: 2000.00, t4_assigned: 2000.00, total_assigned: 10000.00, notes: 'Adultos Solteros' },
  { id: 8, year: 2026, organization: 'CFS', t1_assigned: 8000.00, t2_assigned: 4500.00, t3_assigned: 4500.00, t4_assigned: 5000.00, total_assigned: 22000.00, notes: 'Centro FamilySearch' },
  { id: 9, year: 2026, organization: 'ESTACA', t1_assigned: 62468.69, t2_assigned: 16891.40, t3_assigned: 18145.60, t4_assigned: 11767.40, total_assigned: 109273.09, notes: 'Estaca (Remanente Disponible)' },
];

export const SEED_EXPENSES: ExpenseRecord[] = [
  { id: 1, ref_number: '1226-30000', expense_date: '2026-01-17', organization: 'HJ', supplier_name: 'PALTICOR SA (LOS TREINTA Y TRES)', concept: 'Act. HJ - PALTICOR', gross_amount: 3802.00, external_reimbursement: 0, net_amount: 3802.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1226-30000' },
  { id: 2, ref_number: '1205-55000', expense_date: '2026-01-22', organization: 'CFS', supplier_name: 'Oldfin SA (Ofimax)', concept: 'CFS insumos', gross_amount: 4360.00, external_reimbursement: 0, net_amount: 4360.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1205-55000' },
  { id: 3, ref_number: '1226-30000', expense_date: '2026-01-22', organization: 'SS', supplier_name: 'PAIZ CUILIGOTTI FATIMA GENELA - CINCO DEDOS GRAFICOS', concept: 'Act. Soc Soc Capacitación presidencias', gross_amount: 18545.00, external_reimbursement: 0, net_amount: 18545.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1226-30000' },
  { id: 4, ref_number: '1226-30000', expense_date: '2026-01-22', organization: 'ESTACA', supplier_name: 'Mosca', concept: 'Autosuficiencia - impresión certificados', gross_amount: 276.00, external_reimbursement: 0, net_amount: 276.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1226-30000' },
  { id: 5, ref_number: '1226-30000', expense_date: '2026-01-22', organization: 'HJ', supplier_name: 'ELSOBERANO SAS - EL SOBERANO MAYORISTA', concept: 'Act. HJ MJ materiales', gross_amount: 1920.00, external_reimbursement: 0, net_amount: 1920.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1226-30000' },
  { id: 6, ref_number: '1226-30000', expense_date: '2026-01-22', organization: 'MJ', supplier_name: 'ELSOBERANO SAS - EL SOBERANO MAYORISTA', concept: 'Act. HJ MJ materiales', gross_amount: 1920.00, external_reimbursement: 0, net_amount: 1920.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1226-30000' },
  { id: 7, ref_number: '0131-48000', expense_date: '2026-02-04', organization: 'ESTACA', supplier_name: 'Gustapio Ltda', concept: 'PFJ - Transporte', gross_amount: 68520.71, external_reimbursement: 0, net_amount: 68520.71, is_reimbursable_oai: true, status: 'REEMBOLSADO_OAI', withdrawal_ref: '0131-48000' },
  { id: 8, ref_number: '0221-60000', expense_date: '2026-03-16', organization: 'HJ', supplier_name: 'Disco Uruguay SA', concept: 'Campamento HJ y MJ - Alimentación', gross_amount: 31988.00, external_reimbursement: 0, net_amount: 31988.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0221-60000' },
  { id: 9, ref_number: '0221-60000', expense_date: '2026-03-16', organization: 'MJ', supplier_name: 'Disco Uruguay SA', concept: 'Campamento HJ y MJ - Alimentación', gross_amount: 31988.00, external_reimbursement: 0, net_amount: 31988.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0221-60000' },
  { id: 10, ref_number: '0307-60000', expense_date: '2026-03-16', organization: 'AS', supplier_name: 'CAMOR LTDA - PANADERIA Y CONF SARATOGA', concept: 'Reunión AS - Panadería', gross_amount: 949.00, external_reimbursement: 0, net_amount: 949.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0307-60000' },
  { id: 11, ref_number: '0307-60000', expense_date: '2026-03-16', organization: 'ESTACA', supplier_name: 'MAXIMILIANO ALVAREZ', concept: 'Baile para matrimonios', gross_amount: 57098.00, external_reimbursement: 0, net_amount: 57098.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0307-60000' },
  { id: 12, ref_number: '0314-28000', expense_date: '2026-04-04', organization: 'SS', supplier_name: 'Nueva Cooper SRL (Panadería)', concept: 'Actividad Soc Soc', gross_amount: 25977.00, external_reimbursement: 0, net_amount: 25977.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0314-28000' },
  { id: 13, ref_number: '0506-43000', expense_date: '2026-05-18', organization: 'CFS', supplier_name: 'Oldfin SA (Ofimax)', concept: 'CFS insumos oficina', gross_amount: 6523.00, external_reimbursement: 0, net_amount: 6523.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 14, ref_number: '0506-43000', expense_date: '2026-05-18', organization: 'ESTACA', supplier_name: 'Disco Uruguay SA', concept: 'Insumos varios Estaca', gross_amount: 24831.00, external_reimbursement: 0, net_amount: 24831.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 15, ref_number: '0506-43000', expense_date: '2026-05-18', organization: 'PRIMARIA', supplier_name: 'Mosca', concept: 'Materiales Primaria', gross_amount: 4615.00, external_reimbursement: 0, net_amount: 4615.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 16, ref_number: '0506-43000', expense_date: '2026-05-18', organization: 'SS', supplier_name: 'Nueva Cooper SRL (Panadería)', concept: 'Actividad Soc Soc', gross_amount: 3103.00, external_reimbursement: 0, net_amount: 3103.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 17, ref_number: '0506-43000', expense_date: '2026-05-18', organization: 'ESTACA', supplier_name: 'Gustapio Ltda', concept: 'Transporte Estaca', gross_amount: 479.00, external_reimbursement: 0, net_amount: 479.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 18, ref_number: '0506-43000', expense_date: '2026-05-28', organization: 'ESTACA', supplier_name: 'Disco Uruguay SA', concept: 'Insumos Estaca', gross_amount: 2208.00, external_reimbursement: 0, net_amount: 2208.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0506-43000' },
  { id: 19, ref_number: '0709-20000', expense_date: '2026-07-28', organization: 'HJ', supplier_name: 'PALTICOR SA (LOS TREINTA Y TRES)', concept: 'Actividad Juventud', gross_amount: 3837.00, external_reimbursement: 0, net_amount: 3837.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0709-20000' },
  { id: 20, ref_number: '0709-20000', expense_date: '2026-07-28', organization: 'MJ', supplier_name: 'PALTICOR SA (LOS TREINTA Y TRES)', concept: 'Actividad Juventud', gross_amount: 3837.00, external_reimbursement: 0, net_amount: 3837.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0709-20000' },
  { id: 21, ref_number: '0709-20000', expense_date: '2026-07-28', organization: 'ESTACA', supplier_name: 'DISER SAS (DISERSHOP)', concept: 'Materiales y remeras Estaca', gross_amount: 10820.00, external_reimbursement: 0, net_amount: 10820.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0709-20000' },
  { id: 22, ref_number: '0808-10000', expense_date: '2026-08-15', organization: 'ESTACA', supplier_name: 'DEVOTO SUPERMERCADO', concept: 'Comestibles conferencia Estaca', gross_amount: 5421.00, external_reimbursement: 0, net_amount: 5421.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0808-10000' },
  { id: 23, ref_number: '0822-10000', expense_date: '2026-08-22', organization: 'ESTACA', supplier_name: 'LA NUEVA BARCELONESA - VISAO SA', concept: 'Comestibles Estaca', gross_amount: 4220.00, external_reimbursement: 0, net_amount: 4220.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0822-10000' },
  { id: 24, ref_number: '0822-10000', expense_date: '2026-08-24', organization: 'AS', supplier_name: 'TATA', concept: 'Actividad Adultos Solteros', gross_amount: 6218.00, external_reimbursement: 0, net_amount: 6218.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0822-10000' },
  { id: 25, ref_number: '1095082', expense_date: '2026-08-28', organization: 'ESTACA', supplier_name: 'CONFITERIA PANINO', concept: 'Actividad Meet-up 2026', gross_amount: 100120.00, external_reimbursement: 0, net_amount: 100120.00, is_reimbursable_oai: true, status: 'REEMBOLSADO_OAI', withdrawal_ref: null },
  { id: 26, ref_number: '23679959', expense_date: '2026-09-07', organization: 'ESTACA', supplier_name: 'Centro de Distribución - Montevideo', concept: 'Centro de Distribución materiales', gross_amount: 1000.00, external_reimbursement: 0, net_amount: 1000.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: null },
  { id: 27, ref_number: '0827-20000', expense_date: '2026-09-08', organization: 'ESTACA', supplier_name: 'DEVOTO SUPERMERCADO', concept: 'Alimentos Meet Up 2026', gross_amount: 16707.00, external_reimbursement: 0, net_amount: 16707.00, is_reimbursable_oai: true, status: 'REEMBOLSADO_OAI', withdrawal_ref: '0827-20000' },
  { id: 28, ref_number: '0827-20000', expense_date: '2026-09-08', organization: 'ESTACA', supplier_name: 'PLASTICOS PETROPLAS - PETROPLAS SRL', concept: 'Decoración Meet Up 2026', gross_amount: 1590.00, external_reimbursement: 0, net_amount: 1590.00, is_reimbursable_oai: true, status: 'REEMBOLSADO_OAI', withdrawal_ref: '0827-20000' },
  { id: 29, ref_number: '0902-30000', expense_date: '2026-09-10', organization: 'HJ', supplier_name: 'SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', concept: 'Audio MeetUp compartido (cuota HJ)', gross_amount: 10750.00, external_reimbursement: 6000.00, net_amount: 4750.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0902-30000' },
  { id: 30, ref_number: '0902-30000', expense_date: '2026-09-10', organization: 'MJ', supplier_name: 'SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', concept: 'Audio MeetUp compartido (cuota MJ)', gross_amount: 10750.00, external_reimbursement: 6000.00, net_amount: 4750.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '0902-30000' },
  { id: 31, ref_number: '0902-30000', expense_date: '2026-09-10', organization: 'ESTACA', supplier_name: 'Mosca', concept: 'Decoración Meet Up 2026', gross_amount: 8622.00, external_reimbursement: 0, net_amount: 8622.00, is_reimbursable_oai: true, status: 'REEMBOLSADO_OAI', withdrawal_ref: '0902-30000' },
  { id: 32, ref_number: '1012-25000', expense_date: '2026-10-19', organization: 'AS', supplier_name: 'TENCONI CALVO GAEL NAHUEL', concept: 'Actividad Adultos Solteros', gross_amount: 10000.00, external_reimbursement: 0, net_amount: 10000.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1012-25000' },
  { id: 33, ref_number: '1012-25000', expense_date: '2026-10-19', organization: 'ESTACA', supplier_name: 'ALVANA SRL (CONFITERIA PANINO)', concept: 'Alimentos actividad Estaca', gross_amount: 14664.00, external_reimbursement: 0, net_amount: 14664.00, is_reimbursable_oai: false, status: 'REGISTRADO_LCR', withdrawal_ref: '1012-25000' },
  { id: 34, ref_number: '1017-12500', expense_date: '2026-10-28', organization: 'PRIMARIA', supplier_name: 'Librería y Supermercado', concept: 'Materiales y refrigerio Primaria', gross_amount: 12394.00, external_reimbursement: 0, net_amount: 12394.00, is_reimbursable_oai: false, status: 'PENDIENTE_LCR', withdrawal_ref: '1017-12500' },
  { id: 35, ref_number: '1024-9000', expense_date: '2026-11-01', organization: 'ESTACA', supplier_name: 'Palacio de la Música', concept: 'Materiales Coro de Estaca', gross_amount: 3112.00, external_reimbursement: 0, net_amount: 3112.00, is_reimbursable_oai: false, status: 'PENDIENTE_LCR', withdrawal_ref: '1024-9000' },
];

export const SEED_ACTIVITIES: ActivityRecord[] = [
  { id: 1, ical_uid: 'LCR-2026-001', title: 'Presentación Primaria Colonia Nicolich', event_date: '2026-11-08', start_time: '10:00', location: 'Capilla Colonia Nicolich', organization: 'PRIMARIA', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 2, ical_uid: 'LCR-2026-002', title: 'Presentación Primaria Camino Carrasco', event_date: '2026-11-15', start_time: '10:00', location: 'Capilla Camino Carrasco', organization: 'PRIMARIA', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 3, ical_uid: 'LCR-2026-003', title: 'Actividad AS de Fin de Año', event_date: '2026-11-21', start_time: '20:30', location: 'Centro de Estaca (Dalmiro Costa 4635)', organization: 'AS', estimated_cost: 15000.00, has_budget: true, origin: 'lcr', status: 'APROBADA' },
  { id: 4, ical_uid: 'LCR-2026-004', title: 'Presentación Primaria Aeroparque', event_date: '2026-11-22', start_time: '10:00', location: 'Capilla Aeroparque', organization: 'PRIMARIA', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 5, ical_uid: 'LCR-2026-005', title: 'Instrucción Cuórum de Élderes y Soc. Soc.', event_date: '2026-11-22', start_time: '18:00', location: 'Capilla Carrasco', organization: 'SS', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 6, ical_uid: 'LCR-2026-006', title: 'Actividad Templo y Sacerdocio Primaria', event_date: '2026-11-29', start_time: '16:00', location: 'Capilla Carrasco', organization: 'PRIMARIA', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 7, ical_uid: 'LCR-2026-007', title: 'Consejo de Estaca', event_date: '2026-12-06', start_time: '08:30', location: 'Centro de Estaca', organization: 'ESTACA', estimated_cost: 0, has_budget: false, origin: 'lcr', status: 'APROBADA' },
  { id: 8, ical_uid: 'LCR-2026-008', title: 'Campeonato de Vóley HHJJ y MMJJ', event_date: '2026-12-12', start_time: '15:00', location: 'Capilla Montevideo 9', organization: 'HJ', estimated_cost: 10000.00, has_budget: true, origin: 'lcr', status: 'APROBADA' },
];

export const SEED_CASH_WITHDRAWALS: CashWithdrawalRecord[] = [
  { id: 1, withdrawal_ref: '1205-55000', withdrawal_date: '2026-05-12', amount: 55000.00, responsible_person: 'Pablo Lamela', purpose: 'Actividades de Estaca', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 2, withdrawal_ref: '1226-30000', withdrawal_date: '2026-12-26', amount: 30000.00, responsible_person: 'Pablo Lamela', purpose: 'Campamento y suministros', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 3, withdrawal_ref: '0131-48000', withdrawal_date: '2026-01-31', amount: 48000.00, responsible_person: 'Pablo Lamela', purpose: 'PFJ - Transporte', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 4, withdrawal_ref: '0221-60000', withdrawal_date: '2026-02-21', amount: 60000.00, responsible_person: 'Pablo Lamela', purpose: 'Actividad Mujeres Jóvenes', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 5, withdrawal_ref: '0307-60000', withdrawal_date: '2026-03-07', amount: 60000.00, responsible_person: 'Pablo Lamela', purpose: 'Retiro General', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 6, withdrawal_ref: '0314-28000', withdrawal_date: '2026-03-14', amount: 28000.00, responsible_person: 'Pablo Lamela', purpose: 'Sociedad de Socorro', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 7, withdrawal_ref: '0506-43000', withdrawal_date: '2026-05-06', amount: 43000.00, responsible_person: 'Pablo Lamela', purpose: 'Retiro General Varias Orgs', status: 'CERRADO_EN_CERO', return_date: '2026-06-01', returned_amount: 1241.00 },
  { id: 8, withdrawal_ref: '0709-20000', withdrawal_date: '2026-07-09', amount: 20000.00, responsible_person: 'Pablo Lamela', purpose: 'Actividades Juventud', status: 'CERRADO_EN_CERO', return_date: '2026-08-02', returned_amount: 1506.00 },
  { id: 9, withdrawal_ref: '0808-10000', withdrawal_date: '2026-08-08', amount: 10000.00, responsible_person: 'Pablo Lamela', purpose: 'Supermercado Devoto', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 10, withdrawal_ref: '0822-10000', withdrawal_date: '2026-08-22', amount: 10000.00, responsible_person: 'Pablo Lamela', purpose: 'Adultos Solteros / Misceláneo', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 11, withdrawal_ref: '0827-20000', withdrawal_date: '2026-08-27', amount: 20000.00, responsible_person: 'Pablo Lamela', purpose: 'Actividad Meet-up', status: 'CERRADO_EN_CERO', return_date: null, returned_amount: 0 },
  { id: 12, withdrawal_ref: '0902-30000', withdrawal_date: '2026-09-02', amount: 30000.00, responsible_person: 'Pablo Lamela', purpose: 'Equipo de Audio y Meetup', status: 'PENDIENTE_JUSTIFICAR', return_date: null, returned_amount: 0 },
  { id: 13, withdrawal_ref: '1012-25000', withdrawal_date: '2026-10-12', amount: 25000.00, responsible_person: 'Pablo Lamela', purpose: 'Actividades Octubre', status: 'PENDIENTE_JUSTIFICAR', return_date: null, returned_amount: 0 },
];

export const SEED_SUPPLIERS: SupplierRecord[] = [
  { id: 1, commercial_name: 'PALTICOR SA (LOS TREINTA Y TRES)', legal_name: 'PALTICOR SA', rut: '214567890012', category: 'Ferretería y Pinturas', official_invoice: true, phone: '2900 1234', email: 'ventas@palticor.com.uy', address: 'Montevideo', rating: 5 },
  { id: 2, commercial_name: 'ABITAB SA', legal_name: 'ABITAB SA', rut: '213456780019', category: 'Servicios de Cobranza y Pagos', official_invoice: true, phone: '17123', email: 'contacto@abitab.com.uy', address: 'Sucursales en todo el país', rating: 5 },
  { id: 3, commercial_name: 'Oldfin SA (Ofimax)', legal_name: 'Oldfin SA', rut: '216543210015', category: 'Papelería e Insumos de Oficina', official_invoice: true, phone: '2401 5678', email: 'ventas@ofimax.com.uy', address: 'Montevideo', rating: 5 },
  { id: 4, commercial_name: 'Gustapio Ltda', legal_name: 'Gustapio Ltda', rut: '217894560018', category: 'Transporte y Fletes', official_invoice: true, phone: '099 876 543', email: 'gustapio.transportes@gmail.com', address: 'Montevideo y Canelones', rating: 5 },
  { id: 5, commercial_name: 'PAIZ CUILIGOTTI FATIMA GENELA - CINCO DEDOS GRAFICOS', legal_name: 'FATIMA GENELA PAIZ CUILIGOTTI', rut: '218965410013', category: 'Imprenta y Gráfica', official_invoice: true, phone: '098 765 432', email: 'cincodedosgraficos@gmail.com', address: 'Montevideo', rating: 5 },
  { id: 6, commercial_name: 'Mosca', legal_name: 'MOSCA HNOS SA', rut: '210123450014', category: 'Librería, Papelería y Juguetería', official_invoice: true, phone: '2902 0000', email: 'atencion@mosca.com.uy', address: 'Montevideo Shopping / Portones', rating: 5 },
  { id: 7, commercial_name: 'ELSOBERANO SAS - EL SOBERANO MAYORISTA', legal_name: 'ELSOBERANO SAS', rut: '219874560011', category: 'Comestibles Mayorista', official_invoice: true, phone: '2508 1234', email: 'ventas@elsoberano.com.uy', address: 'Montevideo', rating: 5 },
  { id: 8, commercial_name: 'Disco Uruguay SA', legal_name: 'DISCO URUGUAY SA', rut: '210987650017', category: 'Supermercado y Alimentación', official_invoice: true, phone: '2711 0000', email: 'clientes@disco.com.uy', address: 'Sucursales Malvín / Punta Gorda', rating: 5 },
  { id: 9, commercial_name: 'CAMOR LTDA - PANADERIA Y CONF SARATOGA', legal_name: 'CAMOR LTDA', rut: '215478960016', category: 'Panadería y Confitería', official_invoice: true, phone: '2613 4567', email: 'saratogapanaderia@gmail.com', address: 'Malvín Norte', rating: 5 },
  { id: 10, commercial_name: 'MAXIMILIANO ALVAREZ', legal_name: 'MAXIMILIANO ALVAREZ', rut: '120345678901', category: 'Sonido, Iluminación y Eventos', official_invoice: true, phone: '094 123 789', email: 'maxi.audio.uy@gmail.com', address: 'Montevideo', rating: 5 },
  { id: 11, commercial_name: 'Nueva Cooper SRL (Panadería)', legal_name: 'NUEVA COOPER SRL', rut: '213698520010', category: 'Panadería, Confitería y Catering', official_invoice: true, phone: '2600 9876', email: 'nuevacoopersrl@gmail.com', address: 'Carrasco / Malvín', rating: 5 },
  { id: 12, commercial_name: 'DISER SAS (DISERSHOP)', legal_name: 'DISER SAS', rut: '216987450014', category: 'Serigrafía, Prendas e Impresiones', official_invoice: true, phone: '2200 4567', email: 'ventas@disershop.com.uy', address: 'Montevideo', rating: 5 },
  { id: 13, commercial_name: 'DEVOTO SUPERMERCADO', legal_name: 'DEVOTO HNOS SA', rut: '210543210019', category: 'Supermercado y Alimentación', official_invoice: true, phone: '2708 0000', email: 'clientes@devoto.com.uy', address: 'Portones Shopping / Malvín', rating: 5 },
  { id: 14, commercial_name: 'LA NUEVA BARCELONESA - VISAO SA', legal_name: 'VISAO SA', rut: '214785230018', category: 'Panadería y Confitería', official_invoice: true, phone: '2487 1122', email: 'lanuevabarcelonesa@gmail.com', address: 'La Blanqueada', rating: 5 },
  { id: 15, commercial_name: 'TATA', legal_name: 'TATA SA', rut: '210001230012', category: 'Supermercado y Variedades', official_invoice: true, phone: '2900 8282', email: 'clientes@tata.com.uy', address: 'Sucursales en Montevideo', rating: 5 },
  { id: 16, commercial_name: 'CONFITERIA PANINO (ALVANA SRL)', legal_name: 'ALVANA SRL', rut: '215896320015', category: 'Confitería, Lunch y Catering', official_invoice: true, phone: '2707 3344', email: 'pedidos@panino.com.uy', address: 'Pocitos / Malvín', rating: 5 },
  { id: 17, commercial_name: 'SCANNIELLO GATTO MIGUEL ANGEL - MUSIC-PRO', legal_name: 'MIGUEL ANGEL SCANNIELLO GATTO', rut: '212589630011', category: 'Audio Profesional e Instrumentos', official_invoice: true, phone: '2901 7788', email: 'contacto@musicpro.com.uy', address: 'Centro Montevideo', rating: 5 },
];
