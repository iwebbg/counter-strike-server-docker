#!/usr/bin/env bash
set -euo pipefail

root=${1:-/opt/hlds}

required=(
  hlds_linux
  engine_i486.so
  filesystem_stdio.so
  core.so
  cstrike/dlls/cs.so
  cstrike/addons/metamod/dlls/metamod_i386.so
  cstrike/addons/amxmodx/modules/reapi_amxx_i386.so
  cstrike/addons/resemiclip/resemiclip_mm_i386.so
  cstrike/addons/resemiclip/config.ini
  rehlds-versions.txt
)

for relative in "${required[@]}"; do
  test -s "${root}/${relative}" || {
    printf 'Missing ReHLDS runtime file: %s\n' "${relative}" >&2
    exit 1
  }
done

grep -q 'addons/metamod/dlls/metamod_i386.so' "${root}/cstrike/liblist.gam"
grep -qxF reapi "${root}/cstrike/addons/amxmodx/configs/modules.ini"
grep -qxF 'linux addons/resemiclip/resemiclip_mm_i386.so' "${root}/cstrike/addons/metamod/plugins.ini"
grep -q '^ReSemiclip=2[.]4[.]3$' "${root}/rehlds-versions.txt"
printf 'ReHLDS image layout is complete.\n'
