import { NextRequest, NextResponse } from "next/server";
import { createRisk, listRisks } from "@/lib/server/data-access";
import type { RiskPayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId") ?? "";
  const riskType = request.nextUrl.searchParams.get("riskType") ?? "";
  const riskLevel = request.nextUrl.searchParams.get("riskLevel") ?? "";
  const data = await listRisks({ keyword, customerId, riskType, riskLevel });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as RiskPayload;
    const data = await createRisk(payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "创建风险记录失败",
      },
      { status: 400 },
    );
  }
}
