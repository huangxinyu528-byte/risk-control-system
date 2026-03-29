import { NextRequest, NextResponse } from "next/server";
import {
  assertAgentAccess,
  buildAgentCustomerSearchByName,
} from "@/lib/server/agent-api";

export async function GET(request: NextRequest) {
  assertAgentAccess(request);

  const name = request.nextUrl.searchParams.get("name") ?? "";
  const data = await buildAgentCustomerSearchByName(name);

  return NextResponse.json({
    success: true,
    data,
  });
}
