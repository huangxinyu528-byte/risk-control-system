import { NextRequest, NextResponse } from "next/server";
import { createCreditScore, listCreditScores } from "@/lib/server/data-access";
import type { CreditScorePayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  const scoreMonth = request.nextUrl.searchParams.get("scoreMonth") ?? "";
  const creditLevel = request.nextUrl.searchParams.get("creditLevel") ?? "";
  const data = await listCreditScores({ scoreMonth, creditLevel });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreditScorePayload;
    const data = await createCreditScore(payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "创建评分失败",
      },
      { status: 400 },
    );
  }
}
