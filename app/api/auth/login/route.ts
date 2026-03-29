import { NextRequest, NextResponse } from "next/server";
import { buildSiteAccessUser, getSiteAccessPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { password?: string };
  const password = (payload.password ?? "").trim();

  if (!password || password !== getSiteAccessPassword()) {
    return NextResponse.json(
      {
        success: false,
        message: "密码错误",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      user: buildSiteAccessUser(),
    },
  });
}
