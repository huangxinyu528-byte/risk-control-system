import { NextRequest, NextResponse } from "next/server";
import { createContract, listContracts } from "@/lib/server/data-access";
import type { ContractPayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId") ?? "";
  const projectStatus = request.nextUrl.searchParams.get("projectStatus") ?? "";
  const data = await listContracts({ keyword, customerId, projectStatus });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ContractPayload;
    const data = await createContract(payload);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "创建合同失败",
      },
      { status: 400 },
    );
  }
}
