-- Permitir tipo DEPOSITO en cash_withdrawals para estandarizar Movimientos Tarjeta y Transferencias
ALTER TABLE public.cash_withdrawals
  DROP CONSTRAINT IF EXISTS cash_withdrawals_movement_type_check;

ALTER TABLE public.cash_withdrawals
  ADD CONSTRAINT cash_withdrawals_movement_type_check
  CHECK (movement_type = ANY (ARRAY['EFECTIVO'::text, 'DIRECTO_TARJETA'::text, 'TRANSFERENCIA'::text, 'DEPOSITO'::text]));
