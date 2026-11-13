import assert from "node:assert/strict";
import test from "node:test";
import { eventIsDue, scheduleParts } from "../src/controllers/communityEvents/services/CommunityEventService.mjs";

test("weekly event matching uses the configured local timezone", () => {
  const now = new Date("2026-11-13T18:30:00.000Z");
  const local = scheduleParts(now, "Europe/Sofia");

  assert.deepEqual(local, { dayOfWeek: 5, time: "20:30", occurrenceKey: "2026-11-13" });
  assert.equal(
    eventIsDue(
      {
        day_of_week: 5,
        start_time: "20:30",
        timezone: "Europe/Sofia",
        last_occurrence_key: null,
      },
      now,
    ),
    true,
  );
});

test("an event cannot run twice for the same local occurrence", () => {
  const now = new Date("2026-11-13T18:30:00.000Z");
  assert.equal(
    eventIsDue(
      {
        day_of_week: 5,
        start_time: "20:30",
        timezone: "Europe/Sofia",
        last_occurrence_key: "2026-11-13",
      },
      now,
    ),
    false,
  );
});
