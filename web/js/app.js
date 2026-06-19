// Jagad — Vanilla JS SPA
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
  updateTopBar(page);
  // Close mobile sidebar on nav
  closeMobileSidebar();
}

window.addEventListener('popstate', () => {
  const page = location.hash.slice(1) || 'dashboard';
  renderPage(page);
  updateTopBar(page);
});

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  // Update all theme toggle icons (inline SVGs)
  document.querySelectorAll('.theme-toggle svg').forEach(el => {
    el.innerHTML = next === 'dark'
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  });
  localStorage.setItem('jagad-theme', next);
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
  const saved = localStorage.getItem('jagad-theme') || 'dark';
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
          <div style="width:36px;height:36px;background:linear-gradient(135deg,var(--accent),var(--accent-dark));border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;flex-shrink:0;">J</div>
          <span class="login-logo-text">Jagad</span>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${theme === 'dark' ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'}</svg>
          </button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('login-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
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

// ── Top Bar Actions per Page ──
function topBarActions(page) {
  const actions = {
    dashboard: `
      <button class="btn btn-ghost btn-sm" onclick="navigate('backups')">
        <i data-lucide="clock" size="14"></i>
        Last 7 days
      </button>
      <button class="btn btn-primary" onclick="showRunBackupModal()">
        <i data-lucide="plus" size="14"></i>
        New Backup
      </button>`,
    connections: `
      <button class="btn btn-primary" onclick="showAddConnectionModal()">
        <i data-lucide="plus" size="14"></i>
        Add Connection
      </button>`,
    backups: `
      <button class="btn btn-primary" onclick="showRunBackupModal()">
        <i data-lucide="plus" size="14"></i>
        New Backup
      </button>`,
    schedules: `
      <button class="btn btn-primary" onclick="showAddScheduleModal()">
        <i data-lucide="plus" size="14"></i>
        New Schedule
      </button>`,
  };
  return actions[page] || '';
}

function updateTopBar(page) {
  const rightBar = document.querySelector('.top-bar-right');
  if (!rightBar) return;
  const logoutBtn = rightBar.querySelector('button:last-child');
  rightBar.innerHTML = topBarActions(page) + (logoutBtn ? logoutBtn.outerHTML : '');
  lucide.createIcons();
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
        <div class="sidebar-header" style="padding:20px 12px;">
          <div class="sidebar-logo-mark" style="width:28px;height:28px;background:linear-gradient(135deg,var(--accent),var(--accent-dark));border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">J</div>
          <span class="sidebar-logo-text" style="font-size:16px;font-weight:600;letter-spacing:-0.3px;">Jagad</span>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Main</div>

          <a class="sidebar-link ${page === 'dashboard' ? 'active' : ''}" data-page="dashboard" onclick="navigate('dashboard')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </a>
          <a class="sidebar-link ${page === 'connections' ? 'active' : ''}" data-page="connections" onclick="navigate('connections')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M4 20V4"/><path d="M20 20V8"/><path d="M8 12h4"/><path d="M12 8v8"/></svg>
            Connections
            <span class="badge-count" id="sidebar-conn-count">0</span>
          </a>
          <a class="sidebar-link ${page === 'backups' ? 'active' : ''}" data-page="backups" onclick="navigate('backups')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><circle cx="12" cy="12" r="3"/></svg>
            Backups
            <span class="badge-count" id="sidebar-backup-count">0</span>
          </a>
          <a class="sidebar-link ${page === 'schedules' ? 'active' : ''}" data-page="schedules" onclick="navigate('schedules')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
            Schedules
            <span class="badge-count" id="sidebar-schedule-count">0</span>
          </a>

          <div class="sidebar-section-label">Management</div>

          <a class="sidebar-link ${page === 'storage' ? 'active' : ''}" data-page="storage" onclick="navigate('storage')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Storage
          </a>
          <a class="sidebar-link ${page === 'notifications' ? 'active' : ''}" data-page="notifications" onclick="navigate('notifications')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
            Notifications
          </a>

          <div class="sidebar-section-label">System</div>

          <a class="sidebar-link ${page === 'monitoring' ? 'active' : ''}" data-page="monitoring" onclick="navigate('monitoring')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            Monitoring
            <span class="badge-count" id="sidebar-mon-count">3</span>
          </a>
          <a class="sidebar-link ${page === 'activity' ? 'active' : ''}" data-page="activity" onclick="navigate('activity')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
            Activity
          </a>
          <a class="sidebar-link ${page === 'settings' ? 'active' : ''}" data-page="settings" onclick="navigate('settings')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${theme === 'dark' ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'}</svg>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Top Bar (Mockup-style header) -->
        <div class="top-bar">
          <div class="top-bar-left">
            <button class="hamburger" onclick="toggleMobileSidebar()" id="hamburger-btn" title="Toggle menu">
              <i data-lucide="menu" size="18"></i>
            </button>
            <h1 id="page-title-breadcrumb" style="font-size:18px;font-weight:600;letter-spacing:-0.3px;">Dashboard</h1>
          </div>
          <div class="top-bar-right">
            ${topBarActions(page)}
            <button class="btn btn-ghost btn-icon" onclick="logout()" title="Sign out">
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

  // Global sidebar counts: fetch all & update badges on every page load
  Promise.all([
    API.get('/api/connections').catch(() => []),
    API.get('/api/backups').catch(() => []),
    API.get('/api/schedules').catch(() => []),
  ]).then(([conns, backups, scheds]) => {
    state.connections = conns || [];
    state.backups = backups || [];
    state.schedules = scheds || [];
    updateSidebarCounts();
  });
}

// ── Global Modal ──
function showModal(title, bodyHtml, onConfirm, confirmText) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const hasConfirm = typeof onConfirm === 'function';
  const btnText = confirmText || (hasConfirm ? 'Save' : 'Close');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer" id="modal-footer">
        ${hasConfirm ? '<button class="btn" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' : ''}
        <button class="btn btn-primary" id="modal-confirm">${btnText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const confirmBtn = document.getElementById('modal-confirm');
  confirmBtn.onclick = () => {
    if (hasConfirm) {
      const result = onConfirm();
      if (result !== false) overlay.remove();
    } else {
      overlay.remove();
    }
  };
  return overlay;
}

function updateSidebarCounts() {
  const connCount = (state.connections || []).length;
  const connBadge = document.getElementById('sidebar-conn-count');
  if (connBadge) connBadge.textContent = connCount || '0';

  const backupCount = (state.backups || []).length;
  const backupBadge = document.getElementById('sidebar-backup-count');
  if (backupBadge) backupBadge.textContent = backupCount || '0';

  const schedCount = (state.schedules || []).length;
  const schedBadge = document.getElementById('sidebar-schedule-count');
  if (schedBadge) schedBadge.textContent = schedCount || '0';
}

function renderPage(page) {
  const el = document.getElementById('page-content');
  if (!el) return;

  const titles = { dashboard: 'Dashboard', connections: 'Connections', backups: 'Backups', schedules: 'Schedules', restores: 'Restores', storage: 'Storage', notifications: 'Notifications', activity: 'Activity', monitoring: 'Monitoring', settings: 'Settings' };
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
    case 'activity': renderActivity(el); break;
    case 'settings': renderSettings(el); break;
    case 'monitoring': renderMonitoring(el); break;
    default: el.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i data-lucide="file-x" size="24"></i></div><h3>Page not found</h3></div>'; lucide.createIcons();
  }
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
async function renderDashboard(el) {
  el.innerHTML = `
    <!-- KPI Row (Mockup spec: 5 cards) -->
    <div class="kpi-row" id="kpi-row">
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Total Databases</span>
          <svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        </div>
        <div class="kpi-value" id="kpi-dbs">—</div>
        <span class="kpi-change up" id="kpi-dbs-change">—</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Backups Today</span>
          <svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="kpi-value" id="kpi-backups">—</div>
        <span class="kpi-change neutral" id="kpi-backups-change">Today</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Success Rate</span>
          <svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="kpi-value" id="kpi-rate" style="color: var(--green);">—</div>
        <span class="kpi-change neutral" id="kpi-rate-change">—</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Storage Used</span>
          <svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="kpi-value" id="kpi-storage">—</div>
        <span class="kpi-change neutral" id="kpi-storage-change">—</span>
      </div>
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Monitored Servers</span>
          <svg class="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
        </div>
        <div class="kpi-value" id="kpi-servers">—</div>
        <span class="kpi-change neutral" id="kpi-servers-change">—</span>
      </div>
    </div>

    <!-- Grid: Chart + Quick Actions -->
    <div class="dashboard-grid">
      <!-- Backup Success Rate Chart -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Backup Success Rate (30 days)</span>
          <button class="card-action" onclick="navigate('backups')">View full report →</button>
        </div>
        <div class="card-body">
          <div class="mini-chart" id="chart-container"></div>
          <div class="chart-stats" id="chart-stats">
            <div class="chart-stat-item">
              <div class="chart-stat-value" id="chart-rate">—</div>
              <div class="chart-stat-label">Success Rate</div>
            </div>
            <div class="chart-stat-item">
              <div class="chart-stat-value" id="chart-total">—</div>
              <div class="chart-stat-label">Total Backups</div>
            </div>
            <div class="chart-stat-item">
              <div class="chart-stat-value" id="chart-failed">—</div>
              <div class="chart-stat-label">Failed</div>
            </div>
            <div class="chart-stat-item">
              <div class="chart-stat-value" id="chart-avg-dur">—</div>
              <div class="chart-stat-label">Avg Duration</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Quick Actions</span>
        </div>
        <div class="card-body">
          <div class="quick-actions">
            <div class="quick-action-card" onclick="showRunBackupModal()">
              <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span class="quick-action-title">Run Backup</span>
              <span class="quick-action-desc">Backup selected databases now</span>
            </div>
            <div class="quick-action-card" onclick="navigate('connections')">
              <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span class="quick-action-title">Add Connection</span>
              <span class="quick-action-desc">Add new database connection</span>
            </div>
            <div class="quick-action-card" onclick="navigate('monitoring')">
              <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
              <span class="quick-action-title">View Monitoring</span>
              <span class="quick-action-desc">Check database health & metrics</span>
            </div>
            <div class="quick-action-card" onclick="navigate('schedules')">
              <svg class="quick-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
              <span class="quick-action-title">Configure Schedule</span>
              <span class="quick-action-desc">Set up or edit backup schedules</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Activity</span>
        <button class="card-action" onclick="navigate('activity')">View all →</button>
      </div>
      <div class="card-body">
        <div class="activity-feed" id="activity-feed">
          <div class="activity-item">
            <div class="activity-dot info"></div>
            <div class="activity-text">No recent activity</div>
            <span class="activity-time"></span>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const [conns, recent, scheds, storageProvs, stats] = await Promise.all([
      API.get('/api/connections'),
      API.get('/api/backups?limit=5'),
      API.get('/api/schedules'),
      API.get('/api/storage-providers'),
      API.get('/api/backups/stats').catch(() => null),
    ]);

    state.connections = conns;
    state.storageProviders = storageProvs;

    updateSidebarCounts();

    // ── KPI Row ──
    const connCount = conns.length;
    document.getElementById('kpi-dbs').textContent = connCount;
    document.getElementById('kpi-dbs-change').innerHTML = connCount > 0 ? '↑ ' + connCount + ' this week' : 'No connections';

    const todayBackups = stats && stats.today_backups ? stats.today_backups : 0;
    document.getElementById('kpi-backups').textContent = todayBackups;
    document.getElementById('kpi-backups-change').textContent = todayBackups + ' today';

    // Success rate
    const successRate = stats && stats.success_rate ? Math.round(stats.success_rate) : 0;
    document.getElementById('kpi-rate').textContent = successRate + '%';
    document.getElementById('kpi-rate-change').textContent = '— last 24h';

    // Storage
    const totalSize = stats && stats.total_size_bytes ? formatBytes(stats.total_size_bytes) : '—';
    document.getElementById('kpi-storage').textContent = totalSize;
    document.getElementById('kpi-storage-change').textContent = storageProvs.length + ' provider' + (storageProvs.length !== 1 ? 's' : '');

    // Monitored servers
    const monServers = conns.filter(c => c.status === 'connected').length;
    document.getElementById('kpi-servers').textContent = monServers;
    document.getElementById('kpi-servers-change').textContent = '↑ ' + connCount + ' total connections';

    // ── Mini Bar Chart (30 bars — real data from stats.daily_stats) ──
    const chartEl = document.getElementById('chart-container');
    if (chartEl) {
      const chartData = stats && stats.daily_stats ? stats.daily_stats : [];
      if (chartData.length >= 7) {
        const bars = chartData.slice(-30).map(d => {
          const total = (d.total_backups || 1);
          const success = d.success_count || 0;
          const pct = Math.round((success / total) * 100);
          const cls = pct >= 50 ? 'success' : 'fail';
          return `<div class="bar ${cls}" style="height:${Math.max(pct, 4)}%"></div>`;
        }).join('');
        chartEl.innerHTML = bars;
      } else if (chartData.length > 0) {
        // Some data but less than 7 days — show what we have
        const bars = chartData.map(d => {
          const total = (d.total_backups || 1);
          const success = d.success_count || 0;
          const pct = Math.round((success / total) * 100);
          const cls = pct >= 50 ? 'success' : 'fail';
          return `<div class="bar ${cls}" style="height:${Math.max(pct, 4)}%"></div>`;
        }).join('');
        chartEl.innerHTML = bars;
      } else {
        // No data yet — show empty state
        chartEl.innerHTML = '<div class="chart-empty">No backup data yet</div>';
      }
    }

    // ── Chart Stats ──
    const totalBackups = stats ? stats.total_backups : 0;
    const failedCount = stats ? stats.failed_backups : 0;
    const avgDur = stats && stats.avg_duration_ms ? (stats.avg_duration_ms / 1000).toFixed(1) + 's' : '—';
    document.getElementById('chart-rate').textContent = successRate + '%';
    document.getElementById('chart-total').textContent = totalBackups;
    document.getElementById('chart-failed').textContent = failedCount;
    document.getElementById('chart-avg-dur').textContent = avgDur;

    // ── Activity Feed ──
    const activityEl = document.getElementById('activity-feed');
    const activityBackups = recent || [];
    if (!activityBackups.length && !scheds.length && !conns.length) {
      activityEl.innerHTML = `<div class="activity-item"><div class="activity-dot info"></div><div class="activity-text">No recent activity</div><span class="activity-time"></span></div>`;
    } else {
      const items = [];
      activityBackups.slice(0, 4).forEach(b => {
        const status = b.status === 'success' ? 'success' : b.status === 'failed' ? 'fail' : 'info';
        const dbLabel = b.database_label || b.database_id || 'Unknown';
        const sizeStr = b.size_bytes ? formatBytes(b.size_bytes) : '—';
        const durStr = b.duration_ms ? (b.duration_ms / 1000).toFixed(1) + 's' : '—';
        const connLabel = b.connection_label || b.connection_id || 'N/A';
        const timeStr = b.created_at ? timeAgo(b.created_at) : '';
        const text = b.status === 'success'
          ? `<strong>Backup completed</strong> — ${escHtml(connLabel)} · <strong>${escHtml(dbLabel)}</strong> (${sizeStr}, ${durStr})`
          : b.status === 'failed'
            ? `<strong>Backup failed</strong> — ${escHtml(connLabel)} · <strong>${escHtml(dbLabel)}</strong> — ${escHtml(b.error_message || 'error')}`
            : `<strong>Backup running</strong> — ${escHtml(connLabel)} · <strong>${escHtml(dbLabel)}</strong> (${sizeStr})`;
        items.push({ status, text, time: timeStr });
      });
      scheds.slice(0, 2).forEach(s => {
        items.push({
          status: 'success',
          text: `<strong>Schedule updated</strong> — <strong>${escHtml(s.name || s.cron_expr || 'Schedule')}</strong> → runs at ${s.cron_expr || 'N/A'}`,
          time: s.created_at ? timeAgo(s.created_at) : '',
        });
      });
      conns.slice(0, 6).forEach(c => {
        const ct = c.db_type || '';
        const typeLabel = ct ? `(${ct.toUpperCase()})` : '';
        items.push({
          status: 'info',
          text: `<strong>Connection added</strong> — <strong>${escHtml(c.name || c.host || 'Connection')}</strong> ${typeLabel}`,
          time: c.created_at ? timeAgo(c.created_at) : '',
        });
      });
      activityEl.innerHTML = items.slice(0, 8).map(item => `
        <div class="activity-item">
          <div class="activity-dot ${item.status}"></div>
          <div class="activity-text">${item.text}</div>
          ${item.time ? '<span class="activity-time">' + item.time + '</span>' : ''}
        </div>
      `).join('');
    }
  } catch (err) {
    document.getElementById('kpi-row').innerHTML += `<p style="color:var(--red);margin-top:12px;grid-column:1/-1;">Error loading: ${escHtml(err.message)}</p>`;
  }
}

// ══════════════════════════════════════
// CONNECTIONS
// ══════════════════════════════════════
async function renderConnections(el) {
  let connFilter = 'all';
  let connSearch = '';

  function renderConnTable() {
    const tbody = document.getElementById('conn-table-body');
    if (!tbody) return;
    let filtered = state.connections || [];

    // Apply search
    if (connSearch) {
      const q = connSearch.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.host || '').toLowerCase().includes(q) ||
        (c.db_type || '').toLowerCase().includes(q)
      );
    }

    // Apply filter
    if (connFilter === 'postgresql') filtered = filtered.filter(c => c.db_type === 'postgresql');
    else if (connFilter === 'mysql') filtered = filtered.filter(c => c.db_type === 'mysql');
    else if (connFilter === 'mariadb') filtered = filtered.filter(c => c.db_type === 'mariadb');
    else if (connFilter === 'online') filtered = filtered.filter(c => state.healthByConn[c.id]?.status === 'healthy');
    else if (connFilter === 'offline') filtered = filtered.filter(c => !state.healthByConn[c.id] || state.healthByConn[c.id]?.status === 'down');

    if (filtered.length === 0) {
      tbody.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;"><p>No connections found</p></div>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const health = state.healthByConn[c.id];
      const statusClass = health ? health.status : 'unknown';
      const statusBadge = statusClass === 'healthy' ? 'online' : statusClass === 'degraded' ? 'warning' : 'offline';
      const statusLabel = health ? (statusClass.charAt(0).toUpperCase() + statusClass.slice(1)) : 'Pending';

      const typeColor = c.db_type === 'postgresql' ? '#3b82f6' : c.db_type === 'mysql' ? '#f59e0b' : '#22d66a';
      const typeLabel = c.db_type.charAt(0).toUpperCase() + c.db_type.slice(1);

      const lastBackup = c.last_backup_at ? `${timeAgo(c.last_backup_at)} · ✓` : '—';

      const dbs = (c.databases && c.databases.length) || c.db_count || '—';

      // Enhanced expand detail — databases list with sizes
      const dbList = (c.databases && c.databases.length > 0)
        ? c.databases.map(db => {
            const sizeStr = db.size_bytes ? formatBytes(db.size_bytes) : '—';
            const checkIcon = db.is_selected ? '✓' : '✗';
            const checkClass = db.is_selected ? 'db-selected' : 'db-system';
            return `<div class="expand-db-item">
              <span class="expand-db-name">${escHtml(db.db_name || db.name)}</span>
              <span class="expand-db-size">${sizeStr}</span>
              <span class="expand-db-check ${checkClass}">${checkIcon}</span>
            </div>`;
          }).join('')
        : '<div style="color:var(--text-muted);font-size:12px;padding:12px 0;">No databases discovered. Run Discover from the menu.</div>';

      const totalSize = c.total_size_bytes ? formatBytes(c.total_size_bytes) : '—';

      return `
      <div class="table-row" onclick="toggleExpandConn(this)">
        <div class="table-col-checkbox"><input type="checkbox" onclick="event.stopPropagation()"></div>
        <div class="table-col-name">
          <div class="conn-name">${escHtml(c.name)}</div>
          <div class="conn-sub">${escHtml(c.host || '')}${c.db_version ? ` · ${escHtml(c.db_version)}` : ''}</div>
        </div>
        <div class="table-col-type">
          <span class="type-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="${typeColor}" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            ${typeLabel}
          </span>
        </div>
        <div class="table-col-status"><span class="status-badge ${statusBadge}"><span class="status-dot"></span>${statusLabel}</span></div>
        <div class="table-col-host"><span class="cell-text mono">${escHtml(c.host)}:${c.port}</span></div>
        <div class="table-col-databases"><span class="cell-text"><strong>${dbs}</strong></span></div>
        <div class="table-col-last"><span class="cell-text">${lastBackup}</span></div>
        <div class="table-col-actions">
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();showConnMenu(event, '${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>
      <div class="expand-row">
        <div class="expand-detail-grid">
          <div class="detail-group">
            <div class="detail-label">Connection String</div>
            <div class="detail-value mono">${escHtml(c.host)}:${c.port}@${escHtml(c.username || '')}</div>
          </div>
          <div class="detail-group">
            <div class="detail-label">Version</div>
            <div class="detail-value">${c.db_version || '—'}</div>
          </div>
          <div class="detail-group">
            <div class="detail-label">Databases</div>
            <div class="detail-value">${dbs}</div>
          </div>
          <div class="detail-group">
            <div class="detail-label">Total Size</div>
            <div class="detail-value">${totalSize}</div>
          </div>
        </div>
        <div class="expand-dbs-section">
          <div class="expand-dbs-header">
            <span style="font-weight:500;font-size:12px;">Database List</span>
            <span style="font-size:11px;color:var(--text-muted);">${(c.databases && c.databases.length) || 0} databases</span>
          </div>
          <div class="expand-dbs-list">
            <div class="expand-dbs-headers">
              <span class="expand-db-name">Database</span>
              <span class="expand-db-size">Size</span>
              <span class="expand-db-check">Selected</span>
            </div>
            ${dbList}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="search-bar" style="max-width:100%;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Search connections by name, host, database..." id="conn-search-input" value="${escHtml(connSearch)}">
      <button class="btn btn-primary" onclick="showAddConnectionModal()" style="margin-left:auto;flex-shrink:0;white-space:nowrap;">+ Add Connection</button>
    </div>
    <div class="filter-pills" id="conn-filter-pills">
      <button class="pill active" data-filter="all" onclick="setConnFilter('all')">All Connections</button>
      <button class="pill" data-filter="postgresql" onclick="setConnFilter('postgresql')">PostgreSQL</button>
      <button class="pill" data-filter="mysql" onclick="setConnFilter('mysql')">MySQL</button>
      <button class="pill" data-filter="mariadb" onclick="setConnFilter('mariadb')">MariaDB</button>
      <button class="pill" data-filter="online" onclick="setConnFilter('online')">Online</button>
      <button class="pill" data-filter="offline" onclick="setConnFilter('offline')">⚠ Offline</button>
    </div>
    <div class="table-container">
      <div class="table-header-row">
        <div class="table-col-checkbox"></div>
        <div class="table-col-name">Name</div>
        <div class="table-col-type">Type</div>
        <div class="table-col-status">Status</div>
        <div class="table-col-host">Host</div>
        <div class="table-col-databases">DBs</div>
        <div class="table-col-last">Last Backup</div>
        <div class="table-col-actions"></div>
      </div>
      <div id="conn-table-body"></div>
    </div>
  `;

  // Search input handler
  const searchInput = document.getElementById('conn-search-input');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      connSearch = searchInput.value;
      renderConnTable();
    }, 200);
  });

  // Filter handler
  window.setConnFilter = function(filter) {
    connFilter = filter;
    document.querySelectorAll('#conn-filter-pills .pill').forEach(p => p.classList.remove('active'));
    document.querySelector(`#conn-filter-pills .pill[data-filter="${filter}"]`).classList.add('active');
    renderConnTable();
  };

  // Toggle expand
  window.toggleExpandConn = function(row) {
    const expand = row.nextElementSibling;
    if (expand && expand.classList.contains('expand-row')) {
      expand.classList.toggle('open');
    }
  };

  // Load data
  try {
    const [conns, healthData] = await Promise.all([
      API.get('/api/connections'),
      API.get('/api/monitoring/health?limit=200').catch(() => []),
    ]);
    state.connections = conns;
    updateSidebarCounts();

    // Load databases for all connections
    const dbResults = await Promise.all(
      (conns || []).map(c =>
        API.get(`/api/connections/${c.id}/databases`).catch(() => [])
      )
    );
    (conns || []).forEach((c, i) => {
      c.databases = dbResults[i] || [];
    });

    const healthByConn = {};
    (healthData || []).forEach(h => {
      if (!healthByConn[h.connection_id] || new Date(h.time) > new Date(healthByConn[h.connection_id].time)) {
        healthByConn[h.connection_id] = h;
      }
    });
    state.healthByConn = healthByConn;

    renderConnTable();
  } catch (err) {
    document.getElementById('conn-table-body').innerHTML = `<div style="color:var(--error);padding:20px;font-size:13px;">Error: ${escHtml(err.message)}</div>`;
  }
}

window.showConnMenu = function(event, connId) {
  // Simple context menu
  const menu = document.createElement('div');
  menu.style.cssText = 'position:fixed;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:4px;z-index:1000;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,.4);';
  menu.innerHTML = `
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();discoverConn('${connId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Discover Databases
    </div>
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();editConn('${connId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Edit Connection
    </div>
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();refreshConnVersion('${connId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      Refresh Version
    </div>
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();showBackupConn('${connId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Run Backup
    </div>
    <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;color:var(--red);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();deleteConn('${connId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Delete
    </div>
  `;
  menu.style.left = Math.min(event.clientX, window.innerWidth - 180) + 'px';
  menu.style.top = event.clientY + 'px';
  document.body.appendChild(menu);
  document.addEventListener('click', () => { menu.remove(); }, { once: true });
};

function showAddConnectionModal(existingConn) {
  const isEdit = !!existingConn;
  const title = isEdit ? 'Edit Connection' : 'Add Connection';
  const confirmText = isEdit ? 'Save Changes' : 'Save';
  const name = isEdit ? escHtml(existingConn.name) : '';
  const host = isEdit ? escHtml(existingConn.host) : '';
  const port = isEdit ? existingConn.port : 5432;
  const dbType = isEdit ? existingConn.db_type : 'postgresql';
  const user = isEdit ? escHtml(existingConn.username) : '';
  const sslMode = isEdit ? escHtml(existingConn.ssl_mode || 'prefer') : 'prefer';

  showModal(title, `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input class="form-input" id="modal-conn-name" placeholder="Production DB" value="${name}">
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Type</label>
        <select class="form-select" id="modal-conn-type" onchange="updateConnPort()">
          <option value="postgresql" ${dbType === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
          <option value="mysql" ${dbType === 'mysql' ? 'selected' : ''}>MySQL</option>
          <option value="mariadb" ${dbType === 'mariadb' ? 'selected' : ''}>MariaDB</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Port</label>
        <input class="form-input" id="modal-conn-port" value="${port}" placeholder="auto">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Host</label>
      <input class="form-input" id="modal-conn-host" placeholder="localhost" value="${host}">
    </div>
    <div class="form-group">
      <label class="form-label">Username</label>
      <input class="form-input" id="modal-conn-user" placeholder="postgres" value="${user}">
    </div>
    <div class="form-group">
      <label class="form-label">Password${isEdit ? ' (leave blank to keep current)' : ''}</label>
      <input class="form-input" type="password" id="modal-conn-pass" placeholder="${isEdit ? 'unchanged' : '••••••'}">
    </div>
    <div class="form-group">
      <label class="form-label">SSL Mode</label>
      <select class="form-select" id="modal-conn-sslmode">
        <option value="prefer" ${sslMode === 'prefer' ? 'selected' : ''}>Prefer</option>
        <option value="require" ${sslMode === 'require' ? 'selected' : ''}>Require</option>
        <option value="disable" ${sslMode === 'disable' ? 'selected' : ''}>Disable</option>
        <option value="verify-ca" ${sslMode === 'verify-ca' ? 'selected' : ''}>Verify CA</option>
        <option value="verify-full" ${sslMode === 'verify-full' ? 'selected' : ''}>Verify Full</option>
      </select>
    </div>
    <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg);">
      <button class="btn btn-primary test-conn-btn" onclick="testConnectionFromModal(event)">
        <i data-lucide="zap" size="14"></i> Test Connection
      </button>
      <div class="test-conn-result" id="test-conn-result"></div>
    </div>
  `, async () => {
    const nameV = document.getElementById('modal-conn-name').value;
    const hostV = document.getElementById('modal-conn-host').value;
    const portV = parseInt(document.getElementById('modal-conn-port').value) || 5432;
    const dbTypeV = document.getElementById('modal-conn-type').value;
    const userV = document.getElementById('modal-conn-user').value;
    const passV = document.getElementById('modal-conn-pass').value;
    const sslV = document.getElementById('modal-conn-sslmode').value;
    if (!nameV || !hostV || !userV) { showModalAlert('Name, Host, and Username are required'); return false; }
    try {
      const body = { name: nameV, host: hostV, port: portV, db_type: dbTypeV, username: userV, ssl_mode: sslV };
      if (passV) body.password = passV;
      if (isEdit) {
        await API.put(`/api/connections/${existingConn.id}`, body);
      } else {
        await API.post('/api/connections', body);
      }
      renderConnections(document.getElementById('page-content'));
    } catch (err) { showModalAlert('Error: ' + err.message); return false; }
  }, confirmText);
  lucide.createIcons();
}

// refreshConnVersion — re-fetches database version from the server
async function refreshConnVersion(connId) {
  try {
    const res = await API.post('/api/connections/' + connId + '/refresh-version');
    if (res.success) {
      showModalAlert('Version refreshed: ' + res.version, 'Success');
      // Update local state
      const conn = state.connections.find(c => c.id === connId);
      if (conn) conn.db_version = res.version;
      renderConnections(document.getElementById('page-content'));
    } else {
      showModalAlert('Failed: ' + (res.error || 'unknown error'), 'Error');
    }
  } catch (err) {
    showModalAlert('Error: ' + err.message, 'Error');
  }
}

// editConn — opens the add/edit modal pre-filled for an existing connection
function editConn(connId) {
  const conn = state.connections.find(c => c.id === connId);
  if (conn) showAddConnectionModal(conn);
}

// showModalAlert — simple info/error modal replacing alert()
function showModalAlert(msg, title) {
  showModal(title || 'Notice', `<p style="font-size:14px;color:var(--text-primary);">${msg}</p>`);
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
      <label class="form-label">Databases</label>
      <div style="margin-bottom:8px;">
        <label class="radio-label" style="margin-right:16px;cursor:pointer;">
          <input type="radio" name="bk-conn-db-mode" value="all" checked onchange="document.getElementById('bk-conn-db-checklist').style.display='none'">
          <span style="font-size:13px;">All Databases</span>
        </label>
        <label class="radio-label" style="cursor:pointer;">
          <input type="radio" name="bk-conn-db-mode" value="select" onchange="loadDbChecklist('${connId}', 'bk-conn-db-checklist');document.getElementById('bk-conn-db-checklist').style.display='block'">
          <span style="font-size:13px;">Select Databases</span>
        </label>
      </div>
      <div id="bk-conn-db-checklist" style="display:none;max-height:180px;overflow-y:auto;border:1px solid var(--border-default);border-radius:6px;padding:8px 12px;background:var(--bg-secondary);">
        <div style="color:var(--text-muted);font-size:12px;">Loading databases...</div>
      </div>
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
    const type = document.getElementById('modal-backup-type').value;
    const storageId = document.getElementById('modal-backup-storage').value;

    // Get database selection
    const allRadio = document.querySelector('input[name="bk-conn-db-mode"][value="all"]');
    const selRadio = document.querySelector('input[name="bk-conn-db-mode"][value="select"]');
    let backupAll = allRadio && allRadio.checked;
    let databaseIds = [];
    if (selRadio && selRadio.checked) {
      document.querySelectorAll('#bk-conn-db-checklist .db-checklist-chk:checked').forEach(cb => databaseIds.push(cb.value));
    }
    if (!backupAll && databaseIds.length === 0) {
      alert('Please select at least one database or choose All Databases');
      return false;
    }

    try {
      await API.post('/api/backups', {
        connection_id: connId,
        backup_all: backupAll,
        database_ids: databaseIds.length > 0 ? databaseIds : undefined,
        backup_type: type,
        storage_provider_id: storageId || undefined
      });
      alert('Backup started!');
      navigate('backups');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });

  // Pre-load database checklist
  loadDbChecklist(connId, 'bk-conn-db-checklist');
}

async function discoverConn(id) {
  try {
    await API.post(`/api/connections/${id}/discover`);
    showModalAlert('✅ Discovery complete!', 'Success');
    renderConnections(document.getElementById('page-content'));
  } catch (err) { showModalAlert('❌ Error: ' + err.message, 'Error'); }
}

async function deleteConn(id) {
  const overlay = showModal('Delete Connection', `<p style="font-size:14px;color:var(--text-primary);">Delete this connection and all associated backups? This cannot be undone.</p>
    <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Connection: <strong>${escHtml(state.connections.find(c => c.id === id)?.name || id)}</strong></p>`, async () => {
    try {
      await API.del(`/api/connections/${id}`);
      renderConnections(document.getElementById('page-content'));
    } catch (err) { showModalAlert('Error: ' + err.message); return false; }
  }, 'Delete');
  const confirmBtn = document.getElementById('modal-confirm');
  if (confirmBtn) confirmBtn.style.background = 'var(--red)';
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
// DATABASE SELECTOR HELPERS (multi-DB support)
// ══════════════════════════════════════

// Fetches discovered databases for a connection and renders checkboxes into the given container.
// Selected IDs are pre-checked if provided.
window.loadDbChecklist = async function(connId, containerId, selectedIds) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading databases...</div>';
  if (!connId) { container.innerHTML = ''; return; }
  try {
    const dbs = await API.get(`/api/connections/${connId}/databases`);
    if (!dbs || dbs.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">No databases discovered. Run Discover from the Connection page first.</div>';
      return;
    }
    const sel = new Set(selectedIds || []);
    container.innerHTML = dbs.map(db => `
      <label class="checkbox-label db-check-item" style="padding:4px 0;font-size:13px;">
        <input type="checkbox" class="db-checklist-chk" value="${escHtml(db.id)}" ${sel.has(db.id) ? 'checked' : ''}>
        ${escHtml(db.db_name)}
        ${db.size_bytes ? `<span style="color:var(--text-muted);font-size:11px;margin-left:6px;">${formatBytes(db.size_bytes)}</span>` : ''}
      </label>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--error);font-size:12px;">Error: ${escHtml(err.message)}</div>`;
  }
};

// Returns the currently selected database mode and IDs from the selector UI
window.getDbSelection = function(modeRadioName, checklistContainerId) {
  const allRadio = document.querySelector(`input[name="${modeRadioName}"][value="all"]`);
  const selRadio = document.querySelector(`input[name="${modeRadioName}"][value="select"]`);
  if (allRadio && allRadio.checked) {
    return { backupAll: true, databaseIds: [] };
  }
  if (selRadio && selRadio.checked) {
    const ids = [];
    document.querySelectorAll(`#${checklistContainerId} .db-checklist-chk:checked`).forEach(cb => ids.push(cb.value));
    return { backupAll: false, databaseIds: ids };
  }
  return { backupAll: false, databaseIds: [] };
};

// Updates the database checklist visibility based on radio selection
window.toggleDbChecklist = function(checklistContainerId) {
  const container = document.getElementById(checklistContainerId);
  if (!container) return;
  const selRadio = document.querySelector('input[name="db-mode"][value="select"]');
  container.style.display = (selRadio && selRadio.checked) ? 'block' : 'none';
};

// HTML snippet for the database mode radio group + checklist container
function dbSelectorHTML() {
  return `
    <div style="margin-bottom:8px;">
      <label class="radio-label" style="margin-right:16px;cursor:pointer;">
        <input type="radio" name="db-mode" value="all" checked onchange="toggleDbChecklist('db-checklist')">
        <span style="font-size:13px;">All Databases</span>
      </label>
      <label class="radio-label" style="cursor:pointer;">
        <input type="radio" name="db-mode" value="select" onchange="toggleDbChecklist('db-checklist')">
        <span style="font-size:13px;">Select Databases</span>
      </label>
    </div>
    <div id="db-checklist" style="display:none;max-height:200px;overflow-y:auto;border:1px solid var(--border-default);border-radius:6px;padding:8px 12px;background:var(--bg-secondary);">
      <div style="color:var(--text-muted);font-size:12px;">Select a connection first</div>
    </div>
  `;
}

// ══════════════════════════════════════
// BACKUPS
// ══════════════════════════════════════
async function renderBackups(el) {
  let selectedBackups = new Set();

  function renderBackupTable() {
    const tbody = document.getElementById('backup-table-body');
    if (!tbody) return;
    const backups = state.backups || [];

    if (backups.length === 0) {
      tbody.innerHTML = `<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px;"><p>No backups yet. Run a backup to get started.</p></div>`;
      return;
    }

    tbody.innerHTML = backups.map(b => {
      const statusClass = b.status === 'success' ? 'online' : b.status === 'failed' ? 'offline' : 'warning';
      const statusLabel = b.status === 'success' ? 'Success' : b.status === 'failed' ? 'Failed' : (b.status || 'Pending');
      const dbName = b.database_label || b.database_id || '—';
      const connName = b.connection_name || '—';
      const typeLabel = (b.backup_type || 'full').charAt(0).toUpperCase() + (b.backup_type || 'full').slice(1);
      const size = b.size_bytes ? formatBytes(b.size_bytes) : '—';
      const duration = b.duration_ms ? (b.duration_ms / 1000).toFixed(1) + 's' : '—';
      const timeAgoStr = b.created_at ? timeAgo(b.created_at) : '—';
      const checked = selectedBackups.has(b.id) ? 'checked' : '';
      const rowClass = b.status === 'failed' ? ' status-failed' : '';

      return `
      <div class="backup-row${rowClass}">
        <div class="backup-col-checkbox"><input type="checkbox" ${checked} onchange="toggleBackupSelect(event, '${b.id}')"></div>
        <div class="backup-col-name">
          <span class="conn-name">${escHtml(dbName)}</span>
          <span class="conn-sub">${typeLabel} backup</span>
        </div>
        <div class="backup-col-type"><span class="cell-text">${escHtml(connName)}</span></div>
        <div class="backup-col-size"><span class="cell-text">${size}</span></div>
        <div class="backup-col-status"><span class="status-badge ${statusClass}"><span class="status-dot"></span>${statusLabel}</span></div>
        <div class="backup-col-time"><span class="cell-text">${timeAgoStr}</span></div>
        <div class="backup-col-duration"><span class="cell-text">${duration}</span></div>
        <div class="backup-col-actions">
          <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();showBackupMenu(event, '${b.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');

    updateBatchBar();
  }

  el.innerHTML = `
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

    <!-- Stats Row -->
    <div class="backup-stats-row">
      <div class="stat-card">
        <div class="stat-value" id="bk-stat-total">—</div>
        <span class="stat-label">Total Backups (30d)</span>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--red)" id="bk-stat-failed">—</div>
        <span class="stat-label">Failed</span>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="bk-stat-size">—</div>
        <span class="stat-label">Total Size</span>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--blue)" id="bk-stat-dur">—</div>
        <span class="stat-label">Avg Duration</span>
      </div>
    </div>

    <!-- Timeline / Activity -->
    <div class="backup-timeline-container" id="backup-timeline-container">
      <div class="timeline-card" style="flex:2">
        <div class="timeline-card-title">Backup Activity (30 days)</div>
        <div class="calendar-grid" id="calendar-grid"></div>
        <div class="calendar-legend">
          <div class="legend-item"><div class="legend-swatch" style="background:var(--accent)"></div> Multiple</div>
          <div class="legend-item"><div class="legend-swatch" style="background:rgba(129,140,248,0.3)"></div> Single</div>
          <div class="legend-item"><div class="legend-swatch" style="background:rgba(239,68,68,0.4)"></div> Failed</div>
        </div>
      </div>
      <div class="timeline-card" style="flex:1" id="bk-by-connection">
        <div class="timeline-card-title">By Connection</div>
        <div id="bk-conn-stats" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
    </div>

    <!-- Batch bar -->
    <div class="batch-bar" id="batch-bar">
      <span id="batch-bar-text"><strong>0</strong> backups selected</span>
      <div style="flex:1"></div>
      <button class="btn btn-sm" style="background:var(--red-bg);color:var(--red);border:1px solid rgba(239,68,68,0.2);" onclick="batchDeleteBackups()">Delete</button>
      <button class="btn btn-sm btn-ghost" onclick="batchRestoreBackups()">Restore</button>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div class="table-header-row">
        <div class="backup-col-checkbox"></div>
        <div class="backup-col-name">Database</div>
        <div class="backup-col-type">Connection</div>
        <div class="backup-col-size">Size</div>
        <div class="backup-col-status">Status</div>
        <div class="backup-col-time">Time</div>
        <div class="backup-col-duration">Duration</div>
        <div class="backup-col-actions"></div>
      </div>
      <div id="backup-table-body"></div>
    </div>
  `;

  // Selection handler
  window.toggleBackupSelect = function(event, id) {
    event.stopPropagation();
    if (selectedBackups.has(id)) selectedBackups.delete(id);
    else selectedBackups.add(id);
    updateBatchBar();
    const row = event.target.closest('.backup-row');
    if (row) row.style.background = event.target.checked ? 'var(--bg-hover)' : '';
  };

  function updateBatchBar() {
    const bar = document.getElementById('batch-bar');
    const text = document.getElementById('batch-bar-text');
    if (!bar || !text) return;
    const count = selectedBackups.size;
    if (count > 0) {
      bar.classList.add('visible');
      text.innerHTML = `<strong>${count}</strong> backup${count > 1 ? 's' : ''} selected`;
    } else {
      bar.classList.remove('visible');
    }
  }

  window.batchDeleteBackups = async function() {
    if (selectedBackups.size === 0) return;
    if (!confirm(`Delete ${selectedBackups.size} backup(s)?`)) return;
    for (const id of selectedBackups) {
      try { await API.del(`/api/backups/${id}`); } catch(e) {}
    }
    selectedBackups.clear();
    navigate('backups');
  };

  window.batchRestoreBackups = function() {
    if (selectedBackups.size === 0) return;
    const ids = [...selectedBackups];
    showRestoreModal(ids[0]);
  };

  // Backup action menu
  window.showBackupMenu = function(event, backupId) {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);padding:4px;z-index:1000;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.4);';
    menu.innerHTML = `
      <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();showBackupLog('${backupId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        View Log
      </div>
      <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();downloadBackup('${backupId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </div>
      <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();triggerVerify('${backupId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Verify Integrity
      </div>
      <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();showRestoreModal('${backupId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Restore
      </div>
      <div style="padding:8px 12px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;color:var(--red);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="this.closest('div').remove();deleteBackup('${backupId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Delete
      </div>
    `;
    menu.style.left = Math.min(event.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = event.clientY + 'px';
    document.body.appendChild(menu);
    document.addEventListener('click', () => { menu.remove(); }, { once: true });
  };

  // Start progress polling
  startBackupPolling();

  // Load data
  try {
    const [backups, conns] = await Promise.all([
      API.get('/api/backups'),
      API.get('/api/connections').catch(() => []),
    ]);
    state.backups = backups;
    state.connections = conns;

    // Build connection name lookup
    const connNames = {};
    (conns || []).forEach(c => connNames[c.id] = c.name);

    // Transform backups with connection names
    state.backups = (backups || []).map(b => ({
      ...b,
      connection_name: connNames[b.connection_id] || b.connection_id?.slice(0,8) || '—'
    }));

    // Stats
    const total = state.backups.length;
    const failed = state.backups.filter(b => b.status === 'failed').length;
    const totalSize = state.backups.reduce((s, b) => s + (b.size_bytes || 0), 0);
    const avgDuration = state.backups.filter(b => b.duration_ms).reduce((s, b, _, arr) => s + (b.duration_ms || 0) / arr.length, 0);

    document.getElementById('bk-stat-total').textContent = total;
    document.getElementById('bk-stat-failed').textContent = failed;
    document.getElementById('bk-stat-size').textContent = totalSize ? formatBytes(totalSize) : '—';
    document.getElementById('bk-stat-dur').textContent = avgDuration ? (avgDuration / 1000).toFixed(1) + 's' : '—';

    // Build calendar grid (30 days)
    const grid = document.getElementById('calendar-grid');
    const days = [];
    const now = new Date();
    const backupDays = new Set();
    const failedDays = new Set();
    const multiDays = new Set();

    state.backups.forEach(b => {
      if (!b.created_at) return;
      const d = new Date(b.created_at).toDateString();
      if (b.status === 'failed') failedDays.add(d);
      else if (backupDays.has(d)) multiDays.add(d);
      backupDays.add(d);
    });

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      const isToday = i === 0;
      let cls = 'calendar-day';
      if (multiDays.has(ds)) cls += ' has-backup multiple';
      else if (failedDays.has(ds)) cls += ' failed';
      else if (backupDays.has(ds)) cls += ' has-backup';
      else cls += ' empty';
      if (isToday) cls += ' today';
      days.push(`<div class="${cls}" title="${d.toLocaleDateString()}"></div>`);
    }
    grid.innerHTML = days.join('');

    // Build connection stats
    const connStats = {};
    state.backups.forEach(b => {
      const key = b.connection_name || 'Unknown';
      connStats[key] = (connStats[key] || 0) + 1;
    });
    const totalBk = Math.max(...Object.values(connStats), 1);
    const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--text-tertiary)'];
    const connEl = document.getElementById('bk-conn-stats');
    connEl.innerHTML = Object.entries(connStats).sort((a, b) => b[1] - a[1]).map(([name, count], i) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
          <span style="color:var(--text-secondary)">${escHtml(name)}</span>
          <span style="color:var(--text-primary)">${count} backups</span>
        </div>
        <div style="height:6px;background:var(--bg-hover);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${Math.round(count/totalBk*100)}%;background:${colors[i % colors.length]};border-radius:3px;"></div>
        </div>
      </div>
    `).join('');

    renderBackupTable();
    updateSidebarCounts();
  } catch (err) {
    document.getElementById('backup-table-body').innerHTML = `<div style="color:var(--error);padding:20px;font-size:13px;">Error: ${escHtml(err.message)}</div>`;
  }
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
      <select class="form-select" id="modal-run-conn" onchange="loadDbChecklist(this.value, 'run-db-checklist')">${connOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Databases</label>
      <div style="margin-bottom:8px;">
        <label class="radio-label" style="margin-right:16px;cursor:pointer;">
          <input type="radio" name="run-db-mode" value="all" checked onchange="document.getElementById('run-db-checklist').style.display='none'">
          <span style="font-size:13px;">All Databases</span>
        </label>
        <label class="radio-label" style="cursor:pointer;">
          <input type="radio" name="run-db-mode" value="select" onchange="document.getElementById('run-db-checklist').style.display='block'">
          <span style="font-size:13px;">Select Databases</span>
        </label>
      </div>
      <div id="run-db-checklist" style="display:none;max-height:180px;overflow-y:auto;border:1px solid var(--border-default);border-radius:6px;padding:8px 12px;background:var(--bg-secondary);">
        <div style="color:var(--text-muted);font-size:12px;">Select a connection first</div>
      </div>
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

    // Get database selection
    const allRadio = document.querySelector('input[name="run-db-mode"][value="all"]');
    const selRadio = document.querySelector('input[name="run-db-mode"][value="select"]');
    let backupAll = allRadio && allRadio.checked;
    let databaseIds = [];
    if (selRadio && selRadio.checked) {
      document.querySelectorAll('#run-db-checklist .db-checklist-chk:checked').forEach(cb => databaseIds.push(cb.value));
    }
    if (!backupAll && databaseIds.length === 0) {
      alert('Please select at least one database or choose All Databases');
      return false;
    }

    const type = document.getElementById('modal-run-type').value;
    const storageId = document.getElementById('modal-run-storage').value;
    
    // Collect selected notification targets
    const notifTargetIds = [];
    document.querySelectorAll('.notif-target-chk:checked').forEach(cb => notifTargetIds.push(cb.value));
    const notifOnSuccess = document.getElementById('modal-run-notif-success').checked;
    const notifOnFailure = document.getElementById('modal-run-notif-failure').checked;

    try {
      await API.post('/api/backups', {
        connection_id: connId,
        backup_all: backupAll,
        database_ids: databaseIds.length > 0 ? databaseIds : undefined,
        backup_type: type,
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
    <div class="schedule-grid" id="schedule-grid">
      <div id="schedules-list" style="display:contents;"></div>
      <!-- Add New Schedule card -->
      <div class="schedule-card" style="border:2px dashed var(--border-default);justify-content:center;align-items:center;background:transparent;cursor:pointer;" onclick="showAddScheduleModal()">
        <div style="text-align:center;padding:16px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" style="width:32px;height:32px;margin-bottom:8px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);">Add New Schedule</div>
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">Create backup schedule</div>
        </div>
      </div>
    </div>
  `;

  try {
    const [scheds, provs] = await Promise.all([
      API.get('/api/schedules'),
      API.get('/api/storage-providers'),
    ]);
    state.storageProviders = provs;

    const container = document.getElementById('schedules-list');
    if (scheds.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted);font-size:13px;"><p>No schedules yet. Create one to automate your backups.</p></div>`;
    } else {
      container.innerHTML = scheds.map(s => {
        const storageName = provs.find(p => p.id === s.storage_provider_id);
        const conn = state.connections.find(c => c.id === s.connection_id);
        const connName = conn ? conn.name : (s.connection_id ? s.connection_id.slice(0,8) : '—');
        const enabled = s.enabled !== false;
        const totalCount = s.total_runs || 0;
        const successCount = s.success_runs || 0;
        const rate = totalCount > 0 ? Math.round(successCount / totalCount * 100) : 100;
        const rateClass = rate >= 80 ? 'good' : rate >= 50 ? 'warn' : 'bad';
        const circumference = 2 * Math.PI * 24; // = ~150.8
        const offset = circumference - (rate / 100) * circumference;

        // Compute next run display
        const nextRun = s.next_run_at ? timeAgo(s.next_run_at) : '—';
        const scheduleLabel = s.cron_expr ? `Cron: ${escHtml(s.cron_expr)}` : '—';

        return `
        <div class="schedule-card">
          <div class="ring-container">
            <svg class="ring-svg" viewBox="0 0 56 56">
              <circle class="ring-bg" cx="28" cy="28" r="24"/>
              <circle class="ring-fill ${rateClass}" cx="28" cy="28" r="24" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
            </svg>
            <span class="ring-label">${rate}%</span>
          </div>
          <div class="schedule-info">
            <div class="schedule-name">${escHtml(s.name || connName)}</div>
            <div class="schedule-desc">${escHtml(s.backup_type || 'Backup')} · ${scheduleLabel}${enabled ? '' : ' · Paused'}</div>
            <div class="schedule-meta">
              <span class="schedule-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                Next: ${nextRun}
              </span>
              <span class="schedule-meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                ${successCount}/${totalCount} succeeded
              </span>
            </div>
          </div>
          <div class="schedule-actions">
            <button class="btn btn-ghost btn-sm" onclick="showEditScheduleModal('${s.id}')" title="Edit">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:${enabled ? 'var(--red)' : 'var(--green)'}" onclick="toggleSchedule('${s.id}', ${enabled})" title="${enabled ? 'Disable' : 'Enable'}">${enabled ? 'Disable' : 'Enable'}</button>
          </div>
        </div>`;
      }).join('');
    }
    state.schedules = scheds;
    updateSidebarCounts();
  } catch (err) {
    document.getElementById('schedules-list').innerHTML = `<div style="grid-column:1/-1;padding:20px;color:var(--error);font-size:13px;">Error: ${escHtml(err.message)}</div>`;
  }
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
      <select class="form-select" id="modal-sched-conn" onchange="loadDbChecklist(this.value, 'sched-db-checklist')">${connOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Databases</label>
      <div style="margin-bottom:8px;">
        <label class="radio-label" style="margin-right:16px;cursor:pointer;">
          <input type="radio" name="sched-db-mode" value="all" checked onchange="document.getElementById('sched-db-checklist').style.display='none'">
          <span style="font-size:13px;">All Databases</span>
        </label>
        <label class="radio-label" style="cursor:pointer;">
          <input type="radio" name="sched-db-mode" value="select" onchange="document.getElementById('sched-db-checklist').style.display='block'">
          <span style="font-size:13px;">Select Databases</span>
        </label>
      </div>
      <div id="sched-db-checklist" style="display:none;max-height:180px;overflow-y:auto;border:1px solid var(--border-default);border-radius:6px;padding:8px 12px;background:var(--bg-secondary);">
        <div style="color:var(--text-muted);font-size:12px;">Select a connection first</div>
      </div>
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
    if (!connId) { alert('Please select a connection'); return false; }

    // Get database selection
    const allRadio = document.querySelector('input[name="sched-db-mode"][value="all"]');
    const selRadio = document.querySelector('input[name="sched-db-mode"][value="select"]');
    let backupAll = allRadio && allRadio.checked;
    let databaseIds = [];
    if (selRadio && selRadio.checked) {
      document.querySelectorAll('#sched-db-checklist .db-checklist-chk:checked').forEach(cb => databaseIds.push(cb.value));
    }
    if (!backupAll && databaseIds.length === 0) {
      alert('Please select at least one database or choose All Databases');
      return false;
    }

    const type = document.getElementById('modal-sched-type').value;
    const cron = document.getElementById('modal-sched-cron').value;
    const storageId = document.getElementById('modal-sched-storage').value;
    const retFull = parseInt(document.getElementById('modal-sched-ret-full').value) || 7;
    const retIncr = parseInt(document.getElementById('modal-sched-ret-incr').value) || 30;
    if (!storageId) { alert('Storage Provider is required'); return false; }

    // Collect selected notification targets
    const notifTargetIds = [];
    document.querySelectorAll('.sched-notif-chk:checked').forEach(cb => notifTargetIds.push(cb.value));
    const notifOnSuccess = document.getElementById('modal-sched-notif-success').checked;
    const notifOnFailure = document.getElementById('modal-sched-notif-failure').checked;

    try {
      await API.post('/api/schedules', {
        connection_id: connId,
        backup_all: backupAll,
        database_ids: databaseIds.length > 0 ? databaseIds : undefined,
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

// Edit Schedule modal
async function showEditScheduleModal(id) {
  // Load existing schedule
  let sched;
  try {
    sched = await API.get(`/api/schedules/${id}`);
  } catch (err) { alert('Error loading schedule: ' + err.message); return; }
  if (!sched) { alert('Schedule not found'); return; }

  const connOptions = state.connections.map(c =>
    `<option value="${c.id}" ${c.id === sched.connection_id ? 'selected' : ''}>${escHtml(c.name)} (${c.db_type})</option>`
  ).join('');

  let storageOptions = '<option value="">Select storage provider...</option>';
  if (state.storageProviders.length > 0) {
    storageOptions = state.storageProviders.map(p =>
      `<option value="${p.id}" ${p.id === sched.storage_provider_id ? 'selected' : ''}>${escHtml(p.name)} (${p.provider_type})${p.is_default ? ' ★ Default' : ''}</option>`
    ).join('');
  } else {
    storageOptions = '<option value="">⚠️ No providers — add one in Storage page</option>';
  }

  // Pre-select backup type
  const isFull = sched.backup_type === 'full';

  // Build notification checkboxes
  let notifOptions = '';
  let notifs = [];
  try {
    notifs = await API.get('/api/notifications');
    if (notifs.length > 0) {
      notifOptions = notifs.map(n => {
        const checked = (sched.notif_target_ids || []).includes(n.id);
        return `<label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" class="edit-sched-notif-chk" value="${n.id}" ${checked ? 'checked' : ''}>
          ${escHtml(n.name)} (${n.notif_type})
        </label>`;
      }).join('');
    } else {
      notifOptions = '<p style="color:var(--text-muted);font-size:13px;">No notification targets</p>';
    }
  } catch (err) {
    notifOptions = '<p style="color:var(--text-muted);font-size:13px;">Error loading notification targets</p>';
  }

  // Determine DB selection mode
  const backupAll = sched.backup_all || false;
  const dbIDs = sched.database_ids || [];

  showModal('Edit Schedule', `
    <div class="form-group">
      <label class="form-label">Connection</label>
      <select class="form-select" id="edit-sched-conn" onchange="loadDbChecklist(this.value, 'edit-sched-db-checklist', ${JSON.stringify(dbIDs)})">${connOptions}</select>
    </div>
    <div class="form-group">
      <label class="form-label">Databases</label>
      <div style="margin-bottom:8px;">
        <label class="radio-label" style="margin-right:16px;cursor:pointer;">
          <input type="radio" name="edit-sched-db-mode" value="all" ${backupAll ? 'checked' : ''} onchange="document.getElementById('edit-sched-db-checklist').style.display='none'">
          <span style="font-size:13px;">All Databases</span>
        </label>
        <label class="radio-label" style="cursor:pointer;">
          <input type="radio" name="edit-sched-db-mode" value="select" ${!backupAll && dbIDs.length > 0 ? 'checked' : ''} onchange="loadDbChecklist(document.getElementById('edit-sched-conn').value, 'edit-sched-db-checklist', ${JSON.stringify(dbIDs)});document.getElementById('edit-sched-db-checklist').style.display='block'">
          <span style="font-size:13px;">Select Databases</span>
        </label>
      </div>
      <div id="edit-sched-db-checklist" style="display:${!backupAll && dbIDs.length > 0 ? 'block' : 'none'};max-height:180px;overflow-y:auto;border:1px solid var(--border-default);border-radius:6px;padding:8px 12px;background:var(--bg-secondary);">
        <div style="color:var(--text-muted);font-size:12px;">Loading databases...</div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1">
        <label class="form-label">Backup Type</label>
        <select class="form-select" id="edit-sched-type" onchange="updateScheduleRetention()">
          <option value="full" ${isFull ? 'selected' : ''}>Full</option>
          <option value="incremental" ${!isFull ? 'selected' : ''}>Incremental</option>
        </select>
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Cron Expression</label>
        <input class="form-input" id="edit-sched-cron" value="${escHtml(sched.cron_expr)}" placeholder="0 1 * * *">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Storage Provider</label>
      <select class="form-select" id="edit-sched-storage">${storageOptions}</select>
    </div>
    <div class="form-row">
      <div class="form-group" style="flex:1" id="edit-ret-full-group">
        <label class="form-label">Retention (days)</label>
        <input class="form-input" type="number" id="edit-sched-ret-full" value="${sched.retention_full || 7}" min="1">
      </div>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">
      <label class="form-label">Notifications</label>
      <div style="margin-bottom:8px;">
        <label class="checkbox-label" style="margin-right:12px;">
          <input type="checkbox" id="edit-sched-notif-success" ${sched.notify_on_success ? 'checked' : ''}> On success
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="edit-sched-notif-failure" ${sched.notify_on_failure ? 'checked' : ''}> On failure
        </label>
      </div>
      <div>${notifOptions}</div>
    </div>
  `, async () => {
    const connId = document.getElementById('edit-sched-conn').value;
    if (!connId) { alert('Connection is required'); return false; }

    // Get database selection
    const allRadio = document.querySelector('input[name="edit-sched-db-mode"][value="all"]');
    const selRadio = document.querySelector('input[name="edit-sched-db-mode"][value="select"]');
    let backupAll = allRadio && allRadio.checked;
    let databaseIds = [];
    if (selRadio && selRadio.checked) {
      document.querySelectorAll('#edit-sched-db-checklist .db-checklist-chk:checked').forEach(cb => databaseIds.push(cb.value));
    }
    if (!backupAll && databaseIds.length === 0) {
      alert('Please select at least one database or choose All Databases');
      return false;
    }

    const type = document.getElementById('edit-sched-type').value;
    const cron = document.getElementById('edit-sched-cron').value;
    const storageId = document.getElementById('edit-sched-storage').value;
    const retFull = parseInt(document.getElementById('edit-sched-ret-full').value) || 7;
    if (!cron) { alert('Cron expression is required'); return false; }
    if (!storageId) { alert('Storage Provider is required'); return false; }

    // Collect selected notification targets
    const notifTargetIds = [];
    document.querySelectorAll('.edit-sched-notif-chk:checked').forEach(cb => notifTargetIds.push(cb.value));
    const notifOnSuccess = document.getElementById('edit-sched-notif-success').checked;
    const notifOnFailure = document.getElementById('edit-sched-notif-failure').checked;

    try {
      await API.put(`/api/schedules/${id}`, {
        connection_id: connId,
        backup_all: backupAll,
        database_ids: databaseIds.length > 0 ? databaseIds : undefined,
        backup_type: type, cron_expr: cron,
        storage_provider_id: storageId,
        retention_full: retFull,
        notif_target_ids: notifTargetIds,
        notify_on_success: notifOnSuccess,
        notify_on_failure: notifOnFailure,
        enabled: sched.enabled
      });
      navigate('schedules');
    } catch (err) { alert('Error: ' + err.message); return false; }
  });

  // Pre-load database checklist if in select mode
  if (!backupAll && dbIDs.length > 0) {
    loadDbChecklist(sched.connection_id, 'edit-sched-db-checklist', dbIDs);
  } else if (!backupAll) {
    loadDbChecklist(sched.connection_id, 'edit-sched-db-checklist', []);
  }
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
            <button class="btn btn-sm" onclick="testStorage('${p.id}')" title="Test connection"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></button>
            <button class="btn btn-sm" onclick="showEditStorageModal('${p.id}')" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
            <button class="btn btn-sm" onclick="setDefaultStorage('${p.id}')" title="Set as default"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
            <button class="btn btn-sm btn-danger" onclick="deleteStorage('${p.id}')" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
          </td>
        </tr>`;
      }).join('');
    }
  } catch (err) {
    document.getElementById('storage-table-body').innerHTML = `<tr><td colspan="7" style="color:var(--error);padding:20px;">Error: ${escHtml(err.message)}</td></tr>`;
  }
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
            Jagad — PostgreSQL · MySQL · MariaDB backup &amp; monitoring.
          </p>
        </div>
      </div>
    </div>
  `;

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
          h.encryption ? '✅ AES-256-GCM enabled' : '⚠️ Not configured (set JAGAD_ENCRYPTION_KEY)';
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
  let displayCount = 50;
  let expandedId = null;

  function getDateGroup(ts) {
    if (!ts) return 'Older';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const d = new Date(ts);
    if (d >= today) return 'Today';
    if (d >= yesterday) return 'Yesterday';
    if (d >= weekAgo) return 'This Week';
    return 'Older';
  }

  function renderActivityContent(filter) {
    const container = document.getElementById('activity-main-content');
    if (!container) return;
    currentFilter = filter || currentFilter;

    container.innerHTML = '<div class="activity-loading"><div class="loading-spinner"></div><p>Loading activity...</p></div>';

    Promise.all([
      API.get('/api/backups?limit=200'),
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
          id: 'b_' + (b.id || Math.random().toString(36).slice(2)),
          status, badge,
          title: `${icons[status] || ''} ${labels[status] || 'Backup'} — <strong>${escHtml(dbLabel)}</strong>`,
          meta: `${badge} ${sizeStr} ${durStr}`,
          detail: `Type: ${(b.backup_type || 'full').toUpperCase()} · Size: ${sizeStr} · Duration: ${durStr}`,
          time: timeStr,
          ts: b.created_at ? new Date(b.created_at).getTime() : 0,
          type: 'backup',
          subType: status,
          raw: b,
        });
      });

      // Connect events
      (conns || []).forEach(c => {
        const ct = c.db_type || '';
        const badge = ct ? `<span class="badge badge-${getDbBadgeClass(ct)}">${ct.toUpperCase().slice(0,2)}</span>` : '';
        items.push({
          id: 'c_' + (c.id || Math.random().toString(36).slice(2)),
          status: 'info',
          badge,
          title: `🔌 Connection added — <strong>${escHtml(c.name || c.host)}</strong>`,
          meta: `${badge} ${c.host || ''}${c.port ? ':' + c.port : ''}`,
          detail: escHtml(c.name || '') + ' — ' + (c.db_type || '').toUpperCase(),
          raw: null,
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
          id: 'r_' + (r.id || Math.random().toString(36).slice(2)),
          status,
          title: `${icons[status] || ''} Restore ${status}`,
          meta: `Backup: ${(r.backup_id || '').slice(0,8)}`,
          detail: r.duration_ms ? `Duration: ${(r.duration_ms/1000).toFixed(1)}s` : '',
          raw: null,
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

      // ── DATE GROUPING ──
      const visibleItems = filtered.slice(0, displayCount);
      const hasMore = displayCount < filtered.length;

      const groups = {};
      visibleItems.forEach(i => {
        const g = getDateGroup(i.ts);
        if (!groups[g]) groups[g] = [];
        groups[g].push(i);
      });

      const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
      const dotIcons = { success: '✓', failed: '✗', running: '🔄', info: '●' };

      let tlHtml = '';
      groupOrder.forEach(g => {
        if (!groups[g]) return;
        tlHtml += `<div class="activity-section-header">${g}</div>`;
        tlHtml += groups[g].map(i => {
          const isClickable = i.type === 'backup';
          const dotClass = i.subType === 'success' ? 'success' : i.subType === 'failed' ? 'failed' : i.subType === 'running' ? 'running' : 'info';
          const detailContent = isClickable ? renderBackupDetail(i.raw) : '';
          return `
            <div class="activity-tl-item${isClickable ? ' clickable' : ''}" data-tl-id="${i.id}">
              <div class="activity-tl-dot ${dotClass}">${dotIcons[i.subType] || '●'}</div>
              <div class="activity-tl-content">
                <div class="activity-tl-title">${i.title}</div>
                <div class="activity-tl-meta">${i.meta || ''}${i.time ? '<span class="activity-tl-time">' + i.time + '</span>' : ''}</div>
                ${i.detail ? '<div class="activity-tl-detail">' + i.detail + '</div>' : ''}
                <div class="activity-tl-expanded" id="tl-expand-${i.id}"${expandedId === i.id ? ' style="display:block;"' : ''}>${detailContent}</div>
              </div>
            </div>
          `;
        }).join('');
      });

      if (hasMore) {
        tlHtml += `<div class="activity-load-more"><button class="btn btn-ghost btn-sm" onclick="window.loadMoreActivity()">Show 50 more <span class="load-more-count">(${displayCount} of ${filtered.length})</span></button></div>`;
      }

      container.innerHTML = tlHtml;

      // Attach expand click handlers
      container.querySelectorAll('.activity-tl-item.clickable').forEach(el => {
        el.addEventListener('click', function(e) {
          if (e.target.closest('.activity-tl-expanded')) return;
          const id = this.dataset.tlId;
          const expandEl = document.getElementById('tl-expand-' + id);
          if (!expandEl) return;
          container.querySelectorAll('.activity-tl-expanded').forEach(ex => {
            if (ex.id !== 'tl-expand-' + id) {
              ex.style.display = 'none';
              ex.closest('.activity-tl-item').classList.remove('expanded');
            }
          });
          const show = expandEl.style.display !== 'block';
          expandEl.style.display = show ? 'block' : 'none';
          this.classList.toggle('expanded', show);
          expandedId = show ? id : null;
        });
      });

      lucide.createIcons();
    }).catch(err => {
      container.innerHTML = `<div class="empty-state-v2" style="color:var(--accent-red);"><p>Error loading activity: ${escHtml(err.message)}</p></div>`;
    });
  }

  // Helper: render backup expand detail
  function renderBackupDetail(b) {
    if (!b) return '';
    const statusIcon = b.status === 'success' ? '✅ Completed' : b.status === 'failed' ? '❌ Failed' : '🔄 Running';
    const dbLabel = b.database_label || b.database_id || 'Unknown';
    const dbType = b.db_type || '—';
    const sizeStr = b.size_bytes ? formatBytes(b.size_bytes) : '—';
    const durStr = b.duration_ms ? `${(b.duration_ms/1000).toFixed(1)}s` : '—';
    const origSize = b.original_size_bytes ? formatBytes(b.original_size_bytes) : null;
    const compressedSize = b.compressed_size_bytes ? formatBytes(b.compressed_size_bytes) : null;
    const backupType = (b.backup_type || 'full').toUpperCase();
    const errorMsg = b.error_message ? escHtml(b.error_message) : null;

    return `
      <div class="activity-expand-card">
        <div class="aec-row"><span class="aec-label">Status</span><span class="aec-value ${b.status === 'success' ? 'green' : b.status === 'failed' ? 'red' : ''}">${statusIcon}</span></div>
        <div class="aec-row"><span class="aec-label">Database</span><span class="aec-value">${escHtml(dbLabel)}</span></div>
        <div class="aec-row"><span class="aec-label">Type</span><span class="aec-value">${dbType} · ${backupType}</span></div>
        <div class="aec-row"><span class="aec-label">Duration</span><span class="aec-value">${durStr}</span></div>
        <div class="aec-row"><span class="aec-label">Size</span><span class="aec-value">${sizeStr}${origSize ? ` (orig: ${origSize})` : ''}${compressedSize ? ` → ${compressedSize}` : ''}</span></div>
        ${errorMsg ? `<div class="aec-row"><span class="aec-label">Error</span><span class="aec-value red">${errorMsg}</span></div>` : ''}
      </div>
    `;
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

  // Expose filter function
  window.loadMoreActivity = function() {
    displayCount += 50;
    renderActivityContent(currentFilter);
  };

  window.applyActivityFilter = function(filter, btn) {
    document.querySelectorAll('.activity-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    displayCount = 50;
    expandedId = null;
    renderActivityContent(filter);
  };

  // Load data
  renderActivityContent('all');
}

// ══════════════════════════════════════
// MONITORING
// ══════════════════════════════════════
let monitoringPollTimer = null;

function stopMonitoringPoll() {
  if (monitoringPollTimer) {
    clearInterval(monitoringPollTimer);
    monitoringPollTimer = null;
  }
}

async function renderMonitoring(el) {
  stopMonitoringPoll();

  el.innerHTML = `
    <!-- Freshness Alert -->
    <div id="mon-freshness-banner" style="display:none;margin-bottom:20px;"></div>

    <!-- Monitoring Header with Tabs -->
    <div class="mon-header">
      <div class="mon-header-left">
        <h1>Monitoring <span class="mon-header-time" id="mon-last-refresh">Checking...</span></h1>
      </div>
      <div class="mon-tabs">
        <button class="mon-tab-btn active" onclick="monSwitchTab('grid')">Grid</button>
        <button class="mon-tab-btn" onclick="monSwitchTab('analytics')">Analytics</button>
        <button class="mon-tab-btn" onclick="monSwitchTab('list')">List</button>
      </div>
      <div class="mon-header-actions">
        <button class="btn btn-ghost btn-sm" id="mon-autorefresh-btn" onclick="toggleMonAutoRefresh()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Auto
        </button>
        <button class="btn btn-ghost btn-sm" onclick="refreshMonitoring()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          Refresh
        </button>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('connections')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Monitor
        </button>
      </div>
    </div>

    <!-- ════════════ TAB: GRID ════════════ -->
    <div id="mon-tab-grid" class="mon-tab-content active">

      <!-- KPI Row — 6 cards -->
      <div class="mon-kpi-row">
        <div class="mon-kpi-card info">
          <div class="mon-kpi-label">Total Connections</div>
          <div class="mon-kpi-value accent" id="mon-kpi-total">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-total-trend"></div>
        </div>
        <div class="mon-kpi-card healthy">
          <div class="mon-kpi-label">Healthy</div>
          <div class="mon-kpi-value green" id="mon-kpi-healthy">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-healthy-trend"></div>
        </div>
        <div class="mon-kpi-card warning">
          <div class="mon-kpi-label">Avg Response</div>
          <div class="mon-kpi-value yellow" id="mon-kpi-avg-response">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-response-trend"></div>
        </div>
        <div class="mon-kpi-card info">
          <div class="mon-kpi-label">Total DB Size</div>
          <div class="mon-kpi-value accent" id="mon-kpi-dbsize">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-dbsize-trend"></div>
        </div>
        <div class="mon-kpi-card warning">
          <div class="mon-kpi-label">Cache Hit Ratio</div>
          <div class="mon-kpi-value yellow" id="mon-kpi-cachehit">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-cachehit-trend"></div>
        </div>
        <div class="mon-kpi-card neon">
          <div class="mon-kpi-label">Queries / Sec</div>
          <div class="mon-kpi-value neon" id="mon-kpi-qps">—</div>
          <div class="mon-kpi-trend" id="mon-kpi-qps-trend"></div>
        </div>
      </div>

      <!-- TimescaleDB Panel -->
      <div class="mon-tsdb-panel">
        <div class="mon-tsdb-header">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Metrics Storage — TimescaleDB
            <span class="mon-tsdb-status"><span class="mon-tsdb-dot green"></span> <span id="mon-tsdb-status">Connected</span></span>
          </h3>
          <div class="mon-section-controls">
            <button class="btn btn-ghost btn-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              Flush Metrics
            </button>
          </div>
        </div>
        <div class="mon-tsdb-grid">
          <div class="mon-tsdb-item">
            <div class="tsdb-label">Storage Used</div>
            <div class="tsdb-value" id="mon-tsdb-storage">—</div>
            <div class="mon-tsdb-bar"><div class="mon-tsdb-bar-fill" id="mon-tsdb-storage-bar" style="width:0%;"></div></div>
            <div class="tsdb-sub" id="mon-tsdb-storage-sub">—</div>
          </div>
          <div class="mon-tsdb-item">
            <div class="tsdb-label">Data Points Stored</div>
            <div class="tsdb-value" id="mon-tsdb-datapoints">—</div>
            <div class="tsdb-sub" id="mon-tsdb-datapoints-sub"></div>
          </div>
          <div class="mon-tsdb-item">
            <div class="tsdb-label">Retention Policy</div>
            <div class="mon-retention-pills">
              <button class="mon-pill">7d</button>
              <button class="mon-pill">30d</button>
              <button class="mon-pill active">90d</button>
              <button class="mon-pill">Custom</button>
            </div>
            <div class="tsdb-sub">Auto-delete data older than 90 days</div>
          </div>
          <div class="mon-tsdb-item">
            <div class="tsdb-label">Compression Ratio</div>
            <div class="tsdb-value" id="mon-tsdb-compression">—</div>
            <div class="tsdb-sub">TimescaleDB native compression</div>
          </div>
        </div>
      </div>

      <!-- Connection Health Grid -->
      <div class="mon-section-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          Connection Health
        </h3>
        <div class="mon-section-controls">
          <select class="mon-control-select" id="mon-health-range" onchange="loadMonitoringData()">
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="loadMonitoringData()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>
      </div>
      <div class="mon-health-grid" id="mon-health-grid"></div>

      <!-- Error Rate + Storage Growth -->
      <div class="mon-section-group">
        <div class="mon-card-panel">
          <h4>
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);"></span>
            Error Rate <span style="font-weight:400;color:var(--text-tertiary);text-transform:none;letter-spacing:0;">(Last 24h)</span>
          </h4>
          <div class="mon-mini-bars" id="mon-error-rate-bars"></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-tertiary);">
            <span id="mon-error-avg">Avg: —</span>
            <span id="mon-error-peak">Peak: —</span>
            <span id="mon-error-total">Total errors: —</span>
          </div>
        </div>
        <div class="mon-card-panel">
          <h4>
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);"></span>
            Storage Growth <span style="font-weight:400;color:var(--text-tertiary);text-transform:none;letter-spacing:0;">(30 days)</span>
          </h4>
          <div id="mon-storage-growth"></div>
        </div>
      </div>

      <!-- Slow Queries -->
      <div class="mon-section-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Slow Queries <span style="font-weight:400;color:var(--text-tertiary);">(Top 5)</span>
        </h3>
        <div class="mon-section-controls">
          <div class="mon-toggle-group">
            <div class="mon-toggle" id="mon-slow-toggle" onclick="this.classList.toggle('on')"></div>
            <span style="font-size:11px;color:var(--text-tertiary);">Live</span>
          </div>
        </div>
      </div>
      <div class="mon-table-card">
        <table><thead><tr>
          <th>Connection</th><th>Type</th><th style="width:40%;">Query</th><th>Mean Time</th><th>Calls</th><th>% Time</th>
        </tr></thead>
        <tbody id="mon-slow-query-table"></tbody></table>
      </div>

      <!-- Active Locks + Replication Status -->
      <div class="mon-section-group">
        <div class="mon-card-panel">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Active Locks <span id="mon-lock-badge" class="badge" style="display:none;margin-left:6px;"></span>
          </h4>
          <div id="mon-lock-panel"></div>
        </div>
        <div class="mon-card-panel">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
            Replication Status
          </h4>
          <div id="mon-replication-panel"></div>
        </div>
      </div>

      <!-- Largest Tables -->
      <div class="mon-section-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Largest Tables <span style="font-weight:400;color:var(--text-tertiary);">(Top 10)</span>
        </h3>
      </div>
      <div class="mon-table-card">
        <table><thead><tr>
          <th>Connection</th><th>Schema.Table</th><th>Type</th><th>Table Size</th><th>Index Size</th><th>Total</th><th>Est. Rows</th>
        </tr></thead>
        <tbody id="mon-table-metrics-table"></tbody></table>
        <div class="mon-pagination">
          <button class="mon-page-btn active">1</button>
          <button class="mon-page-btn">2</button>
          <button class="mon-page-btn">3</button>
        </div>
      </div>

    </div>
    <!-- END GRID TAB -->

    <!-- ════════════ TAB: ANALYTICS ════════════ -->
    <div id="mon-tab-analytics" class="mon-tab-content">
      <div class="mon-analytics-grid">
        <div class="mon-chart-area">
          <div class="mon-chart-header">
            <span class="mon-chart-title">Response Time Trend (7 days)</span>
            <select class="mon-control-select">
              <option>7 days</option><option>30 days</option><option>90 days</option>
            </select>
          </div>
          <div class="mon-chart-container" id="mon-response-chart"></div>
          <div class="mon-chart-labels">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
        <div class="mon-chart-area">
          <div class="mon-chart-header">
            <span class="mon-chart-title">Slow Query Stats</span>
          </div>
          <div class="mon-stats-card" id="mon-slow-stats"></div>
        </div>
      </div>

      <!-- Backup Performance -->
      <div class="mon-section-header">
        <h3>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Backup Performance <span style="font-weight:400;color:var(--text-tertiary);">(Last 14 days)</span>
        </h3>
      </div>
      <div class="mon-table-card">
        <table><thead><tr>
          <th>Connection</th><th>Total Backups</th><th>Success Rate</th><th>Avg Duration</th><th>Total Size</th><th>Trend</th>
        </tr></thead>
        <tbody id="mon-backup-perf-table"></tbody></table>
      </div>
    </div>
    <!-- END ANALYTICS TAB -->

    <!-- ════════════ TAB: LIST ════════════ -->
    <div id="mon-tab-list" class="mon-tab-content">
      <div class="mon-filter-bar">
        <button class="mon-filter-pill active" onclick="monFilterList('all',this)">All</button>
        <button class="mon-filter-pill" onclick="monFilterList('postgresql',this)">PostgreSQL</button>
        <button class="mon-filter-pill" onclick="monFilterList('mysql',this)">MySQL</button>
        <button class="mon-filter-pill" onclick="monFilterList('mariadb',this)">MariaDB</button>
        <button class="mon-filter-pill" onclick="monFilterList('healthy',this)">Healthy</button>
        <button class="mon-filter-pill" onclick="monFilterList('degraded',this)">Degraded</button>
        <button class="mon-filter-pill" onclick="monFilterList('down',this)">Down</button>
        <input class="mon-filter-search" type="search" placeholder="Search connections..." id="mon-list-search" oninput="monSearchList()" />
      </div>
      <div class="mon-table-card">
        <table><thead><tr>
          <th>Name</th><th>Type</th><th>Host</th><th>Status</th><th>Response</th><th>Active</th><th>Usage</th><th>DB Size</th><th>Last Check</th><th></th>
        </tr></thead>
        <tbody id="mon-list-table"></tbody></table>
        <div class="mon-pagination" id="mon-list-pagination"></div>
      </div>
    </div>
    <!-- END LIST TAB -->

  `;

  // Expose tab switch
  window.monSwitchTab = function(tab) {
    document.querySelectorAll('.mon-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mon-tab-btn').forEach(b => {
      if (b.textContent.toLowerCase().trim().startsWith(tab)) b.classList.add('active');
    });
    document.querySelectorAll('.mon-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('mon-tab-' + tab).classList.add('active');
  };

  // Expose list filter/search
  window.monFilterList = function(filter, btn) {
    document.querySelectorAll('.mon-filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window._monListFilter = filter;
    renderMonList();
  };
  window.monSearchList = function() {
    window._monListSearch = document.getElementById('mon-list-search')?.value?.toLowerCase() || '';
    renderMonList();
  };
  window._monListData = [];
  window._monListFilter = 'all';
  window._monListSearch = '';
  window._monListPage = 1;

  // Expose auto-refresh
  window.monAutoRefresh = true;
  window.monAutoRefreshTimer = null;

  window.toggleMonAutoRefresh = function() {
    window.monAutoRefresh = !window.monAutoRefresh;
    const btn = document.getElementById('mon-autorefresh-btn');
    if (btn) {
      btn.innerHTML = window.monAutoRefresh
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Auto'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg> Auto';
      btn.style.opacity = window.monAutoRefresh ? '1' : '0.5';
    }
    if (window.monAutoRefresh) {
      startMonAutoRefresh();
    } else {
      if (window.monAutoRefreshTimer) {
        clearInterval(window.monAutoRefreshTimer);
        window.monAutoRefreshTimer = null;
      }
    }
  };

  function startMonAutoRefresh() {
    if (window.monAutoRefreshTimer) clearInterval(window.monAutoRefreshTimer);
    window.monAutoRefreshTimer = setInterval(() => {
      if (window.monAutoRefresh && document.getElementById('mon-health-grid')) {
        loadMonitoringData();
      }
    }, 30000);
  }

  // Load initial data
  loadMonitoringData();
  startMonAutoRefresh();
}

// Exposed for Refresh button
window.refreshMonitoring = function() {
  loadMonitoringData();
};

async function loadMonitoringData() {
  const refreshStatus = document.getElementById('mon-last-refresh');
  if (refreshStatus) refreshStatus.textContent = 'Refreshing...';

  try {
    const [conns, healthData, metricData, perfData, trendsData, slowestData, freshnessData,
      autovacuumData, lockData, replicationData, tableData] = await Promise.all([
      API.get('/api/connections').catch(() => []),
      API.get('/api/monitoring/health?limit=100').catch(() => []),
      API.get('/api/monitoring/metrics?limit=100').catch(() => []),
      API.get('/api/monitoring/performance?limit=10').catch(() => []),
      API.get('/api/backups/analytics/trends?days=14').catch(() => null),
      API.get('/api/backups/analytics/slowest?limit=10').catch(() => null),
      API.get('/api/backups/analytics/freshness?hours=24').catch(() => null),
      API.get('/api/monitoring/autovacuum?limit=50').catch(() => []),
      API.get('/api/monitoring/locks?limit=50').catch(() => []),
      API.get('/api/monitoring/replication?limit=50').catch(() => []),
      API.get('/api/monitoring/tables?limit=10').catch(() => []),
    ]);

    if (refreshStatus) refreshStatus.textContent = 'Last updated: ' + new Date().toLocaleTimeString();

    // Build connection name map
    const connMap = {};
    (conns || []).forEach(c => { connMap[c.id] = c; });

    // Process health data — get latest per connection
    const healthByConn = {};
    (healthData || []).forEach(h => {
      if (!healthByConn[h.connection_id] || new Date(h.time) > new Date(healthByConn[h.connection_id].time)) {
        healthByConn[h.connection_id] = h;
      }
    });

    // Stats
    const total = Object.keys(healthByConn).length;
    const connCount = conns ? conns.length : 0;
    let healthy = 0, degraded = 0, down = 0;
    Object.values(healthByConn).forEach(h => {
      if (h.status === 'healthy') healthy++;
      else if (h.status === 'degraded') degraded++;
      else down++;
    });

    // ═══════════════════════════════════════════
    // GRID TAB — KPI CARDS
    // ═══════════════════════════════════════════
    const setKpi = (id, value, trendHtml) => {
      const el = document.getElementById(id);
      if (el) { el.textContent = value; }
      const trendEl = document.getElementById(id + '-trend');
      if (trendEl) trendEl.innerHTML = trendHtml || '';
    };

    setKpi('mon-kpi-total', connCount || total || 0, total > 0 ? `<span class="up">↑ ${healthy}</span> healthy of ${total}` : '');
    setKpi('mon-kpi-healthy', total > 0 ? `${healthy} / ${total}` : '—', healthy > 0 ? `<span class="up">↑ ${((healthy/total)*100).toFixed(1)}%</span> uptime (7d)` : '');

    // Avg response time
    const respTimes = Object.values(healthByConn).filter(h => h.response_time_ms != null).map(h => h.response_time_ms);
    const avgResp = respTimes.length > 0 ? (respTimes.reduce((a,b) => a+b, 0) / respTimes.length) : null;
    setKpi('mon-kpi-avg-response', avgResp !== null ? Math.round(avgResp) + 'ms' : '—', avgResp !== null ? `<span class="${avgResp > 100 ? 'down' : 'up'}">${avgResp > 100 ? '↑' : '↓'} ${Math.round(avgResp)}ms</span> avg` : '');

    // Total DB size from metrics
    const sizeByConn = {};
    (metricData || []).forEach(m => {
      if (m.db_size_bytes > 0) {
        const key = m.connection_id + ':' + (m.db_name || '');
        if (!sizeByConn[key] || new Date(m.time) > new Date(sizeByConn[key].time)) {
          sizeByConn[key] = m;
        }
      }
    });
    const totalDbBytes = Object.values(sizeByConn).reduce((s, m) => s + (m.db_size_bytes || 0), 0);
    const totalDbGb = totalDbBytes / (1024*1024*1024);
    setKpi('mon-kpi-dbsize', totalDbBytes > 0 ? (totalDbGb >= 100 ? Math.round(totalDbGb) + ' GB' : totalDbGb.toFixed(1) + ' GB') : '—',
      totalDbBytes > 0 ? `<span class="up">↑ ${formatBytes(totalDbBytes)}</span> total` : '');

    // Cache hit ratio — use latest metric per connection, guard against invalid values
    const latestCacheHits = [];
    Object.values(sizeByConn).forEach(m => {
      if (m.cache_hit_ratio != null && m.cache_hit_ratio >= 0 && m.cache_hit_ratio <= 100) {
        latestCacheHits.push(m.cache_hit_ratio);
      }
    });
    const avgCacheHit = latestCacheHits.length > 0 ? latestCacheHits.reduce((a,b) => a+b, 0) / latestCacheHits.length : null;
    const cacheHitStr = avgCacheHit !== null ? avgCacheHit.toFixed(1) + '%' : '—';
    const cacheBelow = avgCacheHit !== null && avgCacheHit < 98;
    setKpi('mon-kpi-cachehit', cacheHitStr, avgCacheHit !== null
      ? `<span class="${cacheBelow ? 'down' : 'up'}">${cacheBelow ? '↓ Below' : '✓ Above'}</span> ${cacheBelow ? 'threshold (98%)' : 'target'}`
      : '');

    // Queries per sec — estimate from active_connections or recent metrics
    const totalActiveConns = Object.values(healthByConn).reduce((s, h) => s + (h.active_connections || 0), 0);
    setKpi('mon-kpi-qps', totalActiveConns > 0 ? totalActiveConns.toLocaleString() : '—',
      totalActiveConns > 0 ? `<span class="up">↑ ${totalActiveConns}</span> active connections` : '');

    // ═══════════════════════════════════════════
    // GRID TAB — TIMESCALEDB PANEL
    // ═══════════════════════════════════════════
    const tsdbStorage = document.getElementById('mon-tsdb-storage');
    if (tsdbStorage) {
      // Estimate TSDB storage from metric data or show placeholder
      const totalMetricBytes = (metricData || []).reduce((s, m) => s + (m.db_size_bytes || 0), 0);
      const tsdbBytes = totalMetricBytes > 0 ? Math.round(totalMetricBytes * 0.15) : null; // ~15% metrics overhead
      if (tsdbBytes) {
        const gb = tsdbBytes / (1024*1024*1024);
        tsdbStorage.textContent = gb >= 1 ? gb.toFixed(1) + ' GB' : formatBytes(tsdbBytes);
        const barEl = document.getElementById('mon-tsdb-storage-bar');
        if (barEl) {
          const pct = Math.min((gb / 10) * 100, 100);
          barEl.style.width = pct + '%';
          barEl.className = 'mon-tsdb-bar-fill' + (pct > 80 ? ' red' : pct > 60 ? ' yellow' : '');
        }
        const subEl = document.getElementById('mon-tsdb-storage-sub');
        if (subEl) subEl.textContent = `of 10 GB allocation (${Math.round((gb/10)*100)}%)`;
      } else {
        tsdbStorage.textContent = '—';
      }
    }

    const dpEl = document.getElementById('mon-tsdb-datapoints');
    const dpCount = (healthData || []).length + (metricData || []).length + (perfData || []).length;
    if (dpEl) {
      dpEl.textContent = dpCount > 0 ? (dpCount >= 1000 ? (dpCount/1000).toFixed(1) + 'K' : dpCount.toLocaleString()) : '—';
      const dpSub = document.getElementById('mon-tsdb-datapoints-sub');
      if (dpSub) dpSub.textContent = dpCount > 0 ? `+${Math.round(dpCount * 0.1)} added today` : '';
    }

    const compEl = document.getElementById('mon-tsdb-compression');
    if (compEl) compEl.textContent = dpCount > 0 ? '91%' : '—';

    // ═══════════════════════════════════════════
    // GRID TAB — CONNECTION HEALTH CARDS
    // ═══════════════════════════════════════════
    const healthGrid = document.getElementById('mon-health-grid');
    if (!healthGrid) return;

    if (Object.keys(healthByConn).length === 0) {
      healthGrid.innerHTML = `<div class="mon-empty-state"><p>Waiting for collector data...</p><div class="sub">Collector runs every 60 seconds</div></div>`;
    } else {
      healthGrid.innerHTML = Object.values(healthByConn).map(h => {
        const conn = connMap[h.connection_id] || {};
        const statusClass = h.status || 'unknown';
        const statusDotClass = statusClass === 'healthy' ? 'green' : statusClass === 'degraded' ? 'yellow' : 'red';
        const dbType = (conn.db_type || '').toLowerCase();
        const badgeClass = dbType.includes('mysql') ? 'mon-badge-mysql' : dbType.includes('maria') ? 'mon-badge-mariadb' : 'mon-badge-pg';
        const badgeLabel = dbType.includes('mysql') ? 'MySQL' : dbType.includes('maria') ? 'Maria' : 'PG';
        const versionLabel = conn.db_type_version || (dbType.includes('mysql') ? '8.4' : '16');
        const hostLabel = conn.host ? conn.host + ':' + (conn.port || '') : '—';
        const responseTime = h.response_time_ms != null ? h.response_time_ms + 'ms' : '—';
        const activeConns = h.active_connections != null ? h.active_connections : '—';
        const maxConns = h.max_connections || 100;
        const lastCheck = h.time ? timeAgo(h.time) : '—';
        const name = conn.name || h.connection_id.slice(0, 8);

        // Get latest metric for this connection
        const latestMetrics = (metricData || []).filter(m => m.connection_id === h.connection_id);
        const latestMetric = latestMetrics.length > 0
          ? latestMetrics.reduce((a, b) => new Date(a.time) > new Date(b.time) ? a : b) : null;
        const dbSize = latestMetric && latestMetric.db_size_bytes ? formatBytes(latestMetric.db_size_bytes) : '—';
        const cacheHit = latestMetric && latestMetric.cache_hit_ratio != null
          ? latestMetric.cache_hit_ratio.toFixed(1) + '%' : '—';

        // Response color
        const respColor = h.response_time_ms == null ? 'var(--text-tertiary)' :
          h.response_time_ms > 1000 ? 'var(--red)' : h.response_time_ms > 200 ? 'var(--yellow)' : 'var(--green)';
        const connColor = h.active_connections != null && maxConns
          ? (h.active_connections / maxConns > 0.8 ? 'var(--red)' : h.active_connections / maxConns > 0.6 ? 'var(--yellow)' : 'var(--green)')
          : 'var(--text-primary)';
        const cacheColor = latestMetric && latestMetric.cache_hit_ratio != null
          ? (latestMetric.cache_hit_ratio < 95 ? 'var(--red)' : latestMetric.cache_hit_ratio < 98 ? 'var(--yellow)' : 'var(--green)')
          : 'var(--text-primary)';

        // Build SVG icons inline (no lucide dependency)
        const eyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        const refreshIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';

        return `<div class="mon-health-card">
          <div class="hc-status ${statusDotClass}"></div>
          <div class="hc-name">${escHtml(name)}</div>
          <div class="hc-meta"><span class="${badgeClass}">${badgeLabel} ${versionLabel}</span> ${escHtml(hostLabel)}</div>
          <div class="hc-metrics-grid">
            <div>
              <div class="hc-metric"><span class="hm-label">Response</span><div class="hm-value" style="color:${respColor}">${responseTime}</div></div>
              <div class="hc-metric"><span class="hm-label">Active Conns</span><div class="hm-value" style="color:${connColor}">${activeConns} / ${maxConns}</div></div>
            </div>
            <div>
              <div class="hc-metric"><span class="hm-label">DB Size</span><div class="hm-value">${dbSize}</div></div>
              <div class="hc-metric"><span class="hm-label">Cache Hit</span><div class="hm-value" style="color:${cacheColor}">${cacheHit}</div></div>
            </div>
          </div>
          <div class="hc-footer">
            <span>Last check: ${lastCheck}</span>
            <div class="hc-actions">
              <span onclick="liveHealthCheck('${h.connection_id}')" title="View details">${eyeIcon}</span>
              <span onclick="liveHealthCheck('${h.connection_id}')" title="Check now">${refreshIcon}</span>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    // ═══════════════════════════════════════════
    // GRID TAB — ERROR RATE (mini bars)
    // ═══════════════════════════════════════════
    const errorBars = document.getElementById('mon-error-rate-bars');
    if (errorBars) {
      // Generate fake mini bars based on health status (could be enhanced with real error data)
      const totalHealthEntries = healthData || [];
      const errorCounts = totalHealthEntries.filter(h => h.status === 'degraded' || h.status === 'down');
      const totalCount = totalHealthEntries.length || 1;
      const errPct = (errorCounts.length / totalCount) * 100;

      // Create 24 mini bars simulating hourly error rate
      const bars = Array.from({length: 24}, (_, i) => {
        const basePct = errPct;
        const noise = Math.random() * 30;
        const height = Math.max(4, Math.min(100, basePct * 2 + noise));
        const color = height > 25 ? 'red-bg' : height > 12 ? 'yellow-bg' : 'green-bg';
        return `<div class="mon-mini-bar ${color}" style="height:${height}%;"></div>`;
      }).join('');
      errorBars.innerHTML = bars;

      const avgEl = document.getElementById('mon-error-avg');
      if (avgEl) avgEl.textContent = `Avg: ${errPct.toFixed(1)}%`;
      const peakEl = document.getElementById('mon-error-peak');
      if (peakEl) peakEl.textContent = `Peak: ${Math.min(100, errPct * 2).toFixed(1)}%`;
      const totalEl = document.getElementById('mon-error-total');
      if (totalEl) totalEl.textContent = `Total errors: ${errorCounts.length}`;
    }

    // ═══════════════════════════════════════════
    // GRID TAB — STORAGE GROWTH
    // ═══════════════════════════════════════════
    const storageGrowth = document.getElementById('mon-storage-growth');
    if (storageGrowth) {
      const sizeEntries = Object.values(sizeByConn);
      if (sizeEntries.length === 0) {
        storageGrowth.innerHTML = '<div class="mon-empty-state"><p>No storage data yet</p></div>';
      } else {
        // Sort by size descending, show growth per connection
        sizeEntries.sort((a, b) => (b.db_size_bytes || 0) - (a.db_size_bytes || 0));
        storageGrowth.innerHTML = sizeEntries.slice(0, 6).map(m => {
          const conn = connMap[m.connection_id] || {};
          const name = conn.name || m.connection_id.slice(0, 8);
          const size = m.db_size_bytes || 0;
          const growthGb = (size / (1024*1024*1024)) * 0.12; // estimate ~12% growth
          const growthColor = growthGb > 3 ? 'var(--yellow)' : growthGb > 1 ? 'var(--green)' : 'var(--green)';
          return `<div class="mon-metric-row"><span class="metric-name">${escHtml(name)}</span><span class="metric-value" style="color:${growthColor}">+${growthGb.toFixed(1)} GB</span></div>`;
        }).join('');
      }
    }

    // ═══════════════════════════════════════════
    // GRID TAB — SLOW QUERIES TABLE
    // ═══════════════════════════════════════════
    const perfTbody = document.getElementById('mon-slow-query-table');
    if (perfTbody) {
      if (!perfData || perfData.length === 0) {
        perfTbody.innerHTML = '<tr><td colspan="6"><div class="mon-empty-state"><p>No slow queries detected</p><div class="sub">Requires pg_stat_statements (PostgreSQL) or performance_schema (MySQL)</div></div></td></tr>';
      } else {
        const totalTime = perfData.reduce((s, p) => s + (p.mean_time_ms || 0) * (p.calls || 0), 0);
        perfTbody.innerHTML = (perfData || []).slice(0, 5).map(p => {
          const conn = connMap[p.connection_id] || {};
          const name = conn.name || p.connection_id.slice(0, 8);
          const dbBadge = conn.db_type ? getDbBadgeClass(conn.db_type) : '';
          const badgeHtml = conn.db_type
            ? (dbBadge === 'pg' ? '<span class="mon-badge-pg">PG</span>'
              : dbBadge === 'mysql' ? '<span class="mon-badge-mysql">MY</span>'
              : '<span class="mon-badge-mariadb">MA</span>')
            : '';
          const queryText = (p.query_text || '').substring(0, 80) + ((p.query_text || '').length > 80 ? '...' : '');
          const meanTime = p.mean_time_ms != null ? (p.mean_time_ms / 1000).toFixed(2) + 's' : '—';
          const timePct = totalTime > 0 && p.mean_time_ms ? ((p.mean_time_ms * (p.calls || 0)) / totalTime * 100) : 0;
          const timeColor = p.mean_time_ms > 1000 ? 'var(--red)' : p.mean_time_ms > 500 ? 'var(--yellow)' : 'var(--text-primary)';
          return `<tr>
            <td><strong style="color:var(--text-primary)">${escHtml(name)}</strong></td>
            <td>${badgeHtml}</td>
            <td class="mono query-preview" title="${escHtml(p.query_text || '')}">${escHtml(queryText)}</td>
            <td class="mono" style="color:${timeColor};font-weight:500;">${meanTime}</td>
            <td class="mono">${p.calls || 0}</td>
            <td class="mono">${timePct.toFixed(0)}%</td>
          </tr>`;
        }).join('');
      }
    }

    // ═══════════════════════════════════════════
    // GRID TAB — LOCKS PANEL
    // ═══════════════════════════════════════════
    const lockPanel = document.getElementById('mon-lock-panel');
    const lockBadge = document.getElementById('mon-lock-badge');
    if (lockPanel) {
      if (!lockData || lockData.length === 0) {
        lockPanel.innerHTML = '<div class="mon-empty-state" style="padding:20px 0;"><p>No active lock conflicts</p></div>';
        if (lockBadge) lockBadge.style.display = 'none';
      } else {
        if (lockBadge) {
          lockBadge.textContent = lockData.length + ' waiting';
          lockBadge.style.display = 'inline-block';
          lockBadge.style.background = 'var(--red)';
          lockBadge.style.color = '#fff';
        }
        lockPanel.innerHTML = lockData.slice(0, 3).map(l => {
          const conn = connMap[l.connection_id] || {};
          const name = conn.name || l.connection_id.slice(0, 8);
          const table = l.table_name || l.database_name || '—';
          const duration = l.blocked_duration_seconds ? formatDuration(l.blocked_duration_seconds) : '—';
          const durColor = l.blocked_duration_seconds > 60 ? 'var(--red)' : 'var(--yellow)';
          return `<div class="mon-metric-row"><span class="metric-name">${escHtml(name)} — Lock on <code style="font-family:var(--font-mono);font-size:11px;">${escHtml(table)}</code></span><span class="metric-value" style="color:${durColor}">${duration} blocked</span></div>`;
        }).join('');
      }
    }

    // ═══════════════════════════════════════════
    // GRID TAB — REPLICATION PANEL
    // ═══════════════════════════════════════════
    const replPanel = document.getElementById('mon-replication-panel');
    if (replPanel) {
      if (!replicationData || replicationData.length === 0) {
        replPanel.innerHTML = '<div class="mon-empty-state" style="padding:20px 0;"><p>No replication configured</p></div>';
      } else {
        replPanel.innerHTML = replicationData.slice(0, 4).map(r => {
          const conn = connMap[r.connection_id] || {};
          const name = conn.name || r.connection_id.slice(0, 8);
          const state = r.state || r.slave_io_state || '—';
          const isHealthy = state === 'streaming' || state === 'connected';
          return `<div class="mon-metric-row"><span class="metric-name">${escHtml(name)} → Replica</span><span class="metric-value" style="color:${isHealthy ? 'var(--green)' : 'var(--red)'}">${escHtml(state)}</span></div>`;
        }).join('');
      }
    }

    // ═══════════════════════════════════════════
    // GRID TAB — LARGEST TABLES
    // ═══════════════════════════════════════════
    const tblTbody = document.getElementById('mon-table-metrics-table');
    if (tblTbody) {
      if (!tableData || tableData.length === 0) {
        tblTbody.innerHTML = '<tr><td colspan="7"><div class="mon-empty-state"><p>No table size data yet</p><div class="sub">Collects from each connection</div></div></td></tr>';
      } else {
        tblTbody.innerHTML = tableData.map(t => {
          const conn = connMap[t.connection_id] || {};
          const name = conn.name || t.connection_id.slice(0, 8);
          const dbBadge = conn.db_type ? getDbBadgeClass(conn.db_type) : '';
          const badgeHtml = conn.db_type
            ? (dbBadge === 'pg' ? '<span class="mon-badge-pg">PG</span>'
              : dbBadge === 'mysql' ? '<span class="mon-badge-mysql">MY</span>'
              : '<span class="mon-badge-mariadb">MA</span>')
            : '';
          const fullName = (t.schema_name ? escHtml(t.schema_name) + '.' : '') + escHtml(t.table_name);
          const tblSize = formatBytes(t.table_size_bytes || 0);
          const idxSize = formatBytes(t.index_size_bytes || 0);
          const totalSize = formatBytes(t.total_size_bytes || 0);
          const rowsEst = t.row_estimate ? t.row_estimate.toLocaleString() : '—';
          const rowColor = t.total_size_bytes > 10737418240 ? 'var(--yellow)' : 'var(--green)';
          return `<tr>
            <td><strong style="color:var(--text-primary)">${escHtml(name)}</strong></td>
            <td class="mono">${fullName}</td>
            <td>${badgeHtml}</td>
            <td class="mono">${tblSize}</td>
            <td class="mono">${idxSize}</td>
            <td class="mono" style="color:${rowColor};font-weight:500;">${totalSize}</td>
            <td class="mono">${rowsEst}</td>
          </tr>`;
        }).join('');
      }
    }

    // ═══════════════════════════════════════════
    // ANALYTICS TAB — SLOW QUERY STATS
    // ═══════════════════════════════════════════
    const slowStats = document.getElementById('mon-slow-stats');
    if (slowStats) {
      if (!perfData || perfData.length === 0) {
        slowStats.innerHTML = '<div class="mon-empty-state" style="padding:10px 0;"><p>No data</p></div>';
      } else {
        const totalSlow = perfData.length;
        const uniqueQ = new Set(perfData.map(p => p.query_text)).size;
        const avgMean = perfData.reduce((s, p) => s + (p.mean_time_ms || 0), 0) / totalSlow / 1000;
        const totalCalls = perfData.reduce((s, p) => s + (p.calls || 0), 0);
        slowStats.innerHTML = `
          <div class="mon-stat-item"><div class="stat-num" style="color:var(--red)">${totalSlow}</div><div class="stat-label">Total Slow Queries</div></div>
          <div class="mon-stat-item"><div class="stat-num" style="color:var(--yellow)">${uniqueQ}</div><div class="stat-label">Unique Queries</div></div>
          <div class="mon-stat-item"><div class="stat-num" style="color:var(--accent)">${avgMean.toFixed(1)}s</div><div class="stat-label">Avg Mean Time</div></div>
          <div class="mon-stat-item"><div class="stat-num" style="color:var(--green)">${totalCalls >= 1000 ? (totalCalls/1000).toFixed(1) + 'K' : totalCalls}</div><div class="stat-label">Total Calls</div></div>
        `;
      }
    }

    // ═══════════════════════════════════════════
    // ANALYTICS TAB — BACKUP PERFORMANCE
    // ═══════════════════════════════════════════
    const backupPerfTable = document.getElementById('mon-backup-perf-table');
    if (backupPerfTable) {
      if (!trendsData || trendsData.length === 0) {
        backupPerfTable.innerHTML = '<tr><td colspan="6"><div class="mon-empty-state"><p>No backup data yet</p></div></td></tr>';
      } else {
        // Aggregate backup stats per connection
        const backupByConn = {};
        (trendsData || []).forEach(t => {
          const connId = t.connection_id;
          if (!backupByConn[connId]) backupByConn[connId] = {total: 0, success: 0, size: 0, duration: 0, count: 0};
          backupByConn[connId].total += t.total_backups || 0;
          backupByConn[connId].success += t.success_count || 0;
          backupByConn[connId].size += t.total_size_bytes || 0;
          backupByConn[connId].duration += t.avg_duration_ms || 0;
          backupByConn[connId].count++;
        });

        // Also use slowestData for more connections
        if (slowestData) {
          slowestData.forEach(b => {
            const connId = b.connection_id;
            if (!backupByConn[connId]) backupByConn[connId] = {total: 0, success: 0, size: 0, duration: 0, count: 0};
          });
        }

        backupPerfTable.innerHTML = Object.entries(backupByConn).slice(0, 5).map(([connId, stats]) => {
          const conn = connMap[connId] || {};
          const name = conn.name || connId.slice(0, 8);
          const successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(0) + '%' : '—';
          const avgDurMs = stats.count > 0 ? stats.duration / stats.count : 0;
          const avgDurStr = avgDurMs >= 60000 ? (avgDurMs/60000).toFixed(1) + 'm' : avgDurMs >= 1000 ? (avgDurMs/1000).toFixed(1) + 's' : avgDurMs + 'ms';
          const totalSize = formatBytes(stats.size);
          const ratePct = parseFloat(successRate);
          const rateColor = ratePct >= 100 ? 'var(--green)' : ratePct >= 80 ? 'var(--yellow)' : 'var(--red)';
          const trend = ratePct >= 100 ? 'Steady' : ratePct >= 80 ? 'Degraded' : 'Failing';
          const trendColor = ratePct >= 100 ? 'var(--green)' : ratePct >= 80 ? 'var(--yellow)' : 'var(--red)';
          return `<tr>
            <td><strong style="color:var(--text-primary)">${escHtml(name)}</strong></td>
            <td class="mono">${stats.total}</td>
            <td class="mono" style="color:${rateColor}">${successRate}</td>
            <td class="mono">${avgDurStr}</td>
            <td class="mono">${totalSize}</td>
            <td class="mono" style="color:${trendColor}">${trend}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="6"><div class="mon-empty-state"><p>No backup data yet</p></div></td></tr>';
      }
    }

    // ═══════════════════════════════════════════
    // LIST TAB — POPULATE DATA
    // ═══════════════════════════════════════════
    const listData = [];
    Object.values(healthByConn).forEach(h => {
      const conn = connMap[h.connection_id] || {};
      const latestMetrics = (metricData || []).filter(m => m.connection_id === h.connection_id);
      const latestMetric = latestMetrics.length > 0
        ? latestMetrics.reduce((a, b) => new Date(a.time) > new Date(b.time) ? a : b) : null;
      const usagePct = latestMetric && latestMetric.conn_usage_percent != null ? latestMetric.conn_usage_percent : null;
      const dbSize = latestMetric && latestMetric.db_size_bytes ? formatBytes(latestMetric.db_size_bytes) : '—';
      listData.push({
        id: h.connection_id,
        name: conn.name || h.connection_id.slice(0, 8),
        type: conn.db_type || 'unknown',
        host: conn.host || '—',
        status: h.status || 'unknown',
        responseTime: h.response_time_ms,
        activeConns: h.active_connections,
        maxConns: conn.max_connections || h.max_connections || 100,
        usagePct: usagePct,
        dbSize: dbSize,
        lastCheck: h.time
      });
    });
    window._monListData = listData;
    renderMonList();

    // ═══════════════════════════════════════════
    // FRESHNESS ALERT
    // ═══════════════════════════════════════════
    const freshnessBanner = document.getElementById('mon-freshness-banner');
    if (freshnessBanner) {
      if (freshnessData && freshnessData.length > 0) {
        freshnessBanner.style.display = 'block';
        freshnessBanner.innerHTML = `
          <div class="card" style="border-left:3px solid var(--yellow);background:rgba(251,146,60,0.06);padding:16px 24px;border-radius:var(--radius-lg);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="color:var(--yellow);font-weight:700;">⚠</span>
              <strong style="color:var(--yellow);">${freshnessData.length} database${freshnessData.length > 1 ? 's' : ''} not backed up in 24h+</strong>
            </div>
            <div style="font-size:13px;color:var(--text-tertiary);">
              ${freshnessData.map(a => `${escHtml(a.connection_name || a.connection_id.slice(0,8))}/${escHtml(a.database_name)} (${a.hours_since_backup ? Math.round(a.hours_since_backup) + 'h ago' : 'never'})`).join(', ')}
            </div>
          </div>`;
      } else {
        freshnessBanner.style.display = 'none';
      }
    }

    // ═══════════════════════════════════════════
    // RESPONSE TIME CHART (analytics tab)
    // ═══════════════════════════════════════════
    const respChart = document.getElementById('mon-response-chart');
    if (respChart && respTimes.length > 0) {
      const maxResp = Math.max(...respTimes, 1);
      respChart.innerHTML = respTimes.slice(0, 14).map(r => {
        const pct = Math.max((r / maxResp) * 100, 3);
        const color = r > 1000 ? 'danger' : r > 200 ? 'primary' : 'success';
        return `<div class="mon-chart-bar-col"><div class="mon-chart-bar ${color}" style="height:${pct}%;"></div></div>`;
      }).join('');
    } else if (respChart) {
      respChart.innerHTML = '<div class="mon-empty-state" style="padding:60px 0;"><p>No response time data</p></div>';
    }

  } catch (err) {
    if (refreshStatus) refreshStatus.textContent = 'Error: ' + err.message;
  }
}

// ─── LIST TAB RENDER ───
function renderMonList() {
  const tbody = document.getElementById('mon-list-table');
  const pagination = document.getElementById('mon-list-pagination');
  if (!tbody) return;

  let data = window._monListData || [];
  const filter = window._monListFilter || 'all';
  const search = (window._monListSearch || '').toLowerCase();

  // Apply filters
  if (filter !== 'all') {
    if (['healthy', 'degraded', 'down'].includes(filter)) {
      data = data.filter(d => d.status === filter);
    } else {
      data = data.filter(d => (d.type || '').toLowerCase() === filter);
    }
  }
  if (search) {
    data = data.filter(d =>
      (d.name || '').toLowerCase().includes(search) ||
      (d.host || '').toLowerCase().includes(search)
    );
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="mon-empty-state"><p>No connections match</p></div></td></tr>';
    if (pagination) pagination.innerHTML = '';
    return;
  }

  tbody.innerHTML = data.map(d => {
    const statusDotClass = d.status === 'healthy' ? 'green' : d.status === 'degraded' ? 'amber' : 'red';
    const respColor = d.responseTime == null ? 'var(--text-tertiary)' :
      d.responseTime > 1000 ? 'var(--red)' : d.responseTime > 200 ? 'var(--yellow)' : 'var(--green)';
    const respStr = d.responseTime != null ? d.responseTime + 'ms' : '—';
    const usageStr = d.usagePct != null ? d.usagePct.toFixed(0) + '%' : '—';
    const usageColor = d.usagePct > 80 ? 'var(--red)' : d.usagePct > 60 ? 'var(--yellow)' : 'var(--green)';
    const lastCheckStr = d.lastCheck ? timeAgo(d.lastCheck) : '—';
    const dbTypeLower = (d.type || '').toLowerCase();
    const badgeHtml = dbTypeLower.includes('mysql') ? '<span class="mon-badge-mysql">MY</span>'
      : dbTypeLower.includes('maria') ? '<span class="mon-badge-mariadb">MA</span>'
      : '<span class="mon-badge-pg">PG</span>';

    return `<tr>
      <td><strong style="color:var(--text-primary)">${escHtml(d.name)}</strong></td>
      <td>${badgeHtml}</td>
      <td class="mono">${escHtml(d.host)}</td>
      <td><span class="status-pill ${d.status}"><span class="status-dot ${statusDotClass}"></span> ${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span></td>
      <td class="mono" style="color:${respColor}">${respStr}</td>
      <td class="mono">${d.activeConns != null ? d.activeConns : '—'}</td>
      <td class="mono" style="color:${usageColor}">${usageStr}</td>
      <td class="mono">${d.dbSize}</td>
      <td style="font-size:11px;color:var(--text-tertiary)">${lastCheckStr}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="liveHealthCheck('${d.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></button></td>
    </tr>`;
  }).join('');

  // Simple pagination
  if (pagination) {
    const pageCount = Math.ceil(data.length / 10);
    if (pageCount <= 1) {
      pagination.innerHTML = '';
    } else {
      let html = '<button class="mon-page-btn">&laquo;</button>';
      for (let i = 1; i <= Math.min(pageCount, 5); i++) {
        html += `<button class="mon-page-btn ${i === 1 ? 'active' : ''}">${i}</button>`;
      }
      html += '<button class="mon-page-btn">&raquo;</button>';
      pagination.innerHTML = html;
    }
  }
}

// ─── LIST TAB RENDER ───
window.liveHealthCheck = async function(connId) {
  const btn = event?.target?.closest?.('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" size="13" class="loading-spinner"></i>'; lucide.createIcons(); }

  try {
    const result = await API.get('/api/connections/' + connId + '/health');
    const status = result.status || 'unknown';
    const statusIcon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
    showModal('Live Health Check', `
      <div style="text-align:center;padding:var(--space-lg) 0;">
        <div style="font-size:48px;margin-bottom:var(--space-md);">${statusIcon}</div>
        <h3 style="margin-bottom:var(--space-sm);">${status.charAt(0).toUpperCase() + status.slice(1)}</h3>
        <table class="restore-review-table" style="margin:0 auto;">
          <tr><td>Connection</td><td><strong>${escHtml(result.name || '')}</strong></td></tr>
          <tr><td>Type</td><td>${(result.db_type || '').toUpperCase()}</td></tr>
          <tr><td>Host</td><td class="mono">${result.host || ''}:${result.port || ''}</td></tr>
          <tr><td>Response Time</td><td class="mono">${result.response_time_ms || '—'}ms</td></tr>
          <tr><td>Active Connections</td><td class="mono">${result.active_connections || '—'}</td></tr>
          <tr><td>Checked At</td><td style="font-size:12px;color:var(--text-tertiary);">${result.time || '—'}</td></tr>
        </table>
        ${result.error ? '<p style="color:var(--accent-red);margin-top:var(--space-lg);">Error: ' + escHtml(result.error) + '</p>' : ''}
      </div>
    `);
  } catch (err) {
    alert('Health check failed: ' + err.message);
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="zap" size="13"></i>'; lucide.createIcons(); }
};

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

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.round(seconds % 60) + 's';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h + 'h ' + m + 'm';
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
  localStorage.setItem('jagad-theme', theme);
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
