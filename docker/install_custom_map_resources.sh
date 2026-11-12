#!/usr/bin/env bash
set -Eeuo pipefail

source_dir=${1:?custom resource directory is required}
target_dir=${2:?target cstrike directory is required}

[[ -d ${source_dir} ]] || exit 0

while IFS= read -r -d '' source_file; do
  relative_path=${source_file#"${source_dir}/"}
  case "${relative_path}" in
    maps/*.bsp|maps/*.res|maps/*.txt|maps/*.nav|models/*.mdl|sound/*.wav|sound/*.mp3|sprites/*.spr|sprites/*.txt|gfx/*.tga|gfx/*.bmp|*.wad)
      ;;
    *)
      printf 'Unsupported custom map resource: %s\n' "${relative_path}" >&2
      exit 1
      ;;
  esac

  target_file="${target_dir}/${relative_path}"
  if [[ -f ${target_file} ]]; then
    cmp -s "${source_file}" "${target_file}" || {
      printf 'Conflicting custom map resource: %s\n' "${relative_path}" >&2
      exit 1
    }
    continue
  fi
  install -D -m 0644 "${source_file}" "${target_file}"
done < <(find "${source_dir}" -type f -print0 | sort -z)
