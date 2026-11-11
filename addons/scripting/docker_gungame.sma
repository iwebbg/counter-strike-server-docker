#include <amxmodx>
#include <cstrike>
#include <fun>
#include <hamsandwich>

#define PLUGIN "Docker GunGame"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"
#define MAX_LEVELS 21

new const g_weapons[MAX_LEVELS][] = {
    "weapon_glock18", "weapon_usp", "weapon_p228", "weapon_fiveseven",
    "weapon_deagle", "weapon_m3", "weapon_xm1014", "weapon_tmp",
    "weapon_mac10", "weapon_mp5navy", "weapon_ump45", "weapon_p90",
    "weapon_galil", "weapon_famas", "weapon_ak47", "weapon_m4a1",
    "weapon_scout", "weapon_awp", "weapon_m249", "weapon_hegrenade",
    "weapon_knife"
};

new const g_death_names[MAX_LEVELS][] = {
    "glock18", "usp", "p228", "fiveseven", "deagle", "m3", "xm1014",
    "tmp", "mac10", "mp5navy", "ump45", "p90", "galil", "famas",
    "ak47", "m4a1", "scout", "awp", "m249", "grenade", "knife"
};

new const g_bp_ammo[MAX_LEVELS] = {
    120, 100, 52, 100, 35, 32, 32, 120, 100, 120, 100, 100, 90, 90,
    90, 90, 90, 30, 200, 1, 0
};

new const g_ammo_types[MAX_LEVELS] = {
    CSW_GLOCK18, CSW_USP, CSW_P228, CSW_FIVESEVEN, CSW_DEAGLE, CSW_M3,
    CSW_XM1014, CSW_TMP, CSW_MAC10, CSW_MP5NAVY, CSW_UMP45, CSW_P90,
    CSW_GALIL, CSW_FAMAS, CSW_AK47, CSW_M4A1, CSW_SCOUT, CSW_AWP,
    CSW_M249, CSW_HEGRENADE, CSW_KNIFE
};

new g_level[33];
new g_kills[33];
new g_kills_required;
new g_respawn_delay;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_gungame_version", VERSION, FCVAR_SERVER);
    g_kills_required = register_cvar("gg_kills_per_level", "2");
    g_respawn_delay = register_cvar("gg_respawn_delay", "2.0");

    RegisterHam(Ham_Spawn, "player", "on_player_spawn", 1);
    register_event("DeathMsg", "on_death", "a");
    register_logevent("on_round_start", 2, "1=Round_Start");

    register_clcmd("buy", "block_buy");
    register_clcmd("buyequip", "block_buy");
    register_clcmd("cl_autobuy", "block_buy");
    register_clcmd("cl_rebuy", "block_buy");
    register_clcmd("drop", "block_buy");
    register_clcmd("say /level", "show_level");
}

public client_putinserver(id)
{
    g_level[id] = 0;
    g_kills[id] = 0;
}

public client_disconnected(id)
{
    remove_task(id);
    remove_task(id + 100);
    g_level[id] = 0;
    g_kills[id] = 0;
}

public block_buy(id)
{
    client_print(id, print_center, "GunGame: weapons are assigned automatically");
    return PLUGIN_HANDLED;
}

public show_level(id)
{
    client_print(id, print_chat, "[GunGame] Level %d/%d: %s (%d kill(s))",
        g_level[id] + 1, MAX_LEVELS, g_death_names[g_level[id]], g_kills[id]);
    return PLUGIN_HANDLED;
}

public on_round_start()
{
    for (new id = 1; id <= MaxClients; id++) {
        if (is_user_alive(id)) {
            set_task(0.2, "give_level_weapon", id);
        }
    }
}

public on_player_spawn(id)
{
    if (!is_user_alive(id)) {
        return;
    }
    set_task(0.2, "give_level_weapon", id);
}

public give_level_weapon(id)
{
    if (!is_user_alive(id)) {
        return;
    }

    strip_user_weapons(id);
    give_item(id, "weapon_knife");

    new level = clamp(g_level[id], 0, MAX_LEVELS - 1);
    if (level != MAX_LEVELS - 1) {
        give_item(id, g_weapons[level]);
        cs_set_user_bpammo(id, g_ammo_types[level], g_bp_ammo[level]);
    }
}

public on_death()
{
    new killer = read_data(1);
    new victim = read_data(2);

    if (victim >= 1 && victim <= MaxClients && is_user_connected(victim)) {
        set_task(get_pcvar_float(g_respawn_delay), "respawn_player", victim + 100);
    }

    if (killer < 1 || killer > MaxClients || killer == victim || !is_user_connected(killer)) {
        return;
    }

    new weapon[24];
    read_data(4, weapon, charsmax(weapon));

    new level = clamp(g_level[killer], 0, MAX_LEVELS - 1);
    if (!equal(weapon, g_death_names[level])) {
        return;
    }

    if (level == MAX_LEVELS - 1) {
        new name[32];
        get_user_name(killer, name, charsmax(name));
        client_print(0, print_chat, "[GunGame] %s won the match! Restarting...", name);
        set_task(5.0, "restart_match");
        return;
    }

    g_kills[killer]++;
    new required = (level >= MAX_LEVELS - 2) ? 1 : get_pcvar_num(g_kills_required);
    required = max(required, 1);

    if (g_kills[killer] >= required) {
        g_kills[killer] = 0;
        g_level[killer]++;
        client_print(killer, print_chat, "[GunGame] Level up! Now: %s",
            g_death_names[g_level[killer]]);
        give_level_weapon(killer);
    }
}

public respawn_player(task_id)
{
    new id = task_id - 100;
    if (is_user_connected(id) && !is_user_alive(id) &&
        (cs_get_user_team(id) == CS_TEAM_T || cs_get_user_team(id) == CS_TEAM_CT)) {
        ExecuteHamB(Ham_CS_RoundRespawn, id);
    }
}

public restart_match()
{
    for (new id = 1; id <= MaxClients; id++) {
        g_level[id] = 0;
        g_kills[id] = 0;
    }
    server_cmd("sv_restart 1");
}

