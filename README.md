# Attachment Organizer for Obsidian

A comprehensive plugin that automatically organizes attachments into a designated folder in your Obsidian vault, with support for note-based subfolders, configurable intervals, and smart exclusion rules.

## Features

- **Auto-organize on load** - moves attachments when Obsidian starts (with a 3s delay to let vault index)
- **Confirmation modal on first run** - shows exactly what will be moved before doing anything
- **Organize by note** - places attachments in subfolders named after the note that links to them (e.g. an image linked from `2026/01 - January.md` goes to `_Attachments/2026/01 - January/`)
- **Configurable interval** - automatically re-organizes on a schedule (default: every 30 minutes, set to 0 to disable)
- **Reorganize inside attachment folder** - optionally move files already inside the attachment folder
- **Ignore subfolders inside attachment folder** - skip files already in subfolders (all or specific ones)
- **Vault folder picker** - browse and select any vault folder as the attachment destination
- **Attachment subfolder picker** - browse and add specific subfolders to the ignore list
- **Configurable extensions** - full control over which file types are treated as attachments
- **Excluded folders** - skip specific folders when scanning (auto-reads `.gitignore` and `.stignore`)
- **Duplicate handling** - automatically renames files to avoid overwrites (e.g. `image (1).png`)
- **Mobile compatible** - gracefully handles platforms where ignore files aren't accessible

## Commands

| Command | Description |
|---|---|
| `Organize attachments now` | Run organizer with confirmation dialog |
| `Organize attachments (skip confirmation)` | Run organizer immediately, no prompt |

## Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Place them in `.obsidian/plugins/attachment-organizer/` in your vault
3. Enable the plugin in **Settings → Community Plugins**

## Settings

| Setting | Default | Description |
|---|---|---|
| Attachment folder | `_Attachments` | Destination folder for all attachments |
| Auto-organize interval | `30` | Minutes between auto-runs. Set to `0` to disable |
| Organize on app load | `true` | Run automatically when Obsidian starts |
| Organize by note | `false` | Place attachments in subfolders named after linking note |
| Reorganize inside attachment folder | `false` | Allow moving files already in the attachment folder |
| Ignore all subfolders inside attachment folder | `true` | Skip files in any subfolder of the attachment folder |
| Ignored subfolders | _(none)_ | Specific subfolders to ignore (when above is off) |
| Attachment extensions | see below | File types treated as attachments |
| Excluded folders | `.obsidian`, `.trash`, `.git`, `node_modules` | Folders skipped during scanning |

### Default attachment extensions

Images: `png`, `jpg`, `jpeg`, `gif`, `bmp`, `svg`, `webp`, `ico`
Audio: `mp3`, `wav`, `ogg`, `flac`, `m4a`
Video: `mp4`, `webm`, `mov`, `avi`, `mkv`
Documents: `pdf`, `doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`
Archives: `zip`, `rar`, `7z`, `tar`, `gz`
Fonts: `ttf`, `otf`, `woff`, `woff2`
Other: `excalidraw`

## License

MIT License - see [LICENSE](LICENSE)
