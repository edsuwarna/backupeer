---
layout: home

title: Backupeer
titleTemplate: Database Backup Tool

hero:
  name: Backupeer
  text: Database backups you can trust
  tagline: Open-source database backup tool for PostgreSQL, MySQL & MariaDB. Stream directly to S3/R2 with zero disk overhead — full backups, incremental backups, scheduling, and a beautiful Web UI.
  image:
    src: /logo-shield.svg
    alt: Backupeer
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/edsuwarna/backupeer

features:
  - title: Streaming Pipeline
    details: Process databases of any size with just ~64KB memory. No temp files, no disk spooling — dump streams directly through compression and encryption to S3.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>

  - title: Multiple Databases
    details: Full support for PostgreSQL (pg_dump + WAL-G), MySQL (mysqldump + XtraBackup), and MariaDB (mariadb-dump + Mariabackup).
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>

  - title: Incremental Backup
    details: WAL-based incrementals for PostgreSQL, page-level change tracking for MySQL/MariaDB via Percona XtraBackup and Mariabackup.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>

  - title: S3 & R2 Storage
    details: Any S3-compatible object storage — AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2, Google Cloud Storage.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.5l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"/><line x1="9" y1="12" x2="15" y2="12"/></svg>

  - title: End-to-End Encryption
    details: AES-256-GCM encryption with streaming chunk-level framing. Counter-based nonces, authentication tags, and proper EOF marking.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

  - title: Beautiful Web UI
    details: Stripe-inspired dashboard with real-time metrics, backup history, schedule management, connection configuration, and restore workflows.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>

  - title: Smart Scheduling
    details: Cron-based scheduling with adaptive retention policies. Automatic full + incremental rotation based on configurable tiers.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>

  - title: Multi-Channel Alerts
    details: Get notified on backup success, failure, or warnings via Telegram, Discord, Slack, email, or custom webhooks.
    icon:
      svg: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
---

<div class="home-stats">
  <div class="home-stat-card">
    <div class="stat-value">3</div>
    <div class="stat-label">Supported Databases</div>
  </div>
  <div class="home-stat-card">
    <div class="stat-value">∞</div>
    <div class="stat-label">Unlimited Backup Size</div>
  </div>
  <div class="home-stat-card">
    <div class="stat-value">~64KB</div>
    <div class="stat-label">Peak Memory Usage</div>
  </div>
</div>

<div class="home-highlight">
  <div class="home-highlight-card">
    <h3>🏆 Streaming Pipeline Architecture</h3>
    <p>
      Unlike traditional backup tools that dump to disk or buffer in memory, Backupeer uses a
      pure streaming pipeline: <code>pg_dump stdout → gzip → encrypt → S3</code> — all connected via
      <code>io.Pipe</code> with under 64KB of memory. Your largest database backs up just as
      efficiently as your smallest. No OOM risk. No disk space contention. No arbitrary size limits.
    </p>
  </div>
</div>
