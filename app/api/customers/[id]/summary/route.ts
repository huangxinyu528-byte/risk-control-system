import { NextResponse } from "next/server";
import { getCustomerSummary } from "@/lib/server/data-access";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const data = await getCustomerSummary(context.params.id);
  if (!data) {
    return NextResponse.json({ success: false, message: "客户不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
