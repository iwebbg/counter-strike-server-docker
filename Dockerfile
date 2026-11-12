# syntax=docker/dockerfile:1.7
FROM debian:bookworm-slim

ARG STEAMCMD_URL=https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
ARG METAMOD_VERSION=1.21.1-am
ARG AMXX_VERSION=1.9.0-git5303
ARG AMXX_RELEASE=1.9.0.5303

ENV DEBIAN_FRONTEND=noninteractive \
    HLDS_DIR=/opt/hlds

RUN dpkg --add-architecture i386 \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl lib32gcc-s1 libc6:i386 libstdc++6:i386 \
      procps tini unzip \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --home-dir /home/hlds --shell /bin/bash hlds \
 && mkdir -p /opt/steamcmd "${HLDS_DIR}" \
 && chown -R hlds:hlds /opt/steamcmd "${HLDS_DIR}" /home/hlds

USER hlds
RUN curl -fsSL --retry 5 "${STEAMCMD_URL}" | tar -xz -C /opt/steamcmd \
 && for attempt in 1 2 3; do \
      /opt/steamcmd/steamcmd.sh \
        +force_install_dir "${HLDS_DIR}" \
        +login anonymous \
        +app_set_config 90 mod cstrike \
        +app_update 90 -beta steam_legacy validate \
        +quit || true; \
      test -f "${HLDS_DIR}/cstrike/liblist.gam" && break; \
    done \
 && test -f "${HLDS_DIR}/cstrike/liblist.gam" \
 && mkdir -p /home/hlds/.steam/sdk32 \
 && ln -sf /opt/steamcmd/linux32/steamclient.so /home/hlds/.steam/sdk32/steamclient.so

USER root
RUN curl -fsSL --retry 5 \
      "https://www.amxmodx.org/release/metamod-${METAMOD_VERSION}.zip" \
      -o /tmp/metamod.zip \
 && unzip -q /tmp/metamod.zip -d "${HLDS_DIR}/cstrike" \
 && curl -fsSL --retry 5 \
      "https://github.com/alliedmodders/amxmodx/releases/download/${AMXX_RELEASE}/amxmodx-${AMXX_VERSION}-base-linux.tar.gz" \
      -o /tmp/amxx-base.tar.gz \
 && curl -fsSL --retry 5 \
      "https://github.com/alliedmodders/amxmodx/releases/download/${AMXX_RELEASE}/amxmodx-${AMXX_VERSION}-cstrike-linux.tar.gz" \
      -o /tmp/amxx-cstrike.tar.gz \
 && tar -xzf /tmp/amxx-base.tar.gz -C "${HLDS_DIR}/cstrike" \
 && tar -xzf /tmp/amxx-cstrike.tar.gz -C "${HLDS_DIR}/cstrike" \
 && sed -i 's#^gamedll_linux.*#gamedll_linux "addons/metamod/dlls/metamod_i386.so"#' "${HLDS_DIR}/cstrike/liblist.gam" \
 && printf '%s\n' 'linux addons/amxmodx/dlls/amxmodx_mm_i386.so' > "${HLDS_DIR}/cstrike/addons/metamod/plugins.ini" \
 && rm -f /tmp/metamod.zip /tmp/amxx-base.tar.gz /tmp/amxx-cstrike.tar.gz

COPY addons/scripting/ /tmp/cs16-scripting/
COPY docker/patch_mapsmenu.sh /usr/local/bin/patch-amxx-mapsmenu
RUN chmod 0755 /usr/local/bin/patch-amxx-mapsmenu \
 && cd "${HLDS_DIR}/cstrike/addons/amxmodx/scripting" \
 && /usr/local/bin/patch-amxx-mapsmenu mapsmenu.sma \
 && ./amxxpc \
      mapsmenu.sma \
      -i"${HLDS_DIR}/cstrike/addons/amxmodx/scripting/include" \
      -o"${HLDS_DIR}/cstrike/addons/amxmodx/plugins/mapsmenu.amxx" \
 && for source_file in /tmp/cs16-scripting/docker_*.sma; do \
      plugin_name=$(basename "${source_file%.sma}"); \
      ./amxxpc \
        "${source_file}" \
        -i"${HLDS_DIR}/cstrike/addons/amxmodx/scripting/include" \
        -o"${HLDS_DIR}/cstrike/addons/amxmodx/plugins/${plugin_name}.amxx" || exit 1; \
    done \
 && cp /tmp/cs16-scripting/*.sma "${HLDS_DIR}/cstrike/addons/amxmodx/scripting/" \
 && rm -rf /tmp/cs16-scripting

COPY configs/plugins/ "${HLDS_DIR}/presets/plugins/"
COPY configs/maps/ "${HLDS_DIR}/presets/maps/"
COPY configs/stats.ini "${HLDS_DIR}/presets/stats.ini"
COPY gungame_maps/ /tmp/gungame_maps/
COPY classic_maps/ /tmp/classic_maps/
COPY docker/install_map_packages.sh /usr/local/bin/install-map-packages
COPY docker/entrypoint.sh /usr/local/bin/cs16-entrypoint

RUN chmod 0755 /usr/local/bin/cs16-entrypoint /usr/local/bin/install-map-packages \
 && /usr/local/bin/install-map-packages /tmp/gungame_maps "${HLDS_DIR}/cstrike" \
 && /usr/local/bin/install-map-packages /tmp/classic_maps "${HLDS_DIR}/cstrike" \
 && for map_list in "${HLDS_DIR}"/presets/maps/*.txt; do \
      while IFS= read -r map; do \
        test -z "${map}" || test -f "${HLDS_DIR}/cstrike/maps/${map}.bsp"; \
      done < "${map_list}"; \
    done \
 && rm -rf /tmp/gungame_maps /tmp/classic_maps \
 && mkdir -p "${HLDS_DIR}/cstrike/logs" "${HLDS_DIR}/cstrike/addons/amxmodx/data" \
 && chown -R hlds:hlds "${HLDS_DIR}"

USER hlds
WORKDIR /opt/hlds
EXPOSE 27015/udp 27015/tcp
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/cs16-entrypoint"]

