const state = {
  token: sessionStorage.getItem('cs16-panel-token') || '',
  servers: [],
  filter: 'all',
  loading: false,
  logsServer: null,
  logsTimer: null,
  adminsServer: null,
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
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.className = 'toast'; }, 3500);
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
  $('#startMapInput').value = input.value === 'gungame' ? 'gg_3way' : 'de_dust2';
  updateMapSuggestions(input.value);
}));

function updateMapSuggestions(mode) {
  $('#mapOptions').innerHTML = maps[mode].map((map) => `<option value="${map}"></option>`).join('');
}

$('#playersRange').addEventListener('input', (event) => { $('#playersOutput').value = event.target.value; });

$('#createForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.maxPlayers = Number(values.maxPlayers);
  values.startImmediately = form.elements.startImmediately.checked;
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
    const payload = await api(`/api/servers/${state.adminsServer.id}/admins`, { method: 'PUT', body: JSON.stringify({ admins: collectAdmins() }) });
    $('#adminsSource').textContent = 'PANEL MANAGED';
    notify(`${payload.admins.length} admin(s) saved and reloaded live.`);
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
updateMapSuggestions('classic');
