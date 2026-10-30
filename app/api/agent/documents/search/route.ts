import { NextRequest, NextResponse } from "next/server";
import { assertAgentAccess } from "@/lib/server/agent-api";
import { searchDocumentChunks } from "@/lib/server/document-search";

export async function GET(request: NextRequest) {
  assertAgentAccess(request);

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId");
  const customerName = request.nextUrl.searchParams.get("customerName");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 8);

  if (!query.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "请提供 q 参数，例如 /api/agent/documents/search?q=起诉",
      },
      { status: 400 },
    );
  }

  const data = await searchDocumentChunks({
    query,
    customerId,
    customerName,
    limit: Number.isFinite(limit) ? limit : 8,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}
