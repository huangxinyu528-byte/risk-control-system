import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "服务运行正常",
    timestamp: new Date().toISOString(),
  });
}
