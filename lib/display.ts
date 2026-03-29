export function displayBaseValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "待补数据";
  }

  return String(value);
}

export function displayComputedValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "未计算";
  }

  return String(value);
}

export function displayOwnerValue(value: string | null | undefined) {
  if (!value) {
    return "待分配";
  }

  return value;
}

export function displayOptionalNote(value: string | null | undefined) {
  return value ?? "";
}

export function displayCreditLevel(value: string | null | undefined) {
  if (!value) {
    return "待评定";
  }

  return value;
}
