export function getStatusClassName(status: string) {
  if (
    status.includes("高风险") ||
    status.includes("逾期") ||
    status.includes("处理中") ||
    status.includes("冻结")
  ) {
    return "status-badge status-danger";
  }

  if (
    status.includes("待") ||
    status.includes("预警") ||
    status.includes("跟进")
  ) {
    return "status-badge status-warning";
  }

  return "status-badge status-normal";
}
