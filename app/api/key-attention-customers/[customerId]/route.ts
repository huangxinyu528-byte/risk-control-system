import { NextResponse } from "next/server";
import { getKeyAttentionCustomerById } from "@/lib/server/data-access";

export async function GET(
  _request: Request,
  context: { params: { customerId: string } },
) {
  const data = await getKeyAttentionCustomerById(context.params.customerId);

  if (!data) {
    return NextResponse.json(
      { success: false, message: "重点关注客户不存在" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data });
}
