#include <amxmodx>
#include <cstrike>
#include <fakemeta>
#include <fun>
#include <hamsandwich>

#define PLUGIN "Docker Gameplay Pack"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"
#define TASK_PROTECTION 1000
#define TASK_WARMUP_RESPAWN 2000
#define TASK_WARMUP 9001
#define TASK_AFK 9002

new g_warmup_enabled;
new g_warmup_seconds;
new g_warmup_active;
new g_spawn_enabled;
new g_spawn_seconds;
new g_semiclip_enabled;
new g_afk_enabled;
new g_afk_warn;
new g_afk_spectator;
new g_afk_kick;

new bool:g_protected[33];
new bool:g_restore_solid[33];
new bool:g_afk_warned[33];
new Float:g_last_activity[33];
new Float:g_last_angles[33][3];
new g_warmup_left;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_gameplay_version", VERSION, FCVAR_SERVER);

    g_warmup_enabled = register_cvar("docker_warmup_enabled", "1");
    g_warmup_seconds = register_cvar("docker_warmup_seconds", "45");
    g_warmup_active = register_cvar("docker_warmup_active", "0", FCVAR_SERVER);
    g_spawn_enabled = register_cvar("docker_spawn_protection_enabled", "1");
    g_spawn_seconds = register_cvar("docker_spawn_protection_seconds", "3.0");
    g_semiclip_enabled = register_cvar("docker_semiclip_enabled", "1");
    g_afk_enabled = register_cvar("docker_afk_enabled", "1");
    g_afk_warn = register_cvar("docker_afk_warn_seconds", "60");
    g_afk_spectator = register_cvar("docker_afk_spectator_seconds", "90");
    g_afk_kick = register_cvar("docker_afk_kick_seconds", "180");

    RegisterHam(Ham_Spawn, "player", "on_spawn", 1);
    register_event("DeathMsg", "on_death", "a");
    register_forward(FM_CmdStart, "on_cmd_start");
    register_forward(FM_PlayerPreThink, "on_prethink");
    register_forward(FM_PlayerPostThink, "on_postthink");

    set_task(5.0, "check_afk", TASK_AFK, "", 0, "b");
}

public plugin_cfg()
{
    if (get_pcvar_num(g_warmup_enabled) && get_pcvar_num(g_warmup_seconds) > 0) {
        set_task(1.0, "start_warmup");
    }
}

public client_putinserver(id)
{
    g_last_activity[id] = get_gametime();
    g_afk_warned[id] = false;
    pev(id, pev_v_angle, g_last_angles[id]);
}

public client_disconnected(id)
{
    remove_task(id + TASK_PROTECTION);
    remove_task(id + TASK_WARMUP_RESPAWN);
    g_protected[id] = false;
    g_restore_solid[id] = false;
    g_afk_warned[id] = false;
}

public start_warmup()
{
    g_warmup_left = get_pcvar_num(g_warmup_seconds);
    set_pcvar_num(g_warmup_active, 1);
    client_print(0, print_chat, "[Warmup] Practice started for %d seconds. Kills do not count.", g_warmup_left);
    set_task(1.0, "warmup_tick", TASK_WARMUP, "", 0, "b");
}

public warmup_tick()
{
    g_warmup_left--;
    if (g_warmup_left <= 0) {
        remove_task(TASK_WARMUP);
        set_pcvar_num(g_warmup_active, 0);
        client_print(0, print_chat, "[Warmup] Finished. The live match starts now!");
        server_cmd("sv_restartround 1");
        return;
    }

    if (g_warmup_left <= 10 || g_warmup_left % 15 == 0) {
        set_hudmessage(201, 255, 74, -1.0, 0.25, 0, 0.0, 1.1, 0.0, 0.0);
        show_hudmessage(0, "WARMUP: %d", g_warmup_left);
    }
}

public on_death()
{
    if (!get_pcvar_num(g_warmup_active)) {
        return;
    }

    new victim = read_data(2);
    if (victim >= 1 && victim <= MaxClients && is_user_connected(victim)) {
        set_task(1.0, "warmup_respawn", victim + TASK_WARMUP_RESPAWN);
    }
}

public warmup_respawn(task_id)
{
    new id = task_id - TASK_WARMUP_RESPAWN;
    if (get_pcvar_num(g_warmup_active) && is_user_connected(id) && !is_user_alive(id)) {
        new CsTeams:team = cs_get_user_team(id);
        if (team == CS_TEAM_T || team == CS_TEAM_CT) {
            ExecuteHamB(Ham_CS_RoundRespawn, id);
        }
    }
}

public on_spawn(id)
{
    if (!is_user_alive(id) || !get_pcvar_num(g_spawn_enabled)) {
        return;
    }

    remove_task(id + TASK_PROTECTION);
    g_protected[id] = true;
    set_user_godmode(id, 1);
    set_user_rendering(id, kRenderFxGlowShell, 80, 220, 190, kRenderNormal, 12);
    set_task(get_pcvar_float(g_spawn_seconds), "end_protection", id + TASK_PROTECTION);
}

public end_protection(task_id)
{
    new id = task_id - TASK_PROTECTION;
    if (!is_user_connected(id)) {
        return;
    }
    g_protected[id] = false;
    set_user_godmode(id, 0);
    set_user_rendering(id);
}

public on_cmd_start(id, uc_handle)
{
    if (!is_user_connected(id)) {
        return FMRES_IGNORED;
    }

    new buttons = get_uc(uc_handle, UC_Buttons);
    new Float:angles[3];
    pev(id, pev_v_angle, angles);
    if (buttons || floatabs(angles[0] - g_last_angles[id][0]) > 1.0 ||
        floatabs(angles[1] - g_last_angles[id][1]) > 1.0) {
        g_last_activity[id] = get_gametime();
        g_afk_warned[id] = false;
        g_last_angles[id][0] = angles[0];
        g_last_angles[id][1] = angles[1];
        g_last_angles[id][2] = angles[2];
    }

    if (g_protected[id] && (buttons & (IN_ATTACK | IN_ATTACK2))) {
        remove_task(id + TASK_PROTECTION);
        end_protection(id + TASK_PROTECTION);
    }
    return FMRES_IGNORED;
}

public on_prethink(id)
{
    if (!get_pcvar_num(g_semiclip_enabled) || !is_user_alive(id)) {
        return FMRES_IGNORED;
    }

    new CsTeams:team = cs_get_user_team(id);
    for (new player = 1; player <= MaxClients; player++) {
        if (player != id && is_user_alive(player) && cs_get_user_team(player) == team) {
            set_pev(player, pev_solid, SOLID_NOT);
            g_restore_solid[player] = true;
        }
    }
    return FMRES_IGNORED;
}

public on_postthink(id)
{
    if (!get_pcvar_num(g_semiclip_enabled) || !is_user_alive(id)) {
        return FMRES_IGNORED;
    }

    for (new player = 1; player <= MaxClients; player++) {
        if (g_restore_solid[player] && is_user_connected(player)) {
            set_pev(player, pev_solid, SOLID_SLIDEBOX);
            g_restore_solid[player] = false;
        }
    }
    return FMRES_IGNORED;
}

public check_afk()
{
    if (!get_pcvar_num(g_afk_enabled)) {
        return;
    }

    new Float:now = get_gametime();
    new warn_after = get_pcvar_num(g_afk_warn);
    new spectator_after = get_pcvar_num(g_afk_spectator);
    new kick_after = get_pcvar_num(g_afk_kick);

    for (new id = 1; id <= MaxClients; id++) {
        if (!is_user_connected(id) || is_user_bot(id) || (get_user_flags(id) & ADMIN_IMMUNITY)) {
            continue;
        }
        new idle = floatround(now - g_last_activity[id]);
        if (idle >= kick_after && cs_get_user_team(id) == CS_TEAM_SPECTATOR) {
            server_cmd("kick #%d ^"AFK for too long^"", get_user_userid(id));
        } else if (idle >= spectator_after && (cs_get_user_team(id) == CS_TEAM_T || cs_get_user_team(id) == CS_TEAM_CT)) {
            if (is_user_alive(id)) {
                user_silentkill(id);
            }
            cs_set_user_team(id, CS_TEAM_SPECTATOR);
            client_print(id, print_chat, "[AFK] You were moved to Spectator.");
        } else if (idle >= warn_after && !g_afk_warned[id]) {
            g_afk_warned[id] = true;
            client_print(id, print_chat, "[AFK] Move or you will be sent to Spectator.");
        }
    }
}
