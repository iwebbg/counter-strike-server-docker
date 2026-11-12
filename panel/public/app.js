const state = {
  token: sessionStorage.getItem('cs16-panel-token') || '',
  servers: [],
  filter: 'all',
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
const authView = $('#authView');
const appView = $('#appView');
const serverGrid = $('#serverGrid');
const emptyState = $('#emptyState');
const createDialog = $('#createDialog');
const logsDialog = $('#logsDialog');
const credentialDialog = $('#credentialDialog');
const adminsDialog = $('#adminsDialog');
const mapsDialog = $('#mapsDialog');
const playersDialog = $('#playersDialog');
const profileDialog = $('#profileDialog');
const toast = $('#toast');
const maps = {
  classic: ['de_dust2', 'de_inferno', 'de_nuke', 'de_train', 'cs_office', 'de_csgothic', 'de_mini_train2', 'de_nuke_fora', 'de_solitude'],
  gungame: ['gg_3way', 'gg_aztec_VS_dust', 'gg_buzz', 'gg_fy_deagle_dustworld', 'gg_fy_deagle_dustworld3', 'gg_hideout', 'gg_inferno', 'gg_js_cbble', 'gg_mariocastle_mt', 'gg_mini_dust2', 'gg_mini_skilluj', 'gg_os_arena'],
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function notify(message, error = false) {
  clearTimeout(notify.timer);
  clearTimeout(notify.hideTimer);
  if (typeof toast.showPopover === 'function' && !toast.matches(':popover-open')) toast.showPopover();
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  notify.timer = setTimeout(() => {
    toast.className = 'toast';
    notify.hideTimer = setTimeout(() => {
      if (typeof toast.hidePopover === 'function' && toast.matches(':popover-open')) toast.hidePopover();
    }, 220);
  }, 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${state.token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function showApp() {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
}

function showAuth(message = '') {
  appView.classList.add('hidden');
  authView.classList.remove('hidden');
  $('#authError').textContent = message;
  $('#tokenInput').focus();
}

function serverCard(server) {
  const online = server.state === 'running';
  const canRemove = server.managedBy === 'panel' && !online;
  const players = server.players === null ? '—' : server.players;
  const capacity = server.liveMaxPlayers || server.maxPlayers;
  const currentMap = server.map || server.startMap || 'starting…';
  return `
    <article class="server-card ${online ? 'online' : ''}" data-id="${server.id}">
      <div class="card-head">
        <div class="card-title"><i class="status-orb"></i><div><h3>${escapeHtml(server.name)}</h3><p>${escapeHtml(server.containerName)}</p></div></div>
        <div class="badges"><span class="badge mode">${escapeHtml(server.mode)}</span><span class="badge">${escapeHtml(server.managedBy)}</span></div>
      </div>
      <div class="server-data">
        <div><span>Status</span><strong>${online ? escapeHtml(server.health) : escapeHtml(server.state)}</strong></div>
        <div><span>Players</span><strong>${players} / ${capacity}</strong></div>
        <div><span>Map</span><strong title="${escapeHtml(currentMap)}">${escapeHtml(currentMap)}</strong></div>
        <div><span>Port</span><strong>:${server.port ?? '—'}</strong></div>
      </div>
      <div class="card-actions">
        ${online
          ? `<button class="button ghost" data-action="stop">■ Stop</button><button class="button ghost" data-action="restart">↻ Restart</button>`
          : `<button class="button primary" data-action="start">▶ Start</button>`}
        <button class="button ghost" data-action="logs">Logs</button>
        <button class="button ghost" data-action="players" ${online ? '' : 'disabled title="Start the server to view players"'}>Players</button>
        <button class="button ghost" data-action="maps" ${online ? '' : 'disabled title="Start the server to manage maps"'}>Maps</button>
        <button class="button ghost" data-action="admins" ${online ? '' : 'disabled title="Start the server to manage admins"'}>Admins</button>
        ${canRemove ? `<button class="button ghost danger" data-action="remove">Remove</button>` : ''}
      </div>
    </article>`;
}

function render() {
  const visible = state.servers.filter((server) => state.filter === 'all' || server.state === state.filter);
  serverGrid.innerHTML = visible.map(serverCard).join('');
  emptyState.classList.toggle('hidden', visible.length !== 0);

  const online = state.servers.filter((server) => server.state === 'running');
  const knownPlayers = online.reduce((total, server) => total + (server.players || 0), 0);
  const capacity = online.reduce((total, server) => total + (server.liveMaxPlayers || server.maxPlayers || 0), 0);
  $('#totalMetric').textContent = state.servers.length;
  $('#onlineMetric').textContent = online.length;
  $('#playersMetric').textContent = knownPlayers;
  $('#capacityMetric').textContent = `${capacity} online slots`;
}

async function refresh(silent = false) {
  if (state.loading) return;
  state.loading = true;
  $('#refreshButton').disabled = true;
  try {
    const payload = await api('/api/servers');
    state.servers = payload.servers;
    $('#portsMetric').textContent = `${payload.portRange[0]}–${payload.portRange[1]}`;
    $('#connectionState').classList.remove('offline');
    $('#connectionState').innerHTML = '<i></i> Docker connected';
    render();
    loadAnalytics(true).catch(() => {});
  } catch (error) {
    $('#connectionState').classList.add('offline');
    $('#connectionState').innerHTML = '<i></i> Connection lost';
    if (!silent) notify(error.message, true);
    if (/token/i.test(error.message)) {
      sessionStorage.removeItem('cs16-panel-token');
      state.token = '';
      showAuth(error.message);
    }
    throw error;
  } finally {
    state.loading = false;
    $('#refreshButton').disabled = false;
  }
}

$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = $('#tokenInput').value;
  state.token = token;
  $('#authError').textContent = '';
  try {
    await refresh(true);
    sessionStorage.setItem('cs16-panel-token', token);
    showApp();
  } catch (error) {
    state.token = '';
    $('#authError').textContent = error.message;
  }
});

$('#logoutButton').addEventListener('click', () => {
  sessionStorage.removeItem('cs16-panel-token');
  state.token = '';
  $('#tokenInput').value = '';
  showAuth();
});

$('#refreshButton').addEventListener('click', () => refresh());
$('#openCreateButton').addEventListener('click', () => createDialog.showModal());

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter').forEach((entry) => entry.classList.remove('active'));
  button.classList.add('active');
  state.filter = button.dataset.filter;
  render();
}));

document.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', () => {
  renderCreateMaps(input.value);
}));

function selectedCreateMaps() {
  return [...document.querySelectorAll('[data-create-map]:checked')].map((input) => input.value);
}

function syncStartMap(preferred = $('#startMapInput').value) {
  const selected = selectedCreateMaps();
  const next = selected.includes(preferred) ? preferred : selected[0] || '';
  $('#startMapInput').innerHTML = selected.map((map) => `<option value="${escapeHtml(map)}" ${map === next ? 'selected' : ''}>${escapeHtml(map)}</option>`).join('');
}

function renderCreateMaps(mode) {
  $('#createMapCategory').textContent = `${mode === 'gungame' ? 'GunGame' : 'Classic'} map rotation · ${maps[mode].length} maps`;
  $('#createMapGrid').innerHTML = maps[mode].map((map) => `<label class="map-check"><input type="checkbox" data-create-map value="${escapeHtml(map)}" checked><span>${escapeHtml(map)}</span></label>`).join('');
  syncStartMap(mode === 'gungame' ? 'gg_3way' : 'de_dust2');
}

$('#createMapGrid').addEventListener('change', () => syncStartMap());
document.querySelectorAll('[data-create-maps]').forEach((button) => button.addEventListener('click', () => {
  const checked = button.dataset.createMaps === 'all';
  document.querySelectorAll('[data-create-map]').forEach((input) => { input.checked = checked; });
  syncStartMap();
}));

$('#playersRange').addEventListener('input', (event) => { $('#playersOutput').value = event.target.value; });

$('#createForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.maxPlayers = Number(values.maxPlayers);
  values.startImmediately = form.elements.startImmediately.checked;
  values.maps = selectedCreateMaps();
  if (!values.maps.length) {
    notify('Select at least one map for the rotation.', true);
    return;
  }
  const submit = $('#createSubmit');
  submit.disabled = true;
  submit.textContent = 'Deploying…';
  try {
    const created = await api('/api/servers', { method: 'POST', body: JSON.stringify(values) });
    createDialog.close();
    $('#rconCredential').textContent = created.rconPassword;
    $('#connectHint').textContent = `connect YOUR_SERVER_IP:${created.port}`;
    credentialDialog.showModal();
    await refresh(true);
  } catch (error) {
    notify(error.message, true);
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Create server <span>→</span>';
  }
});

serverGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  const card = event.target.closest('.server-card');
  if (!button || !card) return;
  const server = state.servers.find((entry) => entry.id === card.dataset.id);
  if (!server) return;
  const action = button.dataset.action;

  if (action === 'logs') {
    state.logsServer = server;
    $('#logsTitle').textContent = `${server.name} logs`;
    logsDialog.showModal();
    await loadLogs();
    state.logsTimer = setInterval(loadLogs, 5000);
    return;
  }

  if (action === 'admins') {
    await openAdmins(server);
    return;
  }

  if (action === 'maps') {
    await openMaps(server);
    return;
  }

  if (action === 'players') {
    await openPlayers(server);
    return;
  }

  if (action === 'remove' && !confirm(`Remove ${server.name}? Its data volumes will be preserved.`)) return;
  button.disabled = true;
  try {
    if (action === 'remove') {
      await api(`/api/servers/${server.id}`, { method: 'DELETE' });
      notify('Server removed; data volumes were preserved.');
    } else {
      await api(`/api/servers/${server.id}/${action}`, { method: 'POST' });
      notify(`${server.name}: ${action} requested.`);
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
    const output = $('#logsOutput');
    const nearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 80;
    output.textContent = payload.logs || 'No logs available yet.';
    if (nearBottom) output.scrollTop = output.scrollHeight;
  } catch (error) {
    $('#logsOutput').textContent = error.message;
  }
}

function closeLogs() {
  clearInterval(state.logsTimer);
  state.logsTimer = null;
  state.logsServer = null;
  logsDialog.close();
}

const adminRoles = {
  full: 'abcdefghijklmnopqrstu',
  moderator: 'abcdefiju',
  maps: 'fju',
};

function adminRole(flags) {
  return Object.entries(adminRoles).find(([, value]) => value === flags)?.[0] || 'custom';
}

function adminRow(admin = { steamId: '', flags: adminRoles.full }) {
  const role = adminRole(admin.flags);
  return `<div class="admin-row">
    <label class="field"><span>Steam ID</span><input data-admin-steam required pattern="STEAM_[0-9]+:[01]:[0-9]+" placeholder="STEAM_0:1:123456" value="${escapeHtml(admin.steamId)}"></label>
    <label class="field"><span>Role</span><select data-admin-role>
      <option value="full" ${role === 'full' ? 'selected' : ''}>Full admin</option>
      <option value="moderator" ${role === 'moderator' ? 'selected' : ''}>Moderator</option>
      <option value="maps" ${role === 'maps' ? 'selected' : ''}>Maps & votes</option>
      <option value="custom" ${role === 'custom' ? 'selected' : ''}>Custom flags</option>
    </select></label>
    <label class="field flags-field"><span>Flags</span><input data-admin-flags required pattern="[a-u]+" value="${escapeHtml(admin.flags)}"></label>
    <button class="icon-button remove-admin" type="button" aria-label="Remove admin">×</button>
  </div>`;
}

function addAdminRow(admin) {
  $('#adminRows').insertAdjacentHTML('beforeend', adminRow(admin));
}

async function openAdmins(server) {
  state.adminsServer = server;
  $('#adminsTitle').textContent = `${server.name} admins`;
  $('#adminRows').innerHTML = '<p class="muted">Loading admins…</p>';
  $('#fleetAdminScope').checked = false;
  adminsDialog.showModal();
  try {
    const payload = await api(`/api/servers/${server.id}/admins`);
    $('#adminsSource').textContent = payload.source === 'panel' ? 'PANEL MANAGED' : '.ENV DEFAULTS';
    $('#adminRows').innerHTML = '';
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
  return [...document.querySelectorAll('.admin-row')].map((row) => ({
    steamId: row.querySelector('[data-admin-steam]').value.trim(),
    flags: row.querySelector('[data-admin-flags]').value.trim(),
  })).filter((admin) => admin.steamId || admin.flags !== adminRoles.full);
}

$('#adminsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity() || !state.adminsServer) return;
  const button = $('#saveAdminsButton');
  button.disabled = true;
  try {
    const scope = $('#fleetAdminScope').checked ? 'fleet' : 'server';
    const payload = await api(`/api/servers/${state.adminsServer.id}/admins`, { method: 'PUT', body: JSON.stringify({ admins: collectAdmins(), scope }) });
    $('#adminsSource').textContent = scope === 'fleet' ? 'DATABASE FLEET' : 'PANEL MANAGED';
    notify(scope === 'fleet' ? `${payload.admins.length} fleet admin(s) applied to ${payload.updatedServers} running server(s).` : `${payload.admins.length} admin(s) saved and reloaded live.`);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#addAdminButton').addEventListener('click', () => addAdminRow());
$('#adminRows').addEventListener('click', (event) => event.target.closest('.remove-admin')?.closest('.admin-row')?.remove());
$('#adminRows').addEventListener('change', (event) => {
  const select = event.target.closest('[data-admin-role]');
  if (!select || select.value === 'custom') return;
  select.closest('.admin-row').querySelector('[data-admin-flags]').value = adminRoles[select.value];
});
$('#resetAdminsButton').addEventListener('click', async () => {
  if (!state.adminsServer || !confirm('Replace panel-managed admins with the original AMXX_ADMINS from .env?')) return;
  try {
    const payload = await api(`/api/servers/${state.adminsServer.id}/admins`, { method: 'DELETE' });
    $('#adminsSource').textContent = '.ENV DEFAULTS';
    $('#adminRows').innerHTML = '';
    payload.admins.forEach(addAdminRow);
    if (!payload.admins.length) addAdminRow();
    notify('Admins reset to .env and reloaded live.');
  } catch (error) {
    notify(error.message, true);
  }
});
document.querySelectorAll('[data-close-admins]').forEach((button) => button.addEventListener('click', closeAdmins));

function renderServerMaps() {
  const payload = state.mapsPayload;
  if (!payload) return;
  $('#serverMapGrid').innerHTML = payload.available.map((map) => {
    return `<div class="server-map-choice" data-server-map-row data-map-name="${escapeHtml(map.toLowerCase())}">
      <label><input type="checkbox" data-server-map value="${escapeHtml(map)}" ${payload.selected.includes(map) ? 'checked' : ''}><span><b>${escapeHtml(map)}</b>${payload.current === map ? '<small>NOW PLAYING</small>' : ''}</span></label>
      ${payload.current === map ? '' : `<button class="play-map" type="button" data-play-map="${escapeHtml(map)}">PLAY NOW</button>`}
    </div>`;
  }).join('');
}

async function openMaps(server) {
  state.mapsServer = server;
  state.mapsPayload = null;
  $('#mapsTitle').textContent = `${server.name} maps`;
  $('#currentMapName').textContent = server.map || 'Loading…';
  $('#serverMapGrid').innerHTML = '<p class="muted">Loading installed maps…</p>';
  $('#mapSearch').value = '';
  mapsDialog.showModal();
  try {
    state.mapsPayload = await api(`/api/servers/${server.id}/maps`);
    $('#currentMapName').textContent = state.mapsPayload.current || server.map || 'Unknown';
    const category = state.mapsPayload.mode === 'gungame' ? 'GUNGAME' : 'CLASSIC';
    $('#mapsSource').textContent = `${category} · ${state.mapsPayload.source === 'panel' ? 'PANEL' : 'RUNTIME'}`;
    $('#mapCategoryHint').textContent = `Only ${category} category maps are shown.`;
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

$('#mapSearch').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll('[data-server-map-row]').forEach((row) => row.classList.toggle('hidden', Boolean(query) && !row.dataset.mapName.includes(query)));
});
$('#selectAllMaps').addEventListener('click', () => document.querySelectorAll('[data-server-map-row]:not(.hidden) [data-server-map]').forEach((input) => { input.checked = true; }));
$('#clearAllMaps').addEventListener('click', () => document.querySelectorAll('[data-server-map-row]:not(.hidden) [data-server-map]').forEach((input) => { input.checked = false; }));
$('#mapsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.mapsServer) return;
  const selected = [...document.querySelectorAll('[data-server-map]:checked')].map((input) => input.value);
  if (!selected.length) {
    notify('Select at least one map for the rotation.', true);
    return;
  }
  const button = $('#saveMapsButton');
  button.disabled = true;
  try {
    const payload = await api(`/api/servers/${state.mapsServer.id}/maps`, { method: 'PUT', body: JSON.stringify({ maps: selected }) });
    state.mapsPayload = { ...state.mapsPayload, ...payload, current: state.mapsPayload.current };
    const category = state.mapsPayload.mode === 'gungame' ? 'GUNGAME' : 'CLASSIC';
    $('#mapsSource').textContent = `${category} · PANEL`;
    notify(`${selected.length} map(s) saved to the rotation.`);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$('#serverMapGrid').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-play-map]');
  if (!button || !state.mapsServer) return;
  const map = button.dataset.playMap;
  if (!confirm(`Change ${state.mapsServer.name} to ${map} now? Connected players will be moved immediately.`)) return;
  button.disabled = true;
  try {
    await api(`/api/servers/${state.mapsServer.id}/maps/change`, { method: 'POST', body: JSON.stringify({ map }) });
    notify(`${state.mapsServer.name}: changing to ${map}.`);
    closeMaps();
    setTimeout(() => refresh(true), 1200);
  } catch (error) {
    button.disabled = false;
    notify(error.message, true);
  }
});
document.querySelectorAll('[data-close-maps]').forEach((button) => button.addEventListener('click', closeMaps));

function playerRow(player) {
  return `<div class="player-row" data-user-id="${player.userId}">
    <div class="player-identity"><b>${escapeHtml(player.name)}</b><code>${escapeHtml(player.steamId)}</code></div>
    <span class="player-stat">${player.frags}</span>
    <span class="player-stat">${player.ping} ms</span>
    <span class="player-stat">${escapeHtml(player.time)}</span>
    <div class="player-actions"><button class="button ghost" type="button" data-player-action="kick">Kick</button><button class="button ghost danger" type="button" data-player-action="ban">Ban</button></div>
  </div>`;
}

async function loadPlayers() {
  if (!state.playersServer || !playersDialog.open) return;
  try {
    const payload = await api(`/api/servers/${state.playersServer.id}/players`);
    $('#playersList').innerHTML = payload.players.length ? payload.players.map(playerRow).join('') : '<div class="players-empty">No players are connected right now.</div>';
  } catch (error) {
    $('#playersList').innerHTML = `<div class="players-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function openPlayers(server) {
  state.playersServer = server;
  $('#playersTitle').textContent = `${server.name} players`;
  $('#playersList').innerHTML = '<p class="muted">Loading players…</p>';
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

$('#playersList').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-player-action]');
  const row = event.target.closest('[data-user-id]');
  if (!button || !row || !state.playersServer) return;
  const action = button.dataset.playerAction;
  const name = row.querySelector('.player-identity b').textContent;
  let minutes = null;
  let scope = null;
  if (action === 'ban') {
    const rawMinutes = prompt(`Ban ${name} for how many minutes? Use 0 for permanent.`, '60');
    if (rawMinutes === null) return;
    minutes = Number(rawMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 525600) {
      notify('Ban duration must be between 0 and 525600 minutes.', true);
      return;
    }
    scope = prompt('Ban scope: type "fleet" for every server or "server" for this server only.', 'fleet');
    if (scope === null) return;
    scope = scope.trim().toLowerCase();
    if (scope !== 'fleet' && scope !== 'server') {
      notify('Ban scope must be fleet or server.', true);
      return;
    }
  }
  const reason = prompt(`${action === 'ban' ? 'Ban' : 'Kick'} reason for ${name}:`, action === 'ban' ? 'Rule violation' : 'Removed by an administrator');
  if (reason === null) return;
  button.disabled = true;
  try {
    const payload = await api(`/api/servers/${state.playersServer.id}/players/${row.dataset.userId}/${action}`, {
      method: 'POST', body: JSON.stringify({ reason, ...(action === 'ban' ? { minutes, scope } : {}) }),
    });
    notify(`${payload.player.name} was ${payload.status}.`);
    setTimeout(loadPlayers, 500);
    loadAnalytics(true).catch(() => {});
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
});
$('#refreshPlayersButton').addEventListener('click', loadPlayers);
document.querySelectorAll('[data-close-players]').forEach((button) => button.addEventListener('click', closePlayers));

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (total < 3600) return `${Math.floor(total / 60)}m`;
  if (total < 86400) return `${(total / 3600).toFixed(total < 36000 ? 1 : 0)}h`;
  return `${(total / 86400).toFixed(1)}d`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'online';
}

function emptyRows(message) {
  return `<div class="data-empty">${escapeHtml(message)}</div>`;
}

function fillStatsFilters(payload) {
  const serverSelect = $('#statsServerFilter');
  const seasonSelect = $('#statsSeasonFilter');
  const selectedServer = serverSelect.value;
  const selectedSeason = seasonSelect.value;
  serverSelect.innerHTML = `<option value="">All servers</option>${payload.servers.map((server) => `<option value="${escapeHtml(server.serverId)}">${escapeHtml(server.name)}</option>`).join('')}`;
  seasonSelect.innerHTML = `<option value="">All time</option>${payload.seasons.map((season) => `<option value="${season.id}">${escapeHtml(season.name)}${season.active ? ' · active' : ''}</option>`).join('')}`;
  if ([...serverSelect.options].some((option) => option.value === selectedServer)) serverSelect.value = selectedServer;
  if ([...seasonSelect.options].some((option) => option.value === selectedSeason)) seasonSelect.value = selectedSeason;
}

async function loadAnalytics(silent = false) {
  if (state.statsLoading || !state.token) return;
  state.statsLoading = true;
  $('#refreshStatsButton').disabled = true;
  try {
    const status = await api('/api/database/status');
    state.databaseConnected = status.connected;
    $('#newSeasonButton').disabled = !status.connected;
    const stateElement = $('#databaseState');
    stateElement.className = `database-state ${status.connected ? 'online' : status.enabled ? 'offline' : ''}`;
    stateElement.textContent = status.connected ? 'MariaDB connected' : status.enabled ? 'MariaDB unavailable' : 'MariaDB disabled';
    $('#databaseDisabled').classList.toggle('hidden', status.enabled && status.connected);
    $('#analyticsContent').classList.toggle('hidden', !status.connected);
    if (!status.connected) {
      if (status.enabled && !silent) notify(status.error || 'MariaDB is unavailable.', true);
      return;
    }

    const params = new URLSearchParams();
    if ($('#statsServerFilter').value) params.set('serverId', $('#statsServerFilter').value);
    if ($('#statsSeasonFilter').value) params.set('seasonId', $('#statsSeasonFilter').value);
    const suffix = params.size ? `?${params}` : '';
    const [payload, bans, moderation] = await Promise.all([
      api(`/api/stats/overview${suffix}`), api('/api/bans'), api('/api/moderation/history'),
    ]);
    fillStatsFilters(payload);
    const summary = payload.summary || {};
    const kills = Number(summary.kills || 0);
    const deaths = Number(summary.deaths || 0);
    $('#statsPlayers').textContent = formatCount(summary.players);
    $('#statsKills').textContent = formatCount(kills);
    $('#statsKd').textContent = `${(kills / Math.max(deaths, 1)).toFixed(2)} fleet K/D`;
    $('#statsHeadshots').textContent = formatCount(summary.headshots);
    $('#statsHsRate').textContent = `${kills ? Math.round(Number(summary.headshots || 0) * 100 / kills) : 0}% of kills`;
    $('#statsPlaytime').textContent = formatDuration(summary.playtimeSeconds);
    $('#statsGgWins').textContent = `${formatCount(summary.gungameWins)} GunGame wins`;

    $('#rankingRows').innerHTML = payload.ranking.length ? payload.ranking.map((player, index) => `<button class="ranking-row ranking-columns" type="button" data-profile="${escapeHtml(player.steamId)}"><span class="ranking-player"><b><i class="ranking-position">#${index + 1}</i>${escapeHtml(player.name)}</b><code>${escapeHtml(player.steamId)}</code></span><span class="ranking-value">${formatCount(player.kills)}</span><span class="ranking-value">${formatCount(player.deaths)}</span><span class="ranking-value">${Number(player.kd || 0).toFixed(2)}</span><span class="ranking-value">${formatCount(player.headshots)}</span><span class="ranking-value">${formatDuration(player.playtimeSeconds)}</span></button>`).join('') : emptyRows('No player statistics yet.');
    $('#mapStatsRows').innerHTML = payload.maps.length ? payload.maps.map((map) => `<div class="data-row"><span><b>${escapeHtml(map.mapName)}</b><small>${formatCount(map.roundsPlayed)} rounds · ${formatCount(map.kills)} kills</small></span><code>${formatCount(map.timesPlayed)} plays</code></div>`).join('') : emptyRows('No map activity yet.');
    $('#sessionRows').innerHTML = payload.sessions.length ? payload.sessions.map((session) => `<div class="data-row"><span><b>${escapeHtml(session.name)}</b><small>${escapeHtml(session.serverId)} · ${formatDate(session.connectedAt)}</small></span><code>${session.disconnectedAt ? formatDuration(session.playtimeSeconds) : 'ONLINE'}</code></div>`).join('') : emptyRows('No sessions yet.');
    $('#achievementRows').innerHTML = payload.achievements.length ? payload.achievements.map((item) => `<div class="data-row"><span><b>${escapeHtml(item.achievement)}</b><small>${escapeHtml(item.name)} · ${escapeHtml(item.description)}</small></span><code>${formatDate(item.unlockedAt)}</code></div>`).join('') : emptyRows('Achievements will appear as players progress.');
    $('#banRows').innerHTML = bans.bans.length ? bans.bans.map((ban) => `<div class="data-row ban-row"><span><b>${escapeHtml(ban.playerName || ban.steamId)}</b><small>${escapeHtml(ban.steamId)}</small></span><span><b>${escapeHtml(ban.reason)}</b><small>${ban.serverId ? `Server ${escapeHtml(ban.serverId)}` : 'Entire fleet'}</small></span><code>${ban.expiresAt ? formatDate(ban.expiresAt) : 'PERMANENT'}</code><button class="button ghost danger" type="button" data-revoke-ban="${ban.id}">Revoke</button></div>`).join('') : emptyRows('No active database bans.');
    $('#moderationRows').innerHTML = moderation.actions.length ? moderation.actions.slice(0, 12).map((item) => `<div class="data-row"><span><b>${escapeHtml(item.action.toUpperCase())} · ${escapeHtml(item.playerName || item.steamId || 'system')}</b><small>${escapeHtml(item.reason)} · ${escapeHtml(item.serverId || 'fleet')}</small></span><code>${formatDate(item.createdAt)}</code></div>`).join('') : emptyRows('No moderation events yet.');
  } catch (error) {
    $('#newSeasonButton').disabled = true;
    $('#databaseState').className = 'database-state offline';
    $('#databaseState').textContent = 'Data error';
    if (!silent) notify(error.message, true);
  } finally {
    state.statsLoading = false;
    $('#refreshStatsButton').disabled = false;
  }
}

async function openProfile(steamId) {
  $('#profileTitle').textContent = steamId;
  $('#profileBody').innerHTML = '<p class="muted">Loading player…</p>';
  profileDialog.showModal();
  try {
    const payload = await api(`/api/stats/players/${steamId}`);
    const totals = payload.stats.reduce((result, row) => ({ kills: result.kills + Number(row.kills), deaths: result.deaths + Number(row.deaths), playtime: result.playtime + Number(row.playtimeSeconds), wins: result.wins + Number(row.gungameWins) }), { kills: 0, deaths: 0, playtime: 0, wins: 0 });
    $('#profileTitle').textContent = payload.player.name;
    $('#profileBody').innerHTML = `<div class="profile-summary"><div><span>Steam ID</span><strong>${escapeHtml(payload.player.steamId)}</strong></div><div><span>Kills / Deaths</span><strong>${formatCount(totals.kills)} / ${formatCount(totals.deaths)}</strong></div><div><span>Playtime</span><strong>${formatDuration(totals.playtime)}</strong></div><div><span>GunGame wins</span><strong>${formatCount(totals.wins)}</strong></div></div><div class="profile-columns"><section><h3>Known names</h3><div class="data-rows compact">${payload.names.map((name) => `<div class="data-row"><span><b>${escapeHtml(name.name)}</b><small>Seen ${formatCount(name.timesSeen)} times</small></span><code>${formatDate(name.lastSeen)}</code></div>`).join('') || emptyRows('No aliases.')}</div></section><section><h3>Achievements</h3><div class="data-rows compact">${payload.achievements.map((item) => `<div class="data-row"><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></span><code>${formatDate(item.unlockedAt)}</code></div>`).join('') || emptyRows('No achievements yet.')}</div></section></div>`;
  } catch (error) {
    $('#profileBody').innerHTML = emptyRows(error.message);
  }
}

$('#refreshStatsButton').addEventListener('click', () => loadAnalytics());
$('#newSeasonButton').addEventListener('click', async () => {
  const name = prompt('New season name. The current active season will be closed:', 'Season 2');
  if (name === null) return;
  try {
    const season = await api('/api/seasons', { method: 'POST', body: JSON.stringify({ name }) });
    notify(`${season.name} is now the active season.`);
    await loadAnalytics();
    $('#statsSeasonFilter').value = String(season.id);
    await loadAnalytics();
  } catch (error) {
    notify(error.message, true);
  }
});
$('#statsServerFilter').addEventListener('change', () => loadAnalytics());
$('#statsSeasonFilter').addEventListener('change', () => loadAnalytics());
$('#rankingRows').addEventListener('click', (event) => {
  const row = event.target.closest('[data-profile]');
  if (row) openProfile(row.dataset.profile);
});
$('#banRows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-revoke-ban]');
  if (!button || !confirm('Revoke this database ban?')) return;
  button.disabled = true;
  try {
    await api(`/api/bans/${button.dataset.revokeBan}/revoke`, { method: 'POST' });
    notify('Ban revoked. Existing local banned.cfg entries may require manual removal.');
    await loadAnalytics();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
});
document.querySelector('[data-close-profile]').addEventListener('click', () => profileDialog.close());

document.querySelector('[data-close-logs]').addEventListener('click', closeLogs);
$('#refreshLogsButton').addEventListener('click', loadLogs);
document.querySelectorAll('[data-close-create]').forEach((button) => button.addEventListener('click', () => createDialog.close()));
document.querySelector('[data-close-credential]').addEventListener('click', () => credentialDialog.close());
$('#copyCredential').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('#rconCredential').textContent);
  notify('RCON password copied.');
});

setInterval(() => {
  if (!document.hidden && state.token && !appView.classList.contains('hidden')) refresh(true).catch(() => {});
}, 7000);

if (state.token) {
  showApp();
  refresh(true).catch(() => showAuth('Session expired. Enter the panel token again.'));
} else {
  showAuth();
}
renderCreateMaps('classic');
