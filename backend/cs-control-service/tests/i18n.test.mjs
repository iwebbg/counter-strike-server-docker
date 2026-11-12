import assert from "node:assert/strict";
import test from "node:test";

function browserGlobals(language) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => language,
      setItem: () => {},
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language },
  });
}

test("i18n defaults to English strings and locale formatting", async () => {
  browserGlobals("en");
  const { getLocale, t } = await import("../../../panel/public/i18n.js?language=en");
  assert.equal(getLocale(), "en-US");
  assert.equal(t("mapsSaved", { count: 3 }), "3 map(s) saved to the rotation.");
  assert.equal(t("healthy"), "healthy");
});

test("i18n loads Bulgarian and interpolates dynamic values", async () => {
  browserGlobals("bg");
  const { getLocale, t } = await import("../../../panel/public/i18n.js?language=bg");
  assert.equal(getLocale(), "bg-BG");
  assert.equal(t("mapsSaved", { count: 3 }), "3 карти са запазени в ротацията.");
  assert.equal(t("healthy"), "работи");
});
