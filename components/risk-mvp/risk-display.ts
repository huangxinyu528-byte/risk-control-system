export function cleanPlaceholderText(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "待补数据") {
    return "";
  }

  return raw
    .replace(/(?:[、，,；\s]*)待补数据(?:\s*等\d+项)?/g, "")
    .replace(/[、，,；\s]+$/g, "")
    .replace(/^[、，,；\s]+/g, "")
    .replace(/[、，,；]{2,}/g, "；")
    .trim();
}

export function summarizeRiskText(values: string[], emptyText: string, maxItems: number) {
  const cleaned = values
    .map((value) => cleanPlaceholderText(value))
    .filter((value) => value.length > 0);
  const informative = cleaned.filter((value) => value !== "当前未发现明显异常");
  const finalValues =
    informative.length > 0 && cleaned.includes("当前未发现明显异常") ? informative : cleaned;
  const limited = finalValues.slice(0, maxItems);
  return limited.join("；") || emptyText;
}

export function displayMetaText(value: string | null | undefined, emptyText = "暂无补充说明") {
  return cleanPlaceholderText(value) || emptyText;
}

export function displayLabelText(value: string | null | undefined, emptyText = "未标注") {
  return cleanPlaceholderText(value) || emptyText;
}
