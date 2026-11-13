export type Locale = "bg" | "en";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "moderator" | "viewer";
  permissions: string[];
  preferredLocale?: Locale;
};

export type Server = {
  id: string;
  serverId?: string;
  name: string;
  containerName: string;
  mode: "classic" | "gungame";
  state: string;
  health: string;
  managedBy: "panel" | "compose";
  players: number | null;
  maxPlayers: number;
  liveMaxPlayers?: number;
  map?: string;
  startMap?: string;
  port?: number;
  imageId?: string;
  targetImageId?: string;
  updateAvailable?: boolean;
};

export type ServersPayload = { servers: Server[]; portRange: [number, number] };
