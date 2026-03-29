import { NextRequest, NextResponse } from "next/server";
import { listKeyAttentionCustomers } from "@/lib/server/data-access";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const attentionLevel = request.nextUrl.searchParams.get("attentionLevel") ?? "";
  const salesOwnerName = request.nextUrl.searchParams.get("salesOwnerName") ?? "";

  const data = await listKeyAttentionCustomers({
    keyword,
    attentionLevel,
    salesOwnerName,
  });

  return NextResponse.json({ success: true, data });
}
