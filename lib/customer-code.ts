export function buildCustomerCode(sequence: number) {
  return `KH${String(sequence).padStart(3, "0")}`;
}

export function normalizeCustomerCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

export function generateNextCustomerCode(existingCodes: Array<string | null | undefined>) {
  const numbers = existingCodes
    .map((code) => normalizeCustomerCode(code))
    .filter((code): code is string => Boolean(code))
    .map((code) => {
      const match = code.match(/^KH(\d+)$/);
      return match ? Number(match[1]) : 0;
    });

  const nextNumber = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return buildCustomerCode(nextNumber);
}

export function formatCustomerDisplayName(customerCode: string | null | undefined, customerName: string) {
  const code = normalizeCustomerCode(customerCode);
  return code ? `${code} / ${customerName}` : customerName;
}
