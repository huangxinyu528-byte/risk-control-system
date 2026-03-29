export async function runTianyanchaSync() {
  return {
    provider: "天眼查",
    mode: "mock",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    summary: {
      scannedCustomers: 3,
      changedCustomers: 1,
      generatedRisks: 1,
    },
  };
}
