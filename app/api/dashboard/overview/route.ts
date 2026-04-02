import { NextResponse } from "next/server";
import { getDashboardOverview } from "@/lib/server/data-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await getDashboardOverview();
  return NextResponse.json({ success: true, data });
}
