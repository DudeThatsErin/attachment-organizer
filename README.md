# Attachment Organizer for Obsidian

A comprehensive plugin that helps you organize, manage, and clean up attachments — plus create structured markdown and PDF files in your Obsidian vault.

---

## 🚀 Features

### 📁 Attachment Management
- **Organize Attachments**: Automatically move all attachments into a designated folder or subfolders (by date, type, or custom pattern)
- **Custom Patterns**: Use tokens like `{{year}}`, `{{month}}`, `{{type}}`, `{{basename}}` to define folder structure
- **Attachment Recognition**: Configurable file extensions define what counts as an attachment
- **Ignore Folder Rules**: Skip folders when organizing or detecting unlinked files

---

### 🧹 Attachment Cleanup
- **Find Unlinked Attachments**: Identify files not linked from any note
- **Purge Unlinked Attachments**: Delete unlinked attachments safely, with confirmation
- **Clean Empty Folders**: Automatically delete empty folders after purging (optional)

---

### 📦 Batch Operations
- **Move Attachments Between Folders**: Easily relocate files in bulk
- **Path Verification**: Ensures folders exist before file movement

---

## 🧩 Installation with BRAT

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian Community Plugins
2. Open BRAT settings
3. Click "Add Beta Plugin"
4. Enter the repository URL: `https://github.com/DudeThatsErin/attachment-organizer`
5. Click "Add Plugin"
6. Go to Community Plugins in Obsidian settings and enable "Attachment Organizer"

---

## 📘 Usage

### 🔄 Organizing Attachments

1. Go to **Settings > Attachment Organizer**
2. Set your preferred attachment folder, organization mode (e.g., by date), and file types
3. Run the "Organize Attachments" command from the Command Palette (Ctrl/Cmd+P)

### 🔍 Finding Unlinked Attachments

1. Run "Find Unlinked Attachments" from the Command Palette
2. Review a list of unlinked files in the console/logs

### 🗑 Purging Unlinked Attachments

1. Run "Purge Unlinked Attachments"
2. Review and confirm the list of files to be deleted

### 🚚 Moving Attachments

1. Run "Move Attachments Between Folders"
2. Enter source and destination folder paths
3. Review and confirm the move

### ✍️ Creating Files (Markdown / PDF)

1. Use the ribbon icon or run "Create: Markdown File" or "Create: PDF File"
2. Fill out:
   - File name
   - Date prefix/suffix option
   - Target folder (dropdown)
   - Template (dropdown or none)
3. Click "Create" — your file is saved and ready

---

## ⚙️ Configuration

Customize all behavior in **Settings > Attachment Organizer**:

- Attachment Folder
- Attachment Extensions
- Ignore Folders (organizing/purging)
- Ignore Folders During File Creation
- Auto-Organize Mode (`none`, `date`, `type`, `custom`)
- Custom Folder Pattern (`{{year}}/{{month}}/{{type}}`)
- Templates Folder for markdown/pdf generation

---

## 🛠 Support

For issues, feature requests, or contributions, visit the [GitHub repository](https://github.com/DudeThatsErin/attachment-organizer).
