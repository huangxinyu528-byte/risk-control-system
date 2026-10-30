import { NextRequest, NextResponse } from "next/server";
import { answerDocumentQuestion } from "@/lib/server/document-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json().catch(() => null)) as {
    question?: string;
    customerName?: string | null;
  } | null;

  const question = body?.question?.trim() ?? "";
  if (!question) {
    return NextResponse.json({ success: false, message: "请输入要查询的客户档案问题" }, { status: 400 });
  }

  const data = await answerDocumentQuestion({
    question,
    customerId: params.id,
    customerName: body?.customerName,
    limit: 5,
  });

  return NextResponse.json({ success: true, data });
}
