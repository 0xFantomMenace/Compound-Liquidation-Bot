import fs from "fs";
import { delay, assert } from "./helpers/tools";
import { collectAllUsers } from "./scripts/collectAllUsers";
import { updateUserListFromLocal } from "./scripts/updateUserListFromLocal";
import { getLiquidatable } from "./scripts/getLiquidatable";
import { executeLiquidation } from "./scripts/executeLiquidation";
import { saveUserListToLocal } from "./scripts/saveUserListToLocal";

const LOOP_INTERVAL_MS = 180000; // 30 minutes
const USER_LIST_PATH = "./userList.json";

interface UserListData {
  lastBlock: number;
  users: string[];
}

async function loadUserList(): Promise<UserListData | null> {
  try {
    if (!fs.existsSync(USER_LIST_PATH)) {
      return null;
    }
    const data = JSON.parse(fs.readFileSync(USER_LIST_PATH, "utf8"));
    assert(typeof data.lastBlock === "number", "lastBlock must be a number");
    assert(Array.isArray(data.users), "users must be an array");
    return data as UserListData;
  } catch {
    return null;
  }
}

async function runLiquidationCycle(userData: UserListData | null): Promise<void> {
  let userList: string[];

  if (userData) {
    console.log("   > Loading from local cache");
    console.log(`   > Last block: ${userData.lastBlock}`);
    console.log(`   > User count: ${userData.users.length}`);

    userList = [...userData.users];

    const updateResult = await updateUserListFromLocal(userData.lastBlock, userList);

    if (updateResult.list.length > 0) {
      userList.push(...updateResult.list);
    }

    await saveUserListToLocal(updateResult.block, userList);
  } else {
    console.log("   > No local cache found, performing full collection");
    userList = await collectAllUsers();
  }

  await delay(2000);

  const unhealthyList = await getLiquidatable(userList);

  await delay(2000);

  await executeLiquidation(unhealthyList);
}

async function main(): Promise<void> {
  console.log("=================================================================");
  console.log("        Compound V3 Liquidation Bot Starting...");
  console.log("=================================================================\n");

  while (true) {
    try {
      const userData = await loadUserList();
      await runLiquidationCycle(userData);
    } catch (error) {
      console.error("   ! Error in liquidation cycle:", error);
    }

    console.log(`\n   > Next cycle in ${LOOP_INTERVAL_MS / 60000} minutes...\n`);
    await delay(LOOP_INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
