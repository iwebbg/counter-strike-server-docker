#include <amxmodx>
#include <amxmisc>
#include <cstrike>
#include <fakemeta>

#define PLUGIN "Docker Community Tools"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"
#define TASK_BALANCE 7710

new g_balance_enabled;
new g_scramble_enabled;
new g_scramble_streak;
new g_radio_enabled;
new g_radio_limit;
new g_radio_window;
new g_rules;
new g_community_url;
new g_kills[33];
new g_deaths[33];
new Float:g_gag_until[33];
new Float:g_mute_until[33];
new Float:g_radio_window_started[33];
new Float:g_radio_blocked_until[33];
new g_radio_count[33];
new g_winning_team;
new g_win_streak;
new bool:g_scramble_pending;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_community_version", VERSION, FCVAR_SERVER);
    g_balance_enabled = register_cvar("docker_team_balance_enabled", "1");
    g_scramble_enabled = register_cvar("docker_team_scramble_enabled", "1");
    g_scramble_streak = register_cvar("docker_team_scramble_streak", "5");
    g_radio_enabled = register_cvar("docker_radio_protection_enabled", "1");
    g_radio_limit = register_cvar("docker_radio_limit", "4");
    g_radio_window = register_cvar("docker_radio_window", "5.0");
    g_rules = register_cvar("docker_server_rules", "Respect players; no cheating; no abuse; follow admin instructions.");
    g_community_url = register_cvar("docker_community_url", "https://interweb.bg");

    register_event("DeathMsg", "on_death", "a");
    register_event("HLTV", "on_new_round", "a", "1=0", "2=0");
    register_event("SendAudio", "terrorists_win", "a", "2=%!MRAD_terwin");
    register_event("SendAudio", "cts_win", "a", "2=%!MRAD_ctwin");
    register_logevent("on_round_end", 2, "1=Round_End");
    register_forward(FM_Voice_SetClientListening, "voice_listening");

    register_clcmd("say", "handle_say");
    register_clcmd("say_team", "handle_say");
    register_concmd("amx_gag", "command_gag", ADMIN_KICK, "<name/#userid> [minutes]");
    register_concmd("amx_ungag", "command_ungag", ADMIN_KICK, "<name/#userid>");
    register_concmd("amx_mute", "command_mute", ADMIN_KICK, "<name/#userid> [minutes]");
    register_concmd("amx_unmute", "command_unmute", ADMIN_KICK, "<name/#userid>");

    new const radio_commands[][] = {
        "radio1", "radio2", "radio3", "coverme", "takepoint", "holdpos", "regroup", "followme",
        "takingfire", "go", "fallback", "sticktog", "getinpos", "stormfront", "report", "roger",
        "enemyspot", "needbackup", "sectorclear", "inposition", "reportingin", "getout", "negative",
        "enemydown"
    };
    for (new index = 0; index < sizeof radio_commands; index++) {
        register_clcmd(radio_commands[index], "handle_radio");
    }
}

public client_putinserver(id)
{
    reset_player(id);
    if (get_pcvar_num(g_balance_enabled)) set_task(5.0, "balance_teams", TASK_BALANCE);
}

public client_disconnected(id)
{
    reset_player(id);
    if (get_pcvar_num(g_balance_enabled)) set_task(2.0, "balance_teams", TASK_BALANCE);
}

reset_player(id)
{
    g_kills[id] = 0;
    g_deaths[id] = 0;
    g_gag_until[id] = 0.0;
    g_mute_until[id] = 0.0;
    g_radio_window_started[id] = 0.0;
    g_radio_blocked_until[id] = 0.0;
    g_radio_count[id] = 0;
}

public on_death()
{
    new killer = read_data(1);
    new victim = read_data(2);
    if (victim >= 1 && victim <= MaxClients) g_deaths[victim]++;
    if (killer >= 1 && killer <= MaxClients && killer != victim) g_kills[killer]++;
}

public terrorists_win() record_win(1);
public cts_win() record_win(2);

record_win(team)
{
    if (team == g_winning_team) g_win_streak++;
    else {
        g_winning_team = team;
        g_win_streak = 1;
    }
    if (get_pcvar_num(g_scramble_enabled) && g_win_streak >= get_pcvar_num(g_scramble_streak)) {
        g_scramble_pending = true;
        g_win_streak = 0;
        client_print(0, print_chat, "[Teams] One-sided streak detected. Teams will be scrambled next round.");
    }
}

public on_round_end()
{
    if (get_pcvar_num(g_balance_enabled)) set_task(1.0, "balance_teams", TASK_BALANCE);
}

public on_new_round()
{
    if (!g_scramble_pending || !get_pcvar_num(g_scramble_enabled)) return;
    g_scramble_pending = false;
    new next_team = 1;
    for (new id = 1; id <= MaxClients; id++) {
        if (!is_user_connected(id) || is_user_bot(id) || is_user_hltv(id)) continue;
        new CsTeams:team = cs_get_user_team(id);
        if (team != CS_TEAM_T && team != CS_TEAM_CT) continue;
        if (is_user_alive(id)) user_silentkill(id);
        cs_set_user_team(id, next_team == 1 ? CS_TEAM_T : CS_TEAM_CT);
        next_team = next_team == 1 ? 2 : 1;
    }
    client_print(0, print_chat, "[Teams] Teams were scrambled after a one-sided streak.");
    server_cmd("sv_restartround 1");
}

public balance_teams()
{
    remove_task(TASK_BALANCE);
    if (!get_pcvar_num(g_balance_enabled)) return;
    new terrorists, counter_terrorists;
    for (new id = 1; id <= MaxClients; id++) {
        if (!is_user_connected(id)) continue;
        new CsTeams:team = cs_get_user_team(id);
        if (team == CS_TEAM_T) terrorists++;
        else if (team == CS_TEAM_CT) counter_terrorists++;
    }
    if (abs(terrorists - counter_terrorists) < 2) return;
    new CsTeams:large_team = terrorists > counter_terrorists ? CS_TEAM_T : CS_TEAM_CT;
    new candidate;
    new Float:lowest_ratio = 999999.0;
    for (new id = 1; id <= MaxClients; id++) {
        if (!is_user_connected(id) || cs_get_user_team(id) != large_team || (get_user_flags(id) & ADMIN_IMMUNITY)) continue;
        new Float:ratio = float(g_kills[id] + 1) / float(g_deaths[id] + 1);
        if (ratio < lowest_ratio) {
            lowest_ratio = ratio;
            candidate = id;
        }
    }
    if (!candidate) return;
    if (is_user_alive(candidate)) user_silentkill(candidate);
    cs_set_user_team(candidate, large_team == CS_TEAM_T ? CS_TEAM_CT : CS_TEAM_T);
    new name[32];
    get_user_name(candidate, name, charsmax(name));
    client_print(0, print_chat, "[Teams] %s was moved to keep teams balanced.", name);
}

public handle_say(id)
{
    new message[192];
    read_args(message, charsmax(message));
    remove_quotes(message);
    if (equali(message, "/rules") || equali(message, "rules")) {
        new rules[256];
        get_pcvar_string(g_rules, rules, charsmax(rules));
        client_print(id, print_chat, "[Rules] %s", rules);
        return PLUGIN_HANDLED;
    }
    if (equali(message, "/help") || equali(message, "help")) {
        new url[160];
        get_pcvar_string(g_community_url, url, charsmax(url));
        client_print(id, print_chat, "[Help] Commands: /rank, /top15, /stats, /statsme, /rules, /rtv, /nominate.");
        client_print(id, print_chat, "[Help] Community and support: %s", url);
        return PLUGIN_HANDLED;
    }
    if (is_restricted(g_gag_until[id])) {
        client_print(id, print_chat, "[Moderation] You are gagged for another %d second(s).", remaining(g_gag_until[id]));
        return PLUGIN_HANDLED;
    }
    return PLUGIN_CONTINUE;
}

public handle_radio(id)
{
    if (is_restricted(g_gag_until[id])) return PLUGIN_HANDLED;
    if (!get_pcvar_num(g_radio_enabled)) return PLUGIN_CONTINUE;
    new Float:now = get_gametime();
    if (g_radio_blocked_until[id] > now) return PLUGIN_HANDLED;
    if (now - g_radio_window_started[id] > get_pcvar_float(g_radio_window)) {
        g_radio_window_started[id] = now;
        g_radio_count[id] = 0;
    }
    g_radio_count[id]++;
    if (g_radio_count[id] > get_pcvar_num(g_radio_limit)) {
        g_radio_blocked_until[id] = now + 10.0;
        client_print(id, print_chat, "[Radio] Flood protection: radio is blocked for 10 seconds.");
        return PLUGIN_HANDLED;
    }
    return PLUGIN_CONTINUE;
}

public voice_listening(receiver, sender, bool:listen)
{
    if (receiver == sender || !is_user_connected(sender) || !is_restricted(g_mute_until[sender])) return FMRES_IGNORED;
    engfunc(EngFunc_SetClientListening, receiver, sender, 0);
    return FMRES_SUPERCEDE;
}

public command_gag(id, level, cid) return restriction_command(id, level, cid, true, false);
public command_mute(id, level, cid) return restriction_command(id, level, cid, false, false);
public command_ungag(id, level, cid) return restriction_command(id, level, cid, true, true);
public command_unmute(id, level, cid) return restriction_command(id, level, cid, false, true);

restriction_command(id, level, cid, bool:gag, bool:remove)
{
    if (!cmd_access(id, level, cid, 2)) return PLUGIN_HANDLED;
    new target_argument[32], minutes_argument[12];
    read_argv(1, target_argument, charsmax(target_argument));
    read_argv(2, minutes_argument, charsmax(minutes_argument));
    new target = cmd_target(id, target_argument, CMDTARGET_ALLOW_SELF);
    if (!target) return PLUGIN_HANDLED;
    new minutes = clamp(str_to_num(minutes_argument), 1, 1440);
    if (!minutes_argument[0]) minutes = 10;
    if (gag) g_gag_until[target] = remove ? 0.0 : get_gametime() + float(minutes * 60);
    else g_mute_until[target] = remove ? 0.0 : get_gametime() + float(minutes * 60);
    new target_name[32], admin_name[32];
    get_user_name(target, target_name, charsmax(target_name));
    get_user_name(id, admin_name, charsmax(admin_name));
    client_print(0, print_chat, "[Moderation] %s %s %s%s.", admin_name, remove ? "removed" : "applied", gag ? "gag for " : "voice mute for ", remove ? target_name : target_name);
    return PLUGIN_HANDLED;
}

bool:is_restricted(Float:until)
{
    return until > get_gametime();
}

remaining(Float:until)
{
    return max(1, floatround(until - get_gametime(), floatround_ceil));
}
