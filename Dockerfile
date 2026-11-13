# syntax=docker/dockerfile:1.7
FROM debian:bookworm-slim AS stable

ARG STEAMCMD_URL=https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
ARG METAMOD_VERSION=1.21.1-am
ARG AMXX_VERSION=1.9.0-git5303
ARG AMXX_RELEASE=1.9.0.5303

ENV DEBIAN_FRONTEND=noninteractive \
    HLDS_DIR=/opt/hlds \
    CS16_ENGINE=valve

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
COPY assets/sounds/killstreak/ "${HLDS_DIR}/cstrike/sound/cs16/killstreak/"
COPY gungame_maps/ /tmp/gungame_maps/
COPY classic_maps/ /tmp/classic_maps/
COPY docker/install_map_packages.sh /usr/local/bin/install-map-packages
COPY docker/install_custom_map_resources.sh /usr/local/bin/install-custom-map-resources
COPY docker/entrypoint.sh /usr/local/bin/cs16-entrypoint

RUN chmod 0755 /usr/local/bin/cs16-entrypoint /usr/local/bin/install-map-packages /usr/local/bin/install-custom-map-resources \
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

FROM stable AS rehlds

ARG REHLDS_VERSION=3.15.0.896
ARG REGAMEDLL_VERSION=5.30.0.814
ARG METAMOD_R_VERSION=1.3.0.149
ARG REAPI_VERSION=5.29.0.358

USER root
COPY docker/rehlds-smoke.sh /usr/local/bin/rehlds-smoke
RUN chmod 0755 /usr/local/bin/rehlds-smoke \
 && curl -fsSL --retry 5 \
      "https://github.com/rehlds/ReHLDS/releases/download/${REHLDS_VERSION}/rehlds-bin-${REHLDS_VERSION}.zip" \
      -o /tmp/rehlds.zip \
 && unzip -q /tmp/rehlds.zip -d /tmp/rehlds \
 && cp /tmp/rehlds/bin/linux32/engine_i486.so \
       /tmp/rehlds/bin/linux32/hlds_linux \
       /tmp/rehlds/bin/linux32/core.so \
       /tmp/rehlds/bin/linux32/filesystem_stdio.so \
       /tmp/rehlds/bin/linux32/demoplayer.so \
       "${HLDS_DIR}/" \
 && cp /tmp/rehlds/bin/linux32/hltv /tmp/rehlds/bin/linux32/proxy.so "${HLDS_DIR}/" \
 && cp /tmp/rehlds/bin/linux32/valve/dlls/director.so "${HLDS_DIR}/valve/dlls/director.so" \
 && curl -fsSL --retry 5 \
      "https://github.com/rehlds/ReGameDLL_CS/releases/download/${REGAMEDLL_VERSION}/regamedll-bin-${REGAMEDLL_VERSION}.zip" \
      -o /tmp/regamedll.zip \
 && unzip -q /tmp/regamedll.zip -d /tmp/regamedll \
 && cp /tmp/regamedll/bin/linux32/cstrike/dlls/cs.so "${HLDS_DIR}/cstrike/dlls/cs.so" \
 && cp /tmp/regamedll/bin/linux32/cstrike/game.cfg \
       /tmp/regamedll/bin/linux32/cstrike/game_init.cfg \
       /tmp/regamedll/bin/linux32/cstrike/delta.lst \
       "${HLDS_DIR}/cstrike/" \
 && curl -fsSL --retry 5 \
      "https://github.com/rehlds/Metamod-R/releases/download/${METAMOD_R_VERSION}/metamod-bin-${METAMOD_R_VERSION}.zip" \
      -o /tmp/metamod-r.zip \
 && unzip -q /tmp/metamod-r.zip -d /tmp/metamod-r \
 && cp /tmp/metamod-r/addons/metamod/metamod_i386.so "${HLDS_DIR}/cstrike/addons/metamod/dlls/metamod_i386.so" \
 && curl -fsSL --retry 5 \
      "https://github.com/rehlds/ReAPI/releases/download/${REAPI_VERSION}/reapi-bin-${REAPI_VERSION}.zip" \
      -o /tmp/reapi.zip \
 && unzip -q /tmp/reapi.zip -d /tmp/reapi \
 && cp -a /tmp/reapi/addons/. "${HLDS_DIR}/cstrike/addons/" \
 && { grep -qxF reapi "${HLDS_DIR}/cstrike/addons/amxmodx/configs/modules.ini" \
      || printf '%s\n' reapi >> "${HLDS_DIR}/cstrike/addons/amxmodx/configs/modules.ini"; } \
 && printf 'ReHLDS=%s\nReGameDLL_CS=%s\nMetamod-R=%s\nReAPI=%s\n' \
      "${REHLDS_VERSION}" "${REGAMEDLL_VERSION}" "${METAMOD_R_VERSION}" "${REAPI_VERSION}" \
      > "${HLDS_DIR}/rehlds-versions.txt" \
 && chmod 0755 "${HLDS_DIR}/hlds_linux" "${HLDS_DIR}/hltv" \
 && /usr/local/bin/rehlds-smoke "${HLDS_DIR}" \
 && chown -R hlds:hlds "${HLDS_DIR}" \
 && rm -rf /tmp/rehlds /tmp/regamedll /tmp/metamod-r /tmp/reapi \
      /tmp/rehlds.zip /tmp/regamedll.zip /tmp/metamod-r.zip /tmp/reapi.zip

ENV CS16_ENGINE=rehlds
LABEL com.cs16.engine="rehlds" \
      com.cs16.rehlds.version="${REHLDS_VERSION}" \
      com.cs16.regamedll.version="${REGAMEDLL_VERSION}" \
      com.cs16.metamod-r.version="${METAMOD_R_VERSION}" \
      com.cs16.reapi.version="${REAPI_VERSION}"

USER hlds

FROM stable AS default

