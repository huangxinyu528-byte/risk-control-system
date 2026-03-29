import { NextRequest, NextResponse } from "next/server";
import { createCustomer, listCustomers } from "@/lib/server/data-access";
import type { CustomerPayload } from "@/lib/types";

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get("keyword") ?? "";
  const data = await listCustomers({ keyword });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CustomerPayload;
    const data = await createCustomer(payload);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "创建客户失败",
      },
      { status: 400 },
    );
  }
}
