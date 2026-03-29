import { NextRequest, NextResponse } from "next/server";
import { createReceivable, listReceivables } from "@/lib/server/data-access";
import type { ReceivablePayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId") ?? "";
  const salesOwnerName = request.nextUrl.searchParams.get("salesOwnerName") ?? "";
  const riskStatus = request.nextUrl.searchParams.get("riskStatus") ?? "";
  const businessType = request.nextUrl.searchParams.get("businessType") ?? "";
  const data = await listReceivables({
    keyword,
    customerId,
    salesOwnerName,
    riskStatus,
    businessType,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ReceivablePayload;
    const data = await createReceivable(payload);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "创建应收账款失败",
      },
      { status: 400 },
    );
  }
}
