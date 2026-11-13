#!/usr/bin/env bash
set -Eeuo pipefail

readonly steamcmd_url=${1:?SteamCMD URL is required}
readonly install_dir=${2:-/opt/hlds}
readonly attempts=${3:-5}
readonly steamcmd_dir=/opt/steamcmd
readonly steam_home=/home/hlds/Steam

[[ ${install_dir} == /opt/hlds ]] || {
  printf 'Refusing unexpected HLDS directory: %s\n' "${install_dir}" >&2
  exit 1
}
[[ ${attempts} =~ ^[1-9][0-9]?$ ]] || {
  printf 'Invalid SteamCMD attempt count: %s\n' "${attempts}" >&2
  exit 1
}

archive=$(mktemp /tmp/steamcmd.XXXXXX.tar.gz)
trap 'rm -f -- "${archive}"' EXIT

curl --fail --silent --show-error --location \
  --retry 8 --retry-all-errors --retry-delay 3 --connect-timeout 20 \
  "${steamcmd_url}" --output "${archive}"

for ((attempt = 1; attempt <= attempts; attempt += 1)); do
  printf '[hlds-install] SteamCMD attempt %d/%d\n' "${attempt}" "${attempts}"

  # A failed bootstrap can leave an incomplete package/public directory. Start
  # the small SteamCMD bootstrap from a clean archive while preserving partial
  # HLDS downloads so app_update can resume them.
  find "${steamcmd_dir}" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  rm -rf -- "${steam_home}/package" "${steam_home}/public"
  tar -xzf "${archive}" -C "${steamcmd_dir}"

  timeout 420 "${steamcmd_dir}/steamcmd.sh" \
    +force_install_dir "${install_dir}" \
    +login anonymous \
    +app_set_config 90 mod cstrike \
    +app_update 90 -beta steam_legacy validate \
    +quit || true

  if [[ -s ${install_dir}/cstrike/liblist.gam ]]; then
    printf '[hlds-install] Counter-Strike server files are ready.\n'
    exit 0
  fi

  if ((attempt < attempts)); then
    delay=$((attempt * 10))
    printf '[hlds-install] SteamCMD did not finish; retrying in %d seconds.\n' "${delay}" >&2
    sleep "${delay}"
  fi
done

printf '[hlds-install] SteamCMD failed after %d attempts.\n' "${attempts}" >&2
exit 1
