// Backupeer — Vanilla JS SPA
// Stripe-inspired design system

const API = {
  base: '',

  async request(method, path, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(this.base + path, opts);
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },
};

const state = { page: 'loading', user: null, connections: [], databases: [], storageProviders: [] };

function navigate(page) {
  history.pushState(null, '', '#' + page);
  renderPage(page);
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

window.addEventListener('popstate', () => {
  const page = location.hash.slice(1) || 'dashboard';
  renderPage(page);
});

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  // Update all theme toggle icons
  document.querySelectorAll('.theme-icon').forEach(el => {
    el.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
  });
  lucide.createIcons();
  localStorage.setItem('backupeer-theme', next);
}

async function init() {
  const saved = localStorage.getItem('backupeer-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  try {
    const res = await API.get('/api/auth/check');
    state.user = res.user;
    renderApp();
  } catch {
    renderLogin();
  }
}

function renderLogin() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">B</div>
          <span class="login-logo-text">Backupeer</span>
        </div>
        <div class="login-subtitle">
          Sign in to <strong>manage your backups</strong><br>
          PostgreSQL · MySQL · MariaDB
        </div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" id="login-user" placeholder="admin" autocomplete="username" value="admin">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" type="password" id="login-pass" placeholder="••••••" autocomplete="current-password">
        </div>
        <button class="btn btn-primary" onclick="login()" style="width:100%;justify-content:center;padding:12px;">
          Sign In
        </button>
        <p class="login-error" id="login-error"></p>
        <div style="text-align:center;margin-top:var(--space-xxl);padding-top:var(--space-xxl);border-top:1px solid var(--border-default);">
          <button class="theme-toggle" onclick="toggleTheme()" style="margin:0 auto;">
            <i class="theme-icon" data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" size="15"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('login-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  lucide.createIcons();
}

async function login() {
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  try {
    const res = await API.post('/api/auth/login', { username: user, password: pass });
    state.user = res.user;
    renderApp();
  } catch (err) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function renderApp() {
  const page = location.hash.slice(1) || 'dashboard';
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';

  document.getElementById('app').innerHTML = `
    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo-icon">B</div>
          <span class="sidebar-logo-text">Backupeer</span>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Main</div>

          <a class="sidebar-link ${page === 'dashboard' ? 'active' : ''}" data-page="dashboard" onclick="navigate('dashboard')">
            <span class="icon"><i data-lucide="layout-dashboard" size="16"></i></span>
            Dashboard
          </a>
          <a class="sidebar-link ${page === 'connections' ? 'active' : ''}" data-page="connections" onclick="navigate('connections')">
            <span class="icon"><i data-lucide="cable" size="16"></i></span>
            Connections
            <span class="badge-count" id="sidebar-conn-count">0</span>
          </a>
          <a class="sidebar-link ${page === 'backups' ? 'active' : ''}" data-page="backups" onclick="navigate('backups')">
            <span class="icon"><i data-lucide="archive" size="16"></i></span>
            Backups
            <span class="badge-count" id="sidebar-backup-count">0</span>
          </a>
          <a class="sidebar-link ${page === 'schedules' ? 'active' : ''}" data-page="schedules" onclick="navigate('schedules')">
            <span class="icon"><i data-lucide="calendar" size="16"></i></span>
            Schedules
          </a>

          <div class="sidebar-section-label" style="margin-top:var(--space-md);">Infrastructure</div>

          <a class="sidebar-link ${page === 'storage' ? 'active' : ''}" data-page="storage" onclick="navigate('storage')">
            <span class="icon"><i data-lucide="hard-drive" size="16"></i></span>
            Storage
          </a>
          <a class="sidebar-link ${page === 'settings' ? 'active' : ''}" data-page="settings" onclick="navigate('settings')">
            <span class="icon"><i data-lucide="settings" size="16"></i></span>
            Settings
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-avatar">${state.user ? state.user.charAt(0).toUpperCase() : 'U'}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${state.user || 'User'}</div>
              <div class="sidebar-user-plan">Pro plan</div>
            </div>
            <button class="theme-toggle" onclick="toggleTheme()" style="flex-shrink:0;">
              <i class="theme-icon" data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" size="14"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Top Bar -->
        <div class="top-bar">
          <div class="top-bar-left">
            <div class="breadcrumb">
              <a href="#" onclick="navigate('dashboard');return false;">Backupeer</a>
              <span>/</span>
              <span style="color:var(--text-secondary);font-weight:500;" id="page-title-breadcrumb">Dashboard</span>
            </div>
          </div>
          <div class="top-bar-right">
            <button class="btn" style="padding:6px 14px;" onclick="logout()" title="Sign out">
              <i data-lucide="log-out" size="15"></i>
            </button>
          </div>
        </div>

        <!-- Page Content -->
        <div class="dashboard-content" id="page-content">
          <div class="loading-screen" style="min-height:200px;"><div class="loading-spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();
  renderPage(page);
}

// ── Global Modal ──
function showModal(title, bodyHtml, onConfirm, confirmText) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer" id="modal-footer">
        <button class="btn" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn btn-primary" id="modal-confirm">${confirmText || (onConfirm ? 'Save' : 'Close')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (onConfirm) {
    document.getElementById('modal-confirm').onclick = () => {
      const result = onConfirm();
      if (result !== false) overlay.remove();
    };
  }
  return overlay;
}

function renderPage(page) {
  const el = document.getElementById('page-content');
  if (!el) return;

  const titles = { dashboard: 'Dashboard', connections: 'Connections', backups: 'Backups', schedules: 'Schedules', storage: 'Storage', settings: 'Settings' };
  const titleEl = document.getElementById('page-title-breadcrumb');
  if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

  switch (page) {
    case 'dashboard': renderDashboard(el); break;
    case 'connections': renderConnections(el); break;
    case 'backups': renderBackups(el); break;
    case 'schedules': renderSchedules(el); break;
    case 'storage': renderStorage(el); break;
    case 'settings': renderSettings(el); break;
    default: el.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="file-x" size="24"></i></div><h3>Page not found</h3></div>'; lucide.createIcons();
  }
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
async function renderDashboard(el) {
  el.innerHTML = `
    <!-- Hero -->
    <div class="dash-hero">
      <div class="dash-hero-content">
        <div class="dash-hero-badge"><i data-lucide="activity" size="12"></i> All systems operational</div>
        <h1>Good ${getGreeting()}, ${state.user || 'Admin'}</h1>
        <p id="hero-summary">Loading your infrastructure...</p>
        <div class="dash-hero-actions">
          <button class="btn-hero btn-hero-primary" onclick="navigate('connections')"><i data-lucide="database" size="15"></i> Add Database</button>
          <button class="btn-hero btn-hero-secondary" onclick="showRunBackupModal()"><i data-lucide="play" size="15"></i> Run Backup Now</button>
          <button class="btn-hero btn-hero-secondary" onclick="navigate('schedules')"><i data-lucide="calendar" size="15"></i> Schedule</button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" id="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#3b82f6,#2563eb);"><i data-lucide="database" size="18"></i></div>
        <div class="stat-value" id="stat-conns">—</div>
        <div class="stat-label">Databases Connected</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#059669);"><i data-lucide="shield" size="18"></i></div>
        <div class="stat-value" id="stat-backups">—</div>
        <div class="stat-label">Total Backups</div>
        <div class="stat-detail" id="stat-backup-detail"></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706);"><i data-lucide="hard-drive" size="18"></i></div>
        <div class="stat-value" id="stat-scheds">—</div>
        <div class="stat-label">Active Schedules</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:var(--gradient-btn);"><i data-lucide="check-circle" size="18"></i></div>
        <div class="stat-value" id="stat-storage">—</div>
        <div class="stat-label">Storage Providers</div>
      </div>
    </div>

    <!-- Recent Backups -->
    <div class="section-header">
      <h2>Recent Backups</h2>
      <div class="section-header-actions">
        <button class="btn" onclick="navigate('backups')">View All</button>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Database</th><th>Type</th><th>Status</th><th>Size</th><th>Duration</th><th>Created</th></tr></thead>
          <tbody id="recent-backups"></tbody>
        </table>
      </div>
    </div>
  `;
  lucide.createIcons();

  try {
    const [conns, backups, scheds, storageProvs, stats] = await Promise.all([
      API.get('/api/connections'),
      API.get('/api/backups?limit=5'),
      API.get('/api/schedules'),
      API.get('/api/storage-providers'),
      API.get('/api/backups/stats').catch(() => null),
    ]);

    state.connections = conns;
    state.storageProviders = storageProvs;

    document.getElementById('stat-conns').textContent = conns.length;
    document.getElementById('stat-scheds').textContent = scheds.filter(s => s.enabled !== false).length;
    document.getElementById('stat-storage').textContent = storageProvs.length;

    if (stats) {
      document.getElementById('stat-backups').textContent = stats.total_backups || 0;
      const successRate = stats.success_rate ? Math.round(stats.success_rate) : 0;
      document.getElementById('stat-backup-detail').innerHTML =
        `<span class="stat-change ${successRate >= 80 ? 'up' : 'down'}">${successRate}% success rate</span>`;
    } else {
      const recent = backups || [];
      document.getElementById('stat-backups').textContent = recent.length;
      const successCount = recent.filter(b => b.status === 'success').length;
      if (recent.length > 0) {
        const percent = Math.round((successCount / recent.length) * 100);
        document.getElementById('stat-backup-detail').innerHTML = `<span class="stat-change up">${percent}% success rate</span>`;
      }
    }

    const totalSize = stats && stats.total_size_bytes ? formatBytes(stats.total_size_bytes) : '—';
    const activeScheds = scheds.filter(s => s.enabled !== false).length;
    document.getElementById('hero-summary').textContent =
      `${conns.length} databases · ${activeScheds} active schedules · ${totalSize} total`;

    // Sidebar counts
    const connBadge = document.getElementById('sidebar-conn-count');
    if (connBadge) connBadge.textContent = conns.length;
    const backupBadge = document.getElementById('sidebar-backup-count');
    if (backupBadge) backupBadge.textContent = recent.length;

    const tbody = document.getElementById('recent-backups');
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No backups yet</p></div></td></tr>';
    } else {
      tbody.innerHTML = recent.map(b => {
        const dbLabel = b.database_label || (b.database_id ? b.database_id.slice(0,8) : '—');
        const dbType = b.db_type || '';
        const badge = dbType ? `<span class="db-badge ${getDbBadgeClass(dbType)}">${dbType.toUpperCase()}</span>` : '';
        return `<tr class="status-${b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'running'}">
          <td>${badge} ${escHtml(dbLabel)}</td>
          <td><span class="badge badge-info">${(b.backup_type || '—').toUpperCase()}</span></td>
          <td><span class="status-pill ${statusPill(b.status)}">${b.status || '—'}</span></td>
          <td class="mono">${b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
          <td class="mono">${b.duration_ms ? (b.duration_ms/1000).toFixed(1)+'s' : '—'}</td>
          <td style="color:var(--text-tertiary);font-size:12px;">${b.created_at ? timeAgo(b.created_at) : '—'}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('stats-grid').innerHTML += `<p style="color:var(--error);margin-top:12px">Error loading: ${escHtml(err.message)}</p>`;
  }
}

// ══════════════════════════════════════
// CONNECTIONS
// ══════════════════════════════════════
async function renderConnections(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Connections</h1>
      <p>Manage database server connections</p>
    </div>
    <div style="margin-bottom:var(--space-lg);">
      <button class="btn btn-primary" onclick="showAddConnectionModal()">+ Add Connection</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Host</th><th>Databases</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="conn-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const conns = await API.get('/api/connections');
    state.connections = conns;
    const tbody = document.getElementById('conn-table-body');
    if (conns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No connections added yet</p></div></td></tr>';
    } else {
      tbody.innerHTML = conns.map(c => `
        <tr>
          <td><strong style="color:var(--text-primary);">${escHtml(c.name)}</strong></td>
          <td><span class="db-badge ${getDbBadgeClass(c.db_type)}">${c.db_type.toUpperCase()}</span></td>
          <td class="mono">${escHtml(c.host)}:${c.port}</td>
          <td>${c.db_count || '—'}</td>
          <td><span class="status-pill connected">Connected</span></td>
          <td>
            <button class="btn btn-sm" onclick="discoverConn('${c.id}')" title="Discover databases"><i data-lucide="search" size="13"></i></button>
            <button class="btn btn-sm" onclick="showBackupConn('${c.id}')" title="Run backup"><i data-lucide="play" size="13"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteConn('${c.id}')" title="Delete"><i data-lucide="trash-2" size="13"></i></button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    document.getElementById('conn-table-body').innerHTML = `<tr><td colspan="6" style="color:var(--error);padding:20px;">Error: ${escHtml(err.message)}</td></tr>`;
  }
  lucide.createIcons();
}

function showAddConnectionModal() {
  showModal('Add Connection', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-conn-name" placeholder="Production DB">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-conn-type">
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mariadb">MariaDB</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Port</label>
        <input class="form-input" id="modal-conn-port" value="5432">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Host</label>
      <input class="form-input" id="modal-conn-host" placeholder="localhost">
    </div>
    <div class="form-group">
      <label class="form-label">Username</label>
      <input class="form-input" id="modal-conn-user" placeholder="postgres">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" type="password" id="modal-conn-pass" placeholder="••••••">
    </div>
  `, async () => {
    const name = document.getElementById('modal-conn-name').value;
    const host = document.getElementById('modal-conn-host').value;
    const port = parseInt(document.getElementById('modal-conn-port').value) || 5432;
    const dbType = document.getElementById('modal-conn-type').value;
    const user = document.getElementById('modal-conn-user').value;
    const pass = document.getElementById('modal-conn-pass').value;
    if (!name || !host || !user) { alert('Name, Host, and Username are required'); return false; }
    try {
      await API.post('/api/connections', { name, host, port, db_type: dbType, username: user, password: pass });
      renderConnections(document.getElementById('page-content'));
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function showBackupConn(connId) {
  let dbs = [];
  try {
    const conn = state.connections.find(c => c.id === connId);
    if (conn && conn.databases) dbs = conn.databases;
  } catch(e) {}

  const dbOptions = dbs.length > 0
    ? dbs.map(d => `<option value="${d.id}">${escHtml(d.db_name)}</option>`).join('')
    : '<option value="">Auto-discover</option>';

  let storageOptions = '<option value="">Use default</option>';
  try {
    const provs = await API.get('/api/storage-providers');
    storageOptions += provs.map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.provider_type})${p.is_default ? ' ★' : ''}</option>`
    ).join('');
  } catch(e) {}

  showModal('Run Backup', `
    <div class="form-group">
      <label class="form-label">Connection ID</label>
      <input class="form-input" id="modal-backup-conn" value="${connId}" readonly>
    </div>
    <div class="form-group">
      <label class="form-label">Database</label>
      <select class="form-select" id="modal-backup-db">${dbOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-backup-type">
          <option value="full">Full</option>
          <option value="incremental">Incremental</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Storage</label>
        <select class="form-select" id="modal-backup-storage">${storageOptions}</select>
      </div>
    </div>
  `, async () => {
    const dbId = document.getElementById('modal-backup-db').value;
    const type = document.getElementById('modal-backup-type').value;
    const storageId = document.getElementById('modal-backup-storage').value;
    try {
      await API.post('/api/backups', {
        connection_id: connId, database_id: dbId, backup_type: type,
        storage_provider_id: storageId || undefined
      });
      alert('Backup started!');
      navigate('backups');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function discoverConn(id) {
  try {
    await API.post(`/api/connections/${id}/discover`);
    alert('Discovery complete!');
    renderConnections(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteConn(id) {
  if (!confirm('Delete this connection and all associated backups?')) return;
  try {
    await API.del(`/api/connections/${id}`);
    renderConnections(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

// ══════════════════════════════════════
// BACKUPS
// ══════════════════════════════════════
async function renderBackups(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Backups</h1>
      <p>Backup history and management</p>
    </div>
    <div style="margin-bottom:var(--space-lg);">
      <button class="btn btn-primary" onclick="showRunBackupModal()">+ Run Backup</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Size</th><th>Duration</th><th>Verify</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody id="backup-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const backups = await API.get('/api/backups');
    const tbody = document.getElementById('backup-table-body');
    if (backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No backups yet</p></div></td></tr>';
    } else {
      tbody.innerHTML = backups.map(b => {
        const statusClass = b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'running';
        return `<tr class="status-${statusClass}">
          <td class="mono" title="${b.id}">${b.id.slice(0,8)}</td>
          <td><span class="badge badge-info">${(b.backup_type || '').toUpperCase()}</span></td>
          <td><span class="status-pill ${statusPill(b.status)}">${b.status || '—'}</span></td>
          <td class="mono">${b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
          <td class="mono">${b.duration_ms ? (b.duration_ms/1000).toFixed(1)+'s' : '—'}</td>
          <td><span class="badge ${b.verify_status === 'passed' ? 'badge-success' : 'badge-neutral'}">${b.verify_status || '—'}</span></td>
          <td style="color:var(--text-tertiary);font-size:12px;">${b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
          <td>
            <button class="btn btn-sm" onclick="showBackupLog('${b.id}')" title="View logs"><i data-lucide="file-text" size="13"></i></button>
            <button class="btn btn-sm" onclick="downloadBackup('${b.id}')" title="Download"><i data-lucide="download" size="13"></i></button>
            <button class="btn btn-sm" onclick="verifyBackup('${b.id}')" title="Verify integrity"><i data-lucide="check-circle" size="13"></i></button>
            <button class="btn btn-sm" onclick="showRestoreModal('${b.id}')" title="Restore"><i data-lucide="rotate-ccw" size="13"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteBackup('${b.id}')" title="Delete"><i data-lucide="trash-2" size="13"></i></button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('backup-table-body').innerHTML = `<tr><td colspan="8" style="color:var(--error);padding:20px;">Error: ${escHtml(err.message)}</td></tr>`;
  }
  lucide.createIcons();
}

async function showBackupLog(backupId) {
  try {
    const data = await API.get(`/api/backups/${backupId}/logs`);
    showModal(`Backup Log: ${backupId.slice(0,8)}`, `
      <pre class="log-viewer">${escHtml(data.log || 'No log output')}</pre>
    `);
  } catch (err) { alert('Error loading logs: ' + err.message); }
}

function showRunBackupModal() {
  const connOptions = state.connections.length > 0
    ? state.connections.map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.db_type})</option>`).join('')
    : '<option value="">No connections — add one first</option>';

  let storageOptions = '<option value="">Use default</option>';
  if (state.storageProviders.length > 0) {
    storageOptions += state.storageProviders.map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.provider_type})${p.is_default ? ' ★' : ''}</option>`
    ).join('');
  }

  showModal('Run Backup', `
    <div class="form-group">
      <label class="form-label">Connection</label>
      <select class="form-select" id="modal-run-conn">${connOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Database ID (optional)</label>
      <input class="form-input" id="modal-run-db" placeholder="auto">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-run-type">
          <option value="full">Full</option>
          <option value="incremental">Incremental</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Storage</label>
        <select class="form-select" id="modal-run-storage">${storageOptions}</select>
      </div>
    </div>
  `, async () => {
    const connId = document.getElementById('modal-run-conn').value;
    if (!connId) { alert('Please select a connection'); return false; }
    const dbId = document.getElementById('modal-run-db').value;
    const type = document.getElementById('modal-run-type').value;
    const storageId = document.getElementById('modal-run-storage').value;
    try {
      await API.post('/api/backups', {
        connection_id: connId, database_id: dbId, backup_type: type,
        storage_provider_id: storageId || undefined
      });
      alert('Backup started!');
      navigate('backups');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function showRestoreModal(backupId) {
  showModal('Restore Backup', `
    <p style="margin-bottom:12px;color:var(--text-secondary);">Restore backup <code>${backupId.slice(0,8)}</code></p>
    <div class="form-group">
      <label class="form-label">Target Connection (optional)</label>
      <select class="form-select" id="modal-restore-conn">
        <option value="">Original connection</option>
        ${state.connections.map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.db_type})</option>`).join('')}
      </select>
    </div>
    <p style="color:var(--warning, #d97706);font-size:13px;display:flex;align-items:center;gap:6px;margin-top:12px;"><i data-lucide="alert-triangle" size="14"></i> This will overwrite the target database!</p>
  `, async () => {
    const targetConn = document.getElementById('modal-restore-conn').value;
    try {
      await API.post(`/api/backups/${backupId}/restore`, { target_connection: targetConn || undefined });
      alert('Restore started!');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
  lucide.createIcons();
}

async function deleteBackup(id) {
  if (!confirm('Delete this backup record?')) return;
  try {
    await API.del(`/api/backups/${id}`);
    renderBackups(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

async function downloadBackup(id) {
  try {
    // Trigger download via redirect — SPA can't stream binary via fetch easily
    window.location.href = `/api/backups/${id}/download`;
  } catch (err) { alert('Error: ' + err.message); }
}

async function verifyBackup(id) {
  try {
    const res = await API.post(`/api/backups/${id}/verify`);
    alert('✅ Verification started! Reload page to see results.');
    renderBackups(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

// ══════════════════════════════════════
// SCHEDULES
// ══════════════════════════════════════
async function renderSchedules(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Schedules</h1>
      <p>Automated backup schedules</p>
    </div>
    <div style="margin-bottom:var(--space-lg);">
      <button class="btn btn-primary" onclick="showAddScheduleModal()">+ New Schedule</button>
    </div>
    <div id="schedules-list"></div>
  `;

  try {
    const [scheds, provs] = await Promise.all([
      API.get('/api/schedules'),
      API.get('/api/storage-providers'),
    ]);
    state.storageProviders = provs;

    const container = document.getElementById('schedules-list');
    if (scheds.length === 0) {
      container.innerHTML = `
        <div class="card"><div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="calendar" size="24"></i></div>
          <h3>No schedules yet</h3>
          <p>Create a schedule to automate your backups</p>
        </div></div>`;
    } else {
      container.innerHTML = scheds.map(s => {
        const storageName = provs.find(p => p.id === s.storage_provider_id);
        const conn = state.connections.find(c => c.id === s.connection_id);
        const connName = conn ? conn.name : (s.connection_id ? s.connection_id.slice(0,8) : '—');
        const dbType = conn ? conn.db_type : '';
        const dbBadge = dbType ? `<span class="db-badge ${getDbBadgeClass(dbType)}">${dbType.toUpperCase()}</span>` : '';
        return `
        <div class="schedule-card">
          <div class="schedule-card-header">
            <div class="schedule-name">
              ${escHtml(s.backup_type || 'Backup')} — ${escHtml(connName)}
              ${dbBadge}
            </div>
            <div class="schedule-toggle ${s.enabled !== false ? 'active' : ''}" onclick="toggleSchedule('${s.id}', ${s.enabled === false})"></div>
          </div>
          <div class="schedule-details">
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Schedule</span>
              <span class="schedule-detail-value"><code>${escHtml(s.cron_expr)}</code> — ${cronHuman(s.cron_expr)}</span>
            </div>
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Type</span>
              <span class="schedule-detail-value">${s.backup_type === 'incremental' ? 'Incremental + Full' : 'Full Backup'}</span>
            </div>
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Destination</span>
              <span class="schedule-detail-value">${storageName ? escHtml(storageName.name) : '—'}</span>
            </div>
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Retention</span>
              <span class="schedule-detail-value">${s.retention_full || 7}d full · ${s.retention_incr || 30}d incr</span>
            </div>
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Status</span>
              <span class="schedule-detail-value"><span class="badge ${s.enabled !== false ? 'badge-success' : 'badge-neutral'}">${s.enabled !== false ? 'Active' : 'Paused'}</span></span>
            </div>
            <div class="schedule-detail-item">
              <span class="schedule-detail-label">Actions</span>
              <div class="schedule-detail-value" style="display:flex;gap:6px;">
                <button class="btn btn-sm" onclick="runScheduleNow('${s.id}')" title="Run now"><i data-lucide="play" size="12"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteSchedule('${s.id}')" title="Delete"><i data-lucide="trash-2" size="12"></i></button>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('schedules-list').innerHTML = `<div class="card" style="padding:var(--space-xxl);color:var(--error);">Error: ${escHtml(err.message)}</div>`;
  }
  lucide.createIcons();
}

function showAddScheduleModal() {
  const connOptions = state.connections.map(c =>
    `<option value="${c.id}">${escHtml(c.name)} (${c.db_type})</option>`
  ).join('');

  let storageOptions = '<option value="">Select storage provider...</option>';
  if (state.storageProviders.length > 0) {
    storageOptions = state.storageProviders.map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.provider_type})${p.is_default ? ' ★ Default' : ''}</option>`
    ).join('');
  } else {
    storageOptions = '<option value="">⚠️ No providers — add one in Storage page</option>';
  }

  showModal('Add Schedule', `
    <div class="form-group">
      <label class="form-label">Connection</label>
      <select class="form-select" id="modal-sched-conn">${connOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Database ID</label>
      <input class="form-input" id="modal-sched-db" placeholder="Database ID from discovery">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Backup Type</label>
        <select class="form-select" id="modal-sched-type">
          <option value="full">Full</option>
          <option value="incremental">Incremental</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Cron Expression</label>
        <input class="form-input" id="modal-sched-cron" value="0 1 * * *" placeholder="0 1 * * *">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Storage Provider</label>
      <select class="form-select" id="modal-sched-storage">${storageOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Retention (full days)</label>
        <input class="form-input" type="number" id="modal-sched-ret-full" value="7">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Retention (incr days)</label>
        <input class="form-input" type="number" id="modal-sched-ret-incr" value="30">
      </div>
    </div>
  `, async () => {
    const connId = document.getElementById('modal-sched-conn').value;
    const dbId = document.getElementById('modal-sched-db').value;
    const type = document.getElementById('modal-sched-type').value;
    const cron = document.getElementById('modal-sched-cron').value;
    const storageId = document.getElementById('modal-sched-storage').value;
    const retFull = parseInt(document.getElementById('modal-sched-ret-full').value) || 7;
    const retIncr = parseInt(document.getElementById('modal-sched-ret-incr').value) || 30;
    if (!connId || !dbId) { alert('Connection and Database are required'); return false; }
    if (!storageId) { alert('Storage Provider is required'); return false; }
    try {
      await API.post('/api/schedules', {
        connection_id: connId, database_id: dbId,
        backup_type: type, cron_expr: cron,
        storage_provider_id: storageId,
        retention_full: retFull, retention_incr: retIncr
      });
      navigate('schedules');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function runScheduleNow(id) {
  try {
    await API.post(`/api/schedules/${id}/run`);
    alert('Backup triggered!');
  } catch (err) { alert('Error: ' + err.message); }
}

async function toggleSchedule(id, enable) {
  try {
    await API.put(`/api/schedules/${id}`, { enabled: enable });
    renderSchedules(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    await API.del(`/api/schedules/${id}`);
    renderSchedules(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

// ══════════════════════════════════════
// STORAGE
// ══════════════════════════════════════
async function renderStorage(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Storage Providers</h1>
      <p>Manage S3-compatible object storage</p>
    </div>
    <div style="margin-bottom:var(--space-lg);">
      <button class="btn btn-primary" onclick="showAddStorageModal()">+ Add Provider</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Endpoint</th><th>Bucket</th><th>Region</th><th>Default</th><th>Actions</th></tr></thead>
          <tbody id="storage-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const provs = await API.get('/api/storage-providers');
    state.storageProviders = provs;
    const tbody = document.getElementById('storage-table-body');
    if (provs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No storage providers configured</p></div></td></tr>';
    } else {
      tbody.innerHTML = provs.map(p => {
        const typeClass = p.provider_type === 's3' ? 'icon-s3' : p.provider_type === 'r2' ? 'icon-r2' : 'icon-s3';
        return `<tr>
          <td><strong style="color:var(--text-primary);">${escHtml(p.name)}</strong></td>
          <td><div class="config-item-icon ${typeClass}" style="width:28px;height:28px;font-size:10px;display:inline-flex;">${p.provider_type.toUpperCase()}</div></td>
          <td class="mono" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;color:var(--text-secondary);">${escHtml(p.endpoint)}</td>
          <td class="mono">${escHtml(p.bucket)}</td>
          <td>${escHtml(p.region)}</td>
          <td>${p.is_default ? '<span class="badge badge-success">Default</span>' : '—'}</td>
          <td>
            <button class="btn btn-sm" onclick="testStorage('${p.id}')" title="Test connection"><i data-lucide="zap" size="13"></i></button>
            <button class="btn btn-sm" onclick="showEditStorageModal('${p.id}')" title="Edit"><i data-lucide="pencil" size="13"></i></button>
            <button class="btn btn-sm" onclick="setDefaultStorage('${p.id}')" title="Set as default"><i data-lucide="star" size="13"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteStorage('${p.id}')" title="Delete"><i data-lucide="trash-2" size="13"></i></button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('storage-table-body').innerHTML = `<tr><td colspan="7" style="color:var(--error);padding:20px;">Error: ${escHtml(err.message)}</td></tr>`;
  }
  lucide.createIcons();
}

function showAddStorageModal() {
  showModal('Add Storage Provider', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-stor-name" placeholder="Production S3">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-stor-type">
          <option value="s3">AWS S3</option>
          <option value="r2">Cloudflare R2</option>
          <option value="minio">MinIO</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Region</label>
        <input class="form-input" id="modal-stor-region" value="auto" placeholder="us-east-1">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Endpoint</label>
      <input class="form-input" id="modal-stor-endpoint" placeholder="https://s3.amazonaws.com">
    </div>
    <div class="form-group">
      <label class="form-label">Bucket</label>
      <input class="form-input" id="modal-stor-bucket" placeholder="my-backups">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Access Key</label>
        <input class="form-input" id="modal-stor-ak" placeholder="AKIA...">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Secret Key</label>
        <input class="form-input" type="password" id="modal-stor-sk" placeholder="••••••">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Path Style</label>
        <select class="form-select" id="modal-stor-pathstyle">
          <option value="true">Yes (MinIO/R2)</option>
          <option value="false">No (AWS)</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;padding-top:22px">
        <label class="checkbox-label">
          <input type="checkbox" id="modal-stor-default" checked> Set as default
        </label>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('modal-stor-name').value;
    const type = document.getElementById('modal-stor-type').value;
    const endpoint = document.getElementById('modal-stor-endpoint').value;
    const region = document.getElementById('modal-stor-region').value;
    const bucket = document.getElementById('modal-stor-bucket').value;
    const ak = document.getElementById('modal-stor-ak').value;
    const sk = document.getElementById('modal-stor-sk').value;
    const pathStyle = document.getElementById('modal-stor-pathstyle').value === 'true';
    const isDefault = document.getElementById('modal-stor-default').checked;

    if (!name || !endpoint || !bucket || !ak || !sk) {
      alert('Name, Endpoint, Bucket, Access Key, and Secret Key are required');
      return false;
    }

    try {
      await API.post('/api/storage-providers', {
        name, provider_type: type, endpoint, region, bucket,
        access_key: ak, secret_key: sk, path_style: pathStyle, is_default: isDefault
      });
      renderStorage(document.getElementById('page-content'));
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function showEditStorageModal(id) {
  let prov;
  try {
    prov = await API.get(`/api/storage-providers/${id}`);
  } catch (err) { alert('Error loading provider: ' + err.message); return; }

  showModal('Edit Storage Provider', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-stor-name" value="${escHtml(prov.name)}">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-stor-type">
          <option value="s3" ${prov.provider_type === 's3' ? 'selected' : ''}>AWS S3</option>
          <option value="r2" ${prov.provider_type === 'r2' ? 'selected' : ''}>Cloudflare R2</option>
          <option value="minio" ${prov.provider_type === 'minio' ? 'selected' : ''}>MinIO</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Region</label>
        <input class="form-input" id="modal-stor-region" value="${escHtml(prov.region)}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Endpoint</label>
      <input class="form-input" id="modal-stor-endpoint" value="${escHtml(prov.endpoint)}">
    </div>
    <div class="form-group">
      <label class="form-label">Bucket</label>
      <input class="form-input" id="modal-stor-bucket" value="${escHtml(prov.bucket)}">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Access Key</label>
        <input class="form-input" id="modal-stor-ak" placeholder="Keep existing">
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Secret Key</label>
        <input class="form-input" type="password" id="modal-stor-sk" placeholder="Keep existing">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Path Style</label>
        <select class="form-select" id="modal-stor-pathstyle">
          <option value="true" ${prov.path_style ? 'selected' : ''}>Yes (MinIO/R2)</option>
          <option value="false" ${!prov.path_style ? 'selected' : ''}>No (AWS)</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;padding-top:22px">
        <label class="checkbox-label">
          <input type="checkbox" id="modal-stor-default" ${prov.is_default ? 'checked' : ''}> Set as default
        </label>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('modal-stor-name').value;
    const type = document.getElementById('modal-stor-type').value;
    const endpoint = document.getElementById('modal-stor-endpoint').value;
    const region = document.getElementById('modal-stor-region').value;
    const bucket = document.getElementById('modal-stor-bucket').value;
    const ak = document.getElementById('modal-stor-ak').value;
    const sk = document.getElementById('modal-stor-sk').value;
    const pathStyle = document.getElementById('modal-stor-pathstyle').value === 'true';
    const isDefault = document.getElementById('modal-stor-default').checked;

    if (!name || !endpoint || !bucket) {
      alert('Name, Endpoint, and Bucket are required');
      return false;
    }

    try {
      await API.put(`/api/storage-providers/${id}`, {
        name, provider_type: type, endpoint, region, bucket,
        access_key: ak || undefined, secret_key: sk || undefined,
        path_style: pathStyle, is_default: isDefault
      });
      renderStorage(document.getElementById('page-content'));
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function testStorage(id) {
  const btn = event.target.closest('button');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="loader" size="13" class="loading-spinner" style="width:13px;height:13px;border-width:2px;"></i>';
  btn.disabled = true;
  lucide.createIcons();

  try {
    const result = await API.post(`/api/storage-providers/${id}/test`);
    if (result.success) {
      alert('✅ Connection successful!');
    } else {
      alert('❌ Connection failed: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    alert('❌ Test error: ' + err.message);
  }

  btn.innerHTML = originalHtml;
  btn.disabled = false;
  lucide.createIcons();
}

async function setDefaultStorage(id) {
  try {
    await API.post(`/api/storage-providers/${id}/set-default`);
    renderStorage(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteStorage(id) {
  if (!confirm('Delete this storage provider? Backups using it will need a new provider to restore.')) return;
  try {
    await API.del(`/api/storage-providers/${id}`);
    renderStorage(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
function renderSettings(el) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  el.innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Application configuration</p>
    </div>
    <div class="card" style="max-width:500px">
      <div class="card-header"><h2>Preferences</h2></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Theme</label>
          <div style="display:flex;align-items:center;gap:var(--space-md);">
            <select class="form-select" onchange="setTheme(this.value)" style="width:auto;flex:1;">
              <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
            </select>
            <button class="theme-toggle" onclick="toggleTheme()">
              <i class="theme-icon" data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" size="15"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Encryption</label>
          <p class="form-help" id="encrypt-status">Checking encryption status...</p>
        </div>
        <div class="form-group">
          <label class="form-label">Version</label>
          <input class="form-input" value="v0.2.0" disabled>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();

  API.get('/api/health').then(h => {
    document.getElementById('encrypt-status').textContent =
      h.encryption ? '✅ AES-256-GCM enabled' : '⚠️ Not configured (set BACKUPEER_ENCRYPTION_KEY)';
  }).catch(() => {
    document.getElementById('encrypt-status').textContent = '⚠️ Unknown';
  });
}

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getDbBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t === 'postgresql' || t === 'postgres') return 'pg';
  if (t === 'mysql') return 'mysql';
  if (t === 'mariadb') return 'maria';
  return 'pg';
}

function statusPill(status) {
  switch (status) {
    case 'success': return 'success';
    case 'failed': case 'error': return 'failed';
    case 'running': case 'verifying': return 'running';
    default: return '';
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs/60) + 'm ago';
  if (secs < 86400) return Math.floor(secs/3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs/86400) + 'd ago';
  return d.toLocaleDateString();
}

function cronHuman(expr) {
  if (!expr) return '';
  const parts = expr.split(' ');
  if (parts.length !== 5) return '';
  if (parts[0] === '0' && parts[1] === '1' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*')
    return 'Every day at 01:00';
  if (parts[0] === '0' && parts[1] === '2' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*')
    return 'Every day at 02:00';
  if (parts[0] === '0' && parts[1] === '3' && parts[2] === '*' && parts[3] === '*' && parts[4] === '0')
    return 'Every Sunday at 03:00';
  if (parts[0] === '0' && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*')
    return 'Every hour';
  if (parts[0] === '*/30' && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*')
    return 'Every 30 minutes';
  return expr;
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-icon').forEach(el => {
    el.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
  });
  lucide.createIcons();
  localStorage.setItem('backupeer-theme', theme);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function logout() {
  API.post('/api/auth/logout');
  state.user = null;
  renderLogin();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  init();
});
