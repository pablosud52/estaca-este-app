export type UserRole = 'ADMIN' | 'PRESIDENCIA' | 'LIDER' | 'CONSULTA' | 'NO_AUTORIZADO';

export type OrganizationCode =
  | 'MJ'
  | 'HJ'
  | 'SEMINARIO'
  | 'SS'
  | 'PRIMARIA'
  | 'JAS'
  | 'AS'
  | 'CFS'
  | 'ESTACA'
  | 'TODAS';

export type DirectoryOrgCode =
  | 'PRESIDENCIA'
  | 'SUMO_CONSEJO'
  | 'SS'
  | 'HJ'
  | 'MJ'
  | 'ESCUELA_DOMINICAL'
  | 'PRIMARIA'
  | 'JAS'
  | 'AS'
  | 'BIENESTAR'
  | 'MUSICA'
  | 'CFS';

export type ExtraRoleType = 'SECRETARIO_AUXILIAR' | 'ASESOR' | 'MANUAL';

export interface StakeDirectoryEntry {
  id: string;
  directory_org: DirectoryOrgCode;
  slot_key: string;
  calling: string;
  is_fixed_slot: boolean;
  extra_role_type?: ExtraRoleType;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  has_app_access: boolean;
  role: UserRole;
  can_approve_activities: boolean;
  is_permanent_admin: boolean;
  assigned_unit?: string;
  assigned_org_notes?: string;
  linked_entry_id?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  organization: OrganizationCode;
  calling: string;
  phone?: string;
  can_approve_activities: boolean;
  is_permanent_admin: boolean;
  is_active: boolean;
}

export interface BudgetAllocation {
  id: number;
  year: number;
  organization: OrganizationCode;
  t1_assigned: number;
  t2_assigned: number;
  t3_assigned: number;
  t4_assigned: number;
  total_assigned: number;
  notes?: string;
}

export type BudgetIncomeEntryType = 'SALDO_INICIAL' | 'INGRESO_UNIDAD' | 'AJUSTE';

export interface BudgetIncomeEntry {
  id: number;
  year: number;
  quarter: QuarterCode;
  entry_type: BudgetIncomeEntryType;
  slot_index: number | null;
  lcr_ref?: string | null;
  description?: string | null;
  amount: number;
}

export type MovementType = 'EFECTIVO' | 'DIRECTO_TARJETA' | 'TRANSFERENCIA' | 'DEPOSITO';

export type ExpenseType =
  | 'EFECTIVO'
  | 'DIRECTO_TARJETA'
  | 'TRANSFERENCIA'
  | 'PROYECTADO_ACTIVIDAD'
  | 'PLANIFICADO_SIN_FECHA';

export interface WithdrawalAllocationItem {
  withdrawal_ref: string;
  amount: number;
}

export interface ExpenseRecord {
  id: number;
  ref_number: string | null;
  expense_date: string; // YYYY-MM-DD (Fecha contable / rendición LCR — uso interno admin)
  activity_date?: string; // YYYY-MM-DD (Fecha en que se hace la actividad — visible al líder y define el trimestre)
  activity_id?: number | null; // Vínculo opcional con una actividad del calendario
  shared_group_id?: string | null; // Agrupa las cuotas de un mismo movimiento LCR compartido entre 2+ organizaciones
  expense_type?: ExpenseType;
  is_applied?: boolean; // true = gasto formal que impacta presupuesto; false = proyectado/planificado
  withdrawal_allocations?: WithdrawalAllocationItem[]; // Hasta 2 retiros en efectivo con su monto exacto
  organization: OrganizationCode;
  supplier_name: string;
  concept: string;
  gross_amount: number;
  external_reimbursement: number;
  net_amount: number;
  is_reimbursable_oai: boolean;
  status: 'REGISTRADO_LCR' | 'PENDIENTE_LCR' | 'REEMBOLSADO_OAI';
  withdrawal_ref: string | null;
}

export type ActivityOrigin = 'lcr' | 'propuesta_lider';

export interface ActivityRecord {
  id: number;
  ical_uid?: string | null;
  title: string;
  event_date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:mm
  end_time?: string | null;
  location: string;
  description?: string | null;
  organization: OrganizationCode;
  estimated_cost: number;
  has_budget: boolean;
  origin?: ActivityOrigin;
  status: 'PROPUESTA' | 'APROBADA' | 'RECHAZADA' | 'REPROGRAMADA' | 'CANCELADA';
}

export type QuarterCode = 'T1' | 'T2' | 'T3' | 'T4';

export interface QuarterSummary {
  quarter: QuarterCode;
  assigned: number;
  carryOverIn: number;
  available: number;
  spent: number;
  remaining: number;
}

export interface CashWithdrawalRecord {
  id: number;
  withdrawal_ref: string;
  withdrawal_date: string; // YYYY-MM-DD
  amount: number;
  responsible_person: string;
  purpose: string;
  movement_type?: MovementType;
  status: 'CERRADO_EN_CERO' | 'PENDIENTE_JUSTIFICAR';
  return_date: string | null;
  returned_amount: number;
}

export interface SupplierBranch {
  name?: string;
  address: string;
  phone_fixed?: string[];
  phone_mobile?: string[];
  hours?: string;
}

export interface SupplierRecord {
  id: number;
  commercial_name: string;
  legal_name?: string;
  description?: string;
  category: string;
  official_invoice: boolean;
  phone?: string;
  phone_fixed?: string;
  phone_mobile?: string;
  email?: string;
  website?: string;
  address?: string;
  hours?: string;
  branches?: SupplierBranch[];
  updated_at?: string;
  rut?: string;
  frequency?: number;
  rating: number;
}
