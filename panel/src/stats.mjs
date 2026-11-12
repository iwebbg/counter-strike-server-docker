function filter(serverId, alias = 's') {
  return serverId ? { sql: ` WHERE ${alias}.server_id = ?`, parameters: [serverId] } : { sql: '', parameters: [] };
}

export function validateStatsFilter(url) {
  const serverId = url.searchParams.get('serverId') || '';
  const seasonRaw = url.searchParams.get('seasonId') || '';
  if (serverId && !/^[a-zA-Z0-9_-]{1,64}$/.test(serverId)) throw new Error('Invalid stats server filter');
  if (seasonRaw && !/^\d{1,10}$/.test(seasonRaw)) throw new Error('Invalid season filter');
  return { serverId: serverId || null, seasonId: seasonRaw ? Number(seasonRaw) : null };
}

export async function syncServerRegistry(database, servers) {
  if (!database.enabled) return;
  await Promise.all(servers.map((server) => database.query(
    `INSERT INTO cs_servers (server_id,container_id,display_name,mode,host_port,max_players,state,current_map,last_heartbeat)
     VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE container_id=VALUES(container_id),display_name=VALUES(display_name),mode=VALUES(mode),host_port=VALUES(host_port),max_players=VALUES(max_players),state=VALUES(state),current_map=VALUES(current_map),last_heartbeat=UTC_TIMESTAMP()`,
    [server.serverId, server.id, server.name, server.mode, server.port, server.maxPlayers, server.state, server.map],
  )));
}

export async function statsOverview(database, values) {
  const seasons = await database.query('SELECT id,slug,name,starts_at AS startsAt,ends_at AS endsAt,active FROM cs_seasons ORDER BY starts_at DESC');
  const servers = await database.query('SELECT server_id AS serverId,display_name AS name,mode,state,current_map AS currentMap,last_heartbeat AS lastHeartbeat FROM cs_servers ORDER BY display_name');
  const source = values.seasonId ? 'cs_season_stats' : 'cs_player_server_stats';
  const conditions = [];
  const parameters = [];
  if (values.serverId) { conditions.push('s.server_id=?'); parameters.push(values.serverId); }
  if (values.seasonId) { conditions.push('s.season_id=?'); parameters.push(values.seasonId); }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const summaryRows = await database.query(
    `SELECT COUNT(DISTINCT s.steam_id) AS players,COALESCE(SUM(s.kills),0) AS kills,COALESCE(SUM(s.deaths),0) AS deaths,COALESCE(SUM(s.headshots),0) AS headshots,COALESCE(SUM(s.playtime_seconds),0) AS playtimeSeconds,COALESCE(SUM(s.gungame_wins),0) AS gungameWins FROM ${source} s${where}`,
    parameters,
  );
  const ranking = await database.query(
    `SELECT p.steam_id AS steamId,p.current_name AS name,SUM(s.kills) AS kills,SUM(s.deaths) AS deaths,SUM(s.headshots) AS headshots,SUM(s.playtime_seconds) AS playtimeSeconds,SUM(s.gungame_wins) AS gungameWins,ROUND(SUM(s.kills)/GREATEST(SUM(s.deaths),1),2) AS kd FROM ${source} s JOIN cs_players p ON p.steam_id=s.steam_id${where} GROUP BY p.steam_id,p.current_name ORDER BY kills DESC, deaths ASC LIMIT 25`,
    parameters,
  );
  const mapFilter = filter(values.serverId, 'm');
  const maps = await database.query(
    `SELECT m.map_name AS mapName,SUM(m.times_played) AS timesPlayed,SUM(m.rounds_played) AS roundsPlayed,SUM(m.kills) AS kills,SUM(m.player_seconds) AS playerSeconds,MAX(m.last_played) AS lastPlayed FROM cs_map_stats m${mapFilter.sql} GROUP BY m.map_name ORDER BY timesPlayed DESC,lastPlayed DESC LIMIT 12`,
    mapFilter.parameters,
  );
  const sessionFilter = filter(values.serverId, 'x');
  const sessions = await database.query(
    `SELECT x.server_id AS serverId,x.steam_id AS steamId,x.player_name AS name,x.connected_at AS connectedAt,x.disconnected_at AS disconnectedAt,x.playtime_seconds AS playtimeSeconds FROM cs_player_sessions x${sessionFilter.sql} ORDER BY x.connected_at DESC LIMIT 12`,
    sessionFilter.parameters,
  );
  const achievementFilter = filter(values.serverId, 'u');
  const achievements = await database.query(
    `SELECT u.steam_id AS steamId,p.current_name AS name,a.name AS achievement,a.description,u.server_id AS serverId,u.unlocked_at AS unlockedAt FROM cs_player_achievements u JOIN cs_players p ON p.steam_id=u.steam_id JOIN cs_achievements a ON a.code=u.achievement_code${achievementFilter.sql} ORDER BY u.unlocked_at DESC LIMIT 12`,
    achievementFilter.parameters,
  );
  return { summary: summaryRows[0], ranking, maps, sessions, achievements, seasons, servers };
}

export async function playerProfile(database, steamId) {
  if (!/^STEAM_[0-9]+:[01]:[0-9]+$/.test(steamId)) throw new Error('Invalid Steam ID');
  const players = await database.query('SELECT steam_id AS steamId,current_name AS name,first_seen AS firstSeen,last_seen AS lastSeen,total_connections AS totalConnections FROM cs_players WHERE steam_id=?', [steamId]);
  if (!players.length) throw new Error('Player not found');
  const [stats, names, achievements, sessions] = await Promise.all([
    database.query('SELECT server_id AS serverId,kills,deaths,headshots,damage,hits,playtime_seconds AS playtimeSeconds,connections,rounds_played AS roundsPlayed,gungame_wins AS gungameWins,highest_gungame_level AS highestGungameLevel,last_seen AS lastSeen FROM cs_player_server_stats WHERE steam_id=? ORDER BY kills DESC', [steamId]),
    database.query('SELECT player_name AS name,first_seen AS firstSeen,last_seen AS lastSeen,times_seen AS timesSeen FROM cs_player_names WHERE steam_id=? ORDER BY last_seen DESC LIMIT 20', [steamId]),
    database.query('SELECT a.name,a.description,u.server_id AS serverId,u.unlocked_at AS unlockedAt FROM cs_player_achievements u JOIN cs_achievements a ON a.code=u.achievement_code WHERE u.steam_id=? ORDER BY u.unlocked_at DESC', [steamId]),
    database.query('SELECT server_id AS serverId,player_name AS name,connected_at AS connectedAt,disconnected_at AS disconnectedAt,playtime_seconds AS playtimeSeconds FROM cs_player_sessions WHERE steam_id=? ORDER BY connected_at DESC LIMIT 20', [steamId]),
  ]);
  return { player: players[0], stats, names, achievements, sessions };
}

export async function moderationHistory(database) {
  return database.query('SELECT id,server_id AS serverId,action,target_steam_id AS steamId,target_name AS playerName,reason,duration_minutes AS durationMinutes,actor,created_at AS createdAt FROM cs_moderation_actions ORDER BY created_at DESC LIMIT 100');
}

export async function activeBans(database) {
  return database.query(`SELECT id,steam_id AS steamId,scope_server_id AS serverId,player_name AS playerName,reason,issued_by AS issuedBy,issued_at AS issuedAt,expires_at AS expiresAt FROM cs_bans WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP()) ORDER BY issued_at DESC LIMIT 200`);
}

export async function recordModeration(database, event) {
  if (!database.enabled) return;
  await database.transaction(async (connection) => {
    await connection.query('INSERT INTO cs_moderation_actions (server_id,action,target_steam_id,target_name,reason,duration_minutes,actor) VALUES (?,?,?,?,?,?,?)', [event.serverId, event.action, event.steamId, event.name, event.reason, event.minutes ?? null, event.actor || 'CS Control']);
    if (event.action === 'ban') {
      const scopedServer = event.scope === 'server' ? event.serverId : null;
      const expires = event.minutes > 0 ? new Date(Date.now() + event.minutes * 60_000) : null;
      await connection.query('INSERT INTO cs_bans (steam_id,scope_server_id,player_name,reason,issued_by,expires_at) VALUES (?,?,?,?,?,?)', [event.steamId, scopedServer, event.name, event.reason, event.actor || 'CS Control', expires]);
    }
  });
}

export async function revokeBan(database, id, reason = 'Revoked in CS Control') {
  if (!Number.isInteger(id) || id < 1) throw new Error('Invalid ban id');
  const result = await database.query('UPDATE cs_bans SET revoked_at=UTC_TIMESTAMP(),revoked_by=?,revoke_reason=? WHERE id=? AND revoked_at IS NULL', ['CS Control', reason, id]);
  if (!result.affectedRows) throw new Error('Active ban not found');
  await database.query('INSERT INTO cs_moderation_actions (action,reason,actor) VALUES (?,?,?)', ['unban', `${reason} (ban #${id})`, 'CS Control']);
  return { status: 'revoked', id };
}

export async function createSeason(database, input) {
  const name = String(input?.name || '').trim();
  if (name.length < 2 || name.length > 64 || !/^[\p{L}\p{N} ._()\-]+$/u.test(name)) throw new Error('Season name must contain 2-64 safe characters');
  const slug = `season-${Date.now()}`;
  return database.transaction(async (connection) => {
    await connection.query('UPDATE cs_seasons SET active=0,ends_at=COALESCE(ends_at,UTC_TIMESTAMP()) WHERE active=1');
    const result = await connection.query('INSERT INTO cs_seasons (slug,name,starts_at,active) VALUES (?,?,UTC_TIMESTAMP(),1)', [slug, name]);
    return { id: Number(result.insertId), slug, name, active: true };
  });
}

export async function syncDatabaseAdmins(database, serverId, admins) {
  if (!database.enabled) return;
  await database.transaction(async (connection) => {
    await connection.query('DELETE FROM cs_admins WHERE scope_server_id=?', [serverId]);
    for (const admin of admins) {
      await connection.query('INSERT INTO cs_admins (steam_id,scope_server_id,flags,active) VALUES (?,?,?,1)', [admin.steamId, serverId, admin.flags]);
    }
  });
}

export async function syncGlobalAdmins(database, admins) {
  if (!database.enabled) throw new Error('MariaDB is required for fleet-wide admins');
  await database.transaction(async (connection) => {
    await connection.query("DELETE FROM cs_admins WHERE scope_server_id='*'");
    for (const admin of admins) {
      await connection.query("INSERT INTO cs_admins (steam_id,scope_server_id,flags,active) VALUES (?,'*',?,1)", [admin.steamId, admin.flags]);
    }
  });
}

export async function globalAdmins(database) {
  if (!database.enabled) return [];
  return database.query("SELECT steam_id AS steamId,flags FROM cs_admins WHERE scope_server_id='*' AND active=1 ORDER BY steam_id");
}
