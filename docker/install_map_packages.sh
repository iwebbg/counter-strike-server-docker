#!/usr/bin/env bash
set -Eeuo pipefail

source_dir=${1:?source directory is required}
target_dir=${2:?target cstrike directory is required}

copy_resource() {
  local source_file=$1
  local relative_path=$2
  local target_file="${target_dir}/${relative_path}"

  case "${relative_path}" in
    *.ztmp)
      return
      ;;
    maps/*|models/*|sound/*|sprites/*|gfx/*|*.wad)
      ;;
    *)
      printf 'Ignoring unsupported map package file: %s\n' "${source_file}" >&2
      return
      ;;
  esac

  if [[ -f ${target_file} ]]; then
    cmp -s "${source_file}" "${target_file}" || {
      printf 'Conflicting map resource: %s\n' "${relative_path}" >&2
      exit 1
    }
    return
  fi

  install -D -m 0644 "${source_file}" "${target_file}"
}

while IFS= read -r -d '' package_dir; do
  package_root=${package_dir}
  if [[ -d ${package_dir}/cstrike ]]; then
    package_root=${package_dir}/cstrike
  fi

  while IFS= read -r -d '' source_file; do
    relative_path=${source_file#"${package_root}/"}
    copy_resource "${source_file}" "${relative_path}"
  done < <(find "${package_root}" -type f -print0 | sort -z)
done < <(find "${source_dir}" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

