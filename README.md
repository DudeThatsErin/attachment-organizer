# Attachment Organizer for Obsidian

A comprehensive plugin that helps you organize, manage, and clean up attachments — plus create structured markdown and PDF files with OCR capabilities in your Obsidian vault.

<img width="1584" height="1680" alt="image" src="https://github.com/user-attachments/assets/99db5692-b9c5-4541-8016-ed07d07a757e" />

<img width="1620" height="1740" alt="image" src="https://github.com/user-attachments/assets/2c115120-8244-4dfe-bdc0-21ac9870ed74" />

<img width="1542" height="1650" alt="image" src="https://github.com/user-attachments/assets/38ce4001-2407-40da-91ba-e5b1caa66599" />


## 🚀 Features

### 📁 Attachment Management
- **Organize Attachments**: Automatically move all attachments into a designated folder or subfolders (by date, type, or custom pattern)
- **Custom Patterns**: Use tokens like `{{year}}`, `{{month}}`, `{{type}}`, `{{basename}}` to define folder structure
- **Attachment Recognition**: Configurable file extensions define what counts as an attachment
- **Ignore Folder Rules**: Skip folders when organizing or detecting unlinked files

### 🧹 Attachment Cleanup
- **Find Unlinked Attachments**: Identify files not linked from any note
- **Purge Unlinked Attachments**: Delete unlinked attachments safely — select all, none, or individual files via checkboxes, then confirm before anything is deleted
- **Clean Empty Folders**: Automatically delete empty folders after purging (optional)

### 🔍 OCR (Optical Character Recognition)
- **Extract Text from Images**: Automatically extract text from image attachments (PNG, JPG, JPEG, WEBP, BMP, GIF)
- **PDF Text Extraction**: Extract text content from PDF files
- **Automatic Processing**: OCR runs automatically when images/PDFs are added to your vault
- **Organized Output**: Extracted text is saved in a dedicated `ocr` subfolder within your attachments directory
- **Markdown Format**: OCR results are saved as [.md](cci:7://file:///f:/Erin%27s%20Cortex/.obsidian/themes/Moonstone/README.md:0:0-0:0) files with the same name as the source file

### 📦 Batch Operations
- **Move Attachments Between Folders**: Easily relocate files in bulk
- **Path Verification**: Ensures folders exist before file movement

## Installation

### 📦 Obsidian Plugin Store (Pending Approval)

You'll soon be able to find it directly in the Community Plugins browser.

### 🧪 Using BRAT (Beta Reviewer's Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Open BRAT settings
3. Click **Add Beta Plugin**
4. Enter: `DudeThatsErin/attachment-organizer`
5. Click **Add Plugin**
6. Enable "Attachment Organizer" in Community Plugins settings

## 📘 Usage

### 🔄 Organizing Attachments

1. Go to **Settings > Attachment Organizer**
2. Set your preferred attachment folder, organization mode (e.g., by date), and file types
3. Run the "Organize Attachments" command from the Command Palette (Ctrl/Cmd+P)

### 🔍 Finding Unlinked Attachments

1. Run "Find Unlinked Attachments" from the Command Palette
2. Review a list of unlinked files in the console/logs

### 🗑 Purging Unlinked Attachments

1. Run "Purge Unlinked Attachments" from the Command Palette
2. A modal opens listing all unlinked attachments with checkboxes (all selected by default)
3. Use **Select All** / **Select None** to bulk-toggle, or check/uncheck individual files
4. Click **Delete Selected** to proceed to a confirmation step
5. Review the final list and click **Delete** to permanently remove the files, or **← Back** to revise your selection
6. Click **Cancel** at any point to abort without deleting anything

### 🚚 Moving Attachments

1. Run "Move Attachments Between Folders"
2. Enter source and destination folder paths
3. Review and confirm the move

### 🔍 Using OCR Features

#### Automatic OCR Processing
- **Enable OCR**: Go to **Settings > Attachment Organizer** and toggle "Enable OCR Processing"
- **Automatic Processing**: When you add images or PDFs to your vault, OCR will automatically run
- **Find Results**: Extracted text files are saved in `[your-attachment-folder]/ocr/`

#### Manual OCR Processing
1. Run "Process OCR for All Images" from the Command Palette to process existing images
2. Run "Process OCR for All PDFs" to process existing PDF files
3. Individual files can be processed by running "Process OCR for Current File" while viewing an image/PDF

#### OCR Output Format
- **File Naming**: `original-filename.md` (e.g., `screenshot.png` → `screenshot.md`)
- **Content Structure**: 
  ```markdown
  # OCR Results for [filename]
  
  **Source File**: [path/to/original/file]
  **Processed**: [timestamp]
  
  ## Extracted Text
  
  [extracted text content here]
  ```
#### Supported File Types for OCR

- **Images:** PNG, JPG, JPEG, WEBP, BMP, GIF
- **Documents:** PDF files

#### ✍️ Creating Files (Markdown / PDF)

1. Use the ribbon icon or run "Create: Markdown File" or "Create: PDF File"
2. Fill out:
    - File name
    - Date prefix/suffix option
    - Target folder (dropdown)
    - Template (dropdown or none)
3. Click "Create" — your file is saved and ready


#### ⚙️ Configuration

Customize all behavior in Settings > Attachment Organizer:

- Attachment Folder: Where attachments are stored
- Attachment Extensions: File types considered as attachments
- Ignore Folders: Folders to skip during organizing/purging
- Ignore Folders During File Creation: Folders to exclude from file creation
- Auto-Organize Mode: none, date, type, custom
- Custom Folder Pattern: {{year}}/{{month}}/{{type}}
- Templates Folder: For markdown/pdf generation
- Enable OCR Processing: Toggle automatic OCR for new files
- OCR Output Folder: Subfolder within attachments for OCR results (default: ocr)

  
## Support

- 💬 [Discord Support](https://discord.gg/XcJWhE3SEA) - Fastest support
- 🐛 [Report Issues](https://github.com/DudeThatsErin/AttachmentOrganizer/issues)
- ⭐ [Star on GitHub](https://github.com/DudeThatsErin/AttachmentOrganizer)
- ☕ [Buy Me a Coffee](https://buymeacoffee.com/erinskidds)


