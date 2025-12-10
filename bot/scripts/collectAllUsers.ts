import {
  START_BLOCK,
  MAX_BLOCK_PER_QUERY,
  abiCoder,
  eventProvider,
  compound,
  compoundWebsocket,
  FILTER,
} from "../helpers/constants";
import { saveUserListToLocal } from "./saveUserListToLocal";
import { delay } from "../helpers/tools";

const SAVE_INTERVAL = 25;

export async function collectAllUsers(): Promise<string[]> {
  const latestBlock = await eventProvider.getBlockNumber();
  const iterations = Math.ceil((latestBlock - START_BLOCK) / MAX_BLOCK_PER_QUERY);

  console.log(`   > Collecting users from block ${START_BLOCK} to ${latestBlock}`);
  console.log(`   > Total iterations: ${iterations}`);

  const userSet = new Set<string>();
  let fromBlock = START_BLOCK;
  let currentBlock = START_BLOCK;
  let saveCounter = 0;

  for (let i = 0; i < iterations; i++) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_PER_QUERY, latestBlock);

    const logs = await compoundWebsocket.queryFilter(FILTER, fromBlock, toBlock);

    if (logs.length > 0) {
      console.log(`   > Log count: ${logs.length}, iteration: ${i + 1}/${iterations}`);

      for (const log of logs) {
        currentBlock = log.blockNumber;
        const onBehalfOf = abiCoder.decode(["address"], log.topics[1]).toString();

        if (!userSet.has(onBehalfOf)) {
          try {
            const debt = await compound.borrowBalanceOf(onBehalfOf);
            if (debt > 0) {
              userSet.add(onBehalfOf);
            }
          } catch {
            console.log("   ! borrowBalanceOf call error, retrying...");
            await delay(1000);
            try {
              const debt = await compound.borrowBalanceOf(onBehalfOf);
              if (debt > 0) {
                userSet.add(onBehalfOf);
              }
            } catch {
              console.log(`   ! Failed to fetch debt for ${onBehalfOf}, skipping`);
            }
          }
        }
      }

      saveCounter++;
      if (saveCounter % SAVE_INTERVAL === 0) {
        await saveUserListToLocal(currentBlock, Array.from(userSet));
        console.log(`   > Checkpoint saved after ${saveCounter} iterations`);
      }
    }

    fromBlock += MAX_BLOCK_PER_QUERY;
  }

  const userList = Array.from(userSet);
  await saveUserListToLocal(latestBlock, userList);
  console.log(`   > Collection complete. Found ${userList.length} users with debt.`);

  return userList;
}
