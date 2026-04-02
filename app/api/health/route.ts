import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "服务运行正常",
    timestamp: new Date().toISOString(),
  });
}
