import { NextResponse } from "next/server";
import { getCustomerLedgerArchive, updateCustomerLedgerArchive } from "@/lib/server/data-access";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const data = await getCustomerLedgerArchive(context.params.id);
    if (!data) {
      return NextResponse.json({ success: false, data: null, message: "客户不存在" }, { status: 404 });
    }

    if (!data.archives.length) {
      return NextResponse.json({ success: true, data: null, message: "暂无原始sheet数据" });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: error instanceof Error ? error.message : "读取原始sheet数据失败",
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } },
) {
  const body = (await request.json()) as {
    sheets?: Array<{
      id: string;
      sheetData: Record<string, unknown>;
    }>;
  };

  const result = await updateCustomerLedgerArchive(context.params.id, {
    sheets: body.sheets ?? [],
  });

  if (!result) {
    return NextResponse.json({ success: false, message: "客户不存在" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result });
}
