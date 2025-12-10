import { abiCoder, liquidator, GAS_LIMIT } from "../helpers/constants";
import { getGasPrice } from "./getGasPrice";
import { delay } from "../helpers/tools";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 15000;

export async function executeLiquidation(unhealthyList: string[]): Promise<void> {
  if (unhealthyList.length === 0) {
    console.log("   > No accounts to liquidate");
    return;
  }

  const startTime = Date.now();
  console.log(`   > Executing liquidation for ${unhealthyList.length} accounts`);

  const iterations = Math.ceil(unhealthyList.length / BATCH_SIZE);

  for (let i = 0; i < iterations; i++) {
    const startIndex = i * BATCH_SIZE;
    const endIndex = Math.min(startIndex + BATCH_SIZE, unhealthyList.length);
    const batch = unhealthyList.slice(startIndex, endIndex);

    const input = abiCoder.encode(["address[]"], [batch]);
    const networkGasPrice = await getGasPrice();

    try {
      const tx = await liquidator.liquidate(input, {
        gasPrice: networkGasPrice,
        gasLimit: GAS_LIMIT,
      });
      console.log(`   > Batch ${i + 1}/${iterations} submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`   > Batch ${i + 1}/${iterations} confirmed`);
    } catch (error) {
      console.error(`   ! Batch ${i + 1}/${iterations} failed:`, error);
    }

    if (i < iterations - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   > Liquidation completed in ${elapsed} seconds`);
  console.log("__________________________________________________________________");
}
