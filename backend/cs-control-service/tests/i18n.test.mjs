import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const messagesUrl = new URL("../../../frontend/cs-control/i18n/messages.ts", import.meta.url);
const providerUrl = new URL("../../../frontend/cs-control/components/i18n-provider.tsx", import.meta.url);

test("Next.js frontend ships Bulgarian and English navigation catalogs", async () => {
  const source = await readFile(messagesUrl, "utf8");
  for (const value of ["Табло", "Сървъри", "Оператори", "Журнал", "Dashboard", "Servers", "Operators", "Audit log"]) {
    assert.ok(source.includes(value), `Missing i18n value: ${value}`);
  }
});

test("language provider persists the BG/EN selection", async () => {
  const source = await readFile(providerUrl, "utf8");
  assert.match(source, /cs16-panel-language/);
  assert.match(source, /saved === "en" \? "en" : "bg"/);
  assert.match(source, /document\.documentElement\.lang = next/);
});
