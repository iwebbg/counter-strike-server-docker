#include <amxmodx>
#include <amxmisc>

#define PLUGIN "Docker RTV and Nominations"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"
#define MAX_MAPS 128
#define MAX_CHOICES 4

new g_maps[MAX_MAPS][32];
new g_map_count;
new g_nomination[33][32];
new bool:g_rtv[33];
new g_recent[10][32];
new g_recent_count;
new g_recent_file[128];

new g_enabled;
new g_ratio;
new g_min_votes;
new g_delay;
new g_recent_limit;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_mapvote_version", VERSION, FCVAR_SERVER);
    g_enabled = register_cvar("docker_rtv_enabled", "1");
    g_ratio = register_cvar("docker_rtv_ratio", "0.60");
    g_min_votes = register_cvar("docker_rtv_min_votes", "2");
    g_delay = register_cvar("docker_rtv_delay_seconds", "120");
    g_recent_limit = register_cvar("docker_recent_maps", "3");

    register_clcmd("say", "handle_say");
    register_clcmd("say_team", "handle_say");

    new data_dir[96];
    get_datadir(data_dir, charsmax(data_dir));
    formatex(g_recent_file, charsmax(g_recent_file), "%s/recent_maps.txt", data_dir);
}

public plugin_cfg()
{
    load_maps();
    load_recent();
    remember_current_map();
}

public client_disconnected(id)
{
    g_rtv[id] = false;
    g_nomination[id][0] = 0;
}

public handle_say(id)
{
    if (!get_pcvar_num(g_enabled)) {
        return PLUGIN_CONTINUE;
    }

    new message[96];
    read_args(message, charsmax(message));
    remove_quotes(message);

    if (equali(message, "/rtv") || equali(message, "rtv")) {
        vote_rtv(id);
        return PLUGIN_HANDLED;
    }
    if (equali(message, "/maps") || equali(message, "maps")) {
        show_maps(id);
        return PLUGIN_HANDLED;
    }
    if (containi(message, "/nominate ") == 0 || containi(message, "nominate ") == 0) {
        new offset = message[0] == '/' ? 10 : 9;
        nominate_map(id, message[offset]);
        return PLUGIN_HANDLED;
    }
    return PLUGIN_CONTINUE;
}

public vote_rtv(id)
{
    if (get_gametime() < get_pcvar_float(g_delay)) {
        client_print(id, print_chat, "[RTV] Available in %d second(s).", floatround(get_pcvar_float(g_delay) - get_gametime()));
        return;
    }
    if (g_rtv[id]) {
        client_print(id, print_chat, "[RTV] You already voted.");
        return;
    }

    g_rtv[id] = true;
    new players = eligible_players();
    new needed = max(get_pcvar_num(g_min_votes), floatround(float(players) * get_pcvar_float(g_ratio), floatround_ceil));
    new votes = rtv_votes();
    client_print(0, print_chat, "[RTV] %n wants a map vote (%d/%d).", id, votes, needed);
    if (votes >= needed) {
        start_map_vote();
    }
}

public nominate_map(id, map[])
{
    trim(map);
    if (!map[0] || !map_allowed(map)) {
        client_print(id, print_chat, "[RTV] Unknown or unavailable map. Use /maps.");
        return;
    }
    if (is_recent(map)) {
        client_print(id, print_chat, "[RTV] %s was played recently.", map);
        return;
    }
    copy(g_nomination[id], charsmax(g_nomination[]), map);
    client_print(0, print_chat, "[RTV] %n nominated %s.", id, map);
}

public show_maps(id)
{
    console_print(id, "----- Available maps -----");
    for (new index = 0; index < g_map_count; index++) {
        console_print(id, "%s%s", g_maps[index], is_recent(g_maps[index]) ? " (recent)" : "");
    }
    console_print(id, "----- Use /nominate map_name -----");
    client_print(id, print_chat, "[RTV] Available maps were printed in your console.");
}

start_map_vote()
{
    new choices[MAX_CHOICES][32];
    new choice_count;

    for (new id = 1; id <= MaxClients && choice_count < MAX_CHOICES; id++) {
        if (g_nomination[id][0] && !choice_exists(choices, choice_count, g_nomination[id]) && !is_recent(g_nomination[id])) {
            copy(choices[choice_count++], 31, g_nomination[id]);
        }
    }

    new attempts;
    while (choice_count < MAX_CHOICES && attempts++ < 512 && g_map_count > 0) {
        new index = random(g_map_count);
        if (!is_recent(g_maps[index]) && !choice_exists(choices, choice_count, g_maps[index])) {
            copy(choices[choice_count++], 31, g_maps[index]);
        }
    }
    if (choice_count < 2) {
        client_print(0, print_chat, "[RTV] Not enough eligible maps for a vote.");
        reset_votes();
        return;
    }

    new command[192] = "amx_votemap";
    for (new index = 0; index < choice_count; index++) {
        add(command, charsmax(command), " ");
        add(command, charsmax(command), choices[index]);
    }
    client_print(0, print_chat, "[RTV] Vote started!");
    server_cmd("%s", command);
    reset_votes();
}

load_maps()
{
    g_map_count = 0;
    new config_dir[96], file_name[128];
    get_configsdir(config_dir, charsmax(config_dir));
    formatex(file_name, charsmax(file_name), "%s/maps.ini", config_dir);
    new file = fopen(file_name, "rt");
    if (!file) return;

    new line[128], map[32];
    while (!feof(file) && g_map_count < MAX_MAPS) {
        fgets(file, line, charsmax(line));
        if (line[0] == ';' || parse(line, map, charsmax(map)) < 1 || !is_map_valid(map)) continue;
        copy(g_maps[g_map_count++], 31, map);
    }
    fclose(file);
}

load_recent()
{
    g_recent_count = 0;
    new file = fopen(g_recent_file, "rt");
    if (!file) return;
    new line[64];
    while (!feof(file) && g_recent_count < sizeof(g_recent)) {
        fgets(file, line, charsmax(line));
        trim(line);
        if (line[0]) copy(g_recent[g_recent_count++], 31, line);
    }
    fclose(file);
}

remember_current_map()
{
    new current[32];
    get_mapname(current, charsmax(current));
    new limit = clamp(get_pcvar_num(g_recent_limit), 0, sizeof(g_recent));
    new file = fopen(g_recent_file, "wt");
    if (!file) return;
    fprintf(file, "%s^n", current);
    for (new index = 0; index < g_recent_count && index < limit - 1; index++) {
        if (!equali(current, g_recent[index])) fprintf(file, "%s^n", g_recent[index]);
    }
    fclose(file);
    load_recent();
}

bool:map_allowed(map[])
{
    for (new index = 0; index < g_map_count; index++) if (equali(map, g_maps[index])) return true;
    return false;
}

bool:is_recent(map[])
{
    new limit = min(g_recent_count, clamp(get_pcvar_num(g_recent_limit), 0, sizeof(g_recent)));
    for (new index = 0; index < limit; index++) if (equali(map, g_recent[index])) return true;
    return false;
}

bool:choice_exists(choices[][32], count, map[])
{
    for (new index = 0; index < count; index++) if (equali(choices[index], map)) return true;
    return false;
}

eligible_players()
{
    new count;
    for (new id = 1; id <= MaxClients; id++) if (is_user_connected(id) && !is_user_bot(id)) count++;
    return count;
}

rtv_votes()
{
    new count;
    for (new id = 1; id <= MaxClients; id++) if (g_rtv[id] && is_user_connected(id)) count++;
    return count;
}

reset_votes()
{
    for (new id = 1; id <= MaxClients; id++) {
        g_rtv[id] = false;
        g_nomination[id][0] = 0;
    }
}
