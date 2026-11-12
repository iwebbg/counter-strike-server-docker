#include <amxmodx>
#include <cstrike>

#define PLUGIN "Docker Kill Streaks"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"

enum _:Announcement
{
    FIRST_BLOOD = 0,
    DOUBLE_KILL,
    MULTI_KILL,
    ULTRA_KILL,
    MONSTER_KILL,
    KILLING_SPREE,
    RAMPAGE,
    DOMINATING,
    UNSTOPPABLE,
    GODLIKE
};

new const g_sound_files[][] =
{
    "cs16/killstreak/first_blood.wav",
    "cs16/killstreak/double_kill.wav",
    "cs16/killstreak/multi_kill.wav",
    "cs16/killstreak/ultra_kill.wav",
    "cs16/killstreak/monster_kill.wav",
    "cs16/killstreak/killing_spree.wav",
    "cs16/killstreak/rampage.wav",
    "cs16/killstreak/dominating.wav",
    "cs16/killstreak/unstoppable.wav",
    "cs16/killstreak/godlike.wav"
};

new const g_labels[][] =
{
    "FIRST BLOOD",
    "DOUBLE KILL",
    "MULTI KILL",
    "ULTRA KILL",
    "MONSTER KILL",
    "KILLING SPREE",
    "RAMPAGE",
    "DOMINATING",
    "UNSTOPPABLE",
    "GODLIKE"
};

new g_enabled;
new g_sounds_enabled;
new g_hud_enabled;
new g_global_announce;
new g_multi_window;
new g_streak[33];
new g_multi[33];
new Float:g_last_kill[33];
new bool:g_first_blood;

public plugin_precache()
{
    for (new index = 0; index < sizeof g_sound_files; index++) {
        precache_sound(g_sound_files[index]);
    }
}

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_killstreak_version", VERSION, FCVAR_SERVER);

    g_enabled = register_cvar("docker_killstreak_enabled", "1");
    g_sounds_enabled = register_cvar("docker_killstreak_sounds_enabled", "1");
    g_hud_enabled = register_cvar("docker_killstreak_hud_enabled", "1");
    g_global_announce = register_cvar("docker_killstreak_global", "1");
    g_multi_window = register_cvar("docker_killstreak_multi_window", "4.0");

    register_event("DeathMsg", "on_death", "a");
    register_logevent("on_round_start", 2, "1=Round_Start");
}

public client_putinserver(id)
{
    reset_player(id);
}

public client_disconnected(id)
{
    reset_player(id);
}

public on_round_start()
{
    g_first_blood = false;
    for (new id = 1; id <= MaxClients; id++) {
        g_multi[id] = 0;
        g_last_kill[id] = 0.0;
    }
}

public on_death()
{
    new killer = read_data(1);
    new victim = read_data(2);

    if (victim >= 1 && victim <= MaxClients) {
        g_streak[victim] = 0;
        g_multi[victim] = 0;
        g_last_kill[victim] = 0.0;
    }

    if (!get_pcvar_num(g_enabled) || killer < 1 || killer > MaxClients ||
        killer == victim || !is_user_connected(killer)) {
        return;
    }
    if (get_user_team(killer) == get_user_team(victim)) {
        return;
    }
    if (cvar_exists("docker_warmup_active") && get_cvar_num("docker_warmup_active")) {
        return;
    }

    new Float:now = get_gametime();
    if (now - g_last_kill[killer] <= get_pcvar_float(g_multi_window)) {
        g_multi[killer]++;
    } else {
        g_multi[killer] = 1;
    }
    g_last_kill[killer] = now;
    g_streak[killer]++;

    new announcement = -1;
    if (!g_first_blood) {
        g_first_blood = true;
        announcement = FIRST_BLOOD;
    } else {
        announcement = streak_announcement(g_streak[killer]);
        if (announcement == -1) {
            announcement = multi_announcement(g_multi[killer]);
        }
    }

    if (announcement != -1) {
        announce(killer, announcement);
    }
}

stock streak_announcement(streak)
{
    switch (streak) {
        case 5: return KILLING_SPREE;
        case 10: return RAMPAGE;
        case 15: return DOMINATING;
        case 20: return UNSTOPPABLE;
        case 25: return GODLIKE;
    }
    return -1;
}

stock multi_announcement(kills)
{
    switch (kills) {
        case 2: return DOUBLE_KILL;
        case 3: return MULTI_KILL;
        case 4: return ULTRA_KILL;
    }
    return kills >= 5 ? MONSTER_KILL : -1;
}

stock announce(killer, announcement)
{
    new target = get_pcvar_num(g_global_announce) ? 0 : killer;
    new name[32];
    get_user_name(killer, name, charsmax(name));

    if (get_pcvar_num(g_hud_enabled)) {
        set_hudmessage(201, 255, 74, -1.0, 0.20, 1, 0.15, 2.2, 0.05, 0.25, -1);
        show_hudmessage(target, "%s^n%s", g_labels[announcement], name);
    }
    client_print(target, print_chat, "[Streak] %s - %s", g_labels[announcement], name);

    if (get_pcvar_num(g_sounds_enabled)) {
        client_cmd(target, "spk ^"%s^"", g_sound_files[announcement]);
    }
}

stock reset_player(id)
{
    g_streak[id] = 0;
    g_multi[id] = 0;
    g_last_kill[id] = 0.0;
}
