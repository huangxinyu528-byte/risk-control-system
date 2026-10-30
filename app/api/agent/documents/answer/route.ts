import { NextRequest, NextResponse } from "next/server";
import { assertAgentAccess } from "@/lib/server/agent-api";
import { answerDocumentQuestion } from "@/lib/server/document-search";

export async function GET(request: NextRequest) {
  assertAgentAccess(request);

  const question = request.nextUrl.searchParams.get("q") ?? "";
  const customerId = request.nextUrl.searchParams.get("customerId");
  const customerName = request.nextUrl.searchParams.get("customerName");

  if (!question.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "请提供 q 参数，例如 /api/agent/documents/answer?q=成都永安有没有担保",
      },
      { status: 400 },
    );
  }

  const data = await answerDocumentQuestion({
    question,
    customerId,
    customerName,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}

export async function POST(request: NextRequest) {
  assertAgentAccess(request);

  const body = (await request.json().catch(() => null)) as {
    question?: string;
    customerId?: string | null;
    customerName?: string | null;
    limit?: number;
  } | null;

  const question = body?.question ?? "";
  if (!question.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "请提供 question 字段。",
      },
      { status: 400 },
    );
  }

  const data = await answerDocumentQuestion({
    question,
    customerId: body?.customerId,
    customerName: body?.customerName,
    limit: body?.limit,
  });

  return NextResponse.json({
    success: true,
    data,
  });
}
