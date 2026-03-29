import { NextRequest, NextResponse } from "next/server";
import { getReceivableById, updateReceivable } from "@/lib/server/data-access";
import type { ReceivablePayload } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  const { id } = context.params;
  const data = await getReceivableById(id);

  if (!data) {
    return NextResponse.json({ success: false, message: "应收账款不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const { id } = context.params;
    const payload = (await request.json()) as ReceivablePayload;
    const data = await updateReceivable(id, payload);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "更新应收账款失败",
      },
      { status: 400 },
    );
  }
}
