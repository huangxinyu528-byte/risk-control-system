import { NextRequest, NextResponse } from "next/server";
import { listHighRiskCustomers } from "@/lib/server/data-access";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const riskLevel = request.nextUrl.searchParams.get("riskLevel") ?? "";
  const salesOwnerName = request.nextUrl.searchParams.get("salesOwnerName") ?? "";

  const data = await listHighRiskCustomers({
    keyword,
    riskLevel,
    salesOwnerName,
  });

  return NextResponse.json({ success: true, data });
}
