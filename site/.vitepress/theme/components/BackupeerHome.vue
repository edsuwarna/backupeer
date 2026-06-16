<template>
  <div class="bp-home">
    <!-- Nav -->
    <nav class="bp-nav">
      <div class="bp-nav-inner">
        <div class="bp-nav-left">
          <a href="/" class="bp-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="1" y="1" width="30" height="30" rx="7" fill="#12131c" stroke="#23263a" stroke-width="0.5"/>
              <path d="M8 12h16v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V12z" fill="rgba(94,106,210,0.2)" stroke="#5E6AD2" stroke-width="1.2"/>
              <path d="M12 8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4h-8V8z" fill="rgba(94,106,210,0.3)" stroke="#5E6AD2" stroke-width="1.2"/>
              <path d="M14 20l2 2 4-4" stroke="#5E6AD2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="bp-logo-text">Backupeer</span>
          </a>
          <div class="bp-nav-links">
            <a href="#features">Features</a>
            <a href="/architecture/overview">Architecture</a>
            <a href="/guide/getting-started">Docs</a>
            <a href="https://github.com/edsuwarna/backupeer" target="_blank">GitHub</a>
          </div>
        </div>
        <div class="bp-nav-right">
          <a href="/guide/getting-started" class="bp-btn bp-btn-primary">Get Started</a>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="bp-hero">
      <div class="bp-hero-bg"></div>
      <div class="bp-hero-inner">
        <div class="bp-hero-content">
          <span class="bp-hero-badge">Open Source</span>
          <h1 class="bp-hero-title">
            Database backups<br>
            <span class="text-accent">you can trust.</span>
          </h1>
          <p class="bp-hero-sub">
            Full &amp; incremental backups for PostgreSQL, MySQL, and MariaDB —<br>
            streamed directly to S3/R2 with zero disk overhead.
          </p>
          <div class="bp-hero-actions">
            <a href="/guide/getting-started" class="bp-btn bp-btn-primary bp-btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
              Get Started
            </a>
            <a href="https://github.com/edsuwarna/backupeer" target="_blank" class="bp-btn bp-btn-ghost bp-btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              View on GitHub
            </a>
          </div>
        </div>
        <div class="bp-hero-visual">
          <div class="bp-pipeline-card">
            <div class="bp-pipeline-header">
              <span class="bp-pipeline-title">backup_prod_db.sh</span>
              <span class="bp-pipeline-status">Running</span>
            </div>
            <div class="bp-pipeline-body">
              <div class="bp-pipe-node">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                <span>pg_dump</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c626e" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <div class="bp-pipe-node accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                <span>gzip</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c626e" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <div class="bp-pipe-node">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>encrypt</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5c626e" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <div class="bp-pipe-node target">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>S3</span>
              </div>
            </div>
            <div class="bp-pipeline-meta">
              <span>~64KB memory &middot; 0 temp files</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="bp-section bp-stats-bar">
      <div class="bp-stat-item">
        <span class="bp-stat-value">3</span>
        <span class="bp-stat-label">Supported Databases</span>
      </div>
      <div class="bp-stat-divider"></div>
      <div class="bp-stat-item">
        <span class="bp-stat-value">∞</span>
        <span class="bp-stat-label">Unlimited Backup Size</span>
      </div>
      <div class="bp-stat-divider"></div>
      <div class="bp-stat-item">
        <span class="bp-stat-value">~64KB</span>
        <span class="bp-stat-label">Peak Memory Usage</span>
      </div>
      <div class="bp-stat-divider"></div>
      <div class="bp-stat-item">
        <span class="bp-stat-value">WAL</span>
        <span class="bp-stat-label">Incremental Engine</span>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="bp-section">
      <div class="bp-section-header">
        <h2>Everything you need for<br><span class="text-accent">database backup management</span></h2>
      </div>
      <div class="bp-features-grid">
        <div class="bp-feature-card" v-for="f in features" :key="f.title">
          <div class="bp-f-icon" v-html="f.icon"></div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Supported Tech -->
    <section class="bp-section bp-tech-section">
      <div class="bp-section-header">
        <h2>Supported <span class="text-accent">Databases &amp; Storage</span></h2>
      </div>
      <div class="bp-tech-grid">
        <div class="bp-tech-pill" v-for="t in techs" :key="t.name">
          <div class="bp-pill-icon" v-html="t.icon"></div>
          <span>{{ t.name }}</span>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="bp-section bp-how-section">
      <div class="bp-section-header">
        <h2>From connection to backup<br><span class="text-accent">in three steps</span></h2>
      </div>
      <div class="bp-steps">
        <div class="bp-step" v-for="(s, i) in steps" :key="s.title">
          <div class="bp-step-num">{{ i + 1 }}</div>
          <h3>{{ s.title }}</h3>
          <p>{{ s.desc }}</p>
        </div>
        <div class="bp-step-connector" v-for="i in [0,1]" :key="'c'+i">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5c626e" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    </section>

    <!-- Architecture -->
    <section class="bp-section bp-arch-section">
      <div class="bp-section-header">
        <h2>Streaming pipeline<br><span class="text-accent">architecture</span></h2>
      </div>
      <div class="bp-arch-diagram">
        <div class="bp-arch-arrow-flow">
          <span class="bp-arch-step">pg_dump</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span class="bp-arch-step">gzip</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span class="bp-arch-step">encrypt</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <span class="bp-arch-step target">S3</span>
        </div>
        <p class="bp-arch-desc">Unlike traditional backup tools that dump to disk, Backupeer uses a pure streaming pipeline — all connected via <code>io.Pipe</code> with under 64KB of memory. No OOM risk. No disk space contention.</p>
      </div>
    </section>

    <!-- CLI Install -->
    <section class="bp-section bp-code-section">
      <div class="bp-section-header">
        <h2>One command to <span class="text-accent">install</span></h2>
      </div>
      <div class="bp-code-block">
        <div class="bp-code-header">
          <span>Copy &amp; paste in your terminal</span>
          <button class="bp-copy-btn" @click="copyCode">{{ copied ? 'Copied!' : 'Copy' }}</button>
        </div>
        <pre><code>curl -fsSL https://github.com/edsuwarna/backupeer/releases/latest/download/install.sh | bash</code></pre>
      </div>
      <p class="bp-code-footnote">Or <a href="/guide/installation" class="text-accent">install via Docker</a> &mdash; no dependencies needed.</p>
    </section>

    <!-- CTA -->
    <section class="bp-cta">
      <div class="bp-cta-card">
        <h2>Ready to secure your databases?</h2>
        <p>Self-hosted, open source, and built to last.</p>
        <div class="bp-cta-actions">
          <a href="/guide/getting-started" class="bp-btn bp-btn-primary bp-btn-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
            Get Started
          </a>
          <a href="https://github.com/edsuwarna/backupeer" target="_blank" class="bp-btn bp-btn-ghost bp-btn-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            Star on GitHub
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bp-footer">
      <div class="bp-footer-inner">
        <div class="bp-footer-col">
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="/architecture/overview">Architecture</a>
          <a href="/guide/getting-started">Documentation</a>
        </div>
        <div class="bp-footer-col">
          <h4>Resources</h4>
          <a href="/reference/cli">CLI Reference</a>
          <a href="/reference/api">API Reference</a>
          <a href="/guide/installation">Installation</a>
        </div>
        <div class="bp-footer-col">
          <h4>Community</h4>
          <a href="https://github.com/edsuwarna/backupeer/issues">Issues</a>
          <a href="https://github.com/edsuwarna/backupeer">GitHub</a>
          <a href="/about/contributing">Contributing</a>
        </div>
      </div>
      <div class="bp-footer-bottom">
        <p>Released under the Apache 2.0 License &mdash; &copy; 2026 Endang Suwarna</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const copied = ref(false)

function copyCode() {
  const code = 'curl -fsSL https://github.com/edsuwarna/backupeer/releases/latest/download/install.sh | bash'
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

const features = [
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    title: 'Streaming Pipeline',
    desc: 'Process databases of any size with just ~64KB memory. No temp files, no disk spooling.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    title: 'Multiple Databases',
    desc: 'Full support for PostgreSQL (pg_dump + WAL-G), MySQL, and MariaDB with native tooling.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
    title: 'Incremental Backup',
    desc: 'WAL-based incrementals for PostgreSQL, page-level tracking for MySQL/MariaDB via XtraBackup.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    title: 'S3 & R2 Storage',
    desc: 'Any S3-compatible object storage — AWS S3, Cloudflare R2, MinIO, DO Spaces, Backblaze B2.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    title: 'End-to-End Encryption',
    desc: 'AES-256-GCM with streaming chunk-level framing, counter-based nonces, and auth tags.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    title: 'Beautiful Web UI',
    desc: 'Dashboard with real-time metrics, backup history, schedule management, and restore workflows.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    title: 'Smart Scheduling',
    desc: 'Cron-based scheduling with adaptive retention policies. Full + incremental rotation.'
  },
  {
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    title: 'Multi-Channel Alerts',
    desc: 'Notifications via Telegram, Discord, Slack, email, or custom webhooks on backup events.'
  },
]

const techs = [
  { name: 'PostgreSQL', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
  { name: 'MySQL', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
  { name: 'MariaDB', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>' },
  { name: 'AWS S3', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
  { name: 'Cloudflare R2', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
  { name: 'MinIO', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
  { name: 'Backblaze B2', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6AD2" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
]

const steps = [
  { title: 'Connect', desc: 'Add your database connection — PostgreSQL, MySQL, or MariaDB. Backupeer auto-detects your schema.' },
  { title: 'Configure', desc: 'Choose full or incremental backup, set a cron schedule, configure retention policy, and pick your storage.' },
  { title: 'Backup & Restore', desc: 'Backups run automatically on schedule. Monitor via the web UI and restore with a single click.' },
]
</script>

<style scoped>
/* ══════════════════════════════════════════════
   Backupeer Home — Dark Theme
   ══════════════════════════════════════════════ */
* { margin: 0; padding: 0; box-sizing: border-box; }

.bp-home {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0b0d11;
  color: #e8eaed;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
}

.text-accent { color: #5E6AD2; }
a.text-accent { color: #5E6AD2; font-weight: 500; text-decoration: none; }
a.text-accent:hover { color: #828DFF; }

/* ─── NAV ─── */
.bp-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(11,13,17,0.85); backdrop-filter: blur(12px);
  border-bottom: 1px solid #23263a;
}
.bp-nav-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; height: 64px; justify-content: space-between;
}
.bp-nav-left { display: flex; align-items: center; gap: 36px; }
.bp-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: #e8eaed; text-decoration: none; letter-spacing: -0.3px; }
.bp-logo svg { flex-shrink: 0; }
.bp-nav-links { display: flex; gap: 28px; }
.bp-nav-links a { color: #9aa0a8; font-size: 14px; font-weight: 500; text-decoration: none; transition: color 0.2s; }
.bp-nav-links a:hover { color: #e8eaed; }
.bp-nav-right { display: flex; align-items: center; gap: 12px; }

/* ─── BUTTONS ─── */
.bp-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: inherit; font-size: 14px; font-weight: 500;
  padding: 10px 20px; border-radius: 8px;
  border: none; cursor: pointer; text-decoration: none;
  transition: all 0.2s;
}
.bp-btn-primary {
  background: #5E6AD2; color: #ffffff;
}
.bp-btn-primary:hover {
  background: #4F5ABF;
}
.bp-btn-ghost {
  background: transparent; color: #e8eaed; border: 1px solid #2a2d3e;
}
.bp-btn-ghost:hover {
  background: rgba(255,255,255,0.05); border-color: #5E6AD2;
}
.bp-btn-lg { padding: 14px 28px; font-size: 15px; border-radius: 10px; }

/* ─── HERO ─── */
.bp-hero {
  padding: 160px 24px 80px; position: relative;
  overflow: hidden;
}
.bp-hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(900px at 80% 20%, rgba(94,106,210,0.10) 0%, transparent 60%),
    radial-gradient(600px at 20% 60%, rgba(94,106,210,0.05) 0%, transparent 50%),
    radial-gradient(800px at 50% 100%, rgba(15,23,42,0.8) 0%, transparent 60%);
  pointer-events: none;
}
.bp-hero-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; gap: 60px;
  position: relative; z-index: 1;
}
.bp-hero-content { flex: 1; min-width: 0; }
.bp-hero-badge {
  display: inline-block; padding: 6px 14px; border-radius: 100px;
  background: rgba(94,106,210,0.10); color: #5E6AD2;
  font-size: 12px; font-weight: 600; letter-spacing: 1px;
  margin-bottom: 20px; border: 1px solid rgba(94,106,210,0.2);
}
.bp-hero-title { font-size: 52px; font-weight: 800; line-height: 1.1; letter-spacing: -1.5px; margin-bottom: 16px; color: #ffffff; }
.bp-hero-sub { font-size: 17px; color: #9aa0a8; margin-bottom: 36px; line-height: 1.7; }
.bp-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }

/* Pipeline Card */
.bp-hero-visual { flex-shrink: 0; }
.bp-pipeline-card {
  background: #12131c; border: 1px solid #23263a; border-radius: 14px;
  padding: 20px; width: 440px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
}
.bp-pipeline-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.bp-pipeline-title { font-size: 13px; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: #9aa0a8; }
.bp-pipeline-status { font-size: 11px; padding: 3px 10px; border-radius: 100px; font-weight: 500; background: rgba(94,106,210,0.12); color: #5E6AD2; }
.bp-pipeline-body { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px 0; }
.bp-pipe-node {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 16px; border-radius: 8px; font-size: 11px;
  font-family: 'JetBrains Mono', monospace; font-weight: 500;
  background: rgba(255,255,255,0.03); border: 1px solid #23263a;
  color: #9aa0a8; min-width: 64px;
}
.bp-pipe-node svg { color: #9aa0a8; }
.bp-pipe-node.accent { background: rgba(94,106,210,0.08); border-color: rgba(94,106,210,0.25); color: #828DFF; }
.bp-pipe-node.accent svg { color: #828DFF; }
.bp-pipe-node.target { background: rgba(94,106,210,0.12); border-color: rgba(94,106,210,0.3); color: #5E6AD2; }
.bp-pipe-node.target svg { color: #5E6AD2; }
.bp-pipeline-meta { text-align: center; font-size: 12px; color: #5c626e; font-family: 'JetBrains Mono', monospace; padding-top: 12px; border-top: 1px solid #1c1f2e; }

/* ─── SECTION BASE ─── */
.bp-section { max-width: 1200px; margin: 0 auto; padding: 80px 24px; }
.bp-section-header { text-align: center; margin-bottom: 48px; }
.bp-section-header h2 { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; }

/* ─── STATS BAR ─── */
.bp-stats-bar {
  display: flex; align-items: center; justify-content: center; gap: 0;
  padding: 48px 24px; max-width: 900px;
}
.bp-stat-item { text-align: center; flex: 1; }
.bp-stat-value { font-size: 36px; font-weight: 700; color: #5E6AD2; line-height: 1.1; margin-bottom: 6px; letter-spacing: -0.3px; }
.bp-stat-label { font-size: 13px; color: #9aa0a8; font-weight: 500; }
.bp-stat-divider { width: 1px; height: 48px; background: #23263a; }

/* ─── FEATURES GRID ─── */
.bp-features-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
}
.bp-feature-card {
  background: #12131c; border: 1px solid #23263a; border-radius: 14px;
  padding: 24px; transition: all 0.25s ease;
}
.bp-feature-card:hover {
  border-color: rgba(94,106,210,0.3);
  box-shadow: 0 0 30px rgba(94,106,210,0.06);
  transform: translateY(-2px);
}
.bp-f-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(94,106,210,0.08); border: 1px solid rgba(94,106,210,0.15);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 14px;
}
.bp-f-icon svg { width: 22px; height: 22px; stroke: #5E6AD2; }
.bp-feature-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #ffffff; }
.bp-feature-card p { font-size: 13.5px; color: #9aa0a8; line-height: 1.6; margin: 0; }

@media (max-width: 1024px) {
  .bp-features-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .bp-features-grid { grid-template-columns: 1fr; }
}

/* ─── TECH SECTION ─── */
.bp-tech-grid { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
.bp-tech-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; border: 1px solid #23263a; border-radius: 10px;
  font-size: 13px; font-weight: 500; color: #9aa0a8;
  background: #12131c; transition: all 0.2s;
}
.bp-tech-pill:hover { border-color: #5E6AD2; color: #5E6AD2; box-shadow: 0 0 20px rgba(94,106,210,0.06); }
.bp-pill-icon { display: flex; align-items: center; }

/* ─── HOW IT WORKS ─── */
.bp-steps {
  display: flex; align-items: flex-start; justify-content: center; gap: 0;
  max-width: 900px; margin: 0 auto;
}
.bp-step {
  text-align: center; flex: 1; padding: 0 20px;
}
.bp-step-num {
  width: 48px; height: 48px; border-radius: 50%;
  background: rgba(94,106,210,0.1); border: 1px solid rgba(94,106,210,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: #5E6AD2;
  margin: 0 auto 16px;
}
.bp-step h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #ffffff; }
.bp-step p { font-size: 14px; color: #9aa0a8; line-height: 1.6; max-width: 280px; margin: 0 auto; }
.bp-step-connector {
  display: flex; align-items: center; padding-top: 14px; flex-shrink: 0;
}

@media (max-width: 768px) {
  .bp-steps { flex-direction: column; align-items: center; gap: 20px; }
  .bp-step-connector { transform: rotate(90deg); padding: 0; }
}

/* ─── ARCHITECTURE ─── */
.bp-arch-section { text-align: center; }
.bp-arch-diagram {
  display: inline-block;
  background: #12131c; border: 1px solid #23263a; border-radius: 14px;
  padding: 40px 48px; max-width: 800px;
}
.bp-arch-arrow-flow {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-bottom: 24px; flex-wrap: wrap;
}
.bp-arch-step {
  padding: 12px 24px; border-radius: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 500;
  background: rgba(255,255,255,0.03); border: 1px solid #23263a;
  color: #9aa0a8;
}
.bp-arch-step.target { background: rgba(94,106,210,0.12); border-color: rgba(94,106,210,0.3); color: #5E6AD2; }
.bp-arch-desc { font-size: 14px; color: #9aa0a8; line-height: 1.7; text-align: left; }
.bp-arch-desc code { color: #5E6AD2; background: rgba(94,106,210,0.08); padding: 2px 6px; border-radius: 4px; font-size: 13px; }

/* ─── CODE BLOCK ─── */
.bp-code-block {
  max-width: 700px; margin: 0 auto;
  background: #12131c; border: 1px solid #23263a; border-radius: 14px;
  overflow: hidden;
}
.bp-code-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid #23263a;
  font-size: 13px; color: #9aa0a8;
}
.bp-copy-btn {
  background: transparent; color: #9aa0a8; border: 1px solid #23263a;
  padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;
  cursor: pointer; font-family: inherit; transition: all 0.2s;
}
.bp-copy-btn:hover { background: rgba(94,106,210,0.1); color: #5E6AD2; border-color: #5E6AD2; }
.bp-code-block pre { margin: 0; padding: 20px; overflow-x: auto; }
.bp-code-block code {
  font-family: 'JetBrains Mono', monospace; font-size: 14px;
  color: #e8eaed; line-height: 1.6;
}
.bp-code-footnote { text-align: center; font-size: 14px; color: #9aa0a8; margin-top: 16px; }

/* ─── CTA ─── */
.bp-cta { padding: 80px 24px 100px; max-width: 1200px; margin: 0 auto; }
.bp-cta-card {
  text-align: center;
  background: linear-gradient(135deg, #12131c, #1a1b2e);
  border: 1px solid rgba(94,106,210,0.15);
  border-radius: 20px; padding: 64px 48px;
  position: relative; overflow: hidden;
}
.bp-cta-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(94,106,210,0.3), transparent);
}
.bp-cta-card h2 { font-size: 32px; font-weight: 700; margin-bottom: 12px; color: #ffffff; }
.bp-cta-card p { font-size: 16px; color: #9aa0a8; margin-bottom: 32px; }
.bp-cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

/* ─── FOOTER ─── */
.bp-footer {
  border-top: 1px solid #23263a; padding: 48px 24px 32px;
}
.bp-footer-inner {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px;
}
.bp-footer-col h4 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #5c626e; margin-bottom: 16px; }
.bp-footer-col a { display: block; color: #9aa0a8; font-size: 14px; text-decoration: none; padding: 4px 0; transition: color 0.2s; }
.bp-footer-col a:hover { color: #5E6AD2; }
.bp-footer-bottom { max-width: 1200px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid #1c1f2e; text-align: center; }
.bp-footer-bottom p { font-size: 13px; color: #5c626e; }

/* ─── RESPONSIVE ─── */
@media (max-width: 900px) {
  .bp-hero-inner { flex-direction: column; text-align: center; }
  .bp-hero-actions { justify-content: center; }
  .bp-hero-visual { width: 100%; }
  .bp-pipeline-card { width: 100%; max-width: 440px; margin: 0 auto; }
  .bp-nav-links { display: none; }
}
@media (max-width: 640px) {
  .bp-hero-title { font-size: 36px; }
  .bp-stats-bar { flex-wrap: wrap; gap: 16px; }
  .bp-stat-item { min-width: 45%; }
  .bp-stat-divider { display: none; }
  .bp-footer-inner { grid-template-columns: 1fr; gap: 32px; }
}
</style>
