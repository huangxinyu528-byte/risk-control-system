import { NextResponse } from "next/server";
import { getHighRiskCustomerById } from "@/lib/server/data-access";

export async function GET(
  _request: Request,
  context: { params: { customerId: string } },
) {
  const data = await getHighRiskCustomerById(context.params.customerId);

  if (!data) {
    return NextResponse.json(
      { success: false, message: "高风险客户不存在" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data });
}
