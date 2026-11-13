#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./docker/rehlds-lab.sh compatibility <container> [manifest.tsv] [report.txt]
  ./docker/rehlds-lab.sh benchmark <container> <duration-seconds> [interval-seconds] [report.jsonl]

The benchmark samples a running server while real clients or approved test bots
produce load. It does not manufacture players and does not claim a pass/fail.
EOF
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
container_running() { [[ $(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null) == true ]]; }

compatibility() {
  local container=${1-}
  local manifest=${2:-configs/rehlds/external-plugins.example.tsv}
  local report=${3:-rehlds-compatibility-$(date -u +%Y%m%dT%H%M%SZ).txt}
  [[ -n ${container} ]] || die 'A container name or ID is required.'
  [[ -f ${manifest} ]] || die "Manifest not found: ${manifest}"
  container_running "${container}" || die "Container is not running: ${container}"
  awk -F '\t' 'NR == 1 { next } NF != 5 { exit 1 } $4 !~ /^(not-tested|passed|failed|blocked)$/ { exit 1 }' \
    "${manifest}" || die 'Invalid compatibility manifest.'
  {
    printf 'captured_at=%s\ncontainer=%s\nimage=%s\n' \
      "$(date -u +%FT%TZ)" "${container}" "$(docker inspect --format '{{.Config.Image}}' "${container}")"
    docker exec "${container}" sh -c \
      'cat /opt/hlds/rehlds-versions.txt; printf "\nMetamod entries:\n"; cat /opt/hlds/cstrike/addons/metamod/plugins.ini; printf "\nAMXX plugins:\n"; sed -n "1,240p" /opt/hlds/cstrike/addons/amxmodx/configs/plugins.ini'
    printf '\nExternal compatibility declarations:\n'
    cat "${manifest}"
    printf '\nRecent loader errors:\n'
    docker logs --tail 500 "${container}" 2>&1 | grep -Ei \
      'bad load|failed|undefined symbol|invalid|orpheu|signature|segmentation' || true
  } > "${report}"
  printf 'Compatibility evidence written to %s\n' "${report}"
}

benchmark() {
  local container=${1-}
  local duration=${2-}
  local interval=${3:-5}
  local report=${4:-rehlds-benchmark-$(date -u +%Y%m%dT%H%M%SZ).jsonl}
  [[ -n ${container} && ${duration} =~ ^[0-9]+$ && ${interval} =~ ^[0-9]+$ ]] || {
    usage
    exit 2
  }
  (( duration >= 60 )) || die 'Use at least 60 seconds for a meaningful sample.'
  (( interval >= 1 && interval <= duration )) || die 'Invalid sample interval.'
  container_running "${container}" || die "Container is not running: ${container}"
  local end=$((SECONDS + duration))
  printf '{"type":"metadata","capturedAt":"%s","container":"%s","duration":%d,"interval":%d,"declaredPlayers":"%s"}\n' \
    "$(date -u +%FT%TZ)" "${container}" "${duration}" "${interval}" "${REHLDS_TEST_PLAYERS:-unspecified}" > "${report}"
  while (( SECONDS < end )); do
    local stats health
    stats=$(docker stats --no-stream --format '{{json .}}' "${container}")
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container}")
    printf '{"type":"sample","capturedAt":"%s","health":"%s","docker":%s}\n' \
      "$(date -u +%FT%TZ)" "${health}" "${stats}" >> "${report}"
    sleep "${interval}"
  done
  printf 'Raw benchmark samples written to %s\n' "${report}"
}

case ${1-} in
  compatibility) shift; compatibility "$@" ;;
  benchmark) shift; benchmark "$@" ;;
  *) usage; exit 2 ;;
esac
