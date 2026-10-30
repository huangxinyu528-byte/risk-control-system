import { NextRequest, NextResponse } from "next/server";
import { getRiskOverview } from "@/lib/server/data-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    const data = await getRiskOverview({ forceRefresh });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "读取风控总览数据失败",
      },
      { status: 500 },
    );
  }
}
