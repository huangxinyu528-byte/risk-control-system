import { NextResponse } from "next/server";
import { listCollectionItems, listReportEntries } from "@/lib/server/data-access";

export async function GET() {
  const [collections, reports] = await Promise.all([
    listCollectionItems(),
    Promise.resolve(listReportEntries()),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      collections,
      reports,
    },
  });
}
