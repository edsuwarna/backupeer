import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Backupeer',
  description: 'Open-source database backup tool — PostgreSQL, MySQL & MariaDB with S3/R2 storage',
  lang: 'en-US',

  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap' }],
    ['link', { rel: 'icon', href: '/favicon.png', type: 'image/png' }],
    ['meta', { name: 'theme-color', content: '#5E6AD2' }],
    ['meta', { property: 'og:title', content: 'Backupeer — Database Backup Tool' }],
    ['meta', { property: 'og:description', content: 'Open-source database backup tool with streaming pipeline, incremental backup, and S3/R2 storage support.' }],
  ],

  appearance: false,

  themeConfig: {
    logo: '/logo-horizontal.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Reference', link: '/reference/cli' },
      { text: 'GitHub', link: 'https://github.com/edsuwarna/backupeer' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/guide/overview' },
            { text: 'Quick Start', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Supported Databases', link: '/guide/supported-databases' },
          ],
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Configuration Guide', link: '/guide/configuration' },
            { text: 'Storage Providers', link: '/guide/storage-providers' },
            { text: 'Scheduling & Retention', link: '/guide/scheduling' },
            { text: 'Notifications', link: '/guide/notifications' },
            { text: 'Encryption', link: '/guide/encryption' },
          ],
        },
        {
          text: 'Operations',
          items: [
            { text: 'Running Backups', link: '/guide/running-backups' },
            { text: 'Restore', link: '/guide/restore' },
            { text: 'Monitoring', link: '/guide/monitoring' },
          ],
        },
      ],

      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI Reference', link: '/reference/cli' },
            { text: 'API Reference', link: '/reference/api' },
            { text: 'Storage Providers', link: '/reference/storage-providers' },
            { text: 'Configuration File', link: '/reference/configuration-file' },
          ],
        },
      ],

      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Streaming Pipeline', link: '/architecture/streaming-pipeline' },
            { text: 'Incremental Backup', link: '/architecture/incremental-backup' },
            { text: 'Security Model', link: '/architecture/security' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/edsuwarna/backupeer' },
    ],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2026 Endang Suwarna',
    },

    editLink: {
      pattern: 'https://github.com/edsuwarna/backupeer/edit/main/site/:path',
    },

    search: {
      provider: 'local',
    },
  },

  vite: {
    css: {
      devSourcemap: true,
    },
  },
})
