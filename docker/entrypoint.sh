#!/usr/bin/env bash
set -Eeuo pipefail

readonly HLDS_DIR=/opt/hlds
readonly CSTRIKE_DIR="${HLDS_DIR}/cstrike"

log() { printf '[cs16] %s\n' "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

cfg_escape() {
  local value=${1-}
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  printf '%s' "${value//$'\n'/ }"
}

is_uint() { [[ ${1-} =~ ^[0-9]+$ ]]; }

mode=${SERVER_MODE:-classic}
case "${mode}" in
  classic|gungame) ;;
  *) die "SERVER_MODE must be 'classic' or 'gungame' (received: ${mode})" ;;
esac

max_players=${MAX_PLAYERS:-24}
is_uint "${max_players}" || die "MAX_PLAYERS must be a positive integer"
(( max_players >= 1 && max_players <= 32 )) || die "MAX_PLAYERS must be between 1 and 32"

default_start_map=de_dust2
if [[ ${mode} == gungame ]]; then
  default_start_map=gg_3way
fi
start_map=${START_MAP:-${default_start_map}}
[[ ${start_map} =~ ^[a-zA-Z0-9_]+$ ]] || die "START_MAP contains unsupported characters"

db_enabled=${DB_ENABLED:-0}
[[ ${db_enabled} == 0 || ${db_enabled} == 1 ]] || die "DB_ENABLED must be 0 or 1"

doublejump_enabled=${GG_DOUBLEJUMP_ENABLED:-1}
[[ ${doublejump_enabled} == 0 || ${doublejump_enabled} == 1 ]] || \
  die "GG_DOUBLEJUMP_ENABLED must be 0 or 1"
doublejump_velocity=${GG_DOUBLEJUMP_VELOCITY:-350.0}
[[ ${doublejump_velocity} =~ ^[0-9]+([.][0-9]+)?$ ]] || \
  die "GG_DOUBLEJUMP_VELOCITY must be a positive number"

warmup_enabled=${WARMUP_ENABLED:-1}
semiclip_enabled=${SEMICLIP_ENABLED:-1}
afk_enabled=${AFK_MANAGER_ENABLED:-1}
rtv_enabled=${RTV_ENABLED:-1}
killstreak_enabled=${KILLSTREAK_ENABLED:-1}
killstreak_sounds=${KILLSTREAK_SOUNDS_ENABLED:-1}
killstreak_hud=${KILLSTREAK_HUD_ENABLED:-1}
killstreak_global=${KILLSTREAK_GLOBAL:-1}
team_balance_enabled=${TEAM_BALANCE_ENABLED:-1}
team_scramble_enabled=${TEAM_SCRAMBLE_ENABLED:-1}
[[ ${mode} == gungame ]] && team_scramble_enabled=${TEAM_SCRAMBLE_ENABLED:-0}
radio_protection_enabled=${RADIO_PROTECTION_ENABLED:-1}
safe_name_enabled=${SAFE_NAME_ENABLED:-1}
safe_chat_enabled=${SAFE_CHAT_ENABLED:-1}
for toggle in warmup_enabled semiclip_enabled afk_enabled rtv_enabled killstreak_enabled killstreak_sounds killstreak_hud killstreak_global team_balance_enabled team_scramble_enabled radio_protection_enabled safe_name_enabled safe_chat_enabled; do
  [[ ${!toggle} == 0 || ${!toggle} == 1 ]] || die "${toggle} must be 0 or 1"
done

# ReHLDS uses the native ReSemiclip Metamod plugin. Keep the Pawn implementation
# as the Valve profile fallback, but never run both collision hooks together.
pawn_semiclip_enabled=${semiclip_enabled}
if [[ ${CS16_ENGINE:-valve} == rehlds && -f ${CSTRIKE_DIR}/addons/resemiclip/config.ini ]]; then
  sed -E -i "s/^[[:space:]]*semiclip[[:space:]]*=.*/semiclip = ${semiclip_enabled};/" \
    "${CSTRIKE_DIR}/addons/resemiclip/config.ini"
  pawn_semiclip_enabled=0
fi

spawn_enabled=${SPAWN_PROTECTION_ENABLED:-}
if [[ -z ${spawn_enabled} ]]; then
  spawn_enabled=0
  [[ ${mode} == gungame ]] && spawn_enabled=1
fi
[[ ${spawn_enabled} == 0 || ${spawn_enabled} == 1 ]] || \
  die "SPAWN_PROTECTION_ENABLED must be 0 or 1"

warmup_seconds=${WARMUP_SECONDS:-45}
afk_warn=${AFK_WARN_SECONDS:-60}
afk_spectator=${AFK_SPECTATOR_SECONDS:-90}
afk_kick=${AFK_KICK_SECONDS:-180}
rtv_min_votes=${RTV_MIN_VOTES:-2}
rtv_delay=${RTV_DELAY_SECONDS:-120}
recent_maps=${RECENT_MAPS:-3}
for integer in warmup_seconds afk_warn afk_spectator afk_kick rtv_min_votes rtv_delay recent_maps; do
  is_uint "${!integer}" || die "${integer} must be a non-negative integer"
done
(( afk_warn <= afk_spectator && afk_spectator <= afk_kick )) || \
  die "AFK thresholds must satisfy WARN <= SPECTATOR <= KICK"

spawn_seconds=${SPAWN_PROTECTION_SECONDS:-3.0}
rtv_ratio=${RTV_RATIO:-0.60}
killstreak_window=${KILLSTREAK_MULTI_WINDOW:-4.0}
amxx_branding_message=${AMXX_BRANDING_MESSAGE:-%hostname% is powered by CS 1.6 Server CP | interweb.bg}
amxx_branding_interval=${AMXX_BRANDING_INTERVAL:-600}
amxx_branding_color=${AMXX_BRANDING_COLOR:-201255074}
team_scramble_streak=${TEAM_SCRAMBLE_STREAK:-5}
radio_limit=${RADIO_SPAM_LIMIT:-4}
radio_window=${RADIO_SPAM_WINDOW:-5.0}
server_rules=${SERVER_RULES:-Respect players; no cheating; no abuse; follow admin instructions.}
community_url=${COMMUNITY_URL:-https://interweb.bg}
chat_limit=${CHAT_SPAM_LIMIT:-5}
chat_window=${CHAT_SPAM_WINDOW:-6.0}
chat_block_seconds=${CHAT_BLOCK_SECONDS:-15}
forbidden_names=${FORBIDDEN_NAMES:-console,server,admin}
forbidden_chat=${FORBIDDEN_CHAT:-}
[[ ${spawn_seconds} =~ ^[0-9]+([.][0-9]+)?$ ]] || die "SPAWN_PROTECTION_SECONDS must be positive"
[[ ${rtv_ratio} =~ ^(0([.][0-9]+)?|1([.]0+)?)$ ]] || die "RTV_RATIO must be between 0 and 1"
[[ ${killstreak_window} =~ ^[0-9]+([.][0-9]+)?$ ]] || die "KILLSTREAK_MULTI_WINDOW must be positive"
is_uint "${amxx_branding_interval}" || die "AMXX_BRANDING_INTERVAL must be a non-negative integer"
(( amxx_branding_interval >= 30 )) || die "AMXX_BRANDING_INTERVAL must be at least 30 seconds"
[[ ${amxx_branding_color} =~ ^[0-9]{9}$ ]] || die "AMXX_BRANDING_COLOR must contain 9 digits (RRRGGGBBB)"
is_uint "${team_scramble_streak}" || die "TEAM_SCRAMBLE_STREAK must be a non-negative integer"
(( team_scramble_streak >= 2 && team_scramble_streak <= 20 )) || die "TEAM_SCRAMBLE_STREAK must be between 2 and 20"
is_uint "${radio_limit}" || die "RADIO_SPAM_LIMIT must be a non-negative integer"
(( radio_limit >= 1 && radio_limit <= 20 )) || die "RADIO_SPAM_LIMIT must be between 1 and 20"
[[ ${radio_window} =~ ^[0-9]+([.][0-9]+)?$ ]] || die "RADIO_SPAM_WINDOW must be positive"
is_uint "${chat_limit}" || die "CHAT_SPAM_LIMIT must be a non-negative integer"
(( chat_limit >= 2 && chat_limit <= 20 )) || die "CHAT_SPAM_LIMIT must be between 2 and 20"
[[ ${chat_window} =~ ^[0-9]+([.][0-9]+)?$ ]] || die "CHAT_SPAM_WINDOW must be positive"
is_uint "${chat_block_seconds}" || die "CHAT_BLOCK_SECONDS must be a non-negative integer"
(( chat_block_seconds >= 1 && chat_block_seconds <= 300 )) || die "CHAT_BLOCK_SECONDS must be between 1 and 300"

cp "${HLDS_DIR}/presets/plugins/${mode}.ini" \
   "${CSTRIKE_DIR}/addons/amxmodx/configs/plugins.ini"
cp "${HLDS_DIR}/presets/stats.ini" \
   "${CSTRIKE_DIR}/addons/amxmodx/configs/stats.ini"
if [[ ${db_enabled} == 1 ]]; then
  printf '\n%s\n' 'docker_sql_stats.amxx' >> \
    "${CSTRIKE_DIR}/addons/amxmodx/configs/plugins.ini"
fi

amxx_config="${CSTRIKE_DIR}/addons/amxmodx/configs/amxx.cfg"
sed -i \
  -e '/^[[:space:]]*amx_scrollmsg[[:space:]]/d' \
  -e '/^[[:space:]]*amx_imessage[[:space:]]/d' \
  "${amxx_config}"
{
  printf '\n// Managed by CS 1.6 Server CP.\n'
  printf 'amx_scrollmsg "%s" %s\n' "$(cfg_escape "${amxx_branding_message}")" "${amxx_branding_interval}"
  printf 'amx_imessage "%s" "%s"\n' "$(cfg_escape "${amxx_branding_message}")" "${amxx_branding_color}"
  printf 'docker_team_balance_enabled %s\n' "${team_balance_enabled}"
  printf 'docker_team_scramble_enabled %s\n' "${team_scramble_enabled}"
  printf 'docker_team_scramble_streak %s\n' "${team_scramble_streak}"
  printf 'docker_radio_protection_enabled %s\n' "${radio_protection_enabled}"
  printf 'docker_radio_limit %s\n' "${radio_limit}"
  printf 'docker_radio_window %s\n' "${radio_window}"
  printf 'docker_server_rules "%s"\n' "$(cfg_escape "${server_rules}")"
  printf 'docker_community_url "%s"\n' "$(cfg_escape "${community_url}")"
  printf 'docker_safe_name_enabled %s\n' "${safe_name_enabled}"
  printf 'docker_safe_chat_enabled %s\n' "${safe_chat_enabled}"
  printf 'docker_chat_limit %s\n' "${chat_limit}"
  printf 'docker_chat_window %s\n' "${chat_window}"
  printf 'docker_chat_block_seconds %s\n' "${chat_block_seconds}"
  printf 'docker_forbidden_names "%s"\n' "$(cfg_escape "${forbidden_names}")"
  printf 'docker_forbidden_chat "%s"\n' "$(cfg_escape "${forbidden_chat}")"
} >> "${amxx_config}"
echo "[entrypoint] Applied CS 1.6 Server CP branding messages"

admins_file="${CSTRIKE_DIR}/addons/amxmodx/configs/users.ini"
managed_admins_file="${CSTRIKE_DIR}/addons/amxmodx/data/panel_admins.txt"
cat > "${admins_file}" <<'EOF'
; Generated from AMXX_ADMINS or CS Control by the container entrypoint.
; SteamID authentication is used, so no admin passwords are stored.
"loopback" "" "abcdefghijklmnopqrstu" "de"
EOF

admin_count=0
admin_source="AMXX_ADMINS"
if [[ -f ${managed_admins_file} ]]; then
  admin_entries=""
  IFS= read -r admin_entries < "${managed_admins_file}" || true
  admin_source="CS Control"
else
  admin_entries=${AMXX_ADMINS:-}
fi
if [[ -n ${admin_entries} ]]; then
  IFS=';' read -ra admins <<< "${admin_entries}"
  for admin_entry in "${admins[@]}"; do
    [[ -n ${admin_entry} ]] || continue
    IFS='|' read -r steam_id access_flags unexpected <<< "${admin_entry}"
    [[ -z ${unexpected:-} && -n ${steam_id:-} && -n ${access_flags:-} ]] || \
      die "Invalid AMXX_ADMINS entry; expected STEAM_ID|flags"
    [[ ${steam_id} =~ ^STEAM_[0-9]+:[01]:[0-9]+$ ]] || \
      die "Invalid admin Steam ID: ${steam_id}"
    [[ ${access_flags} =~ ^[a-u]+$ ]] || \
      die "Invalid AMXX access flags for ${steam_id}; use only a-u and never z"
    printf '"%s" "" "%s" "ce"\n' "${steam_id}" "${access_flags}" >> "${admins_file}"
    ((admin_count += 1))
  done
fi
echo "[entrypoint] Loaded ${admin_count} AMXX admin(s) from ${admin_source}"

custom_map_root="${CSTRIKE_DIR}/addons/amxmodx/data/custom_maps"
if [[ -d ${custom_map_root}/resources ]]; then
  /usr/local/bin/install-custom-map-resources "${custom_map_root}/resources" "${CSTRIKE_DIR}"
  echo "[entrypoint] Installed persistent custom map resources"
fi

persistent_bans_file="${CSTRIKE_DIR}/addons/amxmodx/data/banned.cfg"
touch "${persistent_bans_file}"
ln -sfn "addons/amxmodx/data/banned.cfg" "${CSTRIKE_DIR}/banned.cfg"

managed_mapcycle_file="${CSTRIKE_DIR}/addons/amxmodx/data/panel_mapcycle.txt"
if [[ -f ${managed_mapcycle_file} ]]; then
  : > "${CSTRIKE_DIR}/mapcycle.txt"
  map_count=0
  while IFS= read -r map || [[ -n ${map} ]]; do
    map=${map//[[:space:]]/}
    [[ -n ${map} ]] || continue
    [[ ${map} =~ ^[a-zA-Z0-9_]+$ ]] || die "Invalid map in panel mapcycle: ${map}"
    [[ -f ${CSTRIKE_DIR}/maps/${map}.bsp ]] || die "Map is not installed: ${map}"
    printf '%s\n' "${map}" >> "${CSTRIKE_DIR}/mapcycle.txt"
    ((map_count += 1))
  done < "${managed_mapcycle_file}"
  ((map_count > 0)) || die "Panel mapcycle must contain at least one map"
  echo "[entrypoint] Loaded ${map_count} map(s) from CS Control"
else
  mapcycle=${MAPCYCLE:-}
  if [[ -n ${mapcycle} ]]; then
    : > "${CSTRIKE_DIR}/mapcycle.txt"
    IFS=',' read -ra maps <<< "${mapcycle}"
    for map in "${maps[@]}"; do
      map=${map//[[:space:]]/}
      [[ ${map} =~ ^[a-zA-Z0-9_]+$ ]] || die "Invalid map in MAPCYCLE: ${map}"
      [[ -f ${CSTRIKE_DIR}/maps/${map}.bsp ]] || die "Map is not installed: ${map}"
      printf '%s\n' "${map}" >> "${CSTRIKE_DIR}/mapcycle.txt"
    done
  else
    cp "${HLDS_DIR}/presets/maps/${mode}.txt" "${CSTRIKE_DIR}/mapcycle.txt"
  fi
fi
cp "${CSTRIKE_DIR}/mapcycle.txt" \
   "${CSTRIKE_DIR}/addons/amxmodx/configs/maps.ini"
echo "[entrypoint] Synchronized AMXX maps.ini with the active mapcycle"

cat > "${CSTRIKE_DIR}/server.cfg" <<EOF
hostname "$(cfg_escape "${SERVER_NAME:-My CS 1.6 Server}")"
rcon_password "$(cfg_escape "${RCON_PASSWORD:-change-me-now}")"
sv_password "$(cfg_escape "${SERVER_PASSWORD:-}")"
sv_lan "${SV_LAN:-0}"
sv_region "${REGION:-3}"
sv_contact "$(cfg_escape "${SV_CONTACT:-}")"
mp_autokick 0
mp_autoteambalance 1
mp_buytime 0.5
mp_c4timer 35
mp_chattime 10
mp_fadetoblack 0
mp_flashlight 1
mp_forcecamera 0
mp_freezetime 3
mp_friendlyfire 0
mp_hostagepenalty 0
mp_limitteams 2
mp_logdetail 3
mp_logmessages 1
mp_maxrounds 0
mp_roundtime 2.5
mp_startmoney 800
mp_timelimit 25
mp_tkpunish 0
mp_winlimit 0
allow_spectators 1
decalfrequency 60
log on
sv_alltalk 0
sv_allowdownload 1
sv_allowupload 0
sv_cheats 0
sv_maxrate 100000
sv_minrate 20000
sv_maxupdaterate 102
sv_minupdaterate 20
sv_voiceenable 1
docker_welcome_message "$(cfg_escape "${WELCOME_MESSAGE:-Welcome to our CS 1.6 server!}")"
docker_warmup_enabled "${warmup_enabled}"
docker_warmup_seconds "${warmup_seconds}"
docker_spawn_protection_enabled "${spawn_enabled}"
docker_spawn_protection_seconds "${spawn_seconds}"
docker_semiclip_enabled "${pawn_semiclip_enabled}"
docker_afk_enabled "${afk_enabled}"
docker_afk_warn_seconds "${afk_warn}"
docker_afk_spectator_seconds "${afk_spectator}"
docker_afk_kick_seconds "${afk_kick}"
docker_rtv_enabled "${rtv_enabled}"
docker_rtv_ratio "${rtv_ratio}"
docker_rtv_min_votes "${rtv_min_votes}"
docker_rtv_delay_seconds "${rtv_delay}"
docker_recent_maps "${recent_maps}"
docker_killstreak_enabled "${killstreak_enabled}"
docker_killstreak_sounds_enabled "${killstreak_sounds}"
docker_killstreak_hud_enabled "${killstreak_hud}"
docker_killstreak_global "${killstreak_global}"
docker_killstreak_multi_window "${killstreak_window}"
exec banned.cfg
EOF

if [[ ${mode} == gungame ]]; then
  cat >> "${CSTRIKE_DIR}/server.cfg" <<EOF
mp_autoteambalance 0
mp_buytime 0
mp_freezetime 0
mp_limitteams 0
mp_roundtime 9
mp_startmoney 0
gg_doublejump_enabled "${doublejump_enabled}"
gg_doublejump_velocity "${doublejump_velocity}"
EOF
fi

cat > "${CSTRIKE_DIR}/addons/amxmodx/configs/sql.cfg" <<EOF
amx_sql_host "$(cfg_escape "${DB_HOST:-mariadb}")"
amx_sql_user "$(cfg_escape "${DB_USER:-cs16}")"
amx_sql_pass "$(cfg_escape "${DB_PASSWORD:-change-db-password}")"
amx_sql_db "$(cfg_escape "${DB_NAME:-cs16}")"
amx_sql_type "mysql"
EOF
printf '%s\n' "docker_server_id \"$(cfg_escape "${SERVER_ID:-cs16-1}")\"" >> \
  "${CSTRIKE_DIR}/server.cfg"
printf '%s\n' "docker_server_mode \"$(cfg_escape "${mode}")\"" >> \
  "${CSTRIKE_DIR}/server.cfg"

if [[ ${RCON_PASSWORD:-change-me-now} == change-me-now ]]; then
  log "WARNING: using the default RCON password; change RCON_PASSWORD before public use"
fi

log "Starting mode=${mode}, map=${start_map}, players=${max_players}, database=${db_enabled}, admins=${admin_count}"
exec "${HLDS_DIR}/hlds_run" \
  -game cstrike \
  -console \
  -strictportbind \
  -ip 0.0.0.0 \
  -port 27015 \
  -nojoy \
  +maxplayers "${max_players}" \
  +map "${start_map}"

