#include <amxmodx>
#include <fakemeta>

#define PLUGIN "Docker Double Jump"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"

new g_air_jumps[33];
new g_enabled;
new g_velocity;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_double_jump_version", VERSION, FCVAR_SERVER);
    g_enabled = register_cvar("gg_doublejump_enabled", "1");
    g_velocity = register_cvar("gg_doublejump_velocity", "350.0");
    register_forward(FM_PlayerPreThink, "on_player_prethink");
}

public client_putinserver(id)
{
    g_air_jumps[id] = 0;
}

public client_disconnected(id)
{
    g_air_jumps[id] = 0;
}

public on_player_prethink(id)
{
    if (!get_pcvar_num(g_enabled) || !is_user_alive(id)) {
        return FMRES_IGNORED;
    }

    new flags = pev(id, pev_flags);
    if (flags & FL_ONGROUND) {
        g_air_jumps[id] = 0;
        return FMRES_IGNORED;
    }

    if (pev(id, pev_waterlevel) >= 2 || pev(id, pev_movetype) == MOVETYPE_FLY) {
        return FMRES_IGNORED;
    }

    new buttons = pev(id, pev_button);
    new old_buttons = pev(id, pev_oldbuttons);
    if ((buttons & IN_JUMP) && !(old_buttons & IN_JUMP) && g_air_jumps[id] < 1) {
        new Float:velocity[3];
        pev(id, pev_velocity, velocity);
        velocity[2] = floatclamp(get_pcvar_float(g_velocity), 220.0, 700.0);
        set_pev(id, pev_velocity, velocity);
        g_air_jumps[id]++;
        return FMRES_HANDLED;
    }

    return FMRES_IGNORED;
}

