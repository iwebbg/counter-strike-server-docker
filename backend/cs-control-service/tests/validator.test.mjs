import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "../src/utils/helpers/validator.mjs";

test("strict validation rejects unknown fields", () => {
  const schema = {
    type: "object",
    properties: { name: { type: "string", minLength: 2 } },
    required: ["name"],
    additionalProperties: false,
  };
  const errors = validate({ name: "CS", unexpected: true }, schema);
  assert.equal(errors[0].error_code, "UNKNOWN_FIELD");
});

test("strict validation accepts a valid object", () => {
  const schema = {
    type: "object",
    properties: { email: { type: "string", format: "email" } },
    required: ["email"],
    additionalProperties: false,
  };
  assert.equal(validate({ email: "admin@example.test" }, schema), null);
});
