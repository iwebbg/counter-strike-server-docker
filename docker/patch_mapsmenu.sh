#!/usr/bin/env bash
set -Eeuo pipefail

source_file=${1:?Usage: patch_mapsmenu.sh /path/to/mapsmenu.sma}
[[ -f ${source_file} ]] || { echo "mapsmenu source not found: ${source_file}" >&2; exit 1; }

grep -q $'^\tg_mapName=ArrayCreate(32);$' "${source_file}" || {
  echo "Unsupported mapsmenu.sma: initialization marker is missing" >&2
  exit 1
}
grep -q '^public cmdMapsMenu(id, level, cid)$' "${source_file}" || {
  echo "Unsupported mapsmenu.sma: command marker is missing" >&2
  exit 1
}

sed -i $'/^\tg_mapName=ArrayCreate(32);$/,/^\tload_settings(maps_ini_file)$/c\\
\tg_mapName=ArrayCreate(32);\\
\treload_settings()' "${source_file}"

sed -i '/^public autoRefuse()$/i\
reload_settings()\
{\
\tArrayClear(g_mapName)\
\tg_mapNums = 0\
\
\tnew maps_ini_file[64]\
\tget_configsdir(maps_ini_file, charsmax(maps_ini_file))\
\tformat(maps_ini_file, charsmax(maps_ini_file), "%s/maps.ini", maps_ini_file)\
\
\tif (!file_exists(maps_ini_file))\
\t\tget_cvar_string("mapcyclefile", maps_ini_file, charsmax(maps_ini_file))\
\
\tif (!file_exists(maps_ini_file))\
\t\tformat(maps_ini_file, charsmax(maps_ini_file), "mapcycle.txt")\
\
\tload_settings(maps_ini_file)\
}\
' "${source_file}"

sed -i '/^public cmdVoteMapMenu(id, level, cid)$/,/^}$/ { /^{$/a\
\treload_settings()
}' "${source_file}"
sed -i '/^public cmdMapsMenu(id, level, cid)$/,/^}$/ { /^{$/a\
\treload_settings()
}' "${source_file}"

reload_count=$(grep -c $'^\treload_settings()$' "${source_file}")
((reload_count == 3)) || {
  echo "Failed to add all mapsmenu live reload hooks" >&2
  exit 1
}
