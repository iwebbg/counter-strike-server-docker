import crypto from "node:crypto";
import Db from "../../../utils/Db.mjs";
import { notFound } from "../../../utils/HttpError.mjs";
import { validateEditInput } from "../../servers/services/schemas.mjs";

const portStart = Number(process.env.PORT_RANGE_START || 27015);
const portEnd = Number(process.env.PORT_RANGE_END || 27115);

function parseConfiguration(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function publicTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    configuration: parseConfiguration(row.configuration),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeConfiguration(configuration) {
  return validateEditInput(
    {
      ...configuration,
      rconPassword: "",
      serverPassword: "",
      clearServerPassword: false,
    },
    portStart,
    portEnd,
  );
}

export async function listTemplates() {
  const db = await new Db().db();
  return (await db("panel_configuration_templates").orderBy("name")).map(publicTemplate);
}

export async function getTemplate(id) {
  const db = await new Db().db();
  const row = await db("panel_configuration_templates").where({ id }).first();
  if (!row) throw notFound("CONFIGURATION_TEMPLATE_NOT_FOUND");
  return publicTemplate(row);
}

export async function createTemplate(input, actor) {
  const db = await new Db().db();
  const id = crypto.randomUUID();
  await db("panel_configuration_templates").insert({
    id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    configuration: JSON.stringify(normalizeConfiguration(input.configuration)),
    created_by: actor?.id || null,
  });
  return getTemplate(id);
}

export async function updateTemplate(id, input) {
  const db = await new Db().db();
  if (!(await db("panel_configuration_templates").where({ id }).first())) {
    throw notFound("CONFIGURATION_TEMPLATE_NOT_FOUND");
  }
  const changes = { updated_at: new Date() };
  if (input.name !== undefined) changes.name = input.name.trim();
  if (input.description !== undefined) changes.description = input.description.trim() || null;
  if (input.configuration !== undefined) {
    changes.configuration = JSON.stringify(normalizeConfiguration(input.configuration));
  }
  await db("panel_configuration_templates").where({ id }).update(changes);
  return getTemplate(id);
}

export async function removeTemplate(id) {
  const db = await new Db().db();
  if (!(await db("panel_configuration_templates").where({ id }).delete())) {
    throw notFound("CONFIGURATION_TEMPLATE_NOT_FOUND");
  }
  return { id, status: "deleted" };
}
