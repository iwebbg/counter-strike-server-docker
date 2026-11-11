#include <amxmodx>
#include <sqlx>

#define PLUGIN "Docker SQL Stats"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"

new Handle:g_tuple = Empty_Handle;
new g_server_id[64];

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_server_id", "cs16-1");
    register_event("DeathMsg", "on_death", "a");
}

public plugin_cfg()
{
    new host[64], user[64], pass[64], database[64];
    get_cvar_string("amx_sql_host", host, charsmax(host));
    get_cvar_string("amx_sql_user", user, charsmax(user));
    get_cvar_string("amx_sql_pass", pass, charsmax(pass));
    get_cvar_string("amx_sql_db", database, charsmax(database));
    get_cvar_string("docker_server_id", g_server_id, charsmax(g_server_id));
    if (!g_server_id[0]) {
        copy(g_server_id, charsmax(g_server_id), "cs16-1");
    }
    sanitize_key(g_server_id, charsmax(g_server_id));

    g_tuple = SQL_MakeDbTuple(host, user, pass, database);
    SQL_ThreadQuery(g_tuple, "query_finished", "CREATE TABLE IF NOT EXISTS cs_player_stats (server_id VARCHAR(64) NOT NULL, steam_id VARCHAR(40) NOT NULL, kills INT UNSIGNED NOT NULL DEFAULT 0, deaths INT UNSIGNED NOT NULL DEFAULT 0, last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (server_id, steam_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

public plugin_end()
{
    if (g_tuple != Empty_Handle) {
        SQL_FreeHandle(g_tuple);
    }
}

public client_authorized(id)
{
    if (g_tuple == Empty_Handle || is_user_bot(id) || is_user_hltv(id)) {
        return;
    }

    new steam_id[40], query[512];
    get_user_authid(id, steam_id, charsmax(steam_id));
    sanitize_id(steam_id, charsmax(steam_id));
    formatex(query, charsmax(query), "INSERT INTO cs_player_stats (server_id, steam_id) VALUES ('%s','%s') ON DUPLICATE KEY UPDATE last_seen=CURRENT_TIMESTAMP", g_server_id, steam_id);
    SQL_ThreadQuery(g_tuple, "query_finished", query);
}

public on_death()
{
    if (g_tuple == Empty_Handle) {
        return;
    }

    new killer = read_data(1);
    new victim = read_data(2);
    new query[512], steam_id[40];

    if (victim > 0 && !is_user_bot(victim) && !is_user_hltv(victim)) {
        get_user_authid(victim, steam_id, charsmax(steam_id));
        sanitize_id(steam_id, charsmax(steam_id));
        formatex(query, charsmax(query), "INSERT INTO cs_player_stats (server_id, steam_id, deaths) VALUES ('%s','%s',1) ON DUPLICATE KEY UPDATE deaths=deaths+1, last_seen=CURRENT_TIMESTAMP", g_server_id, steam_id);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
    }

    if (killer > 0 && killer != victim && !is_user_bot(killer) && !is_user_hltv(killer)) {
        get_user_authid(killer, steam_id, charsmax(steam_id));
        sanitize_id(steam_id, charsmax(steam_id));
        formatex(query, charsmax(query), "INSERT INTO cs_player_stats (server_id, steam_id, kills) VALUES ('%s','%s',1) ON DUPLICATE KEY UPDATE kills=kills+1, last_seen=CURRENT_TIMESTAMP", g_server_id, steam_id);
        SQL_ThreadQuery(g_tuple, "query_finished", query);
    }
}

public query_finished(fail_state, Handle:query, error[], error_code, data[], data_size)
{
    if (fail_state != TQUERY_SUCCESS) {
        log_amx("SQL error %d: %s", error_code, error);
    }
}

sanitize_id(value[], len)
{
    for (new i = 0; i < len && value[i]; i++) {
        if (!((value[i] >= 'A' && value[i] <= 'Z') ||
              (value[i] >= '0' && value[i] <= '9') ||
               value[i] == '_' || value[i] == ':')) {
            value[i] = '_';
        }
    }
}

sanitize_key(value[], len)
{
    for (new i = 0; i < len && value[i]; i++) {
        if (!((value[i] >= 'A' && value[i] <= 'Z') ||
              (value[i] >= 'a' && value[i] <= 'z') ||
              (value[i] >= '0' && value[i] <= '9') ||
               value[i] == '_' || value[i] == '-')) {
            value[i] = '_';
        }
    }
}

