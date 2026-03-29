import { NextResponse } from "next/server";
import {
  collectionReports,
  contracts,
  creditScores,
  customers,
  receivables,
  risks,
} from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({
    success: true,
    source: "mock",
    message: "OpenClaw 读取接口占位，当前返回开发假数据。",
    data: {
      customers,
      contracts,
      receivables,
      risks,
      creditScores,
      collectionReports,
    },
  });
}
