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

cp "${HLDS_DIR}/presets/plugins/${mode}.ini" \
   "${CSTRIKE_DIR}/addons/amxmodx/configs/plugins.ini"
if [[ ${db_enabled} == 1 ]]; then
  printf '\n%s\n' 'docker_sql_stats.amxx' >> \
    "${CSTRIKE_DIR}/addons/amxmodx/configs/plugins.ini"
fi

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

mapcycle=${MAPCYCLE:-}
if [[ -n ${mapcycle} ]]; then
  : > "${CSTRIKE_DIR}/mapcycle.txt"
  IFS=',' read -ra maps <<< "${mapcycle}"
  for map in "${maps[@]}"; do
    map=${map//[[:space:]]/}
    [[ ${map} =~ ^[a-zA-Z0-9_]+$ ]] || die "Invalid map in MAPCYCLE: ${map}"
    printf '%s\n' "${map}" >> "${CSTRIKE_DIR}/mapcycle.txt"
  done
else
  cp "${HLDS_DIR}/presets/maps/${mode}.txt" "${CSTRIKE_DIR}/mapcycle.txt"
fi

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

