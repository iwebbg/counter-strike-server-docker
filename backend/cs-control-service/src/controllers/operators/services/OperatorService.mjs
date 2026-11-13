import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { normalizeRole, parseCustomPermissions, ROLES } from "../../../auth/permissions.mjs";
import Db from "../../../utils/Db.mjs";
import { normalizedEmail, UserService } from "../../users/services/UserService.mjs";

const publicOperator = (row, serverScopes = row.serverScopes || []) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: normalizeRole(row.role),
  customPermissions: parseCustomPermissions(row.custom_permissions),
  serverScopes,
  preferredLocale: row.preferred_locale,
  active: Boolean(row.active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function httpError(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

async function operatorById(db, id) {
  const operator = await db("users").where({ id }).first();
  if (!operator) throw httpError(404, "OPERATOR_NOT_FOUND");
  return operator;
}

async function assertOwnerRemains(db, operator, nextRole = operator.role, nextActive = operator.active) {
  if (normalizeRole(operator.role) !== "owner" || (normalizeRole(nextRole) === "owner" && Boolean(nextActive))) return;
  const owners = await db("users").where({ role: "owner", active: true }).count({ count: "*" }).first();
  if (Number(owners.count) <= 1) throw httpError(409, "LAST_OWNER_REQUIRED");
}

export async function listOperators() {
  const db = await new Db().db();
  const rows = await db("users").orderBy([
    { column: "active", order: "desc" },
    { column: "name", order: "asc" },
  ]);
  const scopes = await db("panel_operator_server_scopes").select("user_id", "server_id");
  return rows.map((row) =>
    publicOperator(
      row,
      scopes.filter((scope) => scope.user_id === row.id).map((scope) => scope.server_id),
    ),
  );
}

export async function createOperator(values) {
  const db = await new Db().db();
  const email = normalizedEmail(values.email);
  if (await db("users").where({ normalized_email: email }).first()) throw httpError(409, "OPERATOR_EMAIL_EXISTS");
  const id = crypto.randomUUID();
  const initialPermissions =
    values.role === "owner" ? null : (values.customPermissions ?? (values.role === "custom" ? [] : null));
  const initialScopes = values.role === "owner" ? [] : (values.serverScopes ?? []);
  await db.transaction(async (trx) => {
    await trx("users").insert({
      id,
      name: values.name.trim(),
      email,
      normalized_email: email,
      password: await bcrypt.hash(values.password, 12),
      role: values.role,
      custom_permissions: initialPermissions === null ? null : JSON.stringify(initialPermissions),
      preferred_locale: values.preferredLocale || "bg",
      active: true,
      email_verified_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    if (initialScopes.length) {
      await trx("panel_operator_server_scopes").insert(
        [...new Set(initialScopes)].map((serverId) => ({ user_id: id, server_id: serverId })),
      );
    }
  });
  return publicOperator(await operatorById(db, id), initialScopes);
}

export async function updateOperator(id, values, actorId) {
  const db = await new Db().db();
  const operator = await operatorById(db, id);
  const nextRole = values.role ?? normalizeRole(operator.role);
  const nextActive = values.active ?? Boolean(operator.active);
  const nextPermissions =
    nextRole === "owner"
      ? null
      : values.customPermissions !== undefined
        ? values.customPermissions
        : values.role !== undefined
          ? nextRole === "custom"
            ? (parseCustomPermissions(operator.custom_permissions) ?? [])
            : null
          : parseCustomPermissions(operator.custom_permissions);
  const existingScopes = (await db("panel_operator_server_scopes").where({ user_id: id }).select("server_id")).map(
    (entry) => entry.server_id,
  );
  const nextScopes = nextRole === "owner" ? [] : (values.serverScopes ?? existingScopes);
  const securityChanged =
    nextRole !== normalizeRole(operator.role) ||
    nextActive !== Boolean(operator.active) ||
    JSON.stringify(nextPermissions) !== JSON.stringify(parseCustomPermissions(operator.custom_permissions)) ||
    JSON.stringify([...nextScopes].sort()) !== JSON.stringify([...existingScopes].sort());
  if (id === actorId && (nextRole !== "owner" || !nextActive)) throw httpError(409, "CANNOT_RESTRICT_CURRENT_OPERATOR");
  await assertOwnerRemains(db, operator, nextRole, nextActive);
  const changes = { updated_at: new Date() };
  if (values.name !== undefined) changes.name = values.name.trim();
  if (values.role !== undefined) changes.role = values.role;
  if (values.customPermissions !== undefined || values.role !== undefined) {
    changes.custom_permissions = nextPermissions === null ? null : JSON.stringify([...new Set(nextPermissions)]);
  }
  if (values.active !== undefined) changes.active = values.active;
  if (values.preferredLocale !== undefined) changes.preferred_locale = values.preferredLocale;
  await db.transaction(async (trx) => {
    await trx("users").where({ id }).update(changes);
    if (values.serverScopes !== undefined) {
      await trx("panel_operator_server_scopes").where({ user_id: id }).delete();
      if (nextScopes.length) {
        await trx("panel_operator_server_scopes").insert(
          [...new Set(nextScopes)].map((serverId) => ({ user_id: id, server_id: serverId })),
        );
      }
    }
  });
  if (securityChanged) await new UserService().revokeUserSessions(id);
  return publicOperator(await operatorById(db, id), nextScopes);
}

export async function changeOperatorPassword(id, password) {
  const db = await new Db().db();
  await operatorById(db, id);
  await db("users")
    .where({ id })
    .update({ password: await bcrypt.hash(password, 12), updated_at: new Date() });
  await new UserService().revokeUserSessions(id);
  return { id, sessionsRevoked: true };
}

export async function deleteOperator(id, actorId) {
  if (id === actorId) throw httpError(409, "CANNOT_DELETE_CURRENT_OPERATOR");
  const db = await new Db().db();
  const operator = await operatorById(db, id);
  await assertOwnerRemains(db, operator, "viewer", false);
  await new UserService().revokeUserSessions(id);
  await db("users").where({ id }).delete();
  return { id, status: "deleted" };
}

export function isOperatorRole(value) {
  return ROLES.includes(value);
}
