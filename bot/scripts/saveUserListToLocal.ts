import fs from "fs/promises";

interface UserListData {
  lastBlock: number;
  users: string[];
}

export async function saveUserListToLocal(currentBlock: number, users: string[]): Promise<void> {
  console.log(`   > USER LENGTH @ SAVE: ${users.length}`);
  console.log(`   > BLOCK @ SAVE: ${currentBlock}`);

  const data: UserListData = {
    lastBlock: currentBlock,
    users: users,
  };

  await fs.writeFile("./userList.json", JSON.stringify(data, null, 2), "utf8");
}
