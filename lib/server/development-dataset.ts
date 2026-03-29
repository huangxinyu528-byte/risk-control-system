import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  CollectionItemRecord,
  ContractRecord,
  CreditScoreRecord,
  CustomerRecord,
  ReceivableRecord,
  RiskRecordItem,
} from "@/lib/types";

export type DevelopmentDataset = {
  customers: CustomerRecord[];
  receivables: ReceivableRecord[];
  contracts: ContractRecord[];
  risks: RiskRecordItem[];
  creditScores: CreditScoreRecord[];
  collections: CollectionItemRecord[];
};

const datasetPath = resolve(
  process.cwd(),
  "data",
  "imported",
  "zhongcheng-development-dataset.json",
);

export function loadDevelopmentDataset(): DevelopmentDataset | null {
  if (!existsSync(datasetPath)) {
    return null;
  }

  try {
    const raw = readFileSync(datasetPath, "utf-8");
    return JSON.parse(raw) as DevelopmentDataset;
  } catch (error) {
    console.error("读取开发数据集失败", error);
    return null;
  }
}

export function getDevelopmentDatasetPath() {
  return datasetPath;
}
