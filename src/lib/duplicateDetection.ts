import { getExpenseEffectiveDate, isExpenseApplied } from './formatters';
import { ExpenseRecord } from '../types/database';

export interface GroupedExpenseMovement {
  key: string;
  ids: number[];
  records: ExpenseRecord[];
  primary: ExpenseRecord;
  totalGross: number;
  totalExternalReimb: number;
  totalNet: number;
  isPendingLcr: boolean;
  isApplied: boolean;
  isShared: boolean;
  effectiveDate: string;
  accountingDate: string;
}

export type DuplicateConfidence = 'HIGH' | 'MEDIUM';

export interface DuplicatePairReason {
  confidence: DuplicateConfidence;
  reasons: string[];
}

export interface DuplicateGroup {
  id: string;
  confidence: DuplicateConfidence;
  reasons: string[];
  movements: GroupedExpenseMovement[];
}

export interface DuplicateDraftMatch {
  movement: GroupedExpenseMovement;
  confidence: DuplicateConfidence;
  reasons: string[];
}

const DISMISSED_STORAGE_KEY = 'estaca_este_dismissed_duplicates_v1';
const DATE_WINDOW_DAYS = 7;

/** Normalizes text for case-insensitive and whitespace-tolerant comparison. */
function normalizeText(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Parses YYYY-MM-DD into UTC day number for exact day-difference calculation. */
function parseIsoDay(isoDate?: string | null): number | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Computes minimum absolute day difference across effective and accounting dates. */
function getMinDayDiff(a: GroupedExpenseMovement, b: GroupedExpenseMovement): number | null {
  const datesA = [parseIsoDay(a.effectiveDate), parseIsoDay(a.accountingDate)].filter(
    (d): d is number => d !== null
  );
  const datesB = [parseIsoDay(b.effectiveDate), parseIsoDay(b.accountingDate)].filter(
    (d): d is number => d !== null
  );
  if (datesA.length === 0 || datesB.length === 0) return null;

  let minDiff = Infinity;
  for (const da of datesA) {
    for (const db of datesB) {
      const diff = Math.abs(da - db);
      if (diff < minDiff) minDiff = diff;
    }
  }
  return Number.isFinite(minDiff) ? minDiff : null;
}

/** Canonical symmetric key for a pair of movements. */
export function buildDuplicatePairKey(keyA: string, keyB: string): string {
  return keyA < keyB ? `${keyA}||${keyB}` : `${keyB}||${keyA}`;
}

/** Loads dismissed duplicate pair keys from localStorage safely. */
export function loadDismissedDuplicatePairs(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Persists all pairs within a movement cluster as dismissed (not duplicates). */
export function dismissDuplicateGroupPairs(
  movementKeys: string[],
  currentDismissed: Set<string>
): Set<string> {
  const next = new Set(currentDismissed);
  for (let i = 0; i < movementKeys.length; i += 1) {
    for (let j = i + 1; j < movementKeys.length; j += 1) {
      next.add(buildDuplicatePairKey(movementKeys[i], movementKeys[j]));
    }
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

/** Groups raw ExpenseRecord rows into logical movements (single or shared_group_id). */
export function groupExpensesIntoMovements(expenses: ExpenseRecord[]): GroupedExpenseMovement[] {
  const groups = new Map<string, ExpenseRecord[]>();
  expenses.forEach((exp) => {
    const key = exp.shared_group_id ? `grp:${exp.shared_group_id}` : `single:${exp.id}`;
    const list = groups.get(key) || [];
    list.push(exp);
    groups.set(key, list);
  });

  const result: GroupedExpenseMovement[] = [];
  groups.forEach((records, key) => {
    const primary = records[0];
    const totalGross = Number(
      records.reduce((acc, r) => acc + Number(r.gross_amount), 0).toFixed(2)
    );
    const totalExternalReimb = Number(
      records.reduce((acc, r) => acc + Number(r.external_reimbursement || 0), 0).toFixed(2)
    );
    const totalNet = Number(
      records.reduce((acc, r) => acc + Number(r.net_amount), 0).toFixed(2)
    );
    const applied = isExpenseApplied(primary);

    result.push({
      key,
      ids: records.map((r) => r.id),
      records,
      primary,
      totalGross,
      totalExternalReimb,
      totalNet,
      isPendingLcr: applied && records.some((r) => r.status === 'PENDIENTE_LCR'),
      isApplied: applied,
      isShared: records.length > 1,
      effectiveDate: getExpenseEffectiveDate(primary),
      accountingDate: primary.expense_date,
    });
  });

  return result.sort((a, b) => {
    if (a.isPendingLcr && !b.isPendingLcr) return -1;
    if (!a.isPendingLcr && b.isPendingLcr) return 1;
    return b.effectiveDate.localeCompare(a.effectiveDate);
  });
}

/** Evaluates whether two real/applied movements look like duplicate payments. */
export function compareMovementsForDuplicate(
  a: GroupedExpenseMovement,
  b: GroupedExpenseMovement
): DuplicatePairReason | null {
  if (!a.isApplied || !b.isApplied) return null;
  if (a.key === b.key) return null;

  const reasons: string[] = [];
  let confidence: DuplicateConfidence | null = null;

  const refA = normalizeText(a.primary.ref_number);
  const refB = normalizeText(b.primary.ref_number);
  const typeA = a.primary.expense_type;
  const typeB = b.primary.expense_type;

  // Direct/transfer coupon references are unique per payment (unlike cash withdrawal MMDD-MONTO refs).
  const isDirectRefA = typeA === 'DIRECTO_TARJETA' || typeA === 'TRANSFERENCIA';
  const isDirectRefB = typeB === 'DIRECTO_TARJETA' || typeB === 'TRANSFERENCIA';
  if (isDirectRefA && isDirectRefB && refA && refB && refA === refB) {
    reasons.push(`Mismo número de comprobante (${a.primary.ref_number})`);
    confidence = 'HIGH';
  }

  const sameAmount = Math.abs(a.totalGross - b.totalGross) < 0.01 && a.totalGross > 0;
  const dayDiff = getMinDayDiff(a, b);
  const closeDates = dayDiff !== null && dayDiff <= DATE_WINDOW_DAYS;

  if (sameAmount && closeDates) {
    const supA = normalizeText(a.primary.supplier_name);
    const supB = normalizeText(b.primary.supplier_name);
    const validSupplierMatch =
      supA && supB && supA !== 'por definir' && supB !== 'por definir' && supA === supB;

    if (validSupplierMatch) {
      reasons.push(
        dayDiff === 0
          ? 'Mismo monto, mismo proveedor y misma fecha'
          : `Mismo monto, mismo proveedor y fechas a ${dayDiff} día(s)`
      );
      confidence = 'HIGH';
    } else {
      const orgsA = new Set(a.records.map((r) => r.organization));
      const hasCommonOrg = b.records.some((r) => orgsA.has(r.organization));
      if (hasCommonOrg) {
        reasons.push(
          dayDiff === 0
            ? 'Mismo monto, misma organización y misma fecha'
            : `Mismo monto, misma organización y fechas a ${dayDiff} día(s)`
        );
        if (!confidence) confidence = 'MEDIUM';
      }
    }
  }

  if (!confidence || reasons.length === 0) return null;
  return { confidence, reasons };
}

/** Clusters all non-dismissed duplicate pairs into review groups. */
export function detectDuplicateGroups(
  movements: GroupedExpenseMovement[],
  dismissedPairs: Set<string>
): DuplicateGroup[] {
  const applied = movements.filter((m) => m.isApplied);
  if (applied.length < 2) return [];

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) || x;
    if (p !== x) {
      const root = find(p);
      parent.set(x, root);
      return root;
    }
    return p;
  };
  const union = (x: string, y: string) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  const clusterReasons = new Map<string, Set<string>>();
  const clusterConfidence = new Map<string, DuplicateConfidence>();
  const matchedKeys = new Set<string>();

  for (let i = 0; i < applied.length; i += 1) {
    for (let j = i + 1; j < applied.length; j += 1) {
      const a = applied[i];
      const b = applied[j];
      const pair = buildDuplicatePairKey(a.key, b.key);
      if (dismissedPairs.has(pair)) continue;

      const match = compareMovementsForDuplicate(a, b);
      if (!match) continue;

      matchedKeys.add(a.key);
      matchedKeys.add(b.key);
      union(a.key, b.key);

      const pairId = `${a.key}|${b.key}`;
      clusterReasons.set(pairId, new Set(match.reasons));
      clusterConfidence.set(pairId, match.confidence);
    }
  }

  if (matchedKeys.size === 0) return [];

  const movementByKey = new Map(applied.map((m) => [m.key, m]));
  const clusters = new Map<string, GroupedExpenseMovement[]>();
  matchedKeys.forEach((key) => {
    const root = find(key);
    const list = clusters.get(root) || [];
    const mov = movementByKey.get(key);
    if (mov) list.push(mov);
    clusters.set(root, list);
  });

  const groups: DuplicateGroup[] = [];
  clusters.forEach((clusterMovements, root) => {
    if (clusterMovements.length < 2) return;
    const sortedMovements = [...clusterMovements].sort((a, b) =>
      b.effectiveDate.localeCompare(a.effectiveDate)
    );

    const reasonsSet = new Set<string>();
    let confidence: DuplicateConfidence = 'MEDIUM';

    for (let i = 0; i < sortedMovements.length; i += 1) {
      for (let j = i + 1; j < sortedMovements.length; j += 1) {
        const a = sortedMovements[i];
        const b = sortedMovements[j];
        const match = compareMovementsForDuplicate(a, b);
        if (match) {
          match.reasons.forEach((r) => reasonsSet.add(r));
          if (match.confidence === 'HIGH') confidence = 'HIGH';
        }
      }
    }

    groups.push({
      id: `dup-${root}`,
      confidence,
      reasons: Array.from(reasonsSet),
      movements: sortedMovements,
    });
  });

  return groups.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'HIGH' ? -1 : 1;
    return b.movements[0].effectiveDate.localeCompare(a.movements[0].effectiveDate);
  });
}

/** Checks a draft expense group against existing expenses before saving. */
export function findDuplicatesForDraft(
  draftRecords: Array<Omit<ExpenseRecord, 'id'>>,
  existingExpenses: ExpenseRecord[],
  excludeIds?: number[]
): DuplicateDraftMatch[] {
  if (draftRecords.length === 0) return [];

  const excludeSet = new Set(excludeIds || []);
  const filteredExisting = existingExpenses.filter((e) => !excludeSet.has(e.id));
  const existingMovements = groupExpensesIntoMovements(filteredExisting);

  const draftWithIds: ExpenseRecord[] = draftRecords.map((r, idx) => ({
    ...r,
    id: -1000 - idx,
    shared_group_id: draftRecords.length > 1 ? 'draft-group' : null,
  }));
  const [draftMovement] = groupExpensesIntoMovements(draftWithIds);
  if (!draftMovement || !draftMovement.isApplied) return [];

  const matches: DuplicateDraftMatch[] = [];
  for (const existing of existingMovements) {
    const match = compareMovementsForDuplicate(draftMovement, existing);
    if (match) {
      matches.push({
        movement: existing,
        confidence: match.confidence,
        reasons: match.reasons,
      });
    }
  }

  return matches.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'HIGH' ? -1 : 1));
}
