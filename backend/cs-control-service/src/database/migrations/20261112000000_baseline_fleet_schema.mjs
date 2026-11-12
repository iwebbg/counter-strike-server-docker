import fs from "node:fs/promises";

export const config = { transaction: false };

export const up = async (knex) => {
  const sql = await fs.readFile(new URL("../baseline.sql", import.meta.url), "utf8");
  await knex.raw(sql);
};

export const down = async () => {
  throw new Error("The fleet baseline cannot be rolled back automatically because it may contain player statistics.");
};
