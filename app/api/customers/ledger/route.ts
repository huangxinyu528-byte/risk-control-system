import { NextRequest, NextResponse } from "next/server";
import { listCustomerLedger } from "@/lib/server/data-access";
import type { CustomerLedgerFilters, CustomerLedgerSortField, CustomerLedgerSortOrder } from "@/lib/types";

function parseBoolean(value: string | null) {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters: CustomerLedgerFilters = {
    keyword: searchParams.get("keyword") ?? "",
    customerType: (searchParams.get("customerType") ?? "") as CustomerLedgerFilters["customerType"],
    hasUnclassifiedArchives: parseBoolean(searchParams.get("hasUnclassifiedArchives")),
    riskLevel: (searchParams.get("riskLevel") ?? "") as CustomerLedgerFilters["riskLevel"],
    sortBy: (searchParams.get("sortBy") ?? "unpaidAmount") as CustomerLedgerSortField,
    sortOrder: (searchParams.get("sortOrder") ?? "desc") as CustomerLedgerSortOrder,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 100),
  };

  const data = await listCustomerLedger(filters);
  return NextResponse.json({ success: true, data });
}
