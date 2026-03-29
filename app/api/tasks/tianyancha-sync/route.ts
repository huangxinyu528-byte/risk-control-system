import { NextResponse } from "next/server";
import { runTianyanchaSync } from "@/lib/integrations/tianyancha";

export async function POST() {
  const result = await runTianyanchaSync();

  return NextResponse.json({
    success: true,
    message: "天眼查同步任务占位已执行。",
    data: result,
  });
}
