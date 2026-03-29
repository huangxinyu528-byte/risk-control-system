import { NextRequest, NextResponse } from "next/server";
import {
  assertAgentAccess,
  buildAgentCustomerRiskSummary,
} from "@/lib/server/agent-api";

export async function GET(
  request: NextRequest,
  context: { params: { customerId: string } },
) {
  assertAgentAccess(request);

  const data = await buildAgentCustomerRiskSummary(context.params.customerId);

  if (!data) {
    return NextResponse.json(
      { success: false, message: "客户不存在" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
}
