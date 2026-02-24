/*
 * Attachment Organizer Plugin for Obsidian
 * Automatically moves attachments to a designated folder on load and at intervals.
 */

const { Plugin, PluginSettingTab, Setting, Modal, Notice, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
  attachmentFolder: '_Attachments',
  intervalMinutes: 30,
  autoOrganizeOnLoad: true,
  hasConfirmedFirstRun: false,
  attachmentExtensions: [
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico',
    'mp3', 'wav', 'ogg', 'flac', 'm4a',
    'mp4', 'webm', 'mov', 'avi', 'mkv',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', '7z', 'tar', 'gz',
    'ttf', 'otf', 'woff', 'woff2',
    'excalidraw'
  ],
  excludedFolders: ['.obsidian', '.trash', '.git', 'node_modules'],
  organizeByNote: false,
  reorganizeInsideAttachmentFolder: false,
  ignoreAllAttachmentSubfolders: true,
  ignoredAttachmentSubfolders: []
};

class AttachmentOrganizerPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this.intervalId = null;

    await this.loadSettings();

    // Merge ignore files separately so a failure never prevents plugin from loading
    try {
      await this.mergeIgnoreFiles();
    } catch (e) {
      console.warn('Attachment Organizer: Could not merge ignore files (expected on mobile)', e);
    }

    this.addSettingTab(new AttachmentOrganizerSettingTab(this.app, this));

    this.addCommand({
      id: 'organize-attachments-now',
      name: 'Organize attachments now',
      callback: () => this.runOrganizer(true)
    });

    this.addCommand({
      id: 'organize-attachments-force',
      name: 'Organize attachments (skip confirmation)',
      callback: () => this.runOrganizer(false)
    });

    // Run on layout ready (app load)
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.autoOrganizeOnLoad) {
        // Small delay to let vault fully index
        setTimeout(() => this.runOrganizer(true), 3000);
      }
      this.startInterval();
    });
  }

  onunload() {
    this.stopInterval();
  }

  startInterval() {
    this.stopInterval();
    if (this.settings.intervalMinutes > 0) {
      const ms = this.settings.intervalMinutes * 60 * 1000;
      this.intervalId = window.setInterval(() => {
        this.runOrganizer(false);
      }, ms);
      this.registerInterval(this.intervalId);
    }
  }

  stopInterval() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  /**
   * Parse a .gitignore or .stignore file and extract folder/path entries.
   * Uses Obsidian's vault adapter for cross-platform compatibility (desktop + iOS).
   * Returns an array of folder names (without trailing slashes).
   */
  async parseIgnoreFile(fileName) {
    const entries = [];
    try {
      const adapter = this.app.vault.adapter;
      // Guard: adapter.exists/read may not be available on all platforms
      if (!adapter || typeof adapter.exists !== 'function' || typeof adapter.read !== 'function') {
        return entries;
      }
      const fileExists = await adapter.exists(fileName);
      if (!fileExists) return entries;
      const content = await adapter.read(fileName);
      const lines = content.split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        // Skip empty lines, comments, and negation patterns
        if (!line || line.startsWith('#') || line.startsWith('!')) continue;
        // Skip wildcard-only patterns (e.g. *.log) — we only want folder/path names
        if (line.includes('*') || line.includes('?')) continue;
        // Remove trailing slash if present
        const cleaned = line.replace(/\/+$/, '');
        if (cleaned.length > 0) {
          entries.push(cleaned);
        }
      }
    } catch (err) {
      // Silently fail — ignore files may not be accessible on mobile
    }
    return entries;
  }

  /**
   * Read .gitignore and .stignore from the vault root and merge their entries
   * into the excludedFolders setting (without duplicates).
   */
  async mergeIgnoreFiles() {
    try {
      const gitEntries = await this.parseIgnoreFile('.gitignore');
      const stEntries = await this.parseIgnoreFile('.stignore');

      const allIgnored = [...gitEntries, ...stEntries];
      const currentSet = new Set(this.settings.excludedFolders.map(f => f.toLowerCase()));
      let added = false;

      for (const entry of allIgnored) {
        if (!currentSet.has(entry.toLowerCase())) {
          this.settings.excludedFolders.push(entry);
          currentSet.add(entry.toLowerCase());
          added = true;
        }
      }

      if (added) {
        await this.saveSettings();
      }
    } catch (err) {
      // Silently fail — ignore files may not be accessible on mobile
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Normalize attachment folder setting to vault-relative path without leading/trailing slashes.
   */
  getNormalizedAttachmentFolder() {
    const raw = (this.settings.attachmentFolder || '').trim();
    const normalized = normalizePath(raw || '_Attachments');
    return normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  /**
   * True if the file path is exactly the target folder or inside it.
   */
  isInsideAttachmentFolder(filePath, targetFolder) {
    const lowerPath = normalizePath(filePath).toLowerCase().replace(/^\/+/, '');
    const lowerTarget = targetFolder.toLowerCase();
    return lowerPath === lowerTarget || lowerPath.startsWith(lowerTarget + '/');
  }

  /**
   * Return file path relative to attachment folder, or null if not inside.
   */
  getAttachmentRelativePath(filePath, targetFolder) {
    const normalizedPath = normalizePath(filePath).replace(/^\/+/, '');
    if (!this.isInsideAttachmentFolder(normalizedPath, targetFolder)) return null;
    if (normalizedPath.length === targetFolder.length) return '';
    return normalizedPath.slice(targetFolder.length + 1);
  }

  /**
   * True if a file under attachment folder should be ignored from reorganization.
   */
  shouldIgnoreInsideAttachmentFolder(filePath, targetFolder) {
    const relPath = this.getAttachmentRelativePath(filePath, targetFolder);
    if (relPath === null) return false;

    // Only applies to files in subfolders (not root files directly in attachment folder)
    const slashIndex = relPath.lastIndexOf('/');
    if (slashIndex === -1) return false;

    if (this.settings.ignoreAllAttachmentSubfolders) {
      return true;
    }

    const fileSubfolder = relPath.slice(0, slashIndex).toLowerCase();
    const ignored = (this.settings.ignoredAttachmentSubfolders || [])
      .map((f) => normalizePath(f).replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase())
      .filter((f) => f.length > 0);

    return ignored.some((folder) => fileSubfolder === folder || fileSubfolder.startsWith(folder + '/'));
  }

  /**
   * List all subfolders currently present inside the configured attachment folder.
   * Returned paths are relative to the attachment folder.
   */
  getAttachmentSubfolderOptions() {
    const targetFolder = this.getNormalizedAttachmentFolder();
    const lowerTarget = targetFolder.toLowerCase();
    const options = new Set();

    const loaded = this.app.vault.getAllLoadedFiles();
    for (const item of loaded) {
      if (!item || typeof item.path !== 'string') continue;
      // Folder-like entries have children in Obsidian's loaded tree
      if (!Array.isArray(item.children)) continue;

      const normalized = normalizePath(item.path).replace(/^\/+/, '');
      const lower = normalized.toLowerCase();

      if (!lower.startsWith(lowerTarget + '/')) continue;

      const rel = normalized.slice(targetFolder.length + 1).replace(/\/+$/, '');
      if (rel.length > 0) {
        options.add(rel);
      }
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Find all attachment files that are NOT already in the target folder.
   */
  findMisplacedAttachments() {
    const targetFolder = this.getNormalizedAttachmentFolder();
    const extensions = this.settings.attachmentExtensions.map(e => e.toLowerCase());
    const excludedFolders = this.settings.excludedFolders.map(f => normalizePath(f).toLowerCase());
    const files = this.app.vault.getFiles();
    const misplaced = [];

    for (const file of files) {
      const filePath = normalizePath(file.path);
      const filePathLower = filePath.toLowerCase();
      const isInsideAttachmentFolder = this.isInsideAttachmentFolder(filePathLower, targetFolder);

      // Files inside attachment folder are only considered if explicitly enabled
      if (isInsideAttachmentFolder) {
        if (!this.settings.reorganizeInsideAttachmentFolder) {
          continue;
        }
        if (this.shouldIgnoreInsideAttachmentFolder(filePathLower, targetFolder)) {
          continue;
        }
      }

      // Skip files in excluded folders
      let excluded = false;
      for (const ef of excludedFolders) {
        if (filePathLower.startsWith(ef + '/')) {
          excluded = true;
          break;
        }
      }
      if (excluded) continue;

      // Check extension
      const ext = file.extension ? file.extension.toLowerCase() : '';
      if (extensions.includes(ext)) {
        misplaced.push(file);
      }
    }

    return misplaced;
  }

  /**
   * Find the note that links to / embeds the given attachment file.
   * Returns the first referring TFile, or null if none found.
   */
  findReferringNote(attachmentFile) {
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    // resolvedLinks is { [sourcePath]: { [destPath]: linkCount } }
    for (const sourcePath of Object.keys(resolvedLinks)) {
      const links = resolvedLinks[sourcePath];
      if (links && links[attachmentFile.path] !== undefined) {
        const noteFile = this.app.vault.getAbstractFileByPath(sourcePath);
        if (noteFile) return noteFile;
      }
    }
    return null;
  }

  /**
   * Compute the subfolder path based on the referring note.
   * e.g. note at "2026/01/13 - Tuesday.md" → "_Attachments/2026/01/13 - Tuesday/"
   */
  getNoteBasedSubfolder(referringNote) {
    const targetFolder = this.getNormalizedAttachmentFolder();
    // Use the note's full path without extension as the subfolder
    // e.g. "2026/01/13 - Tuesday.md" → "2026/01/13 - Tuesday"
    const notePath = referringNote.path;
    const notePathNoExt = notePath.replace(/\.md$/i, '');
    return normalizePath(targetFolder + '/' + notePathNoExt);
  }

  /**
   * Compute the destination path for a file.
   * If organizeByNote is enabled, places the file in a subfolder named after the referring note.
   */
  getDestinationPath(file) {
    const targetFolder = this.getNormalizedAttachmentFolder();
    const fileName = file.name;

    if (this.settings.organizeByNote) {
      const referringNote = this.findReferringNote(file);
      if (referringNote) {
        const subfolder = this.getNoteBasedSubfolder(referringNote);
        return normalizePath(subfolder + '/' + fileName);
      }
      // organizeByNote is on but no referring note found:
      // if the file is already inside the attachment folder, keep it where it is.
      const filePathLower = normalizePath(file.path).toLowerCase().replace(/^\/+/, '');
      if (this.isInsideAttachmentFolder(filePathLower, targetFolder)) {
        return normalizePath(file.path);
      }
    }

    return normalizePath(targetFolder + '/' + fileName);
  }

  /**
   * Ensure a unique destination path (avoid overwrites).
   */
  async getUniqueDestinationPath(file) {
    let destPath = this.getDestinationPath(file);
    const existing = this.app.vault.getAbstractFileByPath(destPath);
    if (existing && existing.path !== file.path) {
      const baseName = file.basename;
      const ext = file.extension;
      // Extract the folder portion of the destination
      const destFolder = destPath.substring(0, destPath.lastIndexOf('/'));
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(destPath)) {
        destPath = normalizePath(
          destFolder + '/' + baseName + ' (' + counter + ').' + ext
        );
        counter++;
      }
    }
    return destPath;
  }

  /**
   * Build the list of planned moves.
   */
  async buildMoveList() {
    const misplaced = this.findMisplacedAttachments();
    const moves = [];

    for (const file of misplaced) {
      const destPath = await this.getUniqueDestinationPath(file);
      // Don't move if already at destination
      if (normalizePath(file.path) !== normalizePath(destPath)) {
        moves.push({
          file: file,
          from: file.path,
          to: destPath
        });
      }
    }

    return moves;
  }

  /**
   * Execute the moves.
   */
  async executeMoves(moves) {
    // Ensure target folder exists
    const targetFolder = this.getNormalizedAttachmentFolder();
    const folderExists = this.app.vault.getAbstractFileByPath(targetFolder);
    if (!folderExists) {
      await this.app.vault.createFolder(targetFolder);
    }

    let moved = 0;
    let errors = 0;

    for (const move of moves) {
      try {
        // Skip if destination already exists (avoid overwrite errors)
        const destExists = this.app.vault.getAbstractFileByPath(move.to);
        if (destExists) {
          console.log('Attachment Organizer: Skipping ' + move.from + ' — destination already exists: ' + move.to);
          continue;
        }

        // Ensure all subdirectories exist (recursive creation)
        const destDir = move.to.substring(0, move.to.lastIndexOf('/'));
        if (destDir) {
          await this.ensureFolderExists(destDir);
        }

        await this.app.fileManager.renameFile(move.file, move.to);
        moved++;
      } catch (err) {
        console.error('Attachment Organizer: Failed to move ' + move.from + ' -> ' + move.to, err);
        errors++;
      }
    }

    return { moved, errors };
  }

  /**
   * Recursively ensure a folder path exists, creating parent folders as needed.
   */
  async ensureFolderExists(folderPath) {
    const normalized = normalizePath(folderPath);
    if (this.app.vault.getAbstractFileByPath(normalized)) return;

    // Build list of folders to create from deepest to shallowest
    const parts = normalized.split('/');
    const foldersToCreate = [];
    for (let i = parts.length; i > 0; i--) {
      const partial = parts.slice(0, i).join('/');
      if (this.app.vault.getAbstractFileByPath(partial)) break;
      foldersToCreate.unshift(partial);
    }

    for (const folder of foldersToCreate) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        // Folder may have been created by another operation
      }
    }
  }

  /**
   * Main entry point for organizing.
   * @param {boolean} showConfirmation - Whether to show confirmation modal
   */
  async runOrganizer(showConfirmation) {
    const moves = await this.buildMoveList();

    if (moves.length === 0) {
      // Only notify if manually triggered
      if (showConfirmation) {
        new Notice('Attachment Organizer: All attachments are already organized!');
      }
      // Mark first run as confirmed since there's nothing to do
      if (!this.settings.hasConfirmedFirstRun) {
        this.settings.hasConfirmedFirstRun = true;
        await this.saveSettings();
      }
      return;
    }

    // If first run hasn't been confirmed yet, always show confirmation
    if (!this.settings.hasConfirmedFirstRun || showConfirmation) {
      new ConfirmationModal(this.app, this, moves).open();
      return;
    }

    // Auto-move (after first confirmation, on interval)
    const result = await this.executeMoves(moves);
    if (result.moved > 0) {
      new Notice('Attachment Organizer: Moved ' + result.moved + ' file(s).');
    }
    if (result.errors > 0) {
      new Notice('Attachment Organizer: ' + result.errors + ' error(s) occurred. Check console.');
    }
  }
}

/**
 * Modal to browse ALL vault folders and pick one as the attachment folder.
 */
class VaultFolderPickerModal extends Modal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.filterText = '';
    this.options = [];
    this.listEl = null;
  }

  getAllVaultFolders() {
    const folders = [];
    const loaded = this.app.vault.getAllLoadedFiles();
    for (const item of loaded) {
      if (!item || typeof item.path !== 'string') continue;
      if (!Array.isArray(item.children)) continue;
      const normalized = normalizePath(item.path).replace(/^\//,'').replace(/\/$/,'');
      if (normalized.length > 0) {
        folders.push(normalized);
      }
    }
    return folders.sort((a, b) => a.localeCompare(b));
  }

  normalizeForSearch(value) {
    return String(value || '').toLowerCase().replace(/[\s_\-/\\]+/g, '');
  }

  fuzzyMatch(query, candidate) {
    if (!query) return true;
    if (!candidate) return false;
    let q = 0;
    for (let i = 0; i < candidate.length && q < query.length; i++) {
      if (candidate[i] === query[q]) q++;
    }
    return q === query.length;
  }

  optionMatchesFilter(option) {
    const query = this.normalizeForSearch(this.filterText);
    if (!query) return true;
    const norm = this.normalizeForSearch(option);
    return norm.includes(query) || this.fuzzyMatch(query, norm);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Select attachment folder' });
    contentEl.createEl('p', { text: 'Choose any folder in your vault.' });

    const input = contentEl.createEl('input', { type: 'text', placeholder: 'Filter folders...' });
    input.style.width = '100%';
    input.addEventListener('input', () => {
      this.filterText = input.value.trim();
      this.renderList();
    });

    this.listEl = contentEl.createDiv({ cls: 'ao-folder-picker-list' });
    this.options = this.getAllVaultFolders();
    this.renderList();
  }

  renderList() {
    if (!this.listEl) return;
    this.listEl.empty();

    if (this.options.length === 0) {
      this.listEl.createEl('p', { text: 'No folders found in vault.' });
      return;
    }

    const filtered = this.options.filter((option) => this.optionMatchesFilter(option));

    if (filtered.length === 0) {
      this.listEl.createEl('p', { text: 'No matching folders found.' });
      return;
    }

    const ul = this.listEl.createEl('ul');
    for (const option of filtered) {
      const li = ul.createEl('li');
      const btn = li.createEl('button', { text: option });
      btn.addEventListener('click', async () => {
        await this.onPick(option);
        this.close();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal to browse attachment subfolders and pick one.
 */
class AttachmentSubfolderPickerModal extends Modal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.filterText = '';
    this.options = [];
    this.listEl = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select subfolder to ignore' });
    contentEl.createEl('p', { text: 'Choose a subfolder inside your attachment folder.' });

    const input = contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Filter folders...'
    });
    input.style.width = '100%';
    input.addEventListener('input', () => {
      this.filterText = input.value.trim().toLowerCase();
      this.renderList();
    });

    this.listEl = contentEl.createDiv({ cls: 'ao-folder-picker-list' });
    this.options = this.plugin.getAttachmentSubfolderOptions();
    this.renderList();
  }

  normalizeForSearch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s_\-/\\]+/g, '');
  }

  fuzzyMatch(query, candidate) {
    if (!query) return true;
    if (!candidate) return false;

    let q = 0;
    for (let i = 0; i < candidate.length && q < query.length; i++) {
      if (candidate[i] === query[q]) {
        q++;
      }
    }
    return q === query.length;
  }

  optionMatchesFilter(option) {
    const query = this.normalizeForSearch(this.filterText);
    if (!query) return true;

    const attachmentRoot = this.plugin.getNormalizedAttachmentFolder();
    const rel = this.normalizeForSearch(option);
    const full = this.normalizeForSearch(attachmentRoot + '/' + option);

    return (
      rel.includes(query) ||
      full.includes(query) ||
      this.fuzzyMatch(query, rel) ||
      this.fuzzyMatch(query, full)
    );
  }

  renderList() {
    if (!this.listEl) return;
    this.listEl.empty();

    if (this.options.length === 0) {
      const attachmentRoot = this.plugin.getNormalizedAttachmentFolder();
      this.listEl.createEl('p', {
        text: 'No subfolders found under "' + attachmentRoot + '".'
      });
      this.listEl.createEl('p', {
        text: 'Update the Attachment folder setting to the correct path, then reopen this picker.'
      });
      return;
    }

    const filtered = this.options.filter((option) => this.optionMatchesFilter(option));

    if (filtered.length === 0) {
      this.listEl.createEl('p', { text: 'No matching subfolders found.' });
      return;
    }

    const ul = this.listEl.createEl('ul');
    for (const option of filtered) {
      const li = ul.createEl('li');
      const chooseBtn = li.createEl('button', { text: option });
      chooseBtn.addEventListener('click', async () => {
        await this.onPick(option);
        this.close();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Confirmation Modal - shows FROM/TO paths and file list before moving.
 */
class ConfirmationModal extends Modal {
  constructor(app, plugin, moves) {
    super(app);
    this.plugin = plugin;
    this.moves = moves;
  }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass('attachment-organizer-modal');

    contentEl.createEl('h2', { text: 'Organize Attachments' });

    const summary = contentEl.createDiv({ cls: 'ao-summary' });
    summary.createSpan({
      text: this.moves.length + ' attachment(s) will be moved to: '
    });
    summary.createEl('code', { text: this.plugin.settings.attachmentFolder });

    contentEl.createEl('h3', { text: 'Files to move:' });

    const listEl = contentEl.createDiv({ cls: 'ao-file-list' });

    for (const move of this.moves) {
      const item = listEl.createDiv({ cls: 'ao-file-item' });

      const fromLine = item.createDiv({ cls: 'ao-file-from' });
      fromLine.createSpan({ text: 'FROM: ' });
      fromLine.createEl('code', { text: move.from });

      const toLine = item.createDiv({ cls: 'ao-file-to' });
      toLine.createSpan({ text: 'TO: ' });
      toLine.createEl('code', { text: move.to });
    }

    const buttons = contentEl.createDiv({ cls: 'ao-buttons' });

    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = buttons.createEl('button', {
      text: 'Move ' + this.moves.length + ' file(s)',
      cls: 'mod-cta'
    });
    confirmBtn.addEventListener('click', async () => {
      this.close();

      // Mark first run as confirmed
      if (!this.plugin.settings.hasConfirmedFirstRun) {
        this.plugin.settings.hasConfirmedFirstRun = true;
        await this.plugin.saveSettings();
      }

      const result = await this.plugin.executeMoves(this.moves);
      if (result.moved > 0) {
        new Notice('Attachment Organizer: Successfully moved ' + result.moved + ' file(s).');
      }
      if (result.errors > 0) {
        new Notice('Attachment Organizer: ' + result.errors + ' error(s). Check console for details.');
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Settings Tab
 */
class AttachmentOrganizerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('attachment-organizer-settings');

    containerEl.createEl('h2', { text: 'Attachment Organizer Settings' });

    // Attachment destination folder
    let attachmentFolderTextInput;
    new Setting(containerEl)
      .setName('Attachment folder')
      .setDesc('The folder where attachments should be moved to. Relative to vault root.')
      .addText(text => {
        attachmentFolderTextInput = text;
        return text
          .setPlaceholder('_Attachments')
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value.trim() || '_Attachments';
            await this.plugin.saveSettings();
          });
      })
      .addButton(button => button
        .setButtonText('Browse')
        .onClick(() => {
          new VaultFolderPickerModal(this.app, this.plugin, async (pickedFolder) => {
            this.plugin.settings.attachmentFolder = pickedFolder;
            await this.plugin.saveSettings();
            if (attachmentFolderTextInput) {
              attachmentFolderTextInput.setValue(pickedFolder);
            }
          }).open();
        })
      )
      .addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('Reset to default (_Attachments)')
        .onClick(async () => {
          this.plugin.settings.attachmentFolder = '_Attachments';
          await this.plugin.saveSettings();
          if (attachmentFolderTextInput) {
            attachmentFolderTextInput.setValue('_Attachments');
          }
        })
      );

    // Interval
    new Setting(containerEl)
      .setName('Auto-organize interval (minutes)')
      .setDesc('How often to automatically organize attachments. Set to 0 to disable auto-organize on interval.')
      .addText(text => text
        .setPlaceholder('30')
        .setValue(String(this.plugin.settings.intervalMinutes))
        .onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.intervalMinutes = isNaN(num) || num < 0 ? 30 : num;
          await this.plugin.saveSettings();
          this.plugin.startInterval();
        })
      );

    // Auto-organize on load
    new Setting(containerEl)
      .setName('Organize on app load')
      .setDesc('Automatically organize attachments when Obsidian starts.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoOrganizeOnLoad)
        .onChange(async (value) => {
          this.plugin.settings.autoOrganizeOnLoad = value;
          await this.plugin.saveSettings();
        })
      );

    // Organize by note
    new Setting(containerEl)
      .setName('Organize by note')
      .setDesc(
        'Create subfolders based on the note that links to each attachment. ' +
        'For example, an image linked from "2026/01/13 - Tuesday.md" will be placed in ' +
        '"_Attachments/2026/01/13 - Tuesday/". ' +
        'If no referring note is found, the attachment goes into the root attachment folder.'
      )
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.organizeByNote)
        .onChange(async (value) => {
          this.plugin.settings.organizeByNote = value;
          await this.plugin.saveSettings();
        })
      );

    // Reorganize files already in attachment folder
    new Setting(containerEl)
      .setName('Reorganize files inside attachment folder')
      .setDesc('If enabled, files already in the attachment folder can be moved again (for example, when organizing by note).')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.reorganizeInsideAttachmentFolder)
        .onChange(async (value) => {
          this.plugin.settings.reorganizeInsideAttachmentFolder = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.reorganizeInsideAttachmentFolder) {
      new Setting(containerEl)
        .setName('Ignore all subfolders inside attachment folder')
        .setDesc('When enabled, any file already inside any subfolder under the attachment folder is ignored. Root files are still eligible.')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.ignoreAllAttachmentSubfolders)
          .onChange(async (value) => {
            this.plugin.settings.ignoreAllAttachmentSubfolders = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (!this.plugin.settings.ignoreAllAttachmentSubfolders) {
        new Setting(containerEl)
          .setName('Ignored subfolders inside attachment folder')
          .setDesc('Browse and add subfolders (relative to attachment folder) to ignore.')
          .addButton(button => button
            .setButtonText('Browse')
            .onClick(() => {
              new AttachmentSubfolderPickerModal(this.app, this.plugin, async (pickedFolder) => {
                const current = this.plugin.settings.ignoredAttachmentSubfolders || [];
                if (!current.includes(pickedFolder)) {
                  this.plugin.settings.ignoredAttachmentSubfolders = [...current, pickedFolder];
                  await this.plugin.saveSettings();
                  this.display();
                }
              }).open();
            })
          )
          .addExtraButton(button => button
            .setIcon('reset')
            .setTooltip('Clear ignored subfolders')
            .onClick(async () => {
              this.plugin.settings.ignoredAttachmentSubfolders = [];
              await this.plugin.saveSettings();
              this.display();
            })
          );

        const ignoredFolders = (this.plugin.settings.ignoredAttachmentSubfolders || []).slice().sort((a, b) => a.localeCompare(b));
        const ignoredListWrap = containerEl.createDiv({ cls: 'ao-ignored-subfolders' });
        ignoredListWrap.createEl('strong', { text: 'Ignored subfolder list:' });

        if (ignoredFolders.length === 0) {
          ignoredListWrap.createEl('p', { text: 'No ignored subfolders selected yet.' });
        } else {
          const ul = ignoredListWrap.createEl('ul');
          for (const folder of ignoredFolders) {
            const li = ul.createEl('li');
            li.createSpan({ text: folder + ' ' });
            const removeBtn = li.createEl('button', { text: 'Remove' });
            removeBtn.addEventListener('click', async () => {
              this.plugin.settings.ignoredAttachmentSubfolders = (this.plugin.settings.ignoredAttachmentSubfolders || [])
                .filter((f) => f !== folder);
              await this.plugin.saveSettings();
              this.display();
            });
          }
        }
      }
    }

    // File extensions
    new Setting(containerEl)
      .setName('Attachment extensions')
      .setDesc('Comma-separated list of file extensions to treat as attachments.')
      .addTextArea(text => {
        text
          .setPlaceholder('png, jpg, jpeg, gif, pdf, ...')
          .setValue(this.plugin.settings.attachmentExtensions.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.attachmentExtensions = value
              .split(',')
              .map(e => e.trim().toLowerCase().replace(/^\./, ''))
              .filter(e => e.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 3;
        text.inputEl.cols = 50;
      });

    // Excluded folders
    let excludedTextArea;
    new Setting(containerEl)
      .setName('Excluded folders')
      .setDesc('Comma-separated list of folders to exclude from scanning. Automatically includes entries from .gitignore and .stignore.')
      .addTextArea(text => {
        excludedTextArea = text;
        text
          .setPlaceholder('.obsidian, .trash, .git')
          .setValue(this.plugin.settings.excludedFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split(',')
              .map(e => e.trim())
              .filter(e => e.length > 0);
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      })
      .addButton(button => button
        .setButtonText('Refresh from ignore files')
        .onClick(async () => {
          await this.plugin.mergeIgnoreFiles();
          if (excludedTextArea) {
            excludedTextArea.setValue(this.plugin.settings.excludedFolders.join(', '));
          }
          new Notice('Excluded folders refreshed from .gitignore and .stignore.');
        })
      );

    // Reset first-run confirmation
    new Setting(containerEl)
      .setName('Reset first-run confirmation')
      .setDesc('Re-enable the confirmation modal for the next organize run. Useful if you changed the attachment folder.')
      .addButton(button => button
        .setButtonText('Reset')
        .setWarning()
        .onClick(async () => {
          this.plugin.settings.hasConfirmedFirstRun = false;
          await this.plugin.saveSettings();
          new Notice('First-run confirmation has been reset. Next organize will show confirmation.');
        })
      );

    // Manual trigger
    containerEl.createEl('h3', { text: 'Manual Actions' });

    new Setting(containerEl)
      .setName('Organize now')
      .setDesc('Run the attachment organizer immediately with a confirmation dialog.')
      .addButton(button => button
        .setButtonText('Organize Now')
        .setCta()
        .onClick(() => {
          this.plugin.runOrganizer(true);
        })
      );
  }
}

Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttachmentOrganizerPlugin;
