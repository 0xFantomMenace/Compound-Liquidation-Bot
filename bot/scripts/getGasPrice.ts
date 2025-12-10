import { eventProvider } from "../helpers/constants";
import { delay } from "../helpers/tools";

export async function getGasPrice(): Promise<bigint | null> {
  try {
    const feeData = await eventProvider.getFeeData();
    return feeData.gasPrice;
  } catch {
    await delay(200);
    const feeData = await eventProvider.getFeeData();
    return feeData.gasPrice;
  }
}
