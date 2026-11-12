import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

function fieldFromError(error) {
  const parent = String(error.instancePath ?? "")
    .replace(/^\//, "")
    .replaceAll("/", ".");
  return error.params?.missingProperty
    ? [parent, error.params.missingProperty].filter(Boolean).join(".")
    : parent || "input";
}

const keywordCodes = {
  additionalProperties: "UNKNOWN_FIELD",
  enum: "INVALID_ENUM",
  format: "INVALID_FORMAT",
  maximum: "TOO_LARGE",
  maxLength: "TOO_LONG",
  minimum: "TOO_SMALL",
  minLength: "TOO_SHORT",
  pattern: "INVALID_PATTERN",
  required: "REQUIRED",
  type: "INVALID_TYPE",
};

export function normalizeValidationErrors(errors = []) {
  return errors.map((error) => ({
    field: fieldFromError(error),
    error_code: keywordCodes[error.keyword] ?? "INVALID_VALUE",
    keyword: error.keyword,
    params: error.params ?? {},
  }));
}

export function validate(input, schema) {
  const validator = ajv.compile(schema);
  return validator(input) ? null : normalizeValidationErrors(validator.errors);
}
