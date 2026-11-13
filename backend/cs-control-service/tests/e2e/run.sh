#!/usr/bin/env bash
set -Eeuo pipefail

project_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
compose=(
  docker compose
  --project-name cs16-e2e
  --project-directory "$project_directory"
  --file "$project_directory/docker/compose.yaml"
  --file "$project_directory/docker/compose.e2e.yaml"
  --profile panel
)

cleanup() {
  exit_code=$?
  if ((exit_code != 0)); then
    "${compose[@]}" ps --all || true
    "${compose[@]}" logs --no-color --tail 200 mariadb redis panel || true
  fi

  while IFS= read -r container_id; do
    [[ -z "$container_id" ]] && continue
    instance_id="$(docker inspect --format '{{ index .Config.Labels "com.cs16.instance-id" }}' "$container_id")"
    docker container rm --force "$container_id" >/dev/null
    if [[ "$instance_id" =~ ^[a-z0-9-]+$ ]]; then
      docker volume rm "cs16_${instance_id}_logs" "cs16_${instance_id}_data" >/dev/null 2>&1 || true
    fi
  done < <(docker container ls --all --quiet --filter network=cs16-e2e_default --filter label=com.cs16.managed-by=panel)

  "${compose[@]}" down --volumes --remove-orphans || true
  return "$exit_code"
}

trap cleanup EXIT

docker image inspect cs16-server:local >/dev/null
cleanup
"${compose[@]}" up --detach --build --wait --wait-timeout 180 mariadb redis panel
node "$project_directory/backend/cs-control-service/tests/e2e/control-plane.mjs"
