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
  editServer: null,
  uploadServer: null,
  backupsServer: null,
  backups: [],
  operators: [],
  auditEvents: [],
  statsLoading: false,
  databaseConnected: false,
};

const $ = (selector) => document.querySelector(selector);
const authView = $("#authView");
const appView = $("#appView");
const serverGrid = $("#serverGrid");
const emptyState = $("#emptyState");
const createDialog = $("#createDialog");
const editDialog = $("#editDialog");
const logsDialog = $("#logsDialog");
const credentialDialog = $("#credentialDialog");
const adminsDialog = $("#adminsDialog");
const mapsDialog = $("#mapsDialog");
const playersDialog = $("#playersDialog");
const backupsDialog = $("#backupsDialog");
const auditDialog = $("#auditDialog");
const operatorsDialog = $("#operatorsDialog");
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
  applyPermissionUi();
}

function showAuth(message = "") {
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  $("#authError").textContent = message;
  $("#emailInput").focus();
}

function shortImageId(value) {
  return String(value || "")
    .replace(/^sha256:/, "")
    .slice(0, 12);
}

function can(permission) {
  return state.user?.permissions?.includes(permission) === true;
}

function applyPermissionUi() {
  $("#currentRole").textContent = state.user?.role?.toUpperCase() || "";
  $("#openAuditButton").classList.toggle("hidden", !can("audit.read"));
  $("#openOperatorsButton").classList.toggle("hidden", !can("operators.manage"));
  $("#openCreateButton").classList.toggle("hidden", !can("servers.manage"));
  $("#newSeasonButton").classList.toggle("hidden", !can("seasons.manage"));
}

function serverCard(server) {
  const online = server.state === "running";
  const canRemove = server.managedBy === "panel" && !online;
  const players = server.players === null ? "—" : server.players;
  const capacity = server.liveMaxPlayers || server.maxPlayers;
  const currentMap = server.map || server.startMap || t("starting");
  const currentImage = shortImageId(server.imageId) || "—";
  const targetImage = shortImageId(server.targetImageId) || "—";
  const imageTitle = `${t("currentImage")}: ${server.imageId || "—"}\n${t("availableImage")}: ${server.targetImageId || "—"}`;
  const canOperate = can("servers.operate");
  const canManage = can("servers.manage");
  return `
    <article class="server-card ${online ? "online" : ""}" data-id="${server.id}">
      <div class="card-head">
        <div class="card-title"><i class="status-orb"></i><div><h3>${escapeHtml(server.name)}</h3><p>${escapeHtml(server.containerName)}</p>${server.managedBy === "panel" ? `<p class="image-build" title="${escapeHtml(imageTitle)}">IMAGE ${escapeHtml(currentImage)}${server.updateAvailable ? ` → ${escapeHtml(targetImage)}` : ""}</p>` : ""}</div></div>
        <div class="badges"><span class="badge mode">${escapeHtml(server.mode)}</span><span class="badge">${escapeHtml(server.managedBy)}</span>${server.managedBy === "panel" ? `<span class="badge ${server.updateAvailable ? "update" : "current"}">${t(server.updateAvailable ? "updateAvailable" : "upToDate")}</span>` : ""}</div>
      </div>
      <div class="server-data">
        <div><span>${t("status")}</span><strong>${escapeHtml(t(online ? server.health : server.state))}</strong></div>
        <div><span>${t("players")}</span><strong>${players} / ${capacity}</strong></div>
        <div><span>${t("map")}</span><strong title="${escapeHtml(currentMap)}">${escapeHtml(currentMap)}</strong></div>
        <div><span>${t("port")}</span><strong>:${server.port ?? "—"}</strong></div>
      </div>
      <div class="card-actions">
        ${canOperate ? (online ? `<button class="button ghost" data-action="stop">■ ${t("stop")}</button><button class="button ghost" data-action="restart">↻ ${t("restart")}</button>` : `<button class="button primary" data-action="start">▶ ${t("start")}</button>`) : ""}
        <button class="button ghost" data-action="logs">${t("logs")}</button>
        ${canManage && server.managedBy === "panel" ? `<button class="button ghost" data-action="edit">${t("edit")}</button>` : ""}
        ${canManage && server.updateAvailable ? `<button class="button ghost update-button" data-action="update">${t("update")}</button>` : ""}
        <button class="button ghost" data-action="players" ${online ? "" : `disabled title="${t("viewPlayersHint")}"`}>${t("players")}</button>
        <button class="button ghost" data-action="maps" ${online ? "" : `disabled title="${t("manageMapsHint")}"`}>${t("maps")}</button>
        ${canManage ? `<button class="button ghost" data-action="upload-maps" ${server.updateAvailable ? `disabled title="${t("updateBeforeUpload")}"` : ""}>${t("uploadMaps")}</button>` : ""}
        ${can("admins.manage") ? `<button class="button ghost" data-action="admins" ${online ? "" : `disabled title="${t("manageAdminsHint")}"`}>${t("admins")}</button>` : ""}
        ${can("backups.manage") && server.managedBy === "panel" ? `<button class="button ghost" data-action="backups">${t("backups")}</button>` : ""}
        ${canManage && canRemove ? `<button class="button ghost danger" data-action="remove">${t("remove")}</button>` : ""}
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
  const updates = state.servers.filter((server) => server.updateAvailable);
  const updateAll = $("#updateAllButton");
  updateAll.classList.toggle("hidden", updates.length === 0 || !can("servers.manage"));
  updateAll.textContent = t("updateAllCount", { count: updates.length });
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
  const button = $("#logoutButton");
  button.disabled = true;
  try {
    await api("/api/v1/users/signout", { method: "POST" }, false);
    state.authenticated = false;
    state.user = null;
    $("#passwordInput").value = "";
    showAuth();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#refreshButton").addEventListener("click", () => refresh());
$("#openCreateButton").addEventListener("click", () => createDialog.showModal());
$("#updateAllButton").addEventListener("click", async () => {
  const servers = state.servers.filter((server) => server.updateAvailable);
  if (!servers.length) return;
  const players = servers.reduce((total, server) => total + Number(server.players || 0), 0);
  const message = players
    ? t("updateAllPlayersConfirm", { count: servers.length, players })
    : t("updateAllConfirm", { count: servers.length });
  if (!confirm(message)) return;
  const button = $("#updateAllButton");
  button.disabled = true;
  button.textContent = t("updatingAll");
  try {
    const result = await api("/api/fleet/server-images", { method: "PUT" });
    if (result.failed.length) {
      notify(
        t("fleetUpdatePartial", {
          updated: result.updated.length,
          failed: result.failed.length,
          names: result.failed.map((server) => server.name).join(", "),
        }),
        true,
      );
    } else {
      notify(t("fleetUpdated", { count: result.updated.length }));
    }
    await refresh(true);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll(".filter").forEach((button) =>
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  }),
);

document.querySelectorAll('#createForm input[name="mode"]').forEach((input) =>
  input.addEventListener("change", () => {
    renderCreateMaps(input.value);
  }),
);

document.querySelectorAll('#editForm input[name="mode"]').forEach((input) =>
  input.addEventListener("change", () => {
    renderEditMaps(input.value);
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

function selectedEditMaps() {
  return [...document.querySelectorAll("[data-edit-map]:checked")].map((input) => input.value);
}

function syncEditStartMap(preferred = $("#editStartMapInput").value) {
  const selected = selectedEditMaps();
  const next = selected.includes(preferred) ? preferred : selected[0] || "";
  $("#editStartMapInput").innerHTML = selected
    .map((map) => `<option value="${escapeHtml(map)}" ${map === next ? "selected" : ""}>${escapeHtml(map)}</option>`)
    .join("");
}

function renderEditMaps(mode, selected = maps[mode], preferred = null) {
  const selectedSet = new Set(selected);
  $("#editMapCategory").textContent = t("mapRotation", {
    mode: mode === "gungame" ? "GunGame" : "Classic",
    count: maps[mode].length,
  });
  $("#editMapGrid").innerHTML = maps[mode]
    .map(
      (map) =>
        `<label class="map-check"><input type="checkbox" data-edit-map value="${escapeHtml(map)}" ${selectedSet.has(map) ? "checked" : ""}><span>${escapeHtml(map)}</span></label>`,
    )
    .join("");
  syncEditStartMap(preferred || (mode === "gungame" ? "gg_3way" : "de_dust2"));
}

$("#editMapGrid").addEventListener("change", () => syncEditStartMap());
document.querySelectorAll("[data-edit-maps]").forEach((button) =>
  button.addEventListener("click", () => {
    const checked = button.dataset.editMaps === "all";
    document.querySelectorAll("[data-edit-map]").forEach((input) => {
      input.checked = checked;
    });
    syncEditStartMap();
  }),
);

$("#editPlayersRange").addEventListener("input", (event) => {
  $("#editPlayersOutput").value = event.target.value;
});

async function openEdit(server) {
  state.editServer = server;
  const form = $("#editForm");
  form.reset();
  $("#editTitle").textContent = t("editServer", { name: server.name });
  $("#editSubmit").disabled = true;
  editDialog.showModal();
  try {
    const configuration = await api(`/api/servers/${server.id}/configuration`);
    if (state.editServer?.id !== server.id) return;
    form.elements.name.value = configuration.name;
    form.elements.mode.value = configuration.mode;
    form.elements.maxPlayers.value = configuration.maxPlayers;
    $("#editPlayersOutput").value = configuration.maxPlayers;
    form.elements.port.value = configuration.port;
    form.elements.serverPassword.placeholder = configuration.hasServerPassword
      ? t("passwordConfigured")
      : t("noPasswordConfigured");
    form.elements.rconPassword.placeholder = t("passwordConfigured");
    renderEditMaps(configuration.mode, configuration.maps, configuration.startMap);
    $("#editSubmit").disabled = false;
  } catch (error) {
    editDialog.close();
    state.editServer = null;
    notify(error.message, true);
  }
}

$("#editForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !state.editServer) return;
  const selectedMaps = selectedEditMaps();
  if (!selectedMaps.length) {
    notify(t("selectMap"), true);
    return;
  }
  if (state.editServer.state === "running" && !confirm(t("editRestartConfirm", { name: state.editServer.name }))) {
    return;
  }
  const values = Object.fromEntries(new FormData(form));
  values.maxPlayers = Number(values.maxPlayers);
  values.port = Number(values.port);
  values.maps = selectedMaps;
  values.clearServerPassword = form.elements.clearServerPassword.checked;
  const submit = $("#editSubmit");
  submit.disabled = true;
  submit.textContent = t("savingServer");
  try {
    await api(`/api/servers/${state.editServer.id}`, { method: "PUT", body: JSON.stringify(values) });
    editDialog.close();
    notify(t("serverUpdated"));
    state.editServer = null;
    await refresh(true);
  } catch (error) {
    notify(error.message, true);
  } finally {
    submit.disabled = false;
    submit.innerHTML = `${t("saveRecreate")} <span>→</span>`;
  }
});

serverGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest(".server-card");
  if (!button || !card) return;
  const server = state.servers.find((entry) => entry.id === card.dataset.id);
  if (!server) return;
  const action = button.dataset.action;

  if (action === "edit") {
    await openEdit(server);
    return;
  }

  if (action === "update") {
    const connectedPlayers = Number(server.players || 0);
    const message = connectedPlayers
      ? t("updatePlayersConfirm", { name: server.name, count: connectedPlayers })
      : t("updateConfirm", { name: server.name });
    if (!confirm(message)) return;
    button.disabled = true;
    button.textContent = t("updating");
    try {
      await api(`/api/servers/${server.id}/image`, { method: "PUT" });
      notify(t("serverImageUpdated", { name: server.name }));
      await refresh(true);
    } catch (error) {
      notify(error.message, true);
      button.disabled = false;
      button.textContent = t("update");
    }
    return;
  }

  if (action === "upload-maps") {
    chooseMapPackage(server);
    return;
  }

  if (action === "backups") {
    await openBackups(server);
    return;
  }

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
      <label><input type="checkbox" data-server-map value="${escapeHtml(map)}" ${payload.selected.includes(map) ? "checked" : ""} ${can("maps.manage") ? "" : "disabled"}><span><b>${escapeHtml(map)}</b>${payload.current === map ? `<small>${t("nowPlaying")}</small>` : ""}</span></label>
      ${payload.current === map || !can("maps.manage") ? "" : `<button class="play-map" type="button" data-play-map="${escapeHtml(map)}">${t("playNow")}</button>`}
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
  $("#uploadMapFolderButton").classList.toggle("hidden", !can("servers.manage"));
  $("#selectAllMaps").classList.toggle("hidden", !can("maps.manage"));
  $("#clearAllMaps").classList.toggle("hidden", !can("maps.manage"));
  $("#saveMapsButton").classList.toggle("hidden", !can("maps.manage"));
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

function chooseMapPackage(server) {
  state.uploadServer = server;
  const input = $("#mapPackageInput");
  input.value = "";
  input.click();
}

async function fileBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

$("#mapPackageInput").addEventListener("change", async (event) => {
  const server = state.uploadServer;
  const files = [...event.target.files];
  if (!server || !files.length) return;
  if (files.length > 128) {
    notify(t("mapPackageFileLimit"), true);
    return;
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > 32 * 1024 * 1024) {
    notify(t("mapPackageSizeLimit"), true);
    return;
  }
  if (!confirm(t("uploadMapConfirm", { name: server.name, count: files.length }))) return;
  notify(t("uploadingMaps"));
  try {
    const payload = {
      mode: server.mode,
      files: await Promise.all(
        files.map(async (file) => ({
          path: file.webkitRelativePath || file.name,
          content: await fileBase64(file),
        })),
      ),
    };
    const result = await api(`/api/servers/${server.id}/maps/upload`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    notify(t("mapsUploaded", { maps: result.maps.join(", "), count: result.files }));
    if (state.mapsServer?.id === server.id && mapsDialog.open) {
      closeMaps();
      await openMaps(server);
    }
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.uploadServer = null;
    event.target.value = "";
  }
});

$("#uploadMapFolderButton").addEventListener("click", () => {
  if (state.mapsServer) chooseMapPackage(state.mapsServer);
});

function closeMaps() {
  state.mapsServer = null;
  state.mapsPayload = null;
  mapsDialog.close();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function renderBackups() {
  const rows = $("#backupRows");
  if (!state.backups.length) {
    rows.innerHTML = `<p class="muted">${t("noBackups")}</p>`;
    return;
  }
  rows.innerHTML = state.backups
    .map((backup) => {
      const flags = [
        backup.includes?.data ? "AMXX" : null,
        backup.includes?.logs ? "LOGS" : null,
        backup.includes?.database ? "DB" : null,
      ].filter(Boolean);
      return `<article class="backup-row" data-backup="${escapeHtml(backup.filename)}">
        <div class="backup-info"><strong>${escapeHtml(backup.kind === "safety" ? t("safetyBackup") : backup.name)}</strong><span>${escapeHtml(new Date(backup.createdAt).toLocaleString(getLocale()))} · ${formatBytes(backup.size)}</span><div class="badges">${flags.map((flag) => `<span class="badge">${flag}</span>`).join("")}</div></div>
        <div class="backup-actions"><a class="button ghost" href="/api/backups/${encodeURIComponent(backup.filename)}/download" download>${t("download")}</a><button class="button ghost" type="button" data-restore-backup>${t("restore")}</button><button class="button ghost danger" type="button" data-delete-backup>${t("remove")}</button></div>
      </article>`;
    })
    .join("");
}

async function loadBackups() {
  if (!state.backupsServer) return;
  $("#backupRows").innerHTML = `<p class="muted">${t("loadingBackups")}</p>`;
  try {
    const payload = await api(`/api/backups?serverId=${encodeURIComponent(state.backupsServer.serverId)}`);
    state.backups = payload.backups;
    renderBackups();
  } catch (error) {
    $("#backupRows").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

async function openBackups(server) {
  state.backupsServer = server;
  state.backups = [];
  $("#backupsTitle").textContent = t("serverBackups", { name: server.name });
  $("#backupIncludeLogs").checked = false;
  $("#backupIncludeDatabase").checked = false;
  $("#backupIncludeDatabase").disabled = !state.databaseConnected;
  backupsDialog.showModal();
  await loadBackups();
}

function closeBackups() {
  state.backupsServer = null;
  state.backups = [];
  backupsDialog.close();
}

$("#backupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.backupsServer) return;
  const button = $("#createBackupButton");
  button.disabled = true;
  button.textContent = t("creatingBackup");
  try {
    await api(`/api/servers/${state.backupsServer.id}/backups`, {
      method: "POST",
      body: JSON.stringify({
        includeLogs: $("#backupIncludeLogs").checked,
        includeDatabase: $("#backupIncludeDatabase").checked,
      }),
    });
    notify(t("backupCreated"));
    await loadBackups();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = t("createBackup");
  }
});

$("#backupRows").addEventListener("click", async (event) => {
  const row = event.target.closest("[data-backup]");
  if (!row || !state.backupsServer) return;
  const backup = state.backups.find((entry) => entry.filename === row.dataset.backup);
  if (!backup) return;

  if (event.target.closest("[data-delete-backup]")) {
    if (!confirm(t("deleteBackupConfirm", { date: new Date(backup.createdAt).toLocaleString(getLocale()) }))) return;
    try {
      await api(`/api/backups/${encodeURIComponent(backup.filename)}`, { method: "DELETE" });
      notify(t("backupDeleted"));
      await loadBackups();
    } catch (error) {
      notify(error.message, true);
    }
    return;
  }

  const restoreButton = event.target.closest("[data-restore-backup]");
  if (!restoreButton) return;
  const restoreDatabase =
    backup.includes?.database && confirm(t("restoreDatabaseConfirm", { name: state.backupsServer.name }));
  if (!confirm(t("restoreBackupConfirm", { name: state.backupsServer.name }))) return;
  restoreButton.disabled = true;
  restoreButton.textContent = t("restoring");
  try {
    const result = await api(
      `/api/servers/${state.backupsServer.id}/backups/${encodeURIComponent(backup.filename)}/restore`,
      {
        method: "POST",
        body: JSON.stringify({ restoreLogs: backup.includes?.logs === true, restoreDatabase }),
      },
    );
    notify(t("backupRestored", { safety: result.safetyBackup }));
    closeBackups();
    await refresh(true);
  } catch (error) {
    notify(error.message, true);
    restoreButton.disabled = false;
    restoreButton.textContent = t("restore");
  }
});

$("#refreshBackupsButton").addEventListener("click", loadBackups);
document.querySelectorAll("[data-close-backups]").forEach((button) => button.addEventListener("click", closeBackups));

function operatorRoleOptions(selected) {
  return ["viewer", "moderator", "admin", "owner"]
    .map(
      (role) => `<option value="${role}" ${role === selected ? "selected" : ""}>${t(`operatorRole_${role}`)}</option>`,
    )
    .join("");
}

function renderOperators() {
  $("#operatorRows").innerHTML = state.operators.length
    ? state.operators
        .map(
          (operator) => `<article class="operator-row" data-operator-id="${operator.id}">
            <div class="operator-identity"><label class="field"><span>${t("name")}</span><input data-operator-name value="${escapeHtml(operator.name)}" maxlength="128"></label><span>${escapeHtml(operator.email)}${operator.id === state.user.id ? ` · ${t("currentUser")}` : ""}</span></div>
            <label class="field"><span>${t("role")}</span><select data-operator-role>${operatorRoleOptions(operator.role)}</select></label>
            <label class="toggle compact"><input data-operator-active type="checkbox" ${operator.active ? "checked" : ""}><i></i><span><b>${t(operator.active ? "active" : "inactive")}</b></span></label>
            <div class="operator-actions"><button class="button ghost" type="button" data-operator-save>${t("save")}</button><button class="button ghost" type="button" data-operator-password>${t("password")}</button><button class="button ghost danger" type="button" data-operator-delete>${t("remove")}</button></div>
          </article>`,
        )
        .join("")
    : `<p class="muted">${t("noOperators")}</p>`;
}

async function loadOperators() {
  $("#operatorRows").innerHTML = `<p class="muted">${t("loadingOperators")}</p>`;
  try {
    const payload = await api("/api/operators");
    state.operators = payload.operators;
    renderOperators();
  } catch (error) {
    $("#operatorRows").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

$("#openOperatorsButton").addEventListener("click", async () => {
  operatorsDialog.showModal();
  await loadOperators();
});
document.querySelector("[data-close-operators]").addEventListener("click", () => operatorsDialog.close());

$("#createOperatorForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(event.currentTarget));
  values.preferredLocale = getLocale().startsWith("bg") ? "bg" : "en";
  button.disabled = true;
  try {
    await api("/api/operators", { method: "POST", body: JSON.stringify(values) });
    event.currentTarget.reset();
    notify(t("operatorCreated"));
    await loadOperators();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#operatorRows").addEventListener("click", async (event) => {
  const row = event.target.closest("[data-operator-id]");
  if (!row) return;
  const operator = state.operators.find((entry) => entry.id === row.dataset.operatorId);
  if (!operator) return;
  const clicked = event.target.closest("button");
  if (!clicked) return;
  clicked.disabled = true;
  try {
    if (clicked.matches("[data-operator-save]")) {
      await api(`/api/operators/${operator.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: row.querySelector("[data-operator-name]").value,
          role: row.querySelector("[data-operator-role]").value,
          active: row.querySelector("[data-operator-active]").checked,
        }),
      });
      notify(t("operatorUpdated"));
    } else if (clicked.matches("[data-operator-password]")) {
      const password = prompt(t("newOperatorPassword", { email: operator.email }));
      if (password === null) return;
      if (password.length < 12) throw new Error(t("passwordLength"));
      await api(`/api/operators/${operator.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      notify(t("operatorPasswordChanged"));
    } else if (clicked.matches("[data-operator-delete]")) {
      if (!confirm(t("deleteOperatorConfirm", { email: operator.email }))) return;
      await api(`/api/operators/${operator.id}`, { method: "DELETE" });
      notify(t("operatorDeleted"));
    }
    await loadOperators();
  } catch (error) {
    notify(error.message, true);
  } finally {
    clicked.disabled = false;
  }
});

function auditDate(value) {
  return value ? new Date(value).toISOString() : "";
}

function fillAuditFilters(payload) {
  const operator = $("#auditOperatorFilter");
  const action = $("#auditActionFilter");
  const server = $("#auditServerFilter");
  const selections = { operator: operator.value, action: action.value, server: server.value };
  operator.innerHTML = `<option value="">${t("allOperators")}</option>${payload.operators.map((item) => `<option value="${item.id}">${escapeHtml(item.name || item.email)}</option>`).join("")}`;
  action.innerHTML = `<option value="">${t("allActions")}</option>${payload.actions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
  server.innerHTML = `<option value="">${t("allServers")}</option>${state.servers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  operator.value = selections.operator;
  action.value = selections.action;
  server.value = selections.server;
}

function renderAuditEvents() {
  $("#auditRows").innerHTML = state.auditEvents.length
    ? state.auditEvents
        .map(
          (event) =>
            `<article class="audit-row"><span class="audit-status ${event.status}">${escapeHtml(event.status)}</span><div><strong>${escapeHtml(event.action)}</strong><span>${escapeHtml(event.actorName || event.actorEmail || t("system"))}${event.serverId ? ` · ${escapeHtml(event.serverId)}` : ""}${event.targetName ? ` · ${escapeHtml(event.targetName)}` : ""}</span></div><code title="${escapeHtml(event.requestId || "")}">${formatDate(event.createdAt)}</code></article>`,
        )
        .join("")
    : `<p class="muted">${t("noAuditEvents")}</p>`;
}

async function loadAudit() {
  $("#auditRows").innerHTML = `<p class="muted">${t("loadingAudit")}</p>`;
  const params = new URLSearchParams({ limit: "200" });
  const values = {
    operatorId: $("#auditOperatorFilter").value,
    serverId: $("#auditServerFilter").value,
    action: $("#auditActionFilter").value,
    status: $("#auditStatusFilter").value,
    from: auditDate($("#auditFromFilter").value),
    to: auditDate($("#auditToFilter").value),
  };
  Object.entries(values).forEach(([key, value]) => value && params.set(key, value));
  try {
    const payload = await api(`/api/audit-logs?${params}`);
    state.auditEvents = payload.events;
    fillAuditFilters(payload);
    renderAuditEvents();
  } catch (error) {
    $("#auditRows").innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

$("#openAuditButton").addEventListener("click", async () => {
  auditDialog.showModal();
  await loadAudit();
});
$("#refreshAuditButton").addEventListener("click", loadAudit);
document.querySelector("[data-close-audit]").addEventListener("click", () => auditDialog.close());

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
    <div class="player-actions">${can("players.moderate") ? `<button class="button ghost" type="button" data-player-action="kick">${t("kick")}</button><button class="button ghost danger" type="button" data-player-action="ban">${t("ban")}</button>` : "—"}</div>
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
              `<div class="data-row ban-row"><span><b>${escapeHtml(ban.playerName || ban.steamId)}</b><small>${escapeHtml(ban.steamId)}</small></span><span><b>${escapeHtml(ban.reason)}</b><small>${ban.serverId ? t("serverScope", { id: escapeHtml(ban.serverId) }) : t("entireFleet")}</small></span><code>${ban.expiresAt ? formatDate(ban.expiresAt) : t("permanent")}</code>${can("moderation.manage") ? `<button class="button ghost danger" type="button" data-revoke-ban="${ban.id}">${t("revoke")}</button>` : ""}</div>`,
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
document.querySelectorAll("[data-close-edit]").forEach((button) =>
  button.addEventListener("click", () => {
    editDialog.close();
    state.editServer = null;
  }),
);
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
  const mode = document.querySelector('#createForm input[name="mode"]:checked')?.value || "classic";
  renderCreateMaps(mode);
  if (editDialog.open) {
    const editMode = document.querySelector('#editForm input[name="mode"]:checked')?.value || "classic";
    renderEditMaps(editMode, selectedEditMaps(), $("#editStartMapInput").value);
  }
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
