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

export const ROLES = Object.freeze(["owner", "admin", "moderator", "viewer"]);

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
});

export function normalizeRole(role) {
  if (ROLES.includes(role)) return role;
  if (role === "operator") return "admin";
  return "viewer";
}

export function permissionsForRole(role) {
  return [...ROLE_PERMISSIONS[normalizeRole(role)]];
}

export function hasPermission(user, permission) {
  return permissionsForRole(user?.role).includes(permission);
}
