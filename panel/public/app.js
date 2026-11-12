import { getLocale, initI18n, t, translateDocument } from "./i18n.js";

const state = {
  authenticated: false,
  user: null,
  servers: [],
  filter: "all",
  loading: false,
  logsServer: null,
  logsTimer: null,
  adminsServer: null,
  mapsServer: null,
  mapsPayload: null,
  playersServer: null,
  playersTimer: null,
  statsLoading: false,
  databaseConnected: false,
};

const $ = (selector) => document.querySelector(selector);
const authView = $("#authView");
const appView = $("#appView");
const serverGrid = $("#serverGrid");
const emptyState = $("#emptyState");
const createDialog = $("#createDialog");
const logsDialog = $("#logsDialog");
const credentialDialog = $("#credentialDialog");
const adminsDialog = $("#adminsDialog");
const mapsDialog = $("#mapsDialog");
const playersDialog = $("#playersDialog");
const profileDialog = $("#profileDialog");
const toast = $("#toast");
const maps = {
  classic: [
    "de_dust2",
    "de_inferno",
    "de_nuke",
    "de_train",
    "cs_office",
    "de_csgothic",
    "de_mini_train2",
    "de_nuke_fora",
    "de_solitude",
  ],
  gungame: [
    "gg_3way",
    "gg_aztec_VS_dust",
    "gg_buzz",
    "gg_fy_deagle_dustworld",
    "gg_fy_deagle_dustworld3",
    "gg_hideout",
    "gg_inferno",
    "gg_js_cbble",
    "gg_mariocastle_mt",
    "gg_mini_dust2",
    "gg_mini_skilluj",
    "gg_os_arena",
  ],
};

initI18n();

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

function notify(message, error = false) {
  clearTimeout(notify.timer);
  clearTimeout(notify.hideTimer);
  if (typeof toast.showPopover === "function" && !toast.matches(":popover-open")) toast.showPopover();
  toast.textContent = message;
  toast.className = `toast show${error ? " error" : ""}`;
  notify.timer = setTimeout(() => {
    toast.className = "toast";
    notify.hideTimer = setTimeout(() => {
      if (typeof toast.hidePopover === "function" && toast.matches(":popover-open")) toast.hidePopover();
    }, 220);
  }, 3500);
}

async function api(path, options = {}, allowRefresh = true) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && allowRefresh && !path.includes("/v1/users/")) {
    const refreshed = await api("/api/v1/users/session/refresh", { method: "POST" }, false).catch(() => null);
    if (refreshed) return api(path, options, false);
  }
  if (!response.ok)
    throw new Error(
      payload.error_code || payload.message || payload.error || t("requestFailed", { status: response.status }),
    );
  return payload.success === true ? payload.data : payload;
}

function showApp() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showAuth(message = "") {
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  $("#authError").textContent = message;
  $("#emailInput").focus();
}

function serverCard(server) {
  const online = server.state === "running";
  const canRemove = server.managedBy === "panel" && !online;
  const players = server.players === null ? "—" : server.players;
  const capacity = server.liveMaxPlayers || server.maxPlayers;
  const currentMap = server.map || server.startMap || t("starting");
  return `
    <article class="server-card ${online ? "online" : ""}" data-id="${server.id}">
      <div class="card-head">
        <div class="card-title"><i class="status-orb"></i><div><h3>${escapeHtml(server.name)}</h3><p>${escapeHtml(server.containerName)}</p></div></div>
        <div class="badges"><span class="badge mode">${escapeHtml(server.mode)}</span><span class="badge">${escapeHtml(server.managedBy)}</span></div>
      </div>
      <div class="server-data">
        <div><span>${t("status")}</span><strong>${escapeHtml(t(online ? server.health : server.state))}</strong></div>
        <div><span>${t("players")}</span><strong>${players} / ${capacity}</strong></div>
        <div><span>${t("map")}</span><strong title="${escapeHtml(currentMap)}">${escapeHtml(currentMap)}</strong></div>
        <div><span>${t("port")}</span><strong>:${server.port ?? "—"}</strong></div>
      </div>
      <div class="card-actions">
        ${
          online
            ? `<button class="button ghost" data-action="stop">■ ${t("stop")}</button><button class="button ghost" data-action="restart">↻ ${t("restart")}</button>`
            : `<button class="button primary" data-action="start">▶ ${t("start")}</button>`
        }
        <button class="button ghost" data-action="logs">${t("logs")}</button>
        <button class="button ghost" data-action="players" ${online ? "" : `disabled title="${t("viewPlayersHint")}"`}>${t("players")}</button>
        <button class="button ghost" data-action="maps" ${online ? "" : `disabled title="${t("manageMapsHint")}"`}>${t("maps")}</button>
        <button class="button ghost" data-action="admins" ${online ? "" : `disabled title="${t("manageAdminsHint")}"`}>${t("admins")}</button>
        ${canRemove ? `<button class="button ghost danger" data-action="remove">${t("remove")}</button>` : ""}
      </div>
    </article>`;
}

function render() {
  const visible = state.servers.filter((server) => state.filter === "all" || server.state === state.filter);
  serverGrid.innerHTML = visible.map(serverCard).join("");
  emptyState.classList.toggle("hidden", visible.length !== 0);

  const online = state.servers.filter((server) => server.state === "running");
  const knownPlayers = online.reduce((total, server) => total + (server.players || 0), 0);
  const capacity = online.reduce((total, server) => total + (server.liveMaxPlayers || server.maxPlayers || 0), 0);
  $("#totalMetric").textContent = state.servers.length;
  $("#onlineMetric").textContent = online.length;
  $("#playersMetric").textContent = knownPlayers;
  $("#capacityMetric").textContent = t("onlineSlots", { count: capacity });
}

async function refresh(silent = false) {
  if (state.loading) return;
  state.loading = true;
  $("#refreshButton").disabled = true;
  try {
    const payload = await api("/api/servers");
    state.servers = payload.servers;
    $("#portsMetric").textContent = `${payload.portRange[0]}–${payload.portRange[1]}`;
    $("#connectionState").classList.remove("offline");
    $("#connectionState").innerHTML = `<i></i> ${t("dockerConnected")}`;
    render();
    loadAnalytics(true).catch(() => {});
  } catch (error) {
    $("#connectionState").classList.add("offline");
    $("#connectionState").innerHTML = `<i></i> ${t("connectionLost")}`;
    if (!silent) notify(error.message, true);
    if (/UNAUTHORIZED|SESSION|CREDENTIAL/i.test(error.message)) {
      state.authenticated = false;
      showAuth(error.message);
    }
    throw error;
  } finally {
    state.loading = false;
    $("#refreshButton").disabled = false;
  }
}

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#authError").textContent = "";
  try {
    const session = await api(
      "/api/v1/users/signin",
      {
        method: "POST",
        body: JSON.stringify({ email: $("#emailInput").value, password: $("#passwordInput").value }),
      },
      false,
    );
    state.authenticated = true;
    state.user = session.user;
    await refresh(true);
    showApp();
  } catch (error) {
    state.authenticated = false;
    $("#authError").textContent = error.message;
  }
});

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/v1/users/signout", { method: "POST" }, false).catch(() => {});
  state.authenticated = false;
  state.user = null;
  $("#passwordInput").value = "";
  showAuth();
});

$("#refreshButton").addEventListener("click", () => refresh());
$("#openCreateButton").addEventListener("click", () => createDialog.showModal());

document.querySelectorAll(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  }),
);

document.querySelectorAll('input[name="mode"]').forEach((input) =>
  input.addEventListener("change", () => {
    renderCreateMaps(input.value);
  }),
);

function selectedCreateMaps() {
  return [...document.querySelectorAll("[data-create-map]:checked")].map((input) => input.value);
}

function syncStartMap(preferred = $("#startMapInput").value) {
  const selected = selectedCreateMaps();
  const next = selected.includes(preferred) ? preferred : selected[0] || "";
  $("#startMapInput").innerHTML = selected
    .map((map) => `<option value="${escapeHtml(map)}" ${map === next ? "selected" : ""}>${escapeHtml(map)}</option>`)
    .join("");
}

function renderCreateMaps(mode) {
  $("#createMapCategory").textContent = t("mapRotation", {
    mode: mode === "gungame" ? "GunGame" : "Classic",
    count: maps[mode].length,
  });
  $("#createMapGrid").innerHTML = maps[mode]
    .map(
      (map) =>
        `<label class="map-check"><input type="checkbox" data-create-map value="${escapeHtml(map)}" checked><span>${escapeHtml(map)}</span></label>`,
    )
    .join("");
  syncStartMap(mode === "gungame" ? "gg_3way" : "de_dust2");
}

$("#createMapGrid").addEventListener("change", () => syncStartMap());
document.querySelectorAll("[data-create-maps]").forEach((button) =>
  button.addEventListener("click", () => {
    const checked = button.dataset.createMaps === "all";
    document.querySelectorAll("[data-create-map]").forEach((input) => {
      input.checked = checked;
    });
    syncStartMap();
  }),
);

$("#playersRange").addEventListener("input", (event) => {
  $("#playersOutput").value = event.target.value;
});

$("#createForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.maxPlayers = Number(values.maxPlayers);
  values.startImmediately = form.elements.startImmediately.checked;
  values.maps = selectedCreateMaps();
  if (!values.maps.length) {
    notify(t("selectMap"), true);
    return;
  }
  const submit = $("#createSubmit");
  submit.disabled = true;
  submit.textContent = t("deploying");
  try {
    const created = await api("/api/servers", { method: "POST", body: JSON.stringify(values) });
    createDialog.close();
    $("#rconCredential").textContent = created.rconPassword;
    $("#connectHint").textContent = `connect YOUR_SERVER_IP:${created.port}`;
    credentialDialog.showModal();
    await refresh(true);
  } catch (error) {
    notify(error.message, true);
  } finally {
    submit.disabled = false;
    submit.innerHTML = `${t("createServer")} <span>→</span>`;
  }
});

serverGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest(".server-card");
  if (!button || !card) return;
  const server = state.servers.find((entry) => entry.id === card.dataset.id);
  if (!server) return;
  const action = button.dataset.action;

  if (action === "logs") {
    state.logsServer = server;
    $("#logsTitle").textContent = t("serverLogs", { name: server.name });
    logsDialog.showModal();
    await loadLogs();
    state.logsTimer = setInterval(loadLogs, 5000);
    return;
  }

  if (action === "admins") {
    await openAdmins(server);
    return;
  }

  if (action === "maps") {
    await openMaps(server);
    return;
  }

  if (action === "players") {
    await openPlayers(server);
    return;
  }

  if (action === "remove" && !confirm(t("removeConfirm", { name: server.name }))) return;
  button.disabled = true;
  try {
    if (action === "remove") {
      await api(`/api/servers/${server.id}`, { method: "DELETE" });
      notify(t("removed"));
    } else {
      await api(`/api/servers/${server.id}/${action}`, { method: "POST" });
      notify(t("actionRequested", { name: server.name, action: t(action) }));
    }
    setTimeout(() => refresh(true), 700);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

async function loadLogs() {
  if (!state.logsServer || !logsDialog.open) return;
  try {
    const payload = await api(`/api/servers/${state.logsServer.id}/logs`);
    const output = $("#logsOutput");
    const nearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 80;
    output.textContent = payload.logs || t("noLogs");
    if (nearBottom) output.scrollTop = output.scrollHeight;
  } catch (error) {
    $("#logsOutput").textContent = error.message;
  }
}

function closeLogs() {
  clearInterval(state.logsTimer);
  state.logsTimer = null;
  state.logsServer = null;
  logsDialog.close();
}

const adminRoles = {
  full: "abcdefghijklmnopqrstu",
  moderator: "abcdefiju",
  maps: "fju",
};

function adminRole(flags) {
  return Object.entries(adminRoles).find(([, value]) => value === flags)?.[0] || "custom";
}

function adminRow(admin = { steamId: "", flags: adminRoles.full }) {
  const role = adminRole(admin.flags);
  return `<div class="admin-row">
    <label class="field"><span>${t("steamId")}</span><input data-admin-steam required pattern="STEAM_[0-9]+:[01]:[0-9]+" placeholder="STEAM_0:1:123456" value="${escapeHtml(admin.steamId)}"></label>
    <label class="field"><span>${t("role")}</span><select data-admin-role>
      <option value="full" ${role === "full" ? "selected" : ""}>${t("fullAdmin")}</option>
      <option value="moderator" ${role === "moderator" ? "selected" : ""}>${t("moderator")}</option>
      <option value="maps" ${role === "maps" ? "selected" : ""}>${t("mapsVotes")}</option>
      <option value="custom" ${role === "custom" ? "selected" : ""}>${t("customFlags")}</option>
    </select></label>
    <label class="field flags-field"><span>${t("flags")}</span><input data-admin-flags required pattern="[a-u]+" value="${escapeHtml(admin.flags)}"></label>
    <button class="icon-button remove-admin" type="button" aria-label="${t("removeAdmin")}">×</button>
  </div>`;
}

function addAdminRow(admin) {
  $("#adminRows").insertAdjacentHTML("beforeend", adminRow(admin));
}

async function openAdmins(server) {
  state.adminsServer = server;
  $("#adminsTitle").textContent = t("serverAdmins", { name: server.name });
  $("#adminRows").innerHTML = `<p class="muted">${t("loadingAdmins")}</p>`;
  $("#fleetAdminScope").checked = false;
  adminsDialog.showModal();
  try {
    const payload = await api(`/api/servers/${server.id}/admins`);
    $("#adminsSource").textContent = payload.source === "panel" ? t("panelManaged") : t("envDefaults");
    $("#adminRows").innerHTML = "";
    payload.admins.forEach(addAdminRow);
    if (!payload.admins.length) addAdminRow();
  } catch (error) {
    closeAdmins();
    notify(error.message, true);
  }
}

function closeAdmins() {
  state.adminsServer = null;
  adminsDialog.close();
}

function collectAdmins() {
  return [...document.querySelectorAll(".admin-row")]
    .map((row) => ({
      steamId: row.querySelector("[data-admin-steam]").value.trim(),
      flags: row.querySelector("[data-admin-flags]").value.trim(),
    }))
    .filter((admin) => admin.steamId || admin.flags !== adminRoles.full);
}

$("#adminsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity() || !state.adminsServer) return;
  const button = $("#saveAdminsButton");
  button.disabled = true;
  try {
    const scope = $("#fleetAdminScope").checked ? "fleet" : "server";
    const payload = await api(`/api/servers/${state.adminsServer.id}/admins`, {
      method: "PUT",
      body: JSON.stringify({ admins: collectAdmins(), scope }),
    });
    $("#adminsSource").textContent = scope === "fleet" ? t("databaseFleet") : t("panelManaged");
    notify(
      scope === "fleet"
        ? t("fleetAdminsSaved", { count: payload.admins.length, servers: payload.updatedServers })
        : t("adminsSaved", { count: payload.admins.length }),
    );
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#addAdminButton").addEventListener("click", () => addAdminRow());
$("#adminRows").addEventListener("click", (event) =>
  event.target.closest(".remove-admin")?.closest(".admin-row")?.remove(),
);
$("#adminRows").addEventListener("change", (event) => {
  const select = event.target.closest("[data-admin-role]");
  if (!select || select.value === "custom") return;
  select.closest(".admin-row").querySelector("[data-admin-flags]").value = adminRoles[select.value];
});
$("#resetAdminsButton").addEventListener("click", async () => {
  if (!state.adminsServer || !confirm(t("resetAdminsConfirm"))) return;
  try {
    const payload = await api(`/api/servers/${state.adminsServer.id}/admins`, { method: "DELETE" });
    $("#adminsSource").textContent = t("envDefaults");
    $("#adminRows").innerHTML = "";
    payload.admins.forEach(addAdminRow);
    if (!payload.admins.length) addAdminRow();
    notify(t("adminsReset"));
  } catch (error) {
    notify(error.message, true);
  }
});
document.querySelectorAll("[data-close-admins]").forEach((button) => button.addEventListener("click", closeAdmins));

function renderServerMaps() {
  const payload = state.mapsPayload;
  if (!payload) return;
  $("#serverMapGrid").innerHTML = payload.available
    .map((map) => {
      return `<div class="server-map-choice" data-server-map-row data-map-name="${escapeHtml(map.toLowerCase())}">
      <label><input type="checkbox" data-server-map value="${escapeHtml(map)}" ${payload.selected.includes(map) ? "checked" : ""}><span><b>${escapeHtml(map)}</b>${payload.current === map ? `<small>${t("nowPlaying")}</small>` : ""}</span></label>
      ${payload.current === map ? "" : `<button class="play-map" type="button" data-play-map="${escapeHtml(map)}">${t("playNow")}</button>`}
    </div>`;
    })
    .join("");
}

async function openMaps(server) {
  state.mapsServer = server;
  state.mapsPayload = null;
  $("#mapsTitle").textContent = t("serverMaps", { name: server.name });
  $("#currentMapName").textContent = server.map || t("loading");
  $("#serverMapGrid").innerHTML = `<p class="muted">${t("loadingMaps")}</p>`;
  $("#mapSearch").value = "";
  mapsDialog.showModal();
  try {
    state.mapsPayload = await api(`/api/servers/${server.id}/maps`);
    $("#currentMapName").textContent = state.mapsPayload.current || server.map || t("unknown");
    const category = state.mapsPayload.mode === "gungame" ? "GUNGAME" : "CLASSIC";
    $("#mapsSource").textContent = `${category} · ${state.mapsPayload.source === "panel" ? "PANEL" : "RUNTIME"}`;
    $("#mapCategoryHint").textContent = t("categoryMaps", { category });
    renderServerMaps();
  } catch (error) {
    closeMaps();
    notify(error.message, true);
  }
}

function closeMaps() {
  state.mapsServer = null;
  state.mapsPayload = null;
  mapsDialog.close();
}

$("#mapSearch").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document
    .querySelectorAll("[data-server-map-row]")
    .forEach((row) => row.classList.toggle("hidden", Boolean(query) && !row.dataset.mapName.includes(query)));
});
$("#selectAllMaps").addEventListener("click", () =>
  document.querySelectorAll("[data-server-map-row]:not(.hidden) [data-server-map]").forEach((input) => {
    input.checked = true;
  }),
);
$("#clearAllMaps").addEventListener("click", () =>
  document.querySelectorAll("[data-server-map-row]:not(.hidden) [data-server-map]").forEach((input) => {
    input.checked = false;
  }),
);
$("#mapsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.mapsServer) return;
  const selected = [...document.querySelectorAll("[data-server-map]:checked")].map((input) => input.value);
  if (!selected.length) {
    notify(t("selectMap"), true);
    return;
  }
  const button = $("#saveMapsButton");
  button.disabled = true;
  try {
    const payload = await api(`/api/servers/${state.mapsServer.id}/maps`, {
      method: "PUT",
      body: JSON.stringify({ maps: selected }),
    });
    state.mapsPayload = { ...state.mapsPayload, ...payload, current: state.mapsPayload.current };
    const category = state.mapsPayload.mode === "gungame" ? "GUNGAME" : "CLASSIC";
    $("#mapsSource").textContent = `${category} · PANEL`;
    notify(t("mapsSaved", { count: selected.length }));
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("#serverMapGrid").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-play-map]");
  if (!button || !state.mapsServer) return;
  const map = button.dataset.playMap;
  if (!confirm(t("changeMapConfirm", { name: state.mapsServer.name, map }))) return;
  button.disabled = true;
  try {
    await api(`/api/servers/${state.mapsServer.id}/maps/change`, { method: "POST", body: JSON.stringify({ map }) });
    notify(t("changingMap", { name: state.mapsServer.name, map }));
    closeMaps();
    setTimeout(() => refresh(true), 1200);
  } catch (error) {
    button.disabled = false;
    notify(error.message, true);
  }
});
document.querySelectorAll("[data-close-maps]").forEach((button) => button.addEventListener("click", closeMaps));

function playerRow(player) {
  return `<div class="player-row" data-user-id="${player.userId}">
    <div class="player-identity"><b>${escapeHtml(player.name)}</b><code>${escapeHtml(player.steamId)}</code></div>
    <span class="player-stat">${player.frags}</span>
    <span class="player-stat">${player.ping} ms</span>
    <span class="player-stat">${escapeHtml(player.time)}</span>
    <div class="player-actions"><button class="button ghost" type="button" data-player-action="kick">${t("kick")}</button><button class="button ghost danger" type="button" data-player-action="ban">${t("ban")}</button></div>
  </div>`;
}

async function loadPlayers() {
  if (!state.playersServer || !playersDialog.open) return;
  try {
    const payload = await api(`/api/servers/${state.playersServer.id}/players`);
    $("#playersList").innerHTML = payload.players.length
      ? payload.players.map(playerRow).join("")
      : `<div class="players-empty">${t("noPlayers")}</div>`;
  } catch (error) {
    $("#playersList").innerHTML = `<div class="players-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function openPlayers(server) {
  state.playersServer = server;
  $("#playersTitle").textContent = t("serverPlayers", { name: server.name });
  $("#playersList").innerHTML = `<p class="muted">${t("Loading players…")}</p>`;
  playersDialog.showModal();
  await loadPlayers();
  state.playersTimer = setInterval(loadPlayers, 5000);
}

function closePlayers() {
  clearInterval(state.playersTimer);
  state.playersTimer = null;
  state.playersServer = null;
  playersDialog.close();
}

$("#playersList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-player-action]");
  const row = event.target.closest("[data-user-id]");
  if (!button || !row || !state.playersServer) return;
  const action = button.dataset.playerAction;
  const name = row.querySelector(".player-identity b").textContent;
  let minutes = null;
  let scope = null;
  if (action === "ban") {
    const rawMinutes = prompt(t("banMinutes", { name }), "60");
    if (rawMinutes === null) return;
    minutes = Number(rawMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 525600) {
      notify(t("banDurationError"), true);
      return;
    }
    scope = prompt(t("banScope"), "fleet");
    if (scope === null) return;
    scope = scope.trim().toLowerCase();
    if (scope !== "fleet" && scope !== "server") {
      notify(t("banScopeError"), true);
      return;
    }
  }
  const reason = prompt(
    t("actionReason", { action: action === "ban" ? t("ban") : t("kick"), name }),
    action === "ban" ? t("ruleViolation") : t("adminRemoved"),
  );
  if (reason === null) return;
  button.disabled = true;
  try {
    const payload = await api(`/api/servers/${state.playersServer.id}/players/${row.dataset.userId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason, ...(action === "ban" ? { minutes, scope } : {}) }),
    });
    notify(t("playerAction", { name: payload.player.name, status: t(payload.status) }));
    setTimeout(loadPlayers, 500);
    loadAnalytics(true).catch(() => {});
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("#refreshPlayersButton").addEventListener("click", loadPlayers);
document.querySelectorAll("[data-close-players]").forEach((button) => button.addEventListener("click", closePlayers));

function formatCount(value) {
  return Number(value || 0).toLocaleString(getLocale());
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (total < 3600) return `${Math.floor(total / 60)}m`;
  if (total < 86400) return `${(total / 3600).toFixed(total < 36000 ? 1 : 0)}h`;
  return `${(total / 86400).toFixed(1)}d`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString(getLocale(), { dateStyle: "short", timeStyle: "short" }) : t("online");
}

function emptyRows(message) {
  return `<div class="data-empty">${escapeHtml(message)}</div>`;
}

function fillStatsFilters(payload) {
  const serverSelect = $("#statsServerFilter");
  const seasonSelect = $("#statsSeasonFilter");
  const selectedServer = serverSelect.value;
  const selectedSeason = seasonSelect.value;
  serverSelect.innerHTML = `<option value="">${t("allServers")}</option>${payload.servers.map((server) => `<option value="${escapeHtml(server.serverId)}">${escapeHtml(server.name)}</option>`).join("")}`;
  seasonSelect.innerHTML = `<option value="">${t("allTime")}</option>${payload.seasons.map((season) => `<option value="${season.id}">${escapeHtml(season.name)}${season.active ? ` · ${t("active")}` : ""}</option>`).join("")}`;
  if ([...serverSelect.options].some((option) => option.value === selectedServer)) serverSelect.value = selectedServer;
  if ([...seasonSelect.options].some((option) => option.value === selectedSeason)) seasonSelect.value = selectedSeason;
}

async function loadAnalytics(silent = false) {
  if (state.statsLoading || !state.authenticated) return;
  state.statsLoading = true;
  $("#refreshStatsButton").disabled = true;
  try {
    const status = await api("/api/database/status");
    state.databaseConnected = status.connected;
    $("#newSeasonButton").disabled = !status.connected;
    const stateElement = $("#databaseState");
    stateElement.className = `database-state ${status.connected ? "online" : status.enabled ? "offline" : ""}`;
    stateElement.textContent = status.connected
      ? t("mariaConnected")
      : status.enabled
        ? t("mariaUnavailable")
        : t("mariaDisabled");
    $("#databaseDisabled").classList.toggle("hidden", status.enabled && status.connected);
    $("#analyticsContent").classList.toggle("hidden", !status.connected);
    if (!status.connected) {
      if (status.enabled && !silent) notify(status.error || t("mariaUnavailable"), true);
      return;
    }

    const params = new URLSearchParams();
    if ($("#statsServerFilter").value) params.set("serverId", $("#statsServerFilter").value);
    if ($("#statsSeasonFilter").value) params.set("seasonId", $("#statsSeasonFilter").value);
    const suffix = params.size ? `?${params}` : "";
    const [payload, bans, moderation] = await Promise.all([
      api(`/api/stats/overview${suffix}`),
      api("/api/bans"),
      api("/api/moderation/history"),
    ]);
    fillStatsFilters(payload);
    const summary = payload.summary || {};
    const kills = Number(summary.kills || 0);
    const deaths = Number(summary.deaths || 0);
    $("#statsPlayers").textContent = formatCount(summary.players);
    $("#statsKills").textContent = formatCount(kills);
    $("#statsKd").textContent = t("fleetKd", { value: (kills / Math.max(deaths, 1)).toFixed(2) });
    $("#statsHeadshots").textContent = formatCount(summary.headshots);
    $("#statsHsRate").textContent = t("killsPercent", {
      value: kills ? Math.round((Number(summary.headshots || 0) * 100) / kills) : 0,
    });
    $("#statsPlaytime").textContent = formatDuration(summary.playtimeSeconds);
    $("#statsGgWins").textContent = t("ggWins", { count: formatCount(summary.gungameWins) });

    $("#rankingRows").innerHTML = payload.ranking.length
      ? payload.ranking
          .map(
            (player, index) =>
              `<button class="ranking-row ranking-columns" type="button" data-profile="${escapeHtml(player.steamId)}"><span class="ranking-player"><b><i class="ranking-position">#${index + 1}</i>${escapeHtml(player.name)}</b><code>${escapeHtml(player.steamId)}</code></span><span class="ranking-value">${formatCount(player.kills)}</span><span class="ranking-value">${formatCount(player.deaths)}</span><span class="ranking-value">${Number(player.kd || 0).toFixed(2)}</span><span class="ranking-value">${formatCount(player.headshots)}</span><span class="ranking-value">${formatDuration(player.playtimeSeconds)}</span></button>`,
          )
          .join("")
      : emptyRows(t("noPlayerStats"));
    $("#mapStatsRows").innerHTML = payload.maps.length
      ? payload.maps
          .map(
            (map) =>
              `<div class="data-row"><span><b>${escapeHtml(map.mapName)}</b><small>${t("roundsKills", { rounds: formatCount(map.roundsPlayed), kills: formatCount(map.kills) })}</small></span><code>${t("plays", { count: formatCount(map.timesPlayed) })}</code></div>`,
          )
          .join("")
      : emptyRows(t("noMapActivity"));
    $("#sessionRows").innerHTML = payload.sessions.length
      ? payload.sessions
          .map(
            (session) =>
              `<div class="data-row"><span><b>${escapeHtml(session.name)}</b><small>${escapeHtml(session.serverId)} · ${formatDate(session.connectedAt)}</small></span><code>${session.disconnectedAt ? formatDuration(session.playtimeSeconds) : t("online").toUpperCase()}</code></div>`,
          )
          .join("")
      : emptyRows(t("noSessions"));
    $("#achievementRows").innerHTML = payload.achievements.length
      ? payload.achievements
          .map(
            (item) =>
              `<div class="data-row"><span><b>${escapeHtml(item.achievement)}</b><small>${escapeHtml(item.name)} · ${escapeHtml(item.description)}</small></span><code>${formatDate(item.unlockedAt)}</code></div>`,
          )
          .join("")
      : emptyRows(t("achievementsProgress"));
    $("#banRows").innerHTML = bans.bans.length
      ? bans.bans
          .map(
            (ban) =>
              `<div class="data-row ban-row"><span><b>${escapeHtml(ban.playerName || ban.steamId)}</b><small>${escapeHtml(ban.steamId)}</small></span><span><b>${escapeHtml(ban.reason)}</b><small>${ban.serverId ? t("serverScope", { id: escapeHtml(ban.serverId) }) : t("entireFleet")}</small></span><code>${ban.expiresAt ? formatDate(ban.expiresAt) : t("permanent")}</code><button class="button ghost danger" type="button" data-revoke-ban="${ban.id}">${t("revoke")}</button></div>`,
          )
          .join("")
      : emptyRows(t("noBans"));
    $("#moderationRows").innerHTML = moderation.actions.length
      ? moderation.actions
          .slice(0, 12)
          .map(
            (item) =>
              `<div class="data-row"><span><b>${escapeHtml(item.action.toUpperCase())} · ${escapeHtml(item.playerName || item.steamId || "system")}</b><small>${escapeHtml(item.reason)} · ${escapeHtml(item.serverId || "fleet")}</small></span><code>${formatDate(item.createdAt)}</code></div>`,
          )
          .join("")
      : emptyRows(t("noModeration"));
  } catch (error) {
    $("#newSeasonButton").disabled = true;
    $("#databaseState").className = "database-state offline";
    $("#databaseState").textContent = t("dataError");
    if (!silent) notify(error.message, true);
  } finally {
    state.statsLoading = false;
    $("#refreshStatsButton").disabled = false;
  }
}

async function openProfile(steamId) {
  $("#profileTitle").textContent = steamId;
  $("#profileBody").innerHTML = `<p class="muted">${t("Loading player…")}</p>`;
  profileDialog.showModal();
  try {
    const payload = await api(`/api/stats/players/${steamId}`);
    const totals = payload.stats.reduce(
      (result, row) => ({
        kills: result.kills + Number(row.kills),
        deaths: result.deaths + Number(row.deaths),
        playtime: result.playtime + Number(row.playtimeSeconds),
        wins: result.wins + Number(row.gungameWins),
      }),
      { kills: 0, deaths: 0, playtime: 0, wins: 0 },
    );
    $("#profileTitle").textContent = payload.player.name;
    $("#profileBody").innerHTML =
      `<div class="profile-summary"><div><span>${t("steamId")}</span><strong>${escapeHtml(payload.player.steamId)}</strong></div><div><span>${t("killsDeaths")}</span><strong>${formatCount(totals.kills)} / ${formatCount(totals.deaths)}</strong></div><div><span>${t("playtime")}</span><strong>${formatDuration(totals.playtime)}</strong></div><div><span>${t("gungameWinsLabel")}</span><strong>${formatCount(totals.wins)}</strong></div></div><div class="profile-columns"><section><h3>${t("knownNames")}</h3><div class="data-rows compact">${payload.names.map((name) => `<div class="data-row"><span><b>${escapeHtml(name.name)}</b><small>${t("seenTimes", { count: formatCount(name.timesSeen) })}</small></span><code>${formatDate(name.lastSeen)}</code></div>`).join("") || emptyRows(t("noAliases"))}</div></section><section><h3>${t("achievements")}</h3><div class="data-rows compact">${payload.achievements.map((item) => `<div class="data-row"><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></span><code>${formatDate(item.unlockedAt)}</code></div>`).join("") || emptyRows(t("noAchievements"))}</div></section></div>`;
  } catch (error) {
    $("#profileBody").innerHTML = emptyRows(error.message);
  }
}

$("#refreshStatsButton").addEventListener("click", () => loadAnalytics());
$("#newSeasonButton").addEventListener("click", async () => {
  const name = prompt(t("newSeason"), "Season 2");
  if (name === null) return;
  try {
    const season = await api("/api/seasons", { method: "POST", body: JSON.stringify({ name }) });
    notify(t("activeSeason", { name: season.name }));
    await loadAnalytics();
    $("#statsSeasonFilter").value = String(season.id);
    await loadAnalytics();
  } catch (error) {
    notify(error.message, true);
  }
});
$("#statsServerFilter").addEventListener("change", () => loadAnalytics());
$("#statsSeasonFilter").addEventListener("change", () => loadAnalytics());
$("#rankingRows").addEventListener("click", (event) => {
  const row = event.target.closest("[data-profile]");
  if (row) openProfile(row.dataset.profile);
});
$("#banRows").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-revoke-ban]");
  if (!button || !confirm(t("revokeConfirm"))) return;
  button.disabled = true;
  try {
    await api(`/api/bans/${button.dataset.revokeBan}/revoke`, { method: "POST" });
    notify(t("revoked"));
    await loadAnalytics();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
});
document.querySelector("[data-close-profile]").addEventListener("click", () => profileDialog.close());

document.querySelector("[data-close-logs]").addEventListener("click", closeLogs);
$("#refreshLogsButton").addEventListener("click", loadLogs);
document
  .querySelectorAll("[data-close-create]")
  .forEach((button) => button.addEventListener("click", () => createDialog.close()));
document.querySelector("[data-close-credential]").addEventListener("click", () => credentialDialog.close());
$("#copyCredential").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#rconCredential").textContent);
  notify(t("copied"));
});

setInterval(() => {
  if (!document.hidden && state.authenticated && !appView.classList.contains("hidden")) refresh(true).catch(() => {});
}, 7000);

window.addEventListener("i18n:change", () => {
  render();
  const mode = document.querySelector('input[name="mode"]:checked')?.value || "classic";
  renderCreateMaps(mode);
  if (state.mapsPayload) {
    const category = state.mapsPayload.mode === "gungame" ? "GUNGAME" : "CLASSIC";
    $("#mapCategoryHint").textContent = t("categoryMaps", { category });
    renderServerMaps();
  }
  if (state.authenticated) loadAnalytics(true).catch(() => {});
  translateDocument();
});

(async () => {
  try {
    const session = await api("/api/v1/users/session", {}, false).catch(() =>
      api("/api/v1/users/session/refresh", { method: "POST" }, false),
    );
    state.authenticated = true;
    state.user = session.user;
    showApp();
    await refresh(true);
  } catch {
    showAuth();
  }
})();
renderCreateMaps("classic");
