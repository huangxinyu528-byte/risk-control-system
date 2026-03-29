import { NextRequest, NextResponse } from "next/server";
import { getCreditScoreById, updateCreditScore } from "@/lib/server/data-access";
import type { CreditScorePayload } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const data = await getCreditScoreById(id);

  if (!data) {
    return NextResponse.json({ success: false, message: "评分记录不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const payload = (await request.json()) as CreditScorePayload;
    const data = await updateCreditScore(id, payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "更新评分失败",
      },
      { status: 400 },
    );
  }
}
