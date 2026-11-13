export const PERMISSIONS = Object.freeze({
  SERVERS_READ: "servers.read",
  SERVERS_OPERATE: "servers.operate",
  SERVERS_MANAGE: "servers.manage",
  PLAYERS_MODERATE: "players.moderate",
  MAPS_MANAGE: "maps.manage",
  ADMINS_MANAGE: "admins.manage",
  BACKUPS_MANAGE: "backups.manage",
  STATS_READ: "stats.read",
  SEASONS_MANAGE: "seasons.manage",
  MODERATION_MANAGE: "moderation.manage",
  AUDIT_READ: "audit.read",
  OPERATORS_MANAGE: "operators.manage",
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));
export const ROLES = Object.freeze(["owner", "admin", "moderator", "viewer", "custom"]);

const viewer = [PERMISSIONS.SERVERS_READ, PERMISSIONS.STATS_READ];
const moderator = [...viewer, PERMISSIONS.PLAYERS_MODERATE, PERMISSIONS.MAPS_MANAGE, PERMISSIONS.MODERATION_MANAGE];
const admin = [
  ...moderator,
  PERMISSIONS.SERVERS_OPERATE,
  PERMISSIONS.SERVERS_MANAGE,
  PERMISSIONS.ADMINS_MANAGE,
  PERMISSIONS.BACKUPS_MANAGE,
  PERMISSIONS.SEASONS_MANAGE,
  PERMISSIONS.AUDIT_READ,
];

export const ROLE_PERMISSIONS = Object.freeze({
  viewer,
  moderator,
  admin,
  owner: [...admin, PERMISSIONS.OPERATORS_MANAGE],
  custom: [],
});

export function normalizeRole(role) {
  if (ROLES.includes(role)) return role;
  if (role === "operator") return "admin";
  return "viewer";
}

export function permissionsForRole(role) {
  return [...ROLE_PERMISSIONS[normalizeRole(role)]];
}

export function parseCustomPermissions(value) {
  if (value === null || value === undefined) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((permission) => ALL_PERMISSIONS.includes(permission)))]
      : null;
  } catch {
    return null;
  }
}

export function permissionsForUser(user) {
  const role = normalizeRole(user?.role);
  if (role === "owner") return permissionsForRole("owner");
  const custom = parseCustomPermissions(user?.customPermissions ?? user?.custom_permissions);
  return custom ?? permissionsForRole(role);
}

export function hasPermission(user, permission) {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : permissionsForUser(user);
  return permissions.includes(permission);
}
