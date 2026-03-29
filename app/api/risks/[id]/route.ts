import { NextRequest, NextResponse } from "next/server";
import { getRiskById, updateRisk } from "@/lib/server/data-access";
import type { RiskPayload } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const data = await getRiskById(id);

  if (!data) {
    return NextResponse.json({ success: false, message: "风险记录不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const payload = (await request.json()) as RiskPayload;
    const data = await updateRisk(id, payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "更新风险记录失败",
      },
      { status: 400 },
    );
  }
}
