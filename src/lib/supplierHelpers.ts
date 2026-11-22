import { SupplierRecord } from '../types/database';

/** Normaliza texto para comparar nombres, rubros y direcciones sin tildes ni mayúsculas. */
export const normalizeSupplierText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Extrae solo los dígitos numéricos de una cadena. */
export const digitsOnly = (value?: string): string => (value || '').replace(/\D/g, '');

/** Separa valores múltiples ingresados con "|", ";" o saltos de línea. */
export const splitMultiValue = (value: string): string[] =>
  value
    .split(/[|;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

/** Valida que cada celular ingresado tenga exactamente 9 dígitos. */
export const validateMobilePhones = (raw: string): string | null => {
  const items = splitMultiValue(raw);
  for (const item of items) {
    const digits = digitsOnly(item);
    if (digits.length !== 9) {
      return `El celular "${item}" debe tener exactamente 9 dígitos (tiene ${digits.length}).`;
    }
  }
  return null;
};

/** Valida que cada teléfono fijo ingresado tenga exactamente 8 dígitos. */
export const validateFixedPhones = (raw: string): string | null => {
  const items = splitMultiValue(raw);
  for (const item of items) {
    const digits = digitsOnly(item);
    if (digits.length !== 8) {
      return `El teléfono fijo "${item}" debe tener exactamente 8 dígitos (tiene ${digits.length}).`;
    }
  }
  return null;
};

/** Combina rubros guardados y rubros en uso sin duplicados (ignorando tildes/mayúsculas). */
export const mergeSupplierCategories = (
  savedCategories: string[],
  suppliers: SupplierRecord[]
): string[] => {
  const seen = new Map<string, string>();
  const add = (raw?: string) => {
    const clean = (raw || '').trim();
    if (!clean) return;
    const key = normalizeSupplierText(clean);
    if (!seen.has(key)) {
      seen.set(key, clean);
    }
  };
  savedCategories.forEach(add);
  suppliers.forEach((s) => add(s.category));
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'es'));
};

export interface DuplicateWarnings {
  commercialName?: string;
  rut?: string;
  phoneMobile?: string;
  phoneFixed?: string;
  address?: string;
  branchPhones: Record<number, string>;
  branchAddresses: Record<number, string>;
}

const collectSupplierPhones = (s: SupplierRecord): string[] => {
  const phones: string[] = [];
  splitMultiValue(s.phone_mobile || '').forEach((p) => phones.push(digitsOnly(p)));
  splitMultiValue(s.phone_fixed || '').forEach((p) => phones.push(digitsOnly(p)));
  splitMultiValue(s.phone || '').forEach((p) => phones.push(digitsOnly(p)));
  (s.branches || []).forEach((b) => {
    (b.phone_mobile || []).forEach((p) => phones.push(digitsOnly(p)));
    (b.phone_fixed || []).forEach((p) => phones.push(digitsOnly(p)));
  });
  return phones.filter((d) => d.length >= 6);
};

const collectSupplierAddresses = (s: SupplierRecord): string[] => {
  const addrs: string[] = [];
  splitMultiValue(s.address || '').forEach((a) => addrs.push(normalizeSupplierText(a)));
  (s.branches || []).forEach((b) => {
    if (b.address) addrs.push(normalizeSupplierText(b.address));
  });
  return addrs.filter((a) => a.length >= 5);
};

/** Detecta coincidencias de nombre, RUT, teléfonos o direcciones contra otros proveedores. */
export const findSupplierDuplicates = (
  draft: {
    commercialName: string;
    rut: string;
    phoneMobile: string;
    phoneFixed: string;
    address: string;
    branches: Array<{ address: string; phone_mobile: string; phone_fixed: string }>;
  },
  allSuppliers: SupplierRecord[],
  editingId?: number
): DuplicateWarnings => {
  const others = allSuppliers.filter((s) => s.id !== editingId);
  const warnings: DuplicateWarnings = { branchPhones: {}, branchAddresses: {} };

  const normName = normalizeSupplierText(draft.commercialName);
  if (normName.length >= 2) {
    const match = others.find((s) => normalizeSupplierText(s.commercial_name) === normName);
    if (match) warnings.commercialName = match.commercial_name;
  }

  const rutDigits = digitsOnly(draft.rut);
  if (rutDigits.length >= 6) {
    const match = others.find((s) => digitsOnly(s.rut) === rutDigits);
    if (match) warnings.rut = match.commercial_name;
  }

  const findPhoneMatch = (raw: string): string | undefined => {
    const digitsList = splitMultiValue(raw)
      .map(digitsOnly)
      .filter((d) => d.length >= 6);
    if (digitsList.length === 0) return undefined;
    const match = others.find((s) => {
      const existing = collectSupplierPhones(s);
      return digitsList.some((d) => existing.includes(d));
    });
    return match?.commercial_name;
  };

  const findAddressMatch = (raw: string): string | undefined => {
    const addrList = splitMultiValue(raw)
      .map(normalizeSupplierText)
      .filter((a) => a.length >= 5);
    if (addrList.length === 0) return undefined;
    const match = others.find((s) => {
      const existing = collectSupplierAddresses(s);
      return addrList.some((a) => existing.includes(a));
    });
    return match?.commercial_name;
  };

  warnings.phoneMobile = findPhoneMatch(draft.phoneMobile);
  warnings.phoneFixed = findPhoneMatch(draft.phoneFixed);
  warnings.address = findAddressMatch(draft.address);

  draft.branches.forEach((b, idx) => {
    const mobMatch = findPhoneMatch(b.phone_mobile);
    const fixMatch = findPhoneMatch(b.phone_fixed);
    if (mobMatch || fixMatch) {
      warnings.branchPhones[idx] = mobMatch || fixMatch || '';
    }
    const addrMatch = findAddressMatch(b.address);
    if (addrMatch) {
      warnings.branchAddresses[idx] = addrMatch;
    }
  });

  return warnings;
};
