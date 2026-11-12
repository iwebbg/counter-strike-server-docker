import bcrypt from "bcrypt";
import crypto from "node:crypto";
import authConfig from "../../../config/auth.mjs";
import Db from "../../../utils/Db.mjs";
import Redis from "../../../utils/Redis.mjs";

export const normalizedEmail = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const token = () => crypto.randomBytes(32).toString("hex");
const expiresAt = (seconds) => new Date(Date.now() + seconds * 1000);
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  preferred_locale: user.preferred_locale ?? "bg",
  role: user.role ?? "operator",
});

export class UserService {
  constructor() {
    this.db = new Db();
    this.redis = new Redis();
  }

  async findByEmail(email) {
    return (
      (await this.db.db())("users")
        .where({ normalized_email: normalizedEmail(email) })
        .first() ?? null
    );
  }

  async authenticate(email, password) {
    const user = await this.findByEmail(email);
    if (!user || !user.active || !(await bcrypt.compare(password, user.password))) return null;
    return user;
  }

  async createSession(user, transaction = null) {
    const db = transaction ?? (await this.db.db());
    const client = await db("oauth_clients").where({ provider: "users", revoked: false }).first();
    if (!client) throw new Error("AUTH_CLIENT_NOT_CONFIGURED");
    const accessToken = token();
    const refreshToken = token();
    const accessTokenExpiresAt = expiresAt(authConfig.accessTokenLifetime);
    const refreshTokenExpiresAt = expiresAt(authConfig.refreshTokenLifetime);
    await db("oauth_access_tokens").insert({
      id: accessToken,
      user_id: user.id,
      client_id: client.id,
      scopes: JSON.stringify(["*"]),
      revoked: false,
      expires_at: accessTokenExpiresAt,
    });
    await db("oauth_refresh_tokens").insert({
      id: refreshToken,
      access_token_id: accessToken,
      revoked: false,
      expires_at: refreshTokenExpiresAt,
    });
    return { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
  }

  async signin(email, password) {
    const user = await this.authenticate(email, password);
    if (!user) return null;
    const session = await this.createSession(user);
    await this.setUserCache(session.accessToken, publicUser(user));
    return { ...session, user: publicUser(user) };
  }

  async refreshSession(refreshToken) {
    const db = await this.db.db();
    const result = await db.transaction(async (trx) => {
      const refresh = await trx("oauth_refresh_tokens")
        .where({ id: refreshToken, revoked: false })
        .where("expires_at", ">", new Date())
        .forUpdate()
        .first();
      if (!refresh) return null;
      const access = await trx("oauth_access_tokens").where({ id: refresh.access_token_id }).first();
      const user = access ? await trx("users").where({ id: access.user_id, active: true }).first() : null;
      if (!user) return null;
      await trx("oauth_refresh_tokens").where({ id: refresh.id }).update({ revoked: true });
      await trx("oauth_access_tokens").where({ id: refresh.access_token_id }).update({ revoked: true });
      const session = await this.createSession(user, trx);
      return { ...session, user: publicUser(user), previousAccessToken: refresh.access_token_id };
    });
    if (!result) return null;
    await this.deleteUserCache(result.previousAccessToken);
    await this.setUserCache(result.accessToken, result.user);
    delete result.previousAccessToken;
    return result;
  }

  async signout(accessToken, refreshToken = null) {
    const db = await this.db.db();
    const accessTokens = new Set(accessToken ? [accessToken] : []);
    await db.transaction(async (trx) => {
      if (refreshToken) {
        const refresh = await trx("oauth_refresh_tokens").where({ id: refreshToken }).first();
        if (refresh?.access_token_id) accessTokens.add(refresh.access_token_id);
        await trx("oauth_refresh_tokens").where({ id: refreshToken }).update({ revoked: true });
      }
      for (const tokenId of accessTokens) {
        await trx("oauth_refresh_tokens").where({ access_token_id: tokenId }).update({ revoked: true });
        await trx("oauth_access_tokens").where({ id: tokenId }).update({ revoked: true });
      }
    });
    await Promise.all([...accessTokens].map((tokenId) => this.deleteUserCache(tokenId)));
  }

  async setUserCache(accessToken, user) {
    return this.redis.set(`userSession_${accessToken}`, JSON.stringify(user), authConfig.accessTokenLifetime);
  }
  async getUserCache(accessToken) {
    const value = await this.redis.get(`userSession_${accessToken}`);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  async deleteUserCache(accessToken) {
    return this.redis.delete(`userSession_${accessToken}`);
  }
}
