import {
  MAX_BLOCK_PER_QUERY,
  abiCoder,
  eventProvider,
  compound,
  compoundWebsocket,
  FILTER,
} from "../helpers/constants";
import { delay } from "../helpers/tools";

interface UpdateResult {
  list: string[];
  block: number;
}

export async function updateUserListFromLocal(
  lastBlock: number,
  existingUsers: string[]
): Promise<UpdateResult> {
  const latestBlock = await eventProvider.getBlockNumber();
  const iterations = Math.ceil((latestBlock - lastBlock) / MAX_BLOCK_PER_QUERY);

  if (iterations === 0) {
    console.log("   > No new blocks to scan");
    return { list: [], block: latestBlock };
  }

  console.log(`   > Scanning blocks ${lastBlock} to ${latestBlock} (${iterations} iterations)`);

  const existingSet = new Set(existingUsers);
  const newUsers: string[] = [];
  let fromBlock = lastBlock;

  for (let i = 0; i < iterations; i++) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_PER_QUERY, latestBlock);

    const logs = await compoundWebsocket.queryFilter(FILTER, fromBlock, toBlock);

    if (logs.length > 0) {
      console.log(`   > Log count: ${logs.length}, iteration: ${i + 1}/${iterations}`);

      for (const log of logs) {
        const onBehalfOf = abiCoder.decode(["address"], log.topics[1]).toString();

        if (!existingSet.has(onBehalfOf) && !newUsers.includes(onBehalfOf)) {
          try {
            const debt = await compound.borrowBalanceOf(onBehalfOf);
            if (debt > 0) {
              newUsers.push(onBehalfOf);
              existingSet.add(onBehalfOf);
            }
          } catch {
            console.log("   ! borrowBalanceOf call error, retrying...");
            await delay(1000);
            try {
              const debt = await compound.borrowBalanceOf(onBehalfOf);
              if (debt > 0) {
                newUsers.push(onBehalfOf);
                existingSet.add(onBehalfOf);
              }
            } catch {
              console.log(`   ! Failed to fetch debt for ${onBehalfOf}, skipping`);
            }
          }
        }
      }
    }

    fromBlock += MAX_BLOCK_PER_QUERY;
  }

  if (newUsers.length > 0) {
    console.log(`   > Found ${newUsers.length} new users with debt`);
  }

  return { list: newUsers, block: latestBlock };
}
