import { NextResponse } from "next/server";
import { getCustomerById, listProjectsByCustomer } from "@/lib/server/data-access";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const customer = await getCustomerById(context.params.id);
  if (!customer) {
    return NextResponse.json({ success: false, message: "客户不存在" }, { status: 404 });
  }

  const data = await listProjectsByCustomer(customer.customerId);
  return NextResponse.json({ success: true, data });
}
