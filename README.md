# Attachment Organizer for Obsidian

> *Note 1:* This plugin is being vibe coded. So, if you are not wanting AI code in your vault, please do not use this plugin. Though I am a full time Full Stack Developer so I can validate none of the code is leaking secrets or collecting personal data if that helps you.

> *Note 2:* I am making this plugin for myself. While I accept feature requests, I may not complete them as this plugin is for me, I offer it to anyone in case your brain works like mine. I do not guarantee any support or updates.

A comprehensive plugin that helps you organize, manage, and clean up attachments — rename pasted files automatically — plus extract text from images and PDFs using OCR — all within your Obsidian vault.

## 🚀 Features

### 📁 Attachment Organization
- **Flexible destination**: Move attachments using Obsidian's built-in setting, same folder as the linking note, or a separate named folder
- **Subfolder sorting**: Sort into subfolders by date, file type, or a custom pattern using tokens like `{{year}}`, `{{month}}`, `{{day}}`, `{{type}}`, `{{filename}}`
- **Configurable extensions**: Define exactly which file types count as attachments
- **Ignore rules**: Skip specified folders during organizing or purging
- **Empty folder cleanup**: Folders left empty after organizing are automatically deleted
- **Auto-organize**: Run on startup and/or on a repeating interval

### ✏️ Paste Rename
- Automatically rename files when pasted or dropped into a note
- **Five modes**: do nothing, date-based, custom pattern, ask each time, or date pre-filled + ask to confirm
- **Tokens**: `{{year}}`, `{{month}}`, `{{day}}`, `{{time}}`, `{{type}}`, `{{filename}}` (active note name), `{{original}}` (pasted file's original name)
- Embed links in the note are updated automatically to match the new filename

### 🧹 Attachment Cleanup
- **Find Unlinked Attachments**: Identify attachment files not linked from any note
- **Purge Unlinked Attachments**: Safely delete unlinked attachments — select all, none, or individual files via checkboxes, then confirm before anything is deleted

### 🔍 OCR (Optical Character Recognition)
- Powered by **Google Gemini AI**
- Extract text from images (PNG, JPG, JPEG, WEBP, BMP, GIF, HEIC, HEIF) and PDFs
- Auto-process new files added to a watch folder
- Auto-update OCR notes when source files are modified
- Process files in batches with rate-limit handling and exponential backoff
- Fully customizable prompt and output note template
- Pick any individual file to OCR via command palette

## Installation

### 🧪 Using BRAT (Beta Reviewer's Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Open BRAT settings
3. Click **Add Beta Plugin**
4. Enter: `DudeThatsErin/attachment-organizer`
5. Click **Add Plugin**
6. Enable "Attachment Organizer" in Community Plugins settings

## 📘 Usage

### 🔄 Organizing Attachments

1. Open **Settings > Attachment Organizer > Organization Settings**
2. Set your **Destination**:
   - *Use Obsidian settings* — respects your vault's "Default location for new attachments" setting
   - *Same location as file* — moves attachments to the same folder as the note that links to them
   - *Separate folder* — uses a configured folder name (e.g. `attachments`)
3. Optionally choose **Sort into subfolders by** (none, date, file type, or custom pattern)
4. Run **"Organize attachments"** from the Command Palette (`Ctrl/Cmd+P`)

### ✏️ Paste Rename

1. Open **Settings > Attachment Organizer > Paste Rename Settings**
2. Choose a **Rename mode**:
   - *Do not rename* — default, no change
   - *Date-based* — auto-rename using a date pattern (e.g. `2026-05-04.png`)
   - *Custom pattern* — auto-rename using any token combination
   - *Ask each time* — a prompt appears after each paste so you can type the name
   - *Date-based + ask to confirm* — prompt pre-filled with the date pattern
3. Configure the pattern using tokens: `{{year}}`, `{{month}}`, `{{day}}`, `{{time}}`, `{{type}}`, `{{filename}}` (note name), `{{original}}` (pasted file's original name)

### 🗑 Purging Unlinked Attachments

1. Run **"Purge unlinked attachments"** from the Command Palette
2. A modal lists all unlinked attachments with checkboxes (all selected by default)
3. Use **Select All** / **Select None** to bulk-toggle, or check/uncheck individual files
4. Click **Delete Selected** → review the confirmation list → click **Delete** to permanently remove, or **← Back** to revise
5. Click **Cancel** at any point to abort

### 🔍 Using OCR

#### Setup
1. Open **Settings > Attachment Organizer > OCR Settings**
2. Toggle **Enable OCR** on
3. Paste your [Google AI Studio API key](https://makersuite.google.com/app/apikey)
4. Set the **OCR watch folder** (folder to monitor for new files)
5. Set the **OCR output folder** (where extracted-text notes are saved)

#### Commands
| Command | Description |
|---|---|
| `OCR: Process watch folder` | Batch-process all unprocessed files in the watch folder |
| `OCR: Reprocess all files (force update)` | Re-OCR every file even if a note already exists |
| `OCR: Process current file` | OCR the file currently open in the editor |
| `OCR: Pick attachment to process` | Choose any file in the vault to OCR |
| `OCR: Stop processing` | Halt batch processing after the current file finishes |

#### Output format
Each OCR result is saved as a `.md` note (e.g. `screenshot.png` → `screenshot (OCR).md`) using a customizable template. Default structure:

```markdown
# OCR Result for screenshot.png

**Source:** ![[screenshot.png]]
**Processed:** 2025-01-01T00:00:00.000Z
**Status:** completed

## Extracted Text

[extracted text here]
```

#### Supported file types
Images: PNG, JPG, JPEG, WEBP, BMP, GIF, HEIC, HEIF — Documents: PDF

## ⚙️ Settings Reference

### General Settings
| Setting | Description |
|---|---|
| Attachment extensions | Comma-separated list of extensions treated as attachments |
| Ignore folders | Comma-separated folder paths to skip during organizing or purging |

### Organization Settings
| Setting | Description |
|---|---|
| Destination | *Obsidian settings*, *Same location as file*, or *Separate folder* |
| Default folder name | Folder name used in separate folder mode |
| Sort into subfolders by | None, Date (year/month), File type, or Custom pattern |
| Custom subfolder pattern | Tokens: `{{year}}`, `{{month}}`, `{{day}}`, `{{type}}`, `{{filename}}` |
| Organize on startup | Auto-organize every time Obsidian starts |
| Auto-organize interval | Re-organize on a timer (minutes, 0 = disabled) |

### Paste Rename Settings
| Setting | Description |
|---|---|
| Rename mode | None, Date-based, Custom pattern, Ask each time, or Date + ask |
| Date format pattern | Pattern used for date-based and date+ask modes |
| Custom rename pattern | Pattern used for custom mode |

Available tokens for paste rename patterns:

| Token | Value |
|---|---|
| `{{year}}` | 4-digit year |
| `{{month}}` | 2-digit month |
| `{{day}}` | 2-digit day |
| `{{time}}` | `HHmmss` timestamp |
| `{{type}}` | File extension (e.g. `png`) |
| `{{filename}}` | Name of the active note |
| `{{original}}` | Original pasted filename (without extension) |

### Purge Settings
| Setting | Description |
|---|---|
| Confirm before purging | Show confirmation prompt before deleting unlinked attachments |

### OCR Settings
| Setting | Description |
|---|---|
| Enable OCR | Toggle OCR processing on/off |
| OCR API key | Your Google Gemini API key |
| Gemini model | Model to use (Gemini 2.0 Flash recommended) |
| OCR watch folder | Folder monitored for new images/PDFs |
| OCR output folder | Where OCR notes are saved |

### OCR Processing Settings
| Setting | Description |
|---|---|
| Batch size | Files processed per batch (1 recommended for free tier) |
| Max file size (MB) | Files larger than this are skipped |
| Force reprocess | Re-OCR files even if a note already exists |
| Auto-process new files | OCR files automatically when added to watch folder |
| Auto-process modified files | Re-OCR when a source file is updated |
| OCR processed field | Frontmatter field name used to mark processed files |

### OCR Templates
Customize the prompt sent to Gemini and the output note template. Available template variables: `{{filename}}`, `{{date}}`, `{{status}}`, `{{content}}`.

## Support

- 💬 [Discord Support](https://discord.gg/XcJWhE3SEA) — fastest response
- 🐛 [Report Issues](https://github.com/DudeThatsErin/AttachmentOrganizer/issues)
- ⭐ [Star on GitHub](https://github.com/DudeThatsErin/AttachmentOrganizer)
- ☕ [Buy Me a Coffee](https://buymeacoffee.com/erinskidds)
