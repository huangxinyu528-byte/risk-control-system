import { NextRequest, NextResponse } from "next/server";
import {
  assertAgentAccess,
  buildAgentDashboardSummary,
} from "@/lib/server/agent-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  assertAgentAccess(request);

  const data = await buildAgentDashboardSummary();

  return NextResponse.json({
    success: true,
    data,
  });
}
