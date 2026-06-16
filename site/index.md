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
    icon: 🚀

  - title: Multiple Databases
    details: Full support for PostgreSQL (pg_dump + WAL-G), MySQL (mysqldump + XtraBackup), and MariaDB (mariadb-dump + Mariabackup).
    icon: 🗄️

  - title: Incremental Backup
    details: WAL-based incrementals for PostgreSQL, page-level change tracking for MySQL/MariaDB via Percona XtraBackup and Mariabackup.
    icon: ⏱️

  - title: S3 & R2 Storage
    details: Any S3-compatible object storage — AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2, Google Cloud Storage.
    icon: ☁️

  - title: End-to-End Encryption
    details: AES-256-GCM encryption with streaming chunk-level framing. Counter-based nonces, authentication tags, and proper EOF marking.
    icon: 🔒

  - title: Beautiful Web UI
    details: Stripe-inspired dashboard with real-time metrics, backup history, schedule management, connection configuration, and restore workflows.
    icon: 🖥️

  - title: Smart Scheduling
    details: Cron-based scheduling with adaptive retention policies. Automatic full + incremental rotation based on configurable tiers.
    icon: 📅

  - title: Multi-Channel Alerts
    details: Get notified on backup success, failure, or warnings via Telegram, Discord, Slack, email, or custom webhooks.
    icon: 🔔
---

<!-- Stats -->
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

<!-- Supported Databases -->
<div class="home-tech">
  <h3>Supported Databases & Storage Providers</h3>
  <div class="home-tech-logos">
    <span class="home-tech-badge"><span class="badge-icon">🐘</span> PostgreSQL</span>
    <span class="home-tech-badge"><span class="badge-icon">🐬</span> MySQL</span>
    <span class="home-tech-badge"><span class="badge-icon">🌿</span> MariaDB</span>
    <span class="home-tech-badge"><span class="badge-icon">☁️</span> AWS S3</span>
    <span class="home-tech-badge"><span class="badge-icon">🛡️</span> Cloudflare R2</span>
    <span class="home-tech-badge"><span class="badge-icon">📦</span> MinIO</span>
  </div>
</div>

<!-- Architecture highlight -->
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
