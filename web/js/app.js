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
  // Close mobile sidebar on nav
  closeMobileSidebar();
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

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', open);
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', open ? 'x' : 'menu');
  }
  lucide.createIcons();
  document.body.style.overflow = open ? 'hidden' : '';
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btn = document.getElementById('hamburger-btn');
  if (!sidebar || !sidebar.classList.contains('open')) return;
  sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', 'menu');
  }
  lucide.createIcons();
  document.body.style.overflow = '';
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
          <svg class="login-logo-svg" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="lg-grad" x1="4" y1="2" x2="28" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#c4b5fd"/><stop offset="1" stop-color="#818cf8"/>
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14.5" fill="rgba(196,181,253,0.06)" stroke="rgba(196,181,253,0.10)" stroke-width="0.8"/>
            <path d="M16 3L29 9V21Q29 29 16 32Q3 29 3 21V9L16 3Z" fill="rgba(196,181,253,0.10)"/>
            <path d="M16 3L29 9V21Q29 29 16 32Q3 29 3 21V9L16 3Z" stroke="url(#lg-grad)" stroke-width="1.5"/>
            <ellipse cx="16" cy="14" rx="7" ry="3" fill="rgba(196,181,253,0.12)" stroke="url(#lg-grad)" stroke-width="1.2"/>
            <rect x="9" y="14" width="14" height="6" fill="rgba(196,181,253,0.06)"/>
            <line x1="9" y1="14" x2="9" y2="20" stroke="url(#lg-grad)" stroke-width="1.2"/>
            <line x1="23" y1="14" x2="23" y2="20" stroke="url(#lg-grad)" stroke-width="1.2"/>
            <ellipse cx="16" cy="20" rx="7" ry="3" fill="rgba(196,181,253,0.12)" stroke="url(#lg-grad)" stroke-width="1.2"/>
            <line x1="10" y1="16" x2="22" y2="16" stroke="url(#lg-grad)" stroke-width="0.8" stroke-linecap="round"/>
            <line x1="10" y1="18" x2="22" y2="18" stroke="url(#lg-grad)" stroke-width="0.8" stroke-linecap="round"/>
          </svg>
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
      <!-- Sidebar overlay (mobile) -->
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeMobileSidebar()"></div>

      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <svg class="sidebar-logo-svg" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="sd-grad" x1="4" y1="2" x2="28" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#c4b5fd"/><stop offset="1" stop-color="#818cf8"/>
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14.5" fill="rgba(196,181,253,0.06)" stroke="rgba(196,181,253,0.10)" stroke-width="0.8"/>
            <path d="M16 3L29 9V21Q29 29 16 32Q3 29 3 21V9L16 3Z" fill="rgba(196,181,253,0.10)"/>
            <path d="M16 3L29 9V21Q29 29 16 32Q3 29 3 21V9L16 3Z" stroke="url(#sd-grad)" stroke-width="1.5"/>
            <ellipse cx="16" cy="14" rx="7" ry="3" fill="rgba(196,181,253,0.12)" stroke="url(#sd-grad)" stroke-width="1.2"/>
            <rect x="9" y="14" width="14" height="6" fill="rgba(196,181,253,0.06)"/>
            <line x1="9" y1="14" x2="9" y2="20" stroke="url(#sd-grad)" stroke-width="1.2"/>
            <line x1="23" y1="14" x2="23" y2="20" stroke="url(#sd-grad)" stroke-width="1.2"/>
            <ellipse cx="16" cy="20" rx="7" ry="3" fill="rgba(196,181,253,0.12)" stroke="url(#sd-grad)" stroke-width="1.2"/>
            <line x1="10" y1="16" x2="22" y2="16" stroke="url(#sd-grad)" stroke-width="0.8" stroke-linecap="round"/>
            <line x1="10" y1="18" x2="22" y2="18" stroke="url(#sd-grad)" stroke-width="0.8" stroke-linecap="round"/>
          </svg>
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
          <a class="sidebar-link ${page === 'restores' ? 'active' : ''}" data-page="restores" onclick="navigate('restores')">
            <span class="icon"><i data-lucide="rotate-ccw" size="16"></i></span>
            Restores
          </a>

          <div class="sidebar-section-label" style="margin-top:var(--space-md);">Infrastructure</div>

          <a class="sidebar-link ${page === 'storage' ? 'active' : ''}" data-page="storage" onclick="navigate('storage')">
            <span class="icon"><i data-lucide="hard-drive" size="16"></i></span>
            Storage
          </a>
          <a class="sidebar-link ${page === 'notifications' ? 'active' : ''}" data-page="notifications" onclick="navigate('notifications')">
            <span class="icon"><i data-lucide="bell" size="16"></i></span>
            Notifications
          </a>
          <a class="sidebar-link ${page === 'activity' ? 'active' : ''}" data-page="activity" onclick="navigate('activity')">
            <span class="icon"><i data-lucide="activity" size="16"></i></span>
            Activity
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
            <button class="hamburger" onclick="toggleMobileSidebar()" id="hamburger-btn" title="Toggle menu">
              <i data-lucide="menu" size="18"></i>
            </button>
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

  const titles = { dashboard: 'Dashboard', connections: 'Connections', backups: 'Backups', schedules: 'Schedules', restores: 'Restores', storage: 'Storage', notifications: 'Notifications', activity: 'Activity', settings: 'Settings' };
  const titleEl = document.getElementById('page-title-breadcrumb');
  if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';

  switch (page) {
    case 'dashboard': renderDashboard(el); break;
    case 'connections': renderConnections(el); break;
    case 'backups': renderBackups(el); break;
    case 'schedules': renderSchedules(el); break;
    case 'storage': renderStorage(el); break;
    case 'notifications': renderNotifications(el); break;
    case 'restores': renderRestores(el); break;
    case 'settings': renderSettings(el); break;
    case 'activity': renderActivity(el); break;
    default: el.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="file-x" size="24"></i></div><h3>Page not found</h3></div>'; lucide.createIcons();
  }
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
async function renderDashboard(el) {
  el.innerHTML = `
    <!-- Compact Hero -->
    <div class="dash-hero-compact">
      <div>
        <h1>Good ${getGreeting()}, <span>${state.user || 'Admin'}</span></h1>
        <div class="dash-hero-sub">
          <span class="operational-badge"><i data-lucide="activity" size="12"></i> All systems operational</span>
          <span id="hero-summary">Loading your infrastructure...</span>
        </div>
      </div>
      <div class="dash-hero-actions">
        <button class="btn btn-primary" onclick="navigate('connections')"><i data-lucide="database" size="14"></i> Add Database</button>
        <button class="btn btn-secondary" onclick="showRunBackupModal()"><i data-lucide="play" size="14"></i> Run Backup</button>
        <button class="btn btn-secondary" onclick="navigate('schedules')"><i data-lucide="calendar" size="14"></i> Schedule</button>
      </div>
    </div>

    <!-- Stats Row (5 cards with sparklines) -->
    <div class="stats-row" id="stats-row">
      <div class="stat-card-v2">
        <div class="stat-top">
          <span class="stat-label">Databases</span>
          <i data-lucide="database" size="14" class="stat-icon"></i>
        </div>
        <div class="stat-value blue" id="stat-conns-v2">—</div>
        <span class="stat-change up" id="stat-conns-change"><i data-lucide="trending-up" size="11"></i> connected</span>
        <div class="sparkline" id="spark-conns"></div>
      </div>
      <div class="stat-card-v2">
        <div class="stat-top">
          <span class="stat-label">Total Backups</span>
          <i data-lucide="shield" size="14" class="stat-icon"></i>
        </div>
        <div class="stat-value purple" id="stat-backups-v2">—</div>
        <span class="stat-change up" id="stat-backups-change">—</span>
        <div class="sparkline" id="spark-backups"></div>
      </div>
      <div class="stat-card-v2">
        <div class="stat-top">
          <span class="stat-label">Schedules</span>
          <i data-lucide="calendar" size="14" class="stat-icon"></i>
        </div>
        <div class="stat-value green" id="stat-scheds-v2">—</div>
        <span class="stat-change up" id="stat-scheds-change">active</span>
        <div class="sparkline" id="spark-scheds"></div>
      </div>
      <div class="stat-card-v2">
        <div class="stat-top">
          <span class="stat-label">Storage Used</span>
          <i data-lucide="hard-drive" size="14" class="stat-icon"></i>
        </div>
        <div class="stat-value amber" id="stat-storage-v2">—</div>
        <span class="stat-change" id="stat-storage-change">—</span>
        <div class="sparkline" id="spark-storage"></div>
      </div>
      <div class="stat-card-v2">
        <div class="stat-top">
          <span class="stat-label">Success Rate</span>
          <i data-lucide="check-circle" size="14" class="stat-icon"></i>
        </div>
        <div class="stat-value green" id="stat-success-v2">—</div>
        <span class="stat-change up" id="stat-success-change">—</span>
        <div class="sparkline" id="spark-success"></div>
      </div>
    </div>

    <!-- Two-column: Activity + Quick Stats -->
    <div class="dash-grid">
      <!-- LEFT: Recent Activity -->
      <div>
        <div class="section-header-v2">
          <h3>Recent Activity</h3>
          <a onclick="navigate('backups')">View all →</a>
        </div>
        <div class="activity-card" id="activity-list">
          <div class="empty-state-v2">
            <div class="icon"><i data-lucide="activity" size="32"></i></div>
            <p>No recent activity</p>
          </div>
        </div>
      </div>

      <!-- RIGHT: Quick Stats -->
      <div>
        <div class="quick-stats-card">
          <h5><i data-lucide="bar-chart-3" size="12" style="margin-right:4px;"></i> Today</h5>
          <div class="qs-row">
            <span class="qs-label"><i data-lucide="upload" size="12" style="margin-right:4px;color:var(--text-quaternary);"></i>Backups</span>
            <span class="qs-value blue" id="today-total">—</span>
          </div>
          <div class="qs-row">
            <span class="qs-label"><i data-lucide="check" size="12" style="margin-right:4px;color:var(--accent-green);"></i>Successful</span>
            <span class="qs-value green" id="today-success">—</span>
          </div>
          <div class="qs-row">
            <span class="qs-label"><i data-lucide="x" size="12" style="margin-right:4px;color:var(--accent-red);"></i>Failed</span>
            <span class="qs-value red" id="today-failed">—</span>
          </div>
          <div class="qs-row">
            <span class="qs-label"><i data-lucide="rotate-ccw" size="12" style="margin-right:4px;color:var(--text-quaternary);"></i>Restores</span>
            <span class="qs-value blue" id="today-restores">—</span>
          </div>
          <div class="qs-row" style="border-bottom:1px solid var(--border-subtle);padding-bottom:var(--space-md);margin-bottom:var(--space-sm);">
            <span class="qs-label"><i data-lucide="hard-drive" size="12" style="margin-right:4px;color:var(--text-quaternary);"></i>Data stored</span>
            <span class="qs-value" id="today-data">—</span>
          </div>
          <div class="mini-donut-wrap" id="donut-wrap">
            <div class="mini-donut">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle class="bg-circle" cx="24" cy="24" r="20"></circle>
                <circle class="fg-circle" cx="24" cy="24" r="20" id="donut-circle"></circle>
              </svg>
              <div class="center-text" id="donut-pct">—</div>
            </div>
            <div class="donut-legend">
              <div class="donut-legend-item">
                <span class="donut-legend-dot" style="background:var(--accent-green);"></span>
                <span>Successful</span>
              </div>
              <div class="donut-legend-item">
                <span class="donut-legend-dot" style="background:var(--accent-red);"></span>
                <span>Failed</span>
              </div>
            </div>
          </div>
        </div>
        <div id="running-badge-container"></div>
      </div>
    </div>

    <!-- Storage Usage -->
    <div class="storage-card" id="storage-card">
      <div class="storage-header">
        <h3><i data-lucide="hard-drive" size="14" style="margin-right:6px;"></i> Storage Usage</h3>
        <span class="storage-total" id="storage-total">No storage providers</span>
      </div>
      <div class="storage-list" id="storage-list">
        <div class="empty-state-v2" style="padding:var(--space-xxl) var(--space-xl);">
          <p>No storage providers configured</p>
          <div class="sub" style="margin-top:4px;">Add a storage provider to store backups</div>
        </div>
      </div>
    </div>

    <!-- Recent Backups -->
    <div class="section-header-v2">
      <h3>Recent Backups</h3>
      <a onclick="navigate('backups')">View All →</a>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Database</th><th>Type</th><th>Status</th><th>Size</th><th>Duration</th><th>Created</th></tr></thead>
        <tbody id="recent-backups"></tbody>
      </table>
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

    // ── Stats Row ──
    const connCount = conns.length;
    document.getElementById('stat-conns-v2').textContent = connCount;
    document.getElementById('stat-conns-change').innerHTML = `<i data-lucide="trending-up" size="11"></i> ${connCount > 0 ? connCount + ' connected' : 'No connections'}`;

    const recent = backups || [];
    const totalBackups = stats ? stats.total_backups : recent.length;
    document.getElementById('stat-backups-v2').textContent = totalBackups;

    const activeScheds = scheds.filter(s => s.enabled !== false).length;
    document.getElementById('stat-scheds-v2').textContent = activeScheds;

    const storageCount = storageProvs.length;
    document.getElementById('stat-storage-v2').textContent = storageCount > 0 ? storageCount : '—';

    // Success rate
    let successRate = 0;
    if (stats && stats.success_rate) {
      successRate = Math.round(stats.success_rate);
    } else if (recent.length > 0) {
      const sc = recent.filter(b => b.status === 'success').length;
      successRate = Math.round((sc / recent.length) * 100);
    }
    document.getElementById('stat-success-v2').textContent = successRate + '%';
    document.getElementById('stat-success-change').innerHTML = `<i data-lucide="trending-up" size="11"></i> ${successRate}% success rate`;

    // Sparlines (decorative — 7 bars for weekly trend)
    const sparkConfigs = [
      { id: 'spark-conns', heights: [8, 12, 14, 10, 16, 18, connCount * 4], filled: true },
      { id: 'spark-backups', heights: [16, 20, 14, 22, 18, 24, Math.min(totalBackups * 1.2, 28)], filled: false },
      { id: 'spark-scheds', heights: [6, 10, 8, 14, 12, 16, activeScheds * 5], filled: false },
      { id: 'spark-storage', heights: [10, 14, 18, 16, 20, 22, Math.min(storageCount * 8, 24)], filled: true },
      { id: 'spark-success', heights: [20, 22, 18, 24, 20, 26, Math.min(successRate / 4, 26)], filled: false },
    ];
    sparkConfigs.forEach(cfg => {
      const el2 = document.getElementById(cfg.id);
      if (!el2) return;
      el2.innerHTML = cfg.heights.map((h, i) => {
        const cls = i === cfg.heights.length - 1
          ? (cfg.filled ? 'bar filled' : 'bar green')
          : (cfg.filled ? 'bar' : 'bar green-bg');
        return `<div class="${cls}" style="height:${Math.max(h, 4)}px"></div>`;
      }).join('');
    });

    // Sidebar counts
    const connBadge = document.getElementById('sidebar-conn-count');
    if (connBadge) connBadge.textContent = connCount;
    const backupBadge = document.getElementById('sidebar-backup-count');
    if (backupBadge) backupBadge.textContent = recent.length;

    // Hero summary
    const totalSize = stats && stats.total_size_bytes ? formatBytes(stats.total_size_bytes) : '—';
    document.getElementById('hero-summary').textContent =
      `${connCount} databases · ${activeScheds} active schedules · ${totalSize} total`;

    // ── Activity Feed ──
    const activityEl = document.getElementById('activity-list');
    if (recent.length === 0 && scheds.length === 0 && conns.length === 0) {
      activityEl.innerHTML = `<div class="empty-state-v2"><div class="icon"><i data-lucide="activity" size="32"></i></div><p>No recent activity</p><div class="sub">Add a connection and run your first backup</div></div>`;
    } else {
      const items = [];
      // Add backup activities
      recent.slice(0, 4).forEach((b, i) => {
        const status = b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'running';
        const dbLabel = b.database_label || b.database_id || 'Unknown';
        const dbType = b.db_type || '';
        const badge = dbType ? `<span class="badge badge-${getDbBadgeClass(dbType)}">${dbType.toUpperCase().slice(0,2)}</span>` : '';
        const sizeStr = b.size_bytes ? formatBytes(b.size_bytes) : '—';
        const durStr = b.duration_ms ? (b.duration_ms / 1000).toFixed(1) + 's' : '';
        const timeStr = b.created_at ? timeAgo(b.created_at) : '';
        const statusIcon = status === 'success' ? '✓' : status === 'failed' ? '✗' : '';
        const title = status === 'running'
          ? `Full backup — <strong>${escHtml(dbLabel)}</strong>`
          : `${statusIcon} ${status === 'success' ? 'Full backup completed' : 'Backup failed'} — <strong>${escHtml(dbLabel)}</strong>`;
        const meta = status === 'running'
          ? `${badge} <span style="font-size:11px;color:var(--text-tertiary);">${sizeStr} — ${durStr}</span>`
          : `${badge} ${sizeStr ? `<span class="badge badge-success">${sizeStr}</span>` : ''} ${durStr ? '<span style="font-size:11px;color:var(--text-tertiary);">' + durStr + '</span>' : ''}`;
        items.push({ status, title, meta, time: timeStr });
      });
      // Add schedule created items
      const recentScheds = scheds.slice(0, 2);
      recentScheds.forEach(s => {
        items.push({
          status: 'info',
          title: `📅 Schedule created — <strong>${escHtml(s.name || s.cron_expr || 'Schedule')}</strong>`,
          meta: `<span class="badge badge-info">${(s.backup_type || 'FULL').toUpperCase()}</span> <span style="font-size:11px;color:var(--text-tertiary);">${s.cron_expr || ''}</span>`,
          time: s.created_at ? timeAgo(s.created_at) : '',
        });
      });
      // Add connection items
      const recentConns = conns.slice(0, 2);
      recentConns.forEach(c => {
        const ct = c.db_type || '';
        const badge = ct ? `<span class="badge badge-${getDbBadgeClass(ct)}">${ct.toUpperCase().slice(0,2)}</span>` : '';
        items.push({
          status: 'info',
          title: `🔌 New connection — <strong>${escHtml(c.name || c.host || 'Connection')}</strong>`,
          meta: `${badge} <span style="font-size:11px;color:var(--text-tertiary);">${c.host || ''}${c.port ? ':' + c.port : ''}</span>`,
          time: c.created_at ? timeAgo(c.created_at) : '',
        });
      });
      // Sort all items by time (approximate — put running first)
      items.sort((a, b) => {
        if (a.status === 'running') return -1;
        if (b.status === 'running') return 1;
        return 0;
      });
      const maxItems = Math.min(items.length, 6);
      activityEl.innerHTML = items.slice(0, maxItems).map(item => `
        <div class="activity-item ${item.status}">
          <div class="activity-dot ${item.status}"></div>
          <div class="activity-content">
            <div class="activity-title">${item.title}</div>
            <div class="activity-meta">${item.meta}${item.time ? '<span class="activity-time">' + item.time + '</span>' : ''}</div>
          </div>
        </div>
      `).join('');
    }

    // ── Today Stats ──
    const todayBackups = recent.length;
    const todaySuccess = recent.filter(b => b.status === 'success').length;
    const todayFailed = recent.filter(b => b.status === 'failed').length;
    const todayRestores = 0; // TODO: when restore API available
    document.getElementById('today-total').textContent = todayBackups;
    document.getElementById('today-success').textContent = todaySuccess;
    document.getElementById('today-failed').textContent = todayFailed;
    document.getElementById('today-restores').textContent = todayRestores;
    document.getElementById('today-data').textContent = totalSize;

    // Donut chart
    const donutCircle = document.getElementById('donut-circle');
    const donutPct = document.getElementById('donut-pct');
    if (todayBackups > 0) {
      const pct = Math.round((todaySuccess / todayBackups) * 100);
      const circ = 2 * Math.PI * 20; // r=20 => 125.66
      const offset = circ - (pct / 100) * circ;
      donutCircle.style.strokeDasharray = circ;
      donutCircle.style.strokeDashoffset = offset;
      donutCircle.style.stroke = pct >= 80 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
      donutPct.textContent = pct + '%';
    } else {
      donutCircle.style.strokeDasharray = '125.6';
      donutCircle.style.strokeDashoffset = '125.6';
      donutPct.textContent = '—';
    }

    // Running backup badge
    const runningContainer = document.getElementById('running-badge-container');
    const runningBackup = recent.find(b => b.status === 'running');
    if (runningBackup) {
      const dbLabel = runningBackup.database_label || runningBackup.database_id || 'Unknown';
      const sizeStr = runningBackup.size_bytes ? formatBytes(runningBackup.size_bytes) : '—';
      runningContainer.innerHTML = `
        <div class="running-badge">
          <span class="running-dot"></span>
          <span>${escHtml(dbLabel)} is running (${sizeStr})</span>
        </div>
      `;
    } else {
      runningContainer.innerHTML = '';
    }

    // ── Storage Usage ──
    const storageList = document.getElementById('storage-list');
    const storageTotal = document.getElementById('storage-total');
    if (storageProvs.length === 0) {
      storageList.innerHTML = `<div class="empty-state-v2" style="padding:var(--space-xxl) var(--space-xl);"><p>No storage providers configured</p><div class="sub" style="margin-top:4px;">Add a storage provider to store backups</div></div>`;
      storageTotal.textContent = 'No storage providers';
    } else {
      storageList.innerHTML = storageProvs.map(p => {
        const provType = (p.provider_type || 's3').toLowerCase();
        const iconLabel = provType === 'r2' ? 'R2' : provType === 'gcs' ? 'GCS' : provType === 'minio' ? 'MI' : 'S3';
        const usedStr = '—'; // Backend doesn't have usage stats yet
        const bucketStr = p.bucket || '—';
        const regionStr = p.region || p.endpoint || '';
        return `
          <div class="storage-item">
            <div class="storage-provider-icon ${provType}">${iconLabel}</div>
            <div class="storage-info">
              <div class="storage-name">${escHtml(p.name || iconLabel)}${regionStr ? ' — ' + escHtml(regionStr) : ''}</div>
              <div class="storage-meta">Bucket: ${escHtml(bucketStr)}</div>
              <div class="storage-bar-wrapper">
                <div class="storage-bar-fill ${provType}" style="width:${p.is_default ? '60' : '30'}%"></div>
              </div>
            </div>
            <div class="storage-numbers">
              <div class="storage-used">${usedStr}</div>
              <div class="storage-total-size">${escHtml(bucketStr)}</div>
            </div>
          </div>
        `;
      }).join('');
      storageTotal.textContent = `${storageProvs.length} provider${storageProvs.length > 1 ? 's' : ''}`;
    }

    // ── Recent Backups Table ──
    const tbody = document.getElementById('recent-backups');
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state-v2"><p>No backups yet</p><div class="sub">Run your first backup to see it here</div></div></td></tr>';
    } else {
      tbody.innerHTML = recent.map(b => {
        const dbLabel = b.database_label || (b.database_id ? b.database_id.slice(0,8) : '—');
        const dbType = b.db_type || '';
        const badge = dbType ? `<span class="badge badge-${getDbBadgeClass(dbType)}">${(dbType === 'postgresql' ? 'PG' : dbType === 'mysql' ? 'MY' : dbType === 'mariadb' ? 'MA' : dbType.toUpperCase()).slice(0,2)}</span>` : '';
        const statusClass = b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : b.status === 'running' ? 'running' : 'pending';
        const statusDot = statusClass === 'success' ? 'green' : statusClass === 'failed' ? 'red' : statusClass === 'running' ? 'blue' : 'amber';
        const typeLabel = (b.backup_type || '—').toUpperCase();
        return `<tr>
          <td>${badge} ${escHtml(dbLabel)}</td>
          <td><span class="badge badge-info">${typeLabel}</span></td>
          <td><span class="status-pill ${statusClass}"><span class="status-dot ${statusDot}"></span> ${b.status || '—'}</span></td>
          <td class="mono">${b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
          <td class="mono">${b.duration_ms ? (b.duration_ms/1000).toFixed(1)+'s' : '—'}</td>
          <td style="color:var(--text-tertiary);font-size:11px;">${b.created_at ? timeAgo(b.created_at) : '—'}</td>
        </tr>`;
      }).join('');
    }

    lucide.createIcons();
  } catch (err) {
    document.getElementById('stats-row').innerHTML += `<p style="color:var(--error);margin-top:12px;grid-column:1/-1;">Error loading: ${escHtml(err.message)}</p>`;
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
        <select class="form-select" id="modal-conn-type" onchange="updateConnPort()">
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mariadb">MariaDB</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Port</label>
        <input class="form-input" id="modal-conn-port" value="5432" placeholder="auto">
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
    <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <button class="btn btn-primary test-conn-btn" onclick="testConnectionFromModal(event)">
        <i data-lucide="zap" size="14"></i> Test Connection
      </button>
      <div class="test-conn-result" id="test-conn-result"></div>
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
  lucide.createIcons();
}

async function testConnectionFromModal(event) {
  const btn = event.target.closest('button');
  const host = document.getElementById('modal-conn-host').value;
  const port = parseInt(document.getElementById('modal-conn-port').value) || 5432;
  const dbType = document.getElementById('modal-conn-type').value;
  const user = document.getElementById('modal-conn-user').value;
  const pass = document.getElementById('modal-conn-pass').value;

  if (!host || !user) { alert('Host and Username are required to test'); return; }

  const resultEl = document.getElementById('test-conn-result');
  resultEl.className = 'test-conn-result visible loading';
  resultEl.innerHTML = '<div class="loading-spinner" style="width:16px;height:16px;border-width:2px;"></div> Testing connection...';
  btn.disabled = true;

  try {
    const res = await API.post('/api/connections/_new/test', {
      host, port, db_type: dbType, username: user, password: pass
    });
    if (res.success) {
      resultEl.className = 'test-conn-result visible success';
      resultEl.innerHTML = '<i data-lucide="check-circle" size="16"></i> ✅ Connection successful';
      resultEl.innerHTML += `<div class="test-conn-detail">${user}@${host}:${port} (${dbType})</div>`;
    } else {
      resultEl.className = 'test-conn-result visible failed';
      resultEl.innerHTML = '<i data-lucide="x-circle" size="16"></i> ❌ Connection failed';
      resultEl.innerHTML += `<div class="test-conn-detail">${escHtml(res.error || 'Unknown error')}</div>`;
    }
  } catch (err) {
    resultEl.className = 'test-conn-result visible failed';
    resultEl.innerHTML = '<i data-lucide="x-circle" size="16"></i> ❌ Connection error';
    resultEl.innerHTML += `<div class="test-conn-detail">${escHtml(err.message)}</div>`;
  }

  btn.disabled = false;
  lucide.createIcons();
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

function updateConnPort() {
  const type = document.getElementById('modal-conn-type')?.value;
  const portMap = { postgresql: 5432, mysql: 3306, mariadb: 3306 };
  const portInput = document.getElementById('modal-conn-port');
  if (portInput) portInput.value = portMap[type] || 5432;
}

function updateStoragePlaceholders() {
  const type = document.getElementById('modal-stor-type')?.value;
  const hints = {
    s3:        { endpoint: 'https://s3.amazonaws.com',        bucket: 'my-backups',   region: 'us-east-1',    pathStyle: 'false' },
    r2:        { endpoint: 'https://<acct>.r2.cloudflarestorage.com', bucket: 'my-backups', region: 'auto',        pathStyle: 'true' },
    minio:     { endpoint: 'http://localhost:9000',           bucket: 'my-backups',   region: 'us-east-1',    pathStyle: 'true' },
    gcs:       { endpoint: 'https://storage.googleapis.com',  bucket: 'my-bucket',    region: 'auto',         pathStyle: 'false' },
    b2:        { endpoint: 'https://s3.us-west-000.backblazeb2.com', bucket: 'my-bucket', region: 'us-west-000', pathStyle: 'true' },
    's3-compat': { endpoint: 'https://your-storage.example.com', bucket: 'my-bucket',  region: 'auto',        pathStyle: 'true' },
  };
  const h = hints[type] || hints.s3;
  const ep = document.getElementById('modal-stor-endpoint');
  const bk = document.getElementById('modal-stor-bucket');
  const rg = document.getElementById('modal-stor-region');
  const ps = document.getElementById('modal-stor-pathstyle');
  if (ep) { ep.placeholder = h.endpoint; ep.value = ''; }
  if (bk) { bk.placeholder = h.bucket; bk.value = ''; }
  if (rg) { rg.placeholder = h.region; rg.value = ''; }
  if (ps) ps.value = h.pathStyle;
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

    <!-- Backup Progress Card (live) -->
    <div class="backup-progress-card" id="backup-progress-card">
      <div class="bp-header">
        <div class="bp-title">
          <span class="running-dot"></span>
          <span id="bp-db-name">—</span>
        </div>
        <span class="bp-status" id="bp-status-text">Running...</span>
      </div>
      <div class="bp-bar-wrap">
        <div class="bp-bar-fill" id="bp-bar" style="width:5%"></div>
      </div>
      <div class="bp-meta">
        <span>Size: <strong id="bp-size">—</strong></span>
        <span>Duration: <strong id="bp-dur">—</strong></span>
      </div>
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
  lucide.createIcons();

  // Start progress polling
  startBackupPolling();

  try {
    const backups = await API.get('/api/backups');
    const tbody = document.getElementById('backup-table-body');
    if (backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No backups yet</p></div></td></tr>';
    } else {
      tbody.innerHTML = backups.map(b => {
        const statusClass = b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'running';
        // Enhanced verify badge
        const vStatus = b.verify_status || '—';
        let verifyBadge = '—';
        if (vStatus !== '—') {
          const vClass = vStatus;
          const vLabel = vStatus.charAt(0).toUpperCase() + vStatus.slice(1);
          verifyBadge = `<span class="verify-badge ${vClass}" onclick="showVerifyDetails('${b.id}')" title="Click for details">${vLabel}</span>`;
        }
        return `<tr class="status-${statusClass}">
          <td class="mono" title="${b.id}">${b.id.slice(0,8)}</td>
          <td><span class="badge badge-info">${(b.backup_type || '').toUpperCase()}</span></td>
          <td><span class="status-pill ${statusPill(b.status)}"><span class="status-dot ${b.status === 'success' ? 'green' : b.status === 'failed' ? 'red' : 'blue'}"></span> ${b.status || '—'}</span></td>
          <td class="mono">${b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
          <td class="mono">${b.duration_ms ? (b.duration_ms/1000).toFixed(1)+'s' : '—'}</td>
          <td>${verifyBadge}</td>
          <td style="color:var(--text-tertiary);font-size:12px;">${b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
          <td>
            <button class="btn btn-sm" onclick="showBackupLog('${b.id}')" title="View logs"><i data-lucide="file-text" size="13"></i></button>
            <button class="btn btn-sm" onclick="downloadBackup('${b.id}')" title="Download"><i data-lucide="download" size="13"></i></button>
            <button class="btn btn-sm" onclick="triggerVerify('${b.id}')" title="Verify integrity"><i data-lucide="check-circle" size="13"></i></button>
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

async function showRunBackupModal() {
  const connOptions = state.connections.length > 0
    ? state.connections.map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.db_type})</option>`).join('')
    : '<option value="">No connections — add one first</option>';

  let storageOptions = '<option value="">Use default</option>';
  if (state.storageProviders.length > 0) {
    storageOptions += state.storageProviders.map(p =>
      `<option value="${p.id}">${escHtml(p.name)} (${p.provider_type})${p.is_default ? ' ★' : ''}</option>`
    ).join('');
  }

  // Build notification target checkboxes
  let notifOptions = '';
  let notifs = [];
  try {
    notifs = await API.get('/api/notifications');
    if (notifs.length > 0) {
      notifOptions = notifs.map(n =>
        `<label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" class="notif-target-chk" value="${n.id}" checked>
          ${escHtml(n.name)} (${n.notif_type})
        </label>`
      ).join('');
    } else {
      notifOptions = '<p style="color:var(--text-muted);font-size:13px;">No notification targets — <a href="#" onclick="navigate(\'notifications\');return false;">add one in Notifications</a></p>';
    }
  } catch (err) {
    notifOptions = '<p style="color:var(--text-muted);font-size:13px;">Error loading notification targets</p>';
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
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
      <label class="form-label">Notifications</label>
      <div style="margin-bottom:8px;">
        <label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" id="modal-run-notif-success" checked> On success
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="modal-run-notif-failure" checked> On failure
        </label>
      </div>
      <div>${notifOptions}</div>
    </div>
  `, async () => {
    const connId = document.getElementById('modal-run-conn').value;
    if (!connId) { alert('Please select a connection'); return false; }
    const dbId = document.getElementById('modal-run-db').value;
    const type = document.getElementById('modal-run-type').value;
    const storageId = document.getElementById('modal-run-storage').value;
    
    // Collect selected notification targets
    const notifTargetIds = [];
    document.querySelectorAll('.notif-target-chk:checked').forEach(cb => notifTargetIds.push(cb.value));
    const notifOnSuccess = document.getElementById('modal-run-notif-success').checked;
    const notifOnFailure = document.getElementById('modal-run-notif-failure').checked;

    try {
      await API.post('/api/backups', {
        connection_id: connId, database_id: dbId, backup_type: type,
        storage_provider_id: storageId || undefined,
        notif_target_ids: notifTargetIds,
        notify_on_success: notifOnSuccess,
        notify_on_failure: notifOnFailure
      });
      alert('Backup started!');
      navigate('backups');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function showRestoreModal(backupId) {
  // Load backup details first
  let backupData = null;
  try {
    backupData = await API.get(`/api/backups/${backupId}`);
  } catch (e) { /* ok */ }

  const backupType = backupData ? (backupData.backup_type || 'full').toUpperCase() : 'FULL';
  const backupSize = backupData && backupData.size_bytes ? formatBytes(backupData.size_bytes) : '—';
  const backupDb = backupData && backupData.database_label ? backupData.database_label : (backupData ? backupData.database_id || '' : '');

  // Three-step wizard state
  let step = 1;
  let restoreType = 'full'; // full | data-only | schema-only
  let targetConn = '';

  function renderWizard() {
    const overlay = document.querySelector('.restore-wizard-overlay');
    if (!overlay) return;
    const body = overlay.querySelector('.wizard-body-inner');
    const footer = overlay.querySelector('.wizard-footer-inner');

    // Step indicators
    const stepsHtml = [1,2,3].map(s => {
      const cls = s === step ? 'active' : (s < step ? 'completed' : '');
      const labels = ['Select Backup', 'Configure', 'Restore'];
      return `<div class="wizard-step ${cls}"><span class="step-num">${s < step ? '✓' : s}</span> ${labels[s-1]}</div>`;
    }).join('');

    // Step content
    let bodyHtml = '';
    let backBtn = '';
    let nextBtn = '';

    if (step === 1) {
      bodyHtml = `
        <div style="margin-bottom:var(--space-lg);">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-lg);">Choose what to restore from backup <code>${backupId.slice(0,8)}</code></p>
          <table class="restore-review-table" style="margin-bottom:var(--space-lg);">
            <tr><td>Backup ID</td><td><code>${backupId.slice(0,8)}</code></td></tr>
            <tr><td>Database</td><td>${escHtml(backupDb) || '—'}</td></tr>
            <tr><td>Type</td><td>${backupType}</td></tr>
            <tr><td>Size</td><td>${backupSize}</td></tr>
            <tr><td>Created</td><td>${backupData && backupData.created_at ? new Date(backupData.created_at).toLocaleString() : '—'}</td></tr>
          </table>
        </div>
        <div class="restore-types">
          <div class="restore-type-card ${restoreType === 'full' ? 'selected' : ''}" onclick="selectRestoreType('full')">
            <div class="icon">💾</div>
            <h5>Full Restore</h5>
            <p>Complete database including all schemas and data</p>
          </div>
          <div class="restore-type-card ${restoreType === 'data-only' ? 'selected' : ''}" onclick="selectRestoreType('data-only')">
            <div class="icon">📊</div>
            <h5>Data Only</h5>
            <p>Restore table data without schema definitions</p>
          </div>
        </div>
      `;
      nextBtn = `<button class="btn btn-primary" onclick="restoreWizardNext()"><i data-lucide="arrow-right" size="14"></i> Continue</button>`;
    } else if (step === 2) {
      const connOptions = state.connections.length > 0
        ? state.connections.map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.db_type})</option>`).join('')
        : '<option value="">No connections available</option>';
      bodyHtml = `
        <div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-lg);">Configure restore destination</p>
          <div class="form-group">
            <label class="form-label">Target Connection</label>
            <select class="form-select" id="restore-target-conn" onchange="updateRestoreTargetConn(this.value)">
              <option value="">Original connection (same as backup source)</option>
              ${connOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Database Name (optional)</label>
            <input class="form-input" id="restore-target-db" placeholder="Leave empty to restore to original database">
          </div>
          <div style="background:var(--accent-amber-bg);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);padding:var(--space-md) var(--space-lg);margin-top:var(--space-lg);display:flex;align-items:flex-start;gap:8px;">
            <span style="color:var(--accent-amber);flex-shrink:0;">⚠️</span>
            <span style="font-size:12px;color:var(--text-secondary);">Restore will <strong>overwrite</strong> the target database. Make sure you have a recent backup before proceeding.</span>
          </div>
        </div>
      `;
      backBtn = `<button class="btn" onclick="restoreWizardBack()"><i data-lucide="arrow-left" size="14"></i> Back</button>`;
      nextBtn = `<button class="btn btn-primary" onclick="restoreWizardNext()"><i data-lucide="arrow-right" size="14"></i> Review</button>`;
    } else if (step === 3) {
      const targetLabel = targetConn ? (state.connections.find(c => c.id === targetConn)?.name || 'Custom') : 'Original connection';
      const restoreLabel = restoreType === 'full' ? 'Full database' : 'Data only (no schema)';
      bodyHtml = `
        <div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-lg);">Review your restore options before proceeding</p>
          <table class="restore-review-table">
            <tr><td>Backup</td><td><code>${backupId.slice(0,8)}...</code></td></tr>
            <tr><td>Type</td><td>${restoreLabel}</td></tr>
            <tr><td>Target</td><td>${escHtml(targetLabel)}</td></tr>
            <tr><td>Overwrite</td><td><span style="color:var(--accent-red);">⚠️ Yes — will overwrite target database</span></td></tr>
          </table>
        </div>
      `;
      backBtn = `<button class="btn" onclick="restoreWizardBack()"><i data-lucide="arrow-left" size="14"></i> Back</button>`;
      nextBtn = `<button class="btn btn-primary" onclick="executeRestore('${backupId}')" style="background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 14px rgba(239,68,68,0.35);"><i data-lucide="rotate-ccw" size="14"></i> Start Restore</button>`;
    }

    body.innerHTML = bodyHtml;
    footer.innerHTML = `
      <div>${backBtn}</div>
      <div style="display:flex;gap:var(--space-sm);">
        <button class="btn" onclick="this.closest('.restore-wizard-overlay').remove()">Cancel</button>
        ${nextBtn}
      </div>
    `;
    // Update steps
    overlay.querySelector('.wizard-steps-inner').innerHTML = stepsHtml;
    lucide.createIcons();
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay restore-wizard-overlay';
  overlay.style.zIndex = '1001';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h3>Restore Backup</h3>
        <button class="modal-close" onclick="this.closest('.restore-wizard-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <div class="wizard-steps wizard-steps-inner"></div>
        <div style="padding:var(--space-xxl);">
          <div class="wizard-body-inner"></div>
          <div class="wizard-footer-inner"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  renderWizard();
  lucide.createIcons();

  // Expose helpers to window scope for onclick handlers
  window.selectRestoreType = function(type) {
    restoreType = type;
    renderWizard();
  };
  window.updateRestoreTargetConn = function(val) {
    targetConn = val;
  };
  window.restoreWizardNext = function() {
    if (step < 3) { step++; renderWizard(); }
  };
  window.restoreWizardBack = function() {
    if (step > 1) { step--; renderWizard(); }
  };
  window.executeRestore = async function(id) {
    try {
      const targetDb = document.getElementById('restore-target-db')?.value || '';
      const payload = {
        restore_type: restoreType,
        target_connection: targetConn || undefined,
        target_database: targetDb || undefined,
      };
      await API.post(`/api/backups/${id}/restore`, payload);
      alert('✅ Restore started! Check the Restores page for progress.');
      overlay.remove();
      navigate('restores');
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };
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

function updateScheduleRetention() {
  const type = document.getElementById('modal-sched-type')?.value;
  const fullGroup = document.getElementById('sched-ret-full-group');
  const incrGroup = document.getElementById('sched-ret-incr-group');
  if (!fullGroup || !incrGroup) return;
  fullGroup.style.display = type === 'full' ? '' : 'none';
  incrGroup.style.display = type === 'incremental' ? '' : 'none';
}

async function showAddScheduleModal() {
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

  // Build notification target checkboxes
  let notifOptions = '';
  let notifs = [];
  try {
    notifs = await API.get('/api/notifications');
    if (notifs.length > 0) {
      notifOptions = notifs.map(n =>
        `<label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" class="sched-notif-chk" value="${n.id}" checked>
          ${escHtml(n.name)} (${n.notif_type})
        </label>`
      ).join('');
    } else {
      notifOptions = '<p style="color:var(--text-muted);font-size:13px;">No notification targets — <a href="#" onclick="navigate(\'notifications\');return false;">add one in Notifications</a></p>';
    }
  } catch (err) {
    notifOptions = '<p style="color:var(--text-muted);font-size:13px;">Error loading notification targets</p>';
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
        <select class="form-select" id="modal-sched-type" onchange="updateScheduleRetention()">
          <option value="full">Full</option>
          <option value="incremental">Incremental</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Cron Expression</label>
        <input class="form-input" id="modal-sched-cron" value="0 1 * * *" placeholder="0 1 * * *" oninput="updateCronPreview()">
        <div class="cron-preview-wrap" id="cron-preview-wrap">
          <div class="cron-preview-header">Next <span class="count" id="cron-preview-count">5</span> Executions</div>
          <div id="cron-preview-list"></div>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Storage Provider</label>
      <select class="form-select" id="modal-sched-storage">${storageOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1" id="sched-ret-full-group">
        <label class="form-label">Retention (days)</label>
        <input class="form-input" type="number" id="modal-sched-ret-full" value="7" min="1">
      </div>
      <div class="form-group" style="flex:1;display:none" id="sched-ret-incr-group">
        <label class="form-label">Retention (days)</label>
        <input class="form-input" type="number" id="modal-sched-ret-incr" value="30" min="1">
      </div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
      <label class="form-label">Notifications</label>
      <div style="margin-bottom:8px;">
        <label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" id="modal-sched-notif-success" checked> On success
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="modal-sched-notif-failure" checked> On failure
        </label>
      </div>
      <div>${notifOptions}</div>
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

    // Collect selected notification targets
    const notifTargetIds = [];
    document.querySelectorAll('.sched-notif-chk:checked').forEach(cb => notifTargetIds.push(cb.value));
    const notifOnSuccess = document.getElementById('modal-sched-notif-success').checked;
    const notifOnFailure = document.getElementById('modal-sched-notif-failure').checked;

    try {
      await API.post('/api/schedules', {
        connection_id: connId, database_id: dbId,
        backup_type: type, cron_expr: cron,
        storage_provider_id: storageId,
        retention_full: retFull, retention_incr: retIncr,
        notif_target_ids: notifTargetIds,
        notify_on_success: notifOnSuccess,
        notify_on_failure: notifOnFailure
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

function updateCronPreview() {
  const input = document.getElementById('modal-sched-cron');
  const wrap = document.getElementById('cron-preview-wrap');
  const list = document.getElementById('cron-preview-list');
  if (!input || !wrap || !list) return;

  const expr = input.value.trim();
  if (!expr || expr.split(/\s+/).length !== 5) {
    wrap.classList.remove('visible');
    return;
  }

  const runs = cronNextRuns(expr, 5);
  if (runs.length === 0) {
    wrap.classList.remove('visible');
    return;
  }

  wrap.classList.add('visible');
  document.getElementById('cron-preview-count').textContent = runs.length;
  list.innerHTML = runs.map((r, i) => `
    <div class="cron-preview-item ${r.isSoon ? 'soon' : ''}">
      <span class="num">${i + 1}</span>
      <span class="date">${r.date}</span>
      <span class="time">${r.time}</span>
      <span class="from-now">${r.fromNow}</span>
    </div>
  `).join('');
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
        const typeClass = p.provider_type === 's3' ? 'icon-s3' : p.provider_type === 'r2' ? 'icon-r2' : p.provider_type === 'minio' ? 'icon-minio' : p.provider_type === 'gcs' ? 'icon-gcs' : p.provider_type === 'b2' ? 'icon-b2' : 'icon-s3';
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
        <select class="form-select" id="modal-stor-type" onchange="updateStoragePlaceholders()">
          <option value="s3">AWS S3</option>
          <option value="r2">Cloudflare R2</option>
          <option value="minio">MinIO</option>
          <option value="gcs">Google Cloud Storage</option>
          <option value="b2">Backblaze B2</option>
          <option value="s3-compat">S3-Compatible</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Region</label>
        <input class="form-input" id="modal-stor-region" placeholder="us-east-1">
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
          <option value="gcs" ${prov.provider_type === 'gcs' ? 'selected' : ''}>Google Cloud Storage</option>
          <option value="b2" ${prov.provider_type === 'b2' ? 'selected' : ''}>Backblaze B2</option>
          <option value="s3-compat" ${prov.provider_type === 's3-compat' ? 'selected' : ''}>S3-Compatible</option>
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
async function renderSettings(el) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  el.innerHTML = `
    <div class="page-header">
      <h1>Settings</h1>
      <p>Application configuration</p>
    </div>

    <div class="settings-grid">
      <!-- Preferences -->
      <div class="card">
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
                <i class="theme-icon" data-lucide="\${theme === 'dark' ? 'sun' : 'moon'}" size="15"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Timezone</label>
            <select class="form-select" id="setting-timezone">
              <option value="UTC">UTC</option>
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Defaults -->
      <div class="card">
        <div class="card-header"><h2>Default Settings</h2></div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Retention (full backup days)</label>
              <input class="form-input" type="number" id="setting-ret-full" min="1" max="365">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Retention (incremental days)</label>
              <input class="form-input" type="number" id="setting-ret-incr" min="1" max="365">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Concurrent Backups</label>
              <input class="form-input" type="number" id="setting-concurrent" min="1" max="10">
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Compression</label>
              <select class="form-select" id="setting-compression">
                <option value="gzip">Gzip</option>
                <option value="zstd">Zstandard (zstd)</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Notify on Success (default)</label>
              <select class="form-select" id="setting-notif-success">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Notify on Failure (default)</label>
              <select class="form-select" id="setting-notif-failure">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" onclick="saveSettings()" style="margin-top:8px;">
            <i data-lucide="save" size="14"></i> Save Defaults
          </button>
          <span id="settings-save-msg" style="margin-left:12px;font-size:13px;color:var(--success);"></span>
        </div>
      </div>

      <!-- Security -->
      <div class="card">
        <div class="card-header"><h2>Security</h2></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Encryption</label>
            <p class="form-help" id="encrypt-status">Checking encryption status...</p>
          </div>
          <div class="settings-divider"></div>
          <div class="form-group">
            <label class="form-label">Change Password</label>
            <div class="form-group">
              <input class="form-input" type="password" id="setting-current-pass" placeholder="Current password">
            </div>
            <div class="form-group">
              <input class="form-input" type="password" id="setting-new-pass" placeholder="New password (min. 6 chars)">
            </div>
            <button class="btn btn-primary" onclick="changePassword()">
              <i data-lucide="lock" size="14"></i> Change Password
            </button>
            <span id="password-msg" style="margin-left:12px;font-size:13px;"></span>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card">
        <div class="card-header"><h2>About</h2></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Version</label>
            <input class="form-input" id="setting-version" value="..." disabled>
          </div>
          <p style="color:var(--text-tertiary);font-size:12px;margin-top:8px;">
            Backupeer — PostgreSQL · MySQL · MariaDB backup manager.
          </p>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();

  // Load settings
  try {
    const settings = await API.get('/api/settings');
    if (settings.retention_full_default) document.getElementById('setting-ret-full').value = settings.retention_full_default;
    if (settings.retention_incr_default) document.getElementById('setting-ret-incr').value = settings.retention_incr_default;
    if (settings.concurrent_backups) document.getElementById('setting-concurrent').value = settings.concurrent_backups;
    if (settings.compression) document.getElementById('setting-compression').value = settings.compression;
    if (settings.timezone) document.getElementById('setting-timezone').value = settings.timezone;
    if (settings.notify_on_success) document.getElementById('setting-notif-success').value = settings.notify_on_success;
    if (settings.notify_on_failure) document.getElementById('setting-notif-failure').value = settings.notify_on_failure;
    if (settings.version) document.getElementById('setting-version').value = settings.version;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Check encryption
  API.get('/api/health').then(h => {
    document.getElementById('encrypt-status').textContent =
      h.encryption ? '✅ AES-256-GCM enabled' : '⚠️ Not configured (set BACKUPEER_ENCRYPTION_KEY)';
  }).catch(() => {
    document.getElementById('encrypt-status').textContent = '⚠️ Unknown';
  });
}

async function saveSettings() {
  const settings = {
    retention_full_default: document.getElementById('setting-ret-full').value || '7',
    retention_incr_default: document.getElementById('setting-ret-incr').value || '30',
    concurrent_backups: document.getElementById('setting-concurrent').value || '2',
    compression: document.getElementById('setting-compression').value,
    timezone: document.getElementById('setting-timezone').value,
    notify_on_success: document.getElementById('setting-notif-success').value,
    notify_on_failure: document.getElementById('setting-notif-failure').value,
  };
  try {
    await API.put('/api/settings', settings);
    const msg = document.getElementById('settings-save-msg');
    msg.textContent = '✅ Settings saved';
    setTimeout(() => msg.textContent = '', 3000);
  } catch (err) {
    alert('Error saving settings: ' + err.message);
  }
}

async function changePassword() {
  const current = document.getElementById('setting-current-pass').value;
  const newPass = document.getElementById('setting-new-pass').value;
  const msg = document.getElementById('password-msg');

  if (!current || !newPass) {
    msg.textContent = '⚠️ Fill both fields';
    msg.style.color = 'var(--error)';
    return;
  }
  if (newPass.length < 6) {
    msg.textContent = '⚠️ Min 6 characters';
    msg.style.color = 'var(--error)';
    return;
  }

  try {
    await API.put('/api/auth/password', { current_password: current, new_password: newPass });
    msg.textContent = '✅ Password changed! Please login again.';
    msg.style.color = 'var(--success)';
    document.getElementById('setting-current-pass').value = '';
    document.getElementById('setting-new-pass').value = '';
    setTimeout(() => renderLogin(), 2000);
  } catch (err) {
    msg.textContent = '❌ ' + err.message;
    msg.style.color = 'var(--error)';
  }
}

// ══════════════════════════════════════
// RESTORES
// ══════════════════════════════════════
async function renderRestores(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Restores</h1>
      <p>Restore history from backups</p>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Backup ID</th><th>Target</th><th>Status</th><th>Duration</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody id="restore-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const restores = await API.get('/api/restores') || [];
    const tbody = document.getElementById('restore-table-body');
    if (restores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No restore operations yet — restore a backup from the Backups page</p></div></td></tr>';
    } else {
      tbody.innerHTML = restores.map(r => {
        const statusClass = r.status === 'success' ? 'success' : r.status === 'failed' ? 'failed' : 'running';
        return `<tr class="status-${statusClass}">
          <td class="mono" title="${r.backup_id}">${(r.backup_id || '').slice(0,8)}</td>
          <td style="color:var(--text-secondary);">${r.target_connection ? r.target_connection.slice(0,8) : 'Original'}</td>
          <td><span class="status-pill ${statusPill(r.status)}">${r.status || '—'}</span></td>
          <td class="mono">${r.duration_ms ? (r.duration_ms/1000).toFixed(1)+'s' : '—'}</td>
          <td style="color:var(--text-tertiary);font-size:12px;">${r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
          <td>
            <button class="btn btn-sm" onclick="showRestoreLog('${r.id}')" title="View logs"><i data-lucide="file-text" size="13"></i></button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('restore-table-body').innerHTML = `<tr><td colspan="6" style="color:var(--error);padding:20px;">Error: ${escHtml(err.message)}</td></tr>`;
  }
  lucide.createIcons();
}

async function showRestoreLog(restoreId) {
  try {
    const data = await API.get(`/api/restores/${restoreId}`);
    showModal(`Restore Log: ${restoreId.slice(0,8)}`, `
      <p style="margin-bottom:8px;color:var(--text-secondary);font-size:13px;">
        Status: <strong>${data.status}</strong> &middot;
        Duration: <strong>${data.duration_ms ? (data.duration_ms/1000).toFixed(1)+'s' : '—'}</strong>
      </p>
      <pre class="log-viewer">${escHtml(data.log_output || data.log || 'No log output')}</pre>
    `);
  } catch (err) { alert('Error loading restore log: ' + err.message); }
}

// ══════════════════════════════════════
// ACTIVITY FEED
// ══════════════════════════════════════
async function renderActivity(el) {
  let currentFilter = 'all';

  function renderActivityContent(filter) {
    const container = document.getElementById('activity-main-content');
    if (!container) return;
    currentFilter = filter || currentFilter;

    container.innerHTML = '<div class="activity-loading"><div class="loading-spinner"></div><p>Loading activity...</p></div>';
    lucide.createIcons();

    Promise.all([
      API.get('/api/backups?limit=50'),
      API.get('/api/schedules'),
      API.get('/api/connections'),
      API.get('/api/restores').catch(() => []),
    ]).then(([backups, scheds, conns, restores]) => {
      const items = [];

      // Backup events
      (backups || []).forEach(b => {
        const status = b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'running';
        const dbLabel = b.database_label || b.database_id || 'Unknown';
        const dbType = b.db_type || '';
        const badge = dbType ? `<span class="badge badge-${getDbBadgeClass(dbType)}">${dbType.toUpperCase().slice(0,2)}</span>` : '';
        const sizeStr = b.size_bytes ? formatBytes(b.size_bytes) : '—';
        const durStr = b.duration_ms ? (b.duration_ms/1000).toFixed(1)+'s' : '';
        const timeStr = b.created_at ? timeAgo(b.created_at) : '';
        const icons = { success: '✓', failed: '✗', running: '🔄' };
        const labels = { success: 'Backup completed', failed: 'Backup failed', running: 'Backup running' };
        items.push({
          status, badge,
          title: `${icons[status] || ''} ${labels[status] || 'Backup'} — <strong>${escHtml(dbLabel)}</strong>`,
          meta: `${badge} ${sizeStr} ${durStr}`,
          detail: `Type: ${(b.backup_type || 'full').toUpperCase()} · Size: ${sizeStr} · Duration: ${durStr}`,
          time: timeStr,
          ts: b.created_at ? new Date(b.created_at).getTime() : 0,
          type: 'backup',
          subType: status,
        });
      });

      // Connect events
      (conns || []).slice(0, 5).forEach(c => {
        const ct = c.db_type || '';
        const badge = ct ? `<span class="badge badge-${getDbBadgeClass(ct)}">${ct.toUpperCase().slice(0,2)}</span>` : '';
        items.push({
          status: 'info',
          badge,
          title: `🔌 Connection added — <strong>${escHtml(c.name || c.host)}</strong>`,
          meta: `${badge} ${c.host || ''}${c.port ? ':' + c.port : ''}`,
          detail: escHtml(c.name || '') + ' — ' + (c.db_type || '').toUpperCase(),
          time: c.created_at ? timeAgo(c.created_at) : '',
          ts: c.created_at ? new Date(c.created_at).getTime() : 0,
          type: 'connection',
          subType: 'info',
        });
      });

      // Restore events
      (restores || []).forEach(r => {
        const status = r.status === 'success' ? 'success' : r.status === 'failed' ? 'failed' : 'running';
        const icons = { success: '✅', failed: '❌', running: '🔄' };
        items.push({
          status,
          title: `${icons[status] || ''} Restore ${status}`,
          meta: `Backup: ${(r.backup_id || '').slice(0,8)}`,
          detail: r.duration_ms ? `Duration: ${(r.duration_ms/1000).toFixed(1)}s` : '',
          time: r.created_at ? timeAgo(r.created_at) : '',
          ts: r.created_at ? new Date(r.created_at).getTime() : 0,
          type: 'restore',
          subType: status,
        });
      });

      // Sort by timestamp desc
      items.sort((a, b) => b.ts - a.ts);

      // Apply filter
      const filtered = currentFilter === 'all' ? items : items.filter(i => i.subType === currentFilter || i.type === currentFilter);

      if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state-v2"><div class="icon"><i data-lucide="activity" size="32"></i></div><p>No activity found</p><div class="sub">No matching activity for this filter</div></div>`;
        lucide.createIcons();
        return;
      }

      // Count stats
      const total = items.length;
      const successes = items.filter(i => i.subType === 'success').length;
      const failures = items.filter(i => i.subType === 'failed').length;
      const runningCount = items.filter(i => i.subType === 'running').length;

      // Update sidebar stats
      document.getElementById('as-total').textContent = total;
      document.getElementById('as-success').textContent = successes;
      document.getElementById('as-failed').textContent = failures;
      document.getElementById('as-running').textContent = runningCount;

      // Update recent items sidebar
      const recentItems = items.slice(0, 5).map(i => {
        const dotColor = i.subType === 'success' ? 'green' : i.subType === 'failed' ? 'red' : i.subType === 'running' ? 'blue' : 'amber';
        const text = i.title.replace(/<[^>]+>/g, '').substring(0, 40);
        return `<div class="ar-item"><span class="ar-dot ${dotColor}"></span><span class="ar-text">${escHtml(text)}</span><span class="ar-time">${i.time}</span></div>`;
      }).join('');
      document.getElementById('as-recent-list').innerHTML = recentItems;

      // Render timeline
      container.innerHTML = filtered.map(i => {
        const dotIcons = { success: '✓', failed: '✗', running: '🔄', info: '●' };
        return `
          <div class="activity-tl-item">
            <div class="activity-tl-dot ${i.subType === 'success' ? 'success' : i.subType === 'failed' ? 'failed' : i.subType === 'running' ? 'running' : 'info'}">${dotIcons[i.subType] || '●'}</div>
            <div class="activity-tl-content">
              <div class="activity-tl-title">${i.title}</div>
              <div class="activity-tl-meta">${i.meta || ''}${i.time ? '<span class="activity-tl-time">' + i.time + '</span>' : ''}</div>
              ${i.detail ? '<div class="activity-tl-detail">' + i.detail + '</div>' : ''}
            </div>
          </div>
        `;
      }).join('');
      lucide.createIcons();
    }).catch(err => {
      container.innerHTML = `<div class="empty-state-v2" style="color:var(--accent-red);"><p>Error loading activity: ${escHtml(err.message)}</p></div>`;
    });
  }

  el.innerHTML = `
    <div class="activity-page">
      <div class="activity-page-header">
        <h2><i data-lucide="activity" size="16" style="margin-right:6px;"></i> Activity Feed</h2>
        <div class="activity-filters">
          <button class="activity-filter-btn active" data-filter="all" onclick="applyActivityFilter('all', this)">All</button>
          <button class="activity-filter-btn" data-filter="success" onclick="applyActivityFilter('success', this)">Success</button>
          <button class="activity-filter-btn" data-filter="failed" onclick="applyActivityFilter('failed', this)">Failed</button>
          <button class="activity-filter-btn" data-filter="running" onclick="applyActivityFilter('running', this)">Running</button>
          <button class="activity-filter-btn" data-filter="backup" onclick="applyActivityFilter('backup', this)">Backups</button>
          <button class="activity-filter-btn" data-filter="restore" onclick="applyActivityFilter('restore', this)">Restores</button>
        </div>
      </div>

      <div class="activity-layout">
        <div class="activity-timeline" id="activity-main-content">
          <div class="activity-loading"><div class="loading-spinner"></div><p>Loading activity...</p></div>
        </div>

        <div class="activity-sidebar">
          <div class="activity-sidebar-card">
            <h5><i data-lucide="bar-chart-3" size="12"></i> Summary</h5>
            <div class="as-stat-row"><span class="as-stat-label">Total Events</span><span class="as-stat-value blue" id="as-total">—</span></div>
            <div class="as-stat-row"><span class="as-stat-label">Successful</span><span class="as-stat-value green" id="as-success">—</span></div>
            <div class="as-stat-row"><span class="as-stat-label">Failed</span><span class="as-stat-value red" id="as-failed">—</span></div>
            <div class="as-stat-row"><span class="as-stat-label">Running</span><span class="as-stat-value amber" id="as-running">—</span></div>
          </div>
          <div class="activity-sidebar-card">
            <h5><i data-lucide="clock" size="12"></i> Recent</h5>
            <div id="as-recent-list">
              <div style="font-size:12px;color:var(--text-tertiary);padding:8px 0;">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();

  // Expose filter function
  window.applyActivityFilter = function(filter, btn) {
    document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderActivityContent(filter);
  };

  // Load data
  renderActivityContent('all');
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

// ══════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════
async function renderNotifications(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Notification Targets</h1>
      <p>Configure Telegram, Discord, and Slack notification channels — then select them when running backups or creating schedules</p>
    </div>
    <div style="margin-bottom:var(--space-lg);">
      <button class="btn btn-primary" onclick="showAddNotifModal()">+ Add Channel</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody id="notif-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const notifs = await API.get('/api/notifications');
    const tbody = document.getElementById('notif-table-body');
    if (notifs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><p>No notification channels configured — add one first</p></div></td></tr>';
    } else {
      tbody.innerHTML = notifs.map(n => {
        const typeIcons = { telegram: 'send', discord: 'message-circle', slack: 'message-square' };
        const typeIcon = typeIcons[n.notif_type] || 'bell';
        return `<tr>
          <td><strong style="color:var(--text-primary);">${escHtml(n.name)}</strong></td>
          <td><div class="config-item-icon" style="width:28px;height:28px;font-size:10px;display:inline-flex;"><i data-lucide="${typeIcon}" size="14"></i></div> ${n.notif_type.charAt(0).toUpperCase() + n.notif_type.slice(1)}</td>
          <td>
            <button class="btn btn-sm" onclick="testNotif('${n.id}')" title="Test"><i data-lucide="zap" size="13"></i></button>
            <button class="btn btn-sm" onclick="showEditNotifModal('${n.id}')" title="Edit"><i data-lucide="pencil" size="13"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteNotif('${n.id}')" title="Delete"><i data-lucide="trash-2" size="13"></i></button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('notif-table-body').innerHTML = '<tr><td colspan="3" style="color:var(--error);padding:20px;">Error: ' + escHtml(err.message) + '</td></tr>';
  }
  lucide.createIcons();
}

function showAddNotifModal() {
  showModal('Add Notification Channel', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-notif-name" placeholder="Production Alerts">
    </div>
    <div class="form-group">
      <label class="form-label">Type</label>
      <select class="form-select" id="modal-notif-type" onchange="toggleNotifFields()">
        <option value="telegram">Telegram</option>
        <option value="discord">Discord</option>
        <option value="slack">Slack</option>
      </select>
    </div>
    <div id="notif-config-fields">
      <div class="form-group" id="notif-field-bot-token">
        <label class="form-label">Bot Token</label>
        <input class="form-input" id="modal-notif-bot-token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" type="password">
      </div>
      <div class="form-group" id="notif-field-chat-id">
        <label class="form-label">Chat ID</label>
        <input class="form-input" id="modal-notif-chat-id" placeholder="-1001234567890">
      </div>
      <div class="form-group" id="notif-field-webhook" style="display:none;">
        <label class="form-label">Webhook URL</label>
        <input class="form-input" id="modal-notif-webhook" placeholder="https://hooks.example.com/...">
      </div>
    </div>
    <p style="color:var(--text-secondary);font-size:13px;margin-top:8px;">Notification targets are selected per-backup or per-schedule</p>
  `, async () => {
    const name = document.getElementById('modal-notif-name').value;
    const type = document.getElementById('modal-notif-type').value;

    let configJson = {};
    if (type === 'telegram') {
      const botToken = document.getElementById('modal-notif-bot-token').value;
      const chatId = document.getElementById('modal-notif-chat-id').value;
      if (!botToken || !chatId) { alert('Bot Token and Chat ID are required for Telegram'); return false; }
      configJson = { bot_token: botToken, chat_id: chatId };
    } else {
      const webhook = document.getElementById('modal-notif-webhook').value;
      if (!webhook) { alert('Webhook URL is required'); return false; }
      configJson = { webhook_url: webhook };
    }

    if (!name) { alert('Name is required'); return false; }

    try {
      await API.post('/api/notifications', {
        name, notif_type: type, config_json: JSON.stringify(configJson)
      });
      renderNotifications(document.getElementById('page-content'));
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

function toggleNotifFields() {
  const type = document.getElementById('modal-notif-type').value;
  const tokenField = document.getElementById('notif-field-bot-token');
  const chatField = document.getElementById('notif-field-chat-id');
  const webhookField = document.getElementById('notif-field-webhook');

  if (type === 'telegram') {
    tokenField.style.display = '';
    chatField.style.display = '';
    webhookField.style.display = 'none';
  } else {
    tokenField.style.display = 'none';
    chatField.style.display = 'none';
    webhookField.style.display = '';
  }
}

async function testNotif(id) {
  const btn = event.target.closest('button');
  const original = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="loader" size="13" class="loading-spinner"></i>';
  btn.disabled = true;
  lucide.createIcons();

  try {
    await API.post('/api/notifications/' + id + '/test');
    alert('Test notification sent!');
  } catch (err) {
    alert('Test failed: ' + err.message);
  }

  btn.innerHTML = original;
  btn.disabled = false;
  lucide.createIcons();
}

async function showEditNotifModal(id) {
  let notif;
  try {
    notif = await API.get('/api/notifications/' + id);
  } catch (err) { alert('Error: ' + err.message); return; }

  let configObj = {};
  try { configObj = JSON.parse(notif.config_json); } catch(e) {}

  const botToken = configObj.bot_token || '';
  const chatId = configObj.chat_id || '';
  const webhook = configObj.webhook_url || '';

  showModal('Edit Notification Channel', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-notif-name" value="${escHtml(notif.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">Type</label>
      <select class="form-select" id="modal-notif-type" onchange="toggleNotifFields()" disabled>
        <option value="telegram" ${notif.notif_type === 'telegram' ? 'selected' : ''}>Telegram</option>
        <option value="discord" ${notif.notif_type === 'discord' ? 'selected' : ''}>Discord</option>
        <option value="slack" ${notif.notif_type === 'slack' ? 'selected' : ''}>Slack</option>
      </select>
    </div>
    <div id="notif-config-fields">
      <div class="form-group" id="notif-field-bot-token" style="${notif.notif_type === 'telegram' ? '' : 'display:none;'}">
        <label class="form-label">Bot Token</label>
        <input class="form-input" id="modal-notif-bot-token" value="${escHtml(botToken)}" type="password" placeholder="Keep existing">
      </div>
      <div class="form-group" id="notif-field-chat-id" style="${notif.notif_type === 'telegram' ? '' : 'display:none;'}">
        <label class="form-label">Chat ID</label>
        <input class="form-input" id="modal-notif-chat-id" value="${escHtml(chatId)}">
      </div>
      <div class="form-group" id="notif-field-webhook" style="${notif.notif_type !== 'telegram' ? '' : 'display:none;'}">
        <label class="form-label">Webhook URL</label>
        <input class="form-input" id="modal-notif-webhook" value="${escHtml(webhook)}" placeholder="Keep existing">
      </div>
    </div>
    <p style="color:var(--text-secondary);font-size:13px;margin-top:8px;">Notification targets are selected per-backup or per-schedule</p>
  `, async () => {
    const name = document.getElementById('modal-notif-name').value;
    const type = document.getElementById('modal-notif-type').value;

    let configJson = {};
    if (type === 'telegram') {
      const botToken = document.getElementById('modal-notif-bot-token').value || configObj.bot_token;
      const chatId = document.getElementById('modal-notif-chat-id').value || configObj.chat_id;
      configJson = { bot_token: botToken, chat_id: chatId };
    } else {
      const webhook = document.getElementById('modal-notif-webhook').value || configObj.webhook_url;
      configJson = { webhook_url: webhook };
    }

    if (!name) { alert('Name is required'); return false; }

    try {
      await API.put('/api/notifications/' + id, {
        name, notif_type: type, config_json: JSON.stringify(configJson)
      });
      renderNotifications(document.getElementById('page-content'));
    } catch (err) { alert('Error: ' + err.message); return false; }
  });
}

async function deleteNotif(id) {
  if (!confirm('Delete this notification channel?')) return;
  try {
    await API.del('/api/notifications/' + id);
    renderNotifications(document.getElementById('page-content'));
  } catch (err) { alert('Error: ' + err.message); }
}

// ══════════════════════════════════════════
// FEATURE: CRON Next Runs (computed in JS)
// ══════════════════════════════════════════
function cronNextRuns(expr, count) {
  if (!expr || typeof expr !== 'string') return [];
  count = count || 5;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const [sMin, sHour, sDom, sMonth, sDow] = parts;
  const results = [];
  const now = new Date();
  let cur = new Date(now);
  cur.setSeconds(0, 0);

  let found = 0;
  let maxIter = 2000;
  while (found < count && maxIter-- > 0) {
    // Increment
    cur.setMinutes(cur.getMinutes() + 1);
    if (cur.getFullYear() > 2099) break;

    const m = cur.getMinutes();
    const h = cur.getHours();
    const d = cur.getDate();
    const mo = cur.getMonth() + 1;
    const dw = cur.getDay();

    if (!cronFieldMatch(sMin, m)) continue;
    if (!cronFieldMatch(sHour, h)) continue;
    if (!cronFieldMatch(sDom, d)) continue;
    if (!cronFieldMatch(sMonth, mo)) continue;
    if (!cronFieldMatch(sDow, dw)) continue;

    found++;
    results.push({
      date: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: cur.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      fromNow: timeAgoFromNow(cur),
      isSoon: (cur - now < 3600000),
    });
  }
  return results;
}

function cronFieldMatch(pattern, value) {
  if (pattern === '*' || pattern === '?') return true;
  if (pattern.includes('/')) {
    const [_, step] = pattern.split('/');
    return value % parseInt(step) === 0;
  }
  if (pattern.includes(',')) {
    return pattern.split(',').some(p => cronFieldMatch(p.trim(), value));
  }
  if (pattern.includes('-')) {
    const [l, r] = pattern.split('-').map(Number);
    return value >= l && value <= r;
  }
  return parseInt(pattern) === value;
}

function timeAgoFromNow(date) {
  const diff = date - new Date();
  if (diff < 0) return 'now';
  if (diff < 60000) return 'in <1m';
  if (diff < 3600000) return 'in ' + Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return 'in ' + Math.floor(diff / 3600000) + 'h';
  return 'in ' + Math.floor(diff / 86400000) + 'd';
}

// ══════════════════════════════════════════
// FEATURE: Backup Progress Tracker
// ══════════════════════════════════════════
let backupProgressInterval = null;

function startBackupPolling() {
  stopBackupPolling();
  backupProgressInterval = setInterval(pollRunningBackups, 5000);
  pollRunningBackups();
}

function stopBackupPolling() {
  if (backupProgressInterval) {
    clearInterval(backupProgressInterval);
    backupProgressInterval = null;
  }
}

async function pollRunningBackups() {
  try {
    const backups = await API.get('/api/backups?limit=50');
    const running = backups.filter(b => b.status === 'running');

    // Update any visible progress cards
    const progressEl = document.getElementById('backup-progress-card');
    if (!progressEl) return;

    if (running.length === 0) {
      progressEl.classList.remove('visible');
      return;
    }

    progressEl.classList.add('visible');
    const bp = running[0];
    const dbLabel = bp.database_label || bp.database_id || 'Unknown';

    // Simulate progress based on duration — not perfect but gives feedback
    const elapsed = bp.duration_ms || 0;
    // Scale: most backups complete in 30-120s, assume ~120s = 90%
    const simulated = Math.min(Math.round((elapsed / 120000) * 90), 90);
    const bar = document.getElementById('bp-bar');
    const statusEl = document.getElementById('bp-status-text');
    const sizeEl = document.getElementById('bp-size');
    const durEl = document.getElementById('bp-dur');

    if (bar) bar.style.width = Math.max(simulated, 5) + '%';
    if (statusEl) statusEl.textContent = 'Running...';
    if (sizeEl) sizeEl.textContent = bp.size_bytes ? formatBytes(bp.size_bytes) : '—';
    if (durEl) durEl.textContent = elapsed ? (elapsed/1000).toFixed(1)+'s' : '0s';
    document.getElementById('bp-db-name').textContent = escHtml(dbLabel);
  } catch (e) {
    // Silently retry
  }
}

// ══════════════════════════════════════════
// FEATURE: Verify Detail Modal
// ══════════════════════════════════════════
async function showVerifyDetails(backupId) {
  try {
    const data = await API.get(`/api/backups/${backupId}`);
    const vStatus = data.verify_status || 'pending';
    const vTime = data.verified_at ? new Date(data.verified_at).toLocaleString() : '—';
    const vSize = data.size_bytes ? formatBytes(data.size_bytes) : '—';
    const vChecksum = data.checksum || data.md5 || '—';
    const vLog = data.verify_log || 'No verification details';

    const statusIcons = { passed: '✅', failed: '❌', verifying: '⏳', pending: '⏸️' };
    const statusColors = { passed: 'green', failed: 'red', verifying: 'amber', pending: '' };

    showModal('Backup Verification', `
      <div style="margin-bottom:var(--space-lg);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--space-lg);">
          <div style="font-size:32px;">${statusIcons[vStatus] || '⏸️'}</div>
          <div>
            <div style="font-size:16px;font-weight:600;color:var(--text-primary);text-transform:capitalize;">${vStatus}</div>
            <div style="font-size:12px;color:var(--text-tertiary);">Backup ${backupId.slice(0,8)}</div>
          </div>
        </div>
        <table class="restore-review-table" style="width:100%;">
          <tr><td>Status</td><td class="${statusColors[vStatus]}">${vStatus}</td></tr>
          <tr><td>Verified At</td><td>${vTime}</td></tr>
          <tr><td>Size</td><td>${vSize}</td></tr>
          <tr><td>Checksum</td><td class="mono" style="font-size:10px;word-break:break-all;">${vChecksum}</td></tr>
        </table>
      </div>
      <div style="border-top:1px solid var(--border-default);padding-top:var(--space-lg);">
        <label class="form-label">Verification Log</label>
        <pre class="log-viewer" style="max-height:200px;font-size:11px;">${escHtml(vLog)}</pre>
      </div>
    `);
  } catch (err) {
    alert('Error loading verification details: ' + err.message);
  }
}

async function triggerVerify(backupId) {
  try {
    const res = await API.post(`/api/backups/${backupId}/verify`);
    alert('✅ Verification started!');
    // Re-render current page
    const page = location.hash.slice(1) || 'dashboard';
    if (page === 'backups') {
      renderBackups(document.getElementById('page-content'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
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
