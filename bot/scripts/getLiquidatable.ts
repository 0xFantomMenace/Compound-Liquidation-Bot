import { dataHelper } from "../helpers/constants";
import { delay } from "../helpers/tools";

const BATCH_SIZE = 25;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function getLiquidatable(users: string[]): Promise<string[]> {
  const startTime = Date.now();
  const unhealthyList: string[] = [];

  console.log(`   @ Checking ${users.length} users for liquidation eligibility`);

  const iterations = Math.ceil(users.length / BATCH_SIZE);

  for (let i = 0; i < iterations; i++) {
    const startIndex = i * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, users.length);
    const batch = users.slice(startIndex, endIndex);

    let isLiquidatable: string[];
    let unhealthyCount: number;

    try {
      [isLiquidatable, unhealthyCount] = await dataHelper.isLiquidatable(batch);
    } catch {
      console.log("   ! DataHelper call failed, retrying...");
      await delay(200);
      try {
        [isLiquidatable, unhealthyCount] = await dataHelper.isLiquidatable(batch);
      } catch {
        console.log(`   ! Batch ${i + 1} failed, skipping`);
        continue;
      }
    }

    if (unhealthyCount > 0) {
      for (const address of isLiquidatable) {
        if (address !== ZERO_ADDRESS) {
          unhealthyList.push(address);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   @ Found ${unhealthyList.length} liquidatable positions`);
  console.log(`   > Health check completed in ${elapsed} seconds`);

  return unhealthyList;
}
