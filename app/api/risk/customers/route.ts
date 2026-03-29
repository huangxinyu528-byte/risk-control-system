import { NextRequest, NextResponse } from "next/server";
import { listRiskCustomers } from "@/lib/server/data-access";
import type { RiskCustomerFilters } from "@/lib/types";

function parseBoolean(value: string | null) {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters: RiskCustomerFilters = {
    keyword: searchParams.get("keyword") ?? "",
    riskLevel: (searchParams.get("riskLevel") ?? "") as RiskCustomerFilters["riskLevel"],
    customerType: (searchParams.get("customerType") ?? "") as RiskCustomerFilters["customerType"],
    isImportantCustomer: parseBoolean(searchParams.get("isImportantCustomer")),
    hasUnclosedProjects: parseBoolean(searchParams.get("hasUnclosedProjects")),
    sortBy: (searchParams.get("sortBy") ?? "unpaidAmount") as RiskCustomerFilters["sortBy"],
    sortOrder: (searchParams.get("sortOrder") ?? "desc") as RiskCustomerFilters["sortOrder"],
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 100),
  };

  const data = await listRiskCustomers(filters);
  return NextResponse.json({ success: true, data });
}
