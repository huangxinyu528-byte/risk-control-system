import { NextRequest, NextResponse } from "next/server";
import {
  assertAgentAccess,
  buildAgentMonthlyReport,
} from "@/lib/server/agent-api";

export async function GET(request: NextRequest) {
  assertAgentAccess(request);

  const month = request.nextUrl.searchParams.get("month") ?? "";

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      {
        success: false,
        message: "month 参数格式必须为 YYYY-MM",
      },
      { status: 400 },
    );
  }

  const data = await buildAgentMonthlyReport(month);

  return NextResponse.json({
    success: true,
    data,
  });
}
