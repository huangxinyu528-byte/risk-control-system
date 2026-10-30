import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runRiskAssistant } from "@/lib/server/ai/risk-assistant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runRiskAssistant(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message ?? "AI 请求参数不正确" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "AI 风控助理分析失败",
      },
      { status: 500 },
    );
  }
}
