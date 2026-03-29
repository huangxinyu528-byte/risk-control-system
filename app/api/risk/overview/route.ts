import { NextResponse } from "next/server";
import { getRiskOverview } from "@/lib/server/data-access";

export async function GET() {
  const data = await getRiskOverview();
  return NextResponse.json({ success: true, data });
}
