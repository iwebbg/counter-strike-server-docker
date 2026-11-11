#include <amxmodx>

#define PLUGIN "Docker Welcome"
#define VERSION "1.0.0"
#define AUTHOR "counter-strike-server-docker"
#define TASK_WELCOME 700

new g_message;

public plugin_init()
{
    register_plugin(PLUGIN, VERSION, AUTHOR);
    register_cvar("docker_welcome_version", VERSION, FCVAR_SERVER);
    g_message = register_cvar("docker_welcome_message", "Welcome to the server!");
}

public client_putinserver(id)
{
    if (!is_user_bot(id) && !is_user_hltv(id)) {
        set_task(7.0, "show_welcome", id + TASK_WELCOME);
    }
}

public client_disconnected(id)
{
    remove_task(id + TASK_WELCOME);
}

public show_welcome(task_id)
{
    new id = task_id - TASK_WELCOME;
    if (!is_user_connected(id)) {
        return;
    }

    new name[32], message[160];
    get_user_name(id, name, charsmax(name));
    get_pcvar_string(g_message, message, charsmax(message));

    set_hudmessage(0, 180, 255, -1.0, 0.22, 0, 1.0, 7.0, 0.2, 0.2, -1);
    show_hudmessage(id, "Welcome, %s!^n%s", name, message);
    client_print(id, print_chat, "[Server] Welcome, %s! %s", name, message);
    client_print(id, print_chat, "[Server] Commands: /rank, /stats, /statsme, /top15");

    if (cvar_exists("docker_gungame_version")) {
        client_print(id, print_chat, "[GunGame] Double jump: press SPACE again while airborne. Use /level for progress.");
    }
}

