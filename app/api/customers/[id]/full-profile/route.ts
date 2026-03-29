import { NextResponse } from "next/server";
import { getCustomerFullProfile } from "@/lib/server/data-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const data = await getCustomerFullProfile(context.params.id);
  if (!data) {
    return NextResponse.json({ success: false, message: "客户不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
