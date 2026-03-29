import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, updateCustomer } from "@/lib/server/data-access";
import type { CustomerPayload } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const data = await getCustomerById(id);

  if (!data) {
    return NextResponse.json({ success: false, message: "客户不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const payload = (await request.json()) as CustomerPayload;
    const data = await updateCustomer(id, payload);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "更新客户失败",
      },
      { status: 400 },
    );
  }
}
