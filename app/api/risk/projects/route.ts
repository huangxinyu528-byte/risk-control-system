import { NextRequest, NextResponse } from "next/server";
import { listRiskProjects } from "@/lib/server/data-access";
import type { RiskProjectFilters } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBoolean(value: string | null) {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters: RiskProjectFilters = {
    keyword: searchParams.get("keyword") ?? "",
    riskLevel: (searchParams.get("riskLevel") ?? "") as RiskProjectFilters["riskLevel"],
    projectBelongingCategory: (searchParams.get("projectBelongingCategory") ?? "") as RiskProjectFilters["projectBelongingCategory"],
    businessType: searchParams.get("businessType") ?? "",
    hasLedgerArchive: parseBoolean(searchParams.get("hasLedgerArchive")),
    isUnclosed: parseBoolean(searchParams.get("isUnclosed")),
    sortBy: (searchParams.get("sortBy") ?? "unpaidAmount") as RiskProjectFilters["sortBy"],
    sortOrder: (searchParams.get("sortOrder") ?? "desc") as RiskProjectFilters["sortOrder"],
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 100),
  };

  const data = await listRiskProjects(filters);
  return NextResponse.json({ success: true, data });
}
