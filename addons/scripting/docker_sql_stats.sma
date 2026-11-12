#include <amxmodx>
#include <sqlx>

#define PLUGIN "Docker Fleet Data"
#define VERSION "2.0.0"
#define AUTHOR "counter-strike-server-docker"

new Handle:g_tuple = Empty_Handle;
new g_server_id[64];
new g_server_name[96];
new g_server_mode[24];
new g_player_steam[33][40];
new g_player_name[33][64];
new g_connected_at[33];

public plugin_natives()
{
    register_native("docker_stats_gungame_progress", "native_gungame_progress");
}

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_server_id", "cs16-1");
    register_cvar("docker_server_mode", "classic");
    register_event("DeathMsg", "on_death", "a");
    register_event("Damage", "on_damage", "b", "2!0");
    register_logevent("on_round_start", 2, "1=Round_Start");
    set_task(60.0, "heartbeat", 0, "", 0, "b");
}

public plugin_cfg()
{
    new host[64], user[64], pass[64], database[64];
    get_cvar_string("amx_sql_host", host, charsmax(host));
    get_cvar_string("amx_sql_user", user, charsmax(user));
    get_cvar_string("amx_sql_pass", pass, charsmax(pass));
    get_cvar_string("amx_sql_db", database, charsmax(database));
    get_cvar_string("docker_server_id", g_server_id, charsmax(g_server_id));
    get_cvar_string("hostname", g_server_name, charsmax(g_server_name));
    get_cvar_string("docker_server_mode", g_server_mode, charsmax(g_server_mode));

    if (!g_server_id[0]) copy(g_server_id, charsmax(g_server_id), "cs16-1");
    if (!g_server_name[0]) copy(g_server_name, charsmax(g_server_name), "CS 1.6 Server");
    if (!g_server_mode[0]) copy(g_server_mode, charsmax(g_server_mode), "classic");
    sanitize_key(g_server_id, charsmax(g_server_id));
    sanitize_key(g_server_mode, charsmax(g_server_mode));

    g_tuple = SQL_MakeDbTuple(host, user, pass, database);
    register_server();
    register_map();
}

public plugin_end()
{
    if (g_tuple != Empty_Handle) SQL_FreeHandle(g_tuple);
}

public client_authorized(id)
{
    if (is_user_bot(id) || is_user_hltv(id)) return;
    get_user_authid(id, g_player_steam[id], charsmax(g_player_steam[]));
    if (!valid_steam_id(g_player_steam[id])) return;
    set_task(1.0, "register_player", id);
}

public register_player(id)
{
    if (!is_user_connected(id) || !valid_steam_id(g_player_steam[id]) || g_tuple == Empty_Handle) return;
    get_user_name(id, g_player_name[id], charsmax(g_player_name[]));
    g_connected_at[id] = get_systime();

    new name[128], query[1024];
    sql_escape(g_player_name[id], name, charsmax(name));
    formatex(query, charsmax(query), "INSERT INTO cs_players (steam_id,current_name,total_connections) VALUES ('%s','%s',1) ON DUPLICATE KEY UPDATE current_name=VALUES(current_name),last_seen=UTC_TIMESTAMP(),total_connections=total_connections+1", g_player_steam[id], name);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_player_names (steam_id,player_name) VALUES ('%s','%s') ON DUPLICATE KEY UPDATE last_seen=UTC_TIMESTAMP(),times_seen=times_seen+1", g_player_steam[id], name);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_player_server_stats (server_id,steam_id,connections) VALUES ('%s','%s',1) ON DUPLICATE KEY UPDATE connections=connections+1,last_seen=UTC_TIMESTAMP()", g_server_id, g_player_steam[id]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_player_sessions (server_id,steam_id,player_name) VALUES ('%s','%s','%s')", g_server_id, g_player_steam[id], name);
    SQL_ThreadQuery(g_tuple, "query_finished", query);

    new data[1];
    data[0] = id;
    formatex(query, charsmax(query), "SELECT reason FROM cs_bans WHERE steam_id='%s' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP()) AND (scope_server_id IS NULL OR scope_server_id='%s') ORDER BY issued_at DESC LIMIT 1", g_player_steam[id], g_server_id);
    SQL_ThreadQuery(g_tuple, "ban_check_finished", query, data, sizeof(data));
}

public client_infochanged(id)
{
    if (!is_user_connected(id) || !valid_steam_id(g_player_steam[id]) || g_tuple == Empty_Handle) return;
    new name[64];
    get_user_info(id, "name", name, charsmax(name));
    if (!name[0] || equal(name, g_player_name[id])) return;
    copy(g_player_name[id], charsmax(g_player_name[]), name);

    new escaped[128], query[768];
    sql_escape(name, escaped, charsmax(escaped));
    formatex(query, charsmax(query), "UPDATE cs_players SET current_name='%s',last_seen=UTC_TIMESTAMP() WHERE steam_id='%s'", escaped, g_player_steam[id]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_player_names (steam_id,player_name) VALUES ('%s','%s') ON DUPLICATE KEY UPDATE last_seen=UTC_TIMESTAMP(),times_seen=times_seen+1", g_player_steam[id], escaped);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

public client_disconnected(id)
{
    remove_task(id);
    if (!valid_steam_id(g_player_steam[id]) || g_tuple == Empty_Handle) {
        clear_player(id);
        return;
    }

    new played = max(0, get_systime() - g_connected_at[id]);
    new map[64], query[1024];
    get_mapname(map, charsmax(map));
    sanitize_key(map, charsmax(map));
    formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET playtime_seconds=playtime_seconds+%d,last_seen=UTC_TIMESTAMP() WHERE server_id='%s' AND steam_id='%s'", played, g_server_id, g_player_steam[id]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "UPDATE cs_player_sessions SET disconnected_at=UTC_TIMESTAMP(),playtime_seconds=%d WHERE server_id='%s' AND steam_id='%s' AND disconnected_at IS NULL ORDER BY id DESC LIMIT 1", played, g_server_id, g_player_steam[id]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "UPDATE cs_map_stats SET player_seconds=player_seconds+%d,last_played=UTC_TIMESTAMP() WHERE server_id='%s' AND map_name='%s'", played, g_server_id, map);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_season_stats (season_id,server_id,steam_id,playtime_seconds) SELECT id,'%s','%s',%d FROM cs_seasons WHERE active=1 ON DUPLICATE KEY UPDATE playtime_seconds=playtime_seconds+VALUES(playtime_seconds)", g_server_id, g_player_steam[id], played);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    unlock_achievements(g_player_steam[id]);
    clear_player(id);
}

public on_death()
{
    if (g_tuple == Empty_Handle) return;
    new killer = read_data(1), victim = read_data(2), headshot = read_data(3) ? 1 : 0;
    new query[1024], map[64];
    get_mapname(map, charsmax(map));
    sanitize_key(map, charsmax(map));

    if (victim > 0 && valid_steam_id(g_player_steam[victim])) {
        formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET deaths=deaths+1,last_seen=UTC_TIMESTAMP() WHERE server_id='%s' AND steam_id='%s'", g_server_id, g_player_steam[victim]);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
        formatex(query, charsmax(query), "INSERT INTO cs_season_stats (season_id,server_id,steam_id,deaths) SELECT id,'%s','%s',1 FROM cs_seasons WHERE active=1 ON DUPLICATE KEY UPDATE deaths=deaths+1", g_server_id, g_player_steam[victim]);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
    }
    if (killer > 0 && killer != victim && valid_steam_id(g_player_steam[killer])) {
        formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET kills=kills+1,headshots=headshots+%d,last_seen=UTC_TIMESTAMP() WHERE server_id='%s' AND steam_id='%s'", headshot, g_server_id, g_player_steam[killer]);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
        formatex(query, charsmax(query), "INSERT INTO cs_season_stats (season_id,server_id,steam_id,kills,headshots) SELECT id,'%s','%s',1,%d FROM cs_seasons WHERE active=1 ON DUPLICATE KEY UPDATE kills=kills+1,headshots=headshots+%d", g_server_id, g_player_steam[killer], headshot, headshot);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
        formatex(query, charsmax(query), "UPDATE cs_map_stats SET kills=kills+1,last_played=UTC_TIMESTAMP() WHERE server_id='%s' AND map_name='%s'", g_server_id, map);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
        unlock_achievements(g_player_steam[killer]);
    }
}

public on_damage(victim)
{
    if (g_tuple == Empty_Handle) return;
    new attacker = get_user_attacker(victim);
    if (attacker < 1 || attacker > MaxClients || attacker == victim || !valid_steam_id(g_player_steam[attacker])) return;
    new damage = read_data(2);
    if (damage <= 0) return;
    new query[768];
    formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET damage=damage+%d,hits=hits+1,last_seen=UTC_TIMESTAMP() WHERE server_id='%s' AND steam_id='%s'", damage, g_server_id, g_player_steam[attacker]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "INSERT INTO cs_season_stats (season_id,server_id,steam_id,damage) SELECT id,'%s','%s',%d FROM cs_seasons WHERE active=1 ON DUPLICATE KEY UPDATE damage=damage+%d", g_server_id, g_player_steam[attacker], damage, damage);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

public on_round_start()
{
    if (g_tuple == Empty_Handle) return;
    new map[64], query[512];
    get_mapname(map, charsmax(map));
    sanitize_key(map, charsmax(map));
    formatex(query, charsmax(query), "UPDATE cs_map_stats SET rounds_played=rounds_played+1,last_played=UTC_TIMESTAMP() WHERE server_id='%s' AND map_name='%s'", g_server_id, map);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    for (new id = 1; id <= MaxClients; id++) {
        if (!is_user_connected(id) || !valid_steam_id(g_player_steam[id])) continue;
        formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET rounds_played=rounds_played+1 WHERE server_id='%s' AND steam_id='%s'", g_server_id, g_player_steam[id]);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
    }
}

public heartbeat()
{
    if (g_tuple != Empty_Handle) register_server();
}

public native_gungame_progress(plugin_id, params)
{
    if (params < 3 || g_tuple == Empty_Handle) return 0;
    new id = get_param(1), level = clamp(get_param(2), 0, 21), won = get_param(3) ? 1 : 0;
    if (id < 1 || id > MaxClients || !valid_steam_id(g_player_steam[id])) return 0;
    new query[1024];
    formatex(query, charsmax(query), "INSERT INTO cs_gungame_progress (server_id,steam_id,current_level,highest_level,wins) VALUES ('%s','%s',%d,%d,%d) ON DUPLICATE KEY UPDATE current_level=VALUES(current_level),highest_level=GREATEST(highest_level,VALUES(highest_level)),wins=wins+%d", g_server_id, g_player_steam[id], level, level, won, won);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    formatex(query, charsmax(query), "UPDATE cs_player_server_stats SET highest_gungame_level=GREATEST(highest_gungame_level,%d),gungame_wins=gungame_wins+%d WHERE server_id='%s' AND steam_id='%s'", level, won, g_server_id, g_player_steam[id]);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
    if (won) {
        formatex(query, charsmax(query), "INSERT INTO cs_season_stats (season_id,server_id,steam_id,gungame_wins) SELECT id,'%s','%s',1 FROM cs_seasons WHERE active=1 ON DUPLICATE KEY UPDATE gungame_wins=gungame_wins+1", g_server_id, g_player_steam[id]);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
        unlock_achievements(g_player_steam[id]);
    }
    return 1;
}

register_server()
{
    new name[192], map[64], query[1024];
    sql_escape(g_server_name, name, charsmax(name));
    get_mapname(map, charsmax(map));
    sanitize_key(map, charsmax(map));
    formatex(query, charsmax(query), "INSERT INTO cs_servers (server_id,display_name,mode,max_players,state,current_map) VALUES ('%s','%s','%s',%d,'online','%s') ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),state='online',current_map=VALUES(current_map),last_heartbeat=UTC_TIMESTAMP()", g_server_id, name, g_server_mode, get_maxplayers(), map);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

register_map()
{
    new map[64], query[512];
    get_mapname(map, charsmax(map));
    sanitize_key(map, charsmax(map));
    formatex(query, charsmax(query), "INSERT INTO cs_map_stats (server_id,map_name,times_played) VALUES ('%s','%s',1) ON DUPLICATE KEY UPDATE times_played=times_played+1,last_played=UTC_TIMESTAMP()", g_server_id, map);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

unlock_achievements(const steam_id[])
{
    new query[768];
    unlock_metric(steam_id, "kills", "kills", query, charsmax(query));
    unlock_metric(steam_id, "headshots", "headshots", query, charsmax(query));
    unlock_metric(steam_id, "playtime_seconds", "playtime_seconds", query, charsmax(query));
    unlock_metric(steam_id, "gungame_wins", "gungame_wins", query, charsmax(query));
}

unlock_metric(const steam_id[], const metric[], const column[], query[], query_len)
{
    formatex(query, query_len, "INSERT IGNORE INTO cs_player_achievements (steam_id,achievement_code,server_id) SELECT s.steam_id,a.code,s.server_id FROM cs_player_server_stats s JOIN cs_achievements a ON a.metric='%s' AND s.%s>=a.threshold_value WHERE s.server_id='%s' AND s.steam_id='%s'", metric, column, g_server_id, steam_id);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

public ban_check_finished(fail_state, Handle:query, error[], error_code, data[], data_size)
{
    if (fail_state != TQUERY_SUCCESS) {
        log_amx("Fleet ban SQL error %d: %s", error_code, error);
        return;
    }
    if (SQL_NumResults(query) < 1) return;
    new id = data[0];
    if (!is_user_connected(id)) return;
    new reason[128];
    SQL_ReadResult(query, 0, reason, charsmax(reason));
    server_cmd("kick #%d ^"Fleet ban: %s^"", get_user_userid(id), reason);
}

public query_finished(fail_state, Handle:query, error[], error_code, data[], data_size)
{
    if (fail_state != TQUERY_SUCCESS) log_amx("Fleet data SQL error %d: %s", error_code, error);
}

clear_player(id)
{
    g_player_steam[id][0] = 0;
    g_player_name[id][0] = 0;
    g_connected_at[id] = 0;
}

bool:valid_steam_id(const value[])
{
    return contain(value, "STEAM_") == 0 && !equal(value, "STEAM_ID_PENDING") && !equal(value, "STEAM_ID_LAN");
}

sql_escape(const input[], output[], len)
{
    new position = 0;
    for (new i = 0; input[i] && position < len; i++) {
        if ((input[i] == 92 || input[i] == 39) && position < len - 1) output[position++] = 92;
        output[position++] = input[i];
    }
    output[position] = 0;
}

sanitize_key(value[], len)
{
    for (new i = 0; i < len && value[i]; i++) {
        if (!((value[i] >= 'A' && value[i] <= 'Z') ||
              (value[i] >= 'a' && value[i] <= 'z') ||
              (value[i] >= '0' && value[i] <= '9') ||
               value[i] == '_' || value[i] == '-')) value[i] = '_';
    }
}
