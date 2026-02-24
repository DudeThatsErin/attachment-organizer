# Attachment Organizer for Obsidian

> **Note:** Due to disagreements between myself and the Obsidian Team and the way things are ran there - I am no longer maintaining this plugin. Hence the archive. I am willing to send this over to a new maintainer if one would wish to take over development/maintenance.

A comprehensive plugin that helps you organize, manage, and clean up attachments – plus create structured markdown and PDF files with OCR capabilities in your Obsidian vault.

## Features

- Automatically moves attachments to a designated folder on load and at configurable intervals
- Shows a confirmation modal on first run
- Organize attachments by the note that links to them
- Configurable attachment extensions
- Excluded folders support (auto-reads `.gitignore` and `.stignore`)
- Manual organize command
- Browse vault folders via picker modal

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Place them in `.obsidian/plugins/attachment-organizer/` in your vault
3. Enable the plugin in Obsidian settings

## Settings

- **Attachment folder** – where attachments are moved (default: `_Attachments`)
- **Auto-organize interval** – how often to run automatically (minutes, 0 to disable)
- **Organize on app load** – run on Obsidian startup
- **Organize by note** – place attachments in subfolders named after the linking note
- **Excluded folders** – folders to skip when scanning

## License

MIT License — see [LICENSE](LICENSE)
