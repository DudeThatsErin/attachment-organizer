// === Attachment Organizer Plugin ===

const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, TFolder } = require('obsidian');

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: '',
    autoOrganizeMode: 'date', // 'none', 'date', 'type', 'tag', 'custom'
    customPattern: '{{type}}/{{year}}-{{month}}',
    // OCR Settings
    ocrEnabled: false,
    ocrApiKey: '',
    ocrModel: 'gemini-2.0-flash',
    ocrWatchFolder: 'assets/attachments',
    ocrOutputFolder: 'assets/attachments/ocr',
    ocrAutoProcess: true,
    ocrAutoProcessNewFiles: true,
    ocrAutoProcessModifiedFiles: true,
    ocrProcessedField: 'ocr-processed',
    ocrPrompt: 'Extract all text from this image/document. Provide the text content clearly and accurately.',
    ocrTemplate: '# OCR Result for {{filename}}\n\n**Source:** ![[{{filename}}]]\n**Processed:** {{date}}\n**Status:** {{status}}\n\n## Extracted Text\n\n{{content}}',
    ocrBatchSize: 1,
    ocrMaxFileSize: 10485760, // 10MB in bytes
    ocrForceReprocess: false,
};

class AttachmentOrganizerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        // Settings container
        // Main Settings Section
        containerEl.createEl('h2', { text: 'Attachment Organizer Settings' });

         // Support & Links Section
         this.createAccordionSection(containerEl, 'Support & Links', () => {
            const supportContainer = containerEl.createDiv();
            supportContainer.className = 'support-container';
            
            const buyMeACoffeeBtn = supportContainer.createEl('a', { 
                text: '☕ Buy Me a Coffee',
                href: 'https://buymeacoffee.com/erinskidds'
            });
            buyMeACoffeeBtn.className = 'support-link coffee-link';
            
            const githubBtn = supportContainer.createEl('a', { 
                text: '⭐ Star on GitHub',
                href: 'https://github.com/DudeThatsErin/AttachmentOrganizer'
            });
            githubBtn.className = 'support-link github-link';
            
            const issuesBtn = supportContainer.createEl('a', { 
                text: '🐛 Report Issues',
                href: 'https://github.com/DudeThatsErin/AttachmentOrganizer/issues'
            });
            issuesBtn.className = 'support-link issues-link';
            
            const discordBtn = supportContainer.createEl('a', { 
                text: '💬 Discord Support',
                href: 'https://discord.gg/XcJWhE3SEA'
            });
            discordBtn.className = 'support-link discord-link';
        });

        // Basic Attachment Settings
        this.createAccordionSection(containerEl, 'Basic Settings', () => {
            new Setting(containerEl)
                .setName('Attachment folder')
                .setDesc('The base folder where attachments will be organized')
                .addText(text => text
                    .setPlaceholder('attachments')
                    .setValue(this.plugin.settings.attachmentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentFolder = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Attachment extensions')
                .setDesc('Comma-separated list of file extensions considered as attachments')
                .addText(text => text
                    .setPlaceholder('png,jpg,jpeg,...')
                    .setValue(this.plugin.settings.attachmentExtensions)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentExtensions = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Ignore folders')
                .setDesc('Comma-separated list of folder paths to ignore when organizing or purging')
                .addTextArea(text => text
                    .setPlaceholder('folder1,folder2/subfolder')
                    .setValue(this.plugin.settings.ignoreFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.ignoreFolders = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Show notifications')
                .setDesc('Show notifications before deleting unlinked attachments')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.confirmPurge)
                    .onChange(async (value) => {
                        this.plugin.settings.confirmPurge = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        // Organization settings
        this.createAccordionSection(containerEl, 'Organization settings', () => {
            new Setting(containerEl)
                .setName('Auto-organize mode')
                .setDesc('How attachments should be organized')
                .addDropdown(drop => drop
                    .addOption('none', 'None')
                    .addOption('date', 'By Date')
                    .addOption('type', 'By File Type')
                    .addOption('custom', 'Custom Pattern')
                    .setValue(this.plugin.settings.autoOrganizeMode)
                    .onChange(async (value) => {
                        this.plugin.settings.autoOrganizeMode = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.autoOrganizeMode === 'custom') {
                new Setting(containerEl)
                    .setName('Custom folder pattern')
                    .setDesc('Use {{year}}, {{month}}, {{type}}, {{basename}} in folder structure')
                    .addText(text => text
                        .setPlaceholder('{{type}}/{{year}}-{{month}}')
                        .setValue(this.plugin.settings.customPattern)
                        .onChange(async (value) => {
                            this.plugin.settings.customPattern = value;
                            await this.plugin.saveSettings();
                        }));
            }
        });

        // OCR Settings
        this.createAccordionSection(containerEl, 'OCR Settings', () => {
            const ocrDesc = containerEl.createEl('p', { 
                text: 'Automatically extract text from images and PDFs using Google Gemini AI',
                cls: 'setting-item-description'
            });
            ocrDesc.className = 'ocr-description';

            new Setting(containerEl)
                .setName('Enable OCR')
                .setDesc('Enable automatic OCR processing of images and PDFs')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.ocrEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrEnabled = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.ocrEnabled) {
                new Setting(containerEl)
                    .setName('OCR API key')
                    .setDesc('Get your API key from Google AI Studio (https://makersuite.google.com/app/apikey)')
                    .addText(text => text
                        .setPlaceholder('AIza...')
                        .setValue(this.plugin.settings.ocrApiKey)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrApiKey = value.trim();
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Gemini model')
                    .setDesc('The Gemini model to use for OCR')
                    .addDropdown(drop => drop
                        .addOption('gemini-2.0-flash', 'Gemini 2.0 Flash (Fastest, Recommended)')
                        .addOption('gemini-2.0-flash-lite', 'Gemini 2.0 Flash-Lite (Free tier)')
                        .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
                        .addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
                        .addOption('gemini-2.5-pro-exp-03-25', 'Gemini 2.5 Pro (Experimental)')
                        .setValue(this.plugin.settings.ocrModel)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrModel = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('OCR watch folder')
                    .setDesc('Folder to monitor for images and PDFs to OCR')
                    .addText(text => text
                        .setPlaceholder('assets/attachments')
                        .setValue(this.plugin.settings.ocrWatchFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrWatchFolder = value.trim();
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('OCR output folder')
                    .setDesc('Where to save OCR notes (leave empty to use same folder as source)')
                    .addText(text => text
                        .setPlaceholder('assets/attachments/ocr')
                        .setValue(this.plugin.settings.ocrOutputFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrOutputFolder = value.trim();
                            await this.plugin.saveSettings();
                        }));
            }
        });

        // OCR Processing Settings
        if (this.plugin.settings.ocrEnabled) {
            this.createAccordionSection(containerEl, 'OCR processing settings', () => {
                new Setting(containerEl)
                    .setName('Batch size')
                    .setDesc('Number of files to process in each batch (1 recommended for free tier)')
                    .addSlider(slider => slider
                        .setLimits(1, 5, 1)
                        .setValue(this.plugin.settings.ocrBatchSize)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.ocrBatchSize = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Max file size (MB)')
                    .setDesc('Maximum file size to process (larger files will be skipped)')
                    .addSlider(slider => slider
                        .setLimits(1, 50, 1)
                        .setValue(this.plugin.settings.ocrMaxFileSize / 1024 / 1024)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.ocrMaxFileSize = value * 1024 * 1024;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Force reprocess')
                    .setDesc('Always reprocess files even if OCR already exists (useful for testing)')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrForceReprocess)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrForceReprocess = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Auto-process new files')
                    .setDesc('Automatically OCR new images and PDFs added to the watch folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrAutoProcessNewFiles)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrAutoProcessNewFiles = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Auto-process modified files')
                    .setDesc('Automatically OCR files when they are modified or updated')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrAutoProcessModifiedFiles)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrAutoProcessModifiedFiles = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('OCR processed field')
                    .setDesc('YAML frontmatter field name to mark files as processed')
                    .addText(text => text
                        .setPlaceholder('ocr-processed')
                        .setValue(this.plugin.settings.ocrProcessedField)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrProcessedField = value;
                            await this.plugin.saveSettings();
                        }));
            });

            // OCR Templates Section
            this.createAccordionSection(containerEl, 'OCR templates', () => {
                const ocrPromptSetting = new Setting(containerEl)
                    .setName('OCR prompt')
                    .setDesc('Custom prompt to send to Gemini for OCR processing')
                    .setClass('setting-item-heading');
                
                ocrPromptSetting.settingEl.style.display = 'block';
                const promptTextArea = ocrPromptSetting.settingEl.createEl('textarea');
                promptTextArea.placeholder = 'Extract all text from this image/document...';
                promptTextArea.value = this.plugin.settings.ocrPrompt;
                promptTextArea.rows = 8;
                promptTextArea.className = 'ocr-template-textarea';
                promptTextArea.addEventListener('input', async (e) => {
                    this.plugin.settings.ocrPrompt = e.target.value;
                    await this.plugin.saveSettings();
                });

                const ocrTemplateSetting = new Setting(containerEl)
                    .setName('OCR output template')
                    .setDesc('Template for OCR output notes. Available variables: {{filename}}, {{date}}, {{status}}, {{content}}')
                    .setClass('setting-item-heading');
                
                ocrTemplateSetting.settingEl.style.display = 'block';
                const templateTextArea = ocrTemplateSetting.settingEl.createEl('textarea');
                templateTextArea.placeholder = '# OCR Result for {{filename}}...';
                templateTextArea.value = this.plugin.settings.ocrTemplate;
                templateTextArea.rows = 10;
                templateTextArea.className = 'ocr-template-textarea';
                templateTextArea.addEventListener('input', async (e) => {
                    this.plugin.settings.ocrTemplate = e.target.value;
                    await this.plugin.saveSettings();
                });
            });
        }
    }

    createAccordionSection(containerEl, title, contentCallback) {
        const accordionContainer = containerEl.createDiv('accordion-section');
        
        const header = accordionContainer.createDiv('accordion-header');
        header.className = 'accordion-header';
        
        const headerText = header.createSpan();
        headerText.textContent = title;
        
        const arrow = header.createSpan('accordion-arrow');
        arrow.textContent = '▼';
        arrow.className = 'accordion-arrow';
        
        const content = accordionContainer.createDiv('accordion-content');
        content.className = 'accordion-content';
        
        let isExpanded = true; // Start expanded
        
        const toggleAccordion = () => {
            isExpanded = !isExpanded;
            
            if (isExpanded) {
                content.classList.add('expanded');
                content.classList.remove('collapsed');
                arrow.classList.add('expanded');
                arrow.classList.remove('collapsed');
                header.classList.add('expanded');
                header.classList.remove('collapsed');
            } else {
                content.classList.add('collapsed');
                content.classList.remove('expanded');
                arrow.classList.add('collapsed');
                arrow.classList.remove('expanded');
                header.classList.add('collapsed');
                header.classList.remove('expanded');
            }
        };
        
        header.addEventListener('click', toggleAccordion);
        
        // Hover effects are now handled by CSS
        
        // Call the content callback to populate the accordion
        const tempContainer = containerEl.createDiv();
        const originalContainerEl = containerEl;
        
        // Temporarily redirect new Settings to our temp container
        const originalCreateEl = containerEl.createEl;
        containerEl.createEl = tempContainer.createEl.bind(tempContainer);
        
        contentCallback();
        
        // Restore original createEl
        containerEl.createEl = originalCreateEl;
        
        // Move the settings that were just added to the accordion content
        while (tempContainer.firstChild) {
            content.appendChild(tempContainer.firstChild);
        }
        
        // Remove the temp container
        tempContainer.remove();
    }
}

class OcrPickerModal extends Modal {
    constructor(app, files, onPick) {
        super(app);
        this.files = files;
        this.onPick = onPick;
        this.filterText = '';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'OCR: Pick attachment to process' });
        contentEl.createEl('p', { text: `${this.files.length} OCR-compatible file${this.files.length !== 1 ? 's' : ''} found in vault.`, cls: 'ao-purge-desc' });

        const input = contentEl.createEl('input', { type: 'text', placeholder: 'Filter by filename or path...' });
        input.style.cssText = 'width:100%;margin-bottom:10px;padding:6px 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);';
        input.addEventListener('input', () => {
            this.filterText = input.value.trim().toLowerCase();
            this.renderList(listEl);
        });

        const listEl = contentEl.createDiv({ cls: 'ao-purge-list' });
        this.renderList(listEl);

        const btnRow = contentEl.createDiv({ cls: 'ao-purge-btn-row' });
        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    renderList(listEl) {
        listEl.empty();
        const filtered = this.filterText
            ? this.files.filter(f => f.path.toLowerCase().includes(this.filterText) || f.name.toLowerCase().includes(this.filterText))
            : this.files;

        if (filtered.length === 0) {
            listEl.createEl('p', { text: 'No matching files.', cls: 'ao-purge-desc' });
            return;
        }

        for (const file of filtered) {
            const row = listEl.createDiv({ cls: 'ao-purge-row' });
            row.style.cursor = 'pointer';
            const info = row.createDiv({ cls: 'ao-purge-label' });
            info.createEl('span', { text: file.name, cls: 'ao-purge-name' });
            info.createEl('span', { text: file.path, cls: 'ao-purge-path' });
            row.addEventListener('click', () => {
                this.close();
                this.onPick(file);
            });
            row.addEventListener('mouseenter', () => row.style.background = 'var(--background-modifier-hover)');
            row.addEventListener('mouseleave', () => row.style.background = '');
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

class PurgeUnlinkedModal extends Modal {
    constructor(app, unlinkedFiles, onConfirm) {
        super(app);
        this.unlinkedFiles = unlinkedFiles;
        this.onConfirm = onConfirm;
        this.selected = new Set(unlinkedFiles.map(f => f.path));
        this.confirmStep = false;
    }

    onOpen() {
        this.render();
    }

    render() {
        const { contentEl } = this;
        contentEl.empty();

        if (this.confirmStep) {
            this.renderConfirmStep();
        } else {
            this.renderSelectStep();
        }
    }

    renderSelectStep() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Purge Unlinked Attachments' });
        contentEl.createEl('p', {
            text: `Found ${this.unlinkedFiles.length} unlinked attachment${this.unlinkedFiles.length !== 1 ? 's' : ''}. Select which ones to delete.`,
            cls: 'ao-purge-desc'
        });

        // Select all / none buttons
        const bulkRow = contentEl.createDiv({ cls: 'ao-purge-bulk-row' });
        const selectAllBtn = bulkRow.createEl('button', { text: 'Select All' });
        selectAllBtn.addEventListener('click', () => {
            this.selected = new Set(this.unlinkedFiles.map(f => f.path));
            this.render();
        });
        const selectNoneBtn = bulkRow.createEl('button', { text: 'Select None' });
        selectNoneBtn.addEventListener('click', () => {
            this.selected = new Set();
            this.render();
        });

        const countEl = bulkRow.createSpan({ cls: 'ao-purge-count' });
        countEl.setText(`${this.selected.size} of ${this.unlinkedFiles.length} selected`);

        // File list with checkboxes
        const listEl = contentEl.createDiv({ cls: 'ao-purge-list' });
        for (const file of this.unlinkedFiles) {
            const row = listEl.createDiv({ cls: 'ao-purge-row' });
            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = this.selected.has(file.path);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selected.add(file.path);
                } else {
                    this.selected.delete(file.path);
                }
                countEl.setText(`${this.selected.size} of ${this.unlinkedFiles.length} selected`);
            });
            const label = row.createEl('label', { cls: 'ao-purge-label' });
            label.createEl('span', { text: file.name, cls: 'ao-purge-name' });
            label.createEl('span', { text: file.path, cls: 'ao-purge-path' });
            label.prepend(checkbox);
        }

        // Action buttons
        const btnRow = contentEl.createDiv({ cls: 'ao-purge-btn-row' });

        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const deleteBtn = btnRow.createEl('button', { text: 'Delete Selected', cls: 'mod-warning' });
        deleteBtn.addEventListener('click', () => {
            if (this.selected.size === 0) {
                new Notice('No files selected.');
                return;
            }
            this.confirmStep = true;
            this.render();
        });
    }

    renderConfirmStep() {
        const { contentEl } = this;
        const filesToDelete = this.unlinkedFiles.filter(f => this.selected.has(f.path));

        contentEl.createEl('h2', { text: 'Confirm Deletion' });
        contentEl.createEl('p', {
            text: `You are about to permanently delete ${filesToDelete.length} file${filesToDelete.length !== 1 ? 's' : ''}. This cannot be undone.`,
            cls: 'ao-purge-warning'
        });

        const listEl = contentEl.createDiv({ cls: 'ao-purge-list ao-purge-confirm-list' });
        for (const file of filesToDelete) {
            const row = listEl.createDiv({ cls: 'ao-purge-row' });
            row.createEl('span', { text: '🗑 ', cls: 'ao-purge-icon' });
            const info = row.createDiv({ cls: 'ao-purge-label' });
            info.createEl('span', { text: file.name, cls: 'ao-purge-name' });
            info.createEl('span', { text: file.path, cls: 'ao-purge-path' });
        }

        const btnRow = contentEl.createDiv({ cls: 'ao-purge-btn-row' });

        const backBtn = btnRow.createEl('button', { text: '← Back' });
        backBtn.addEventListener('click', () => {
            this.confirmStep = false;
            this.render();
        });

        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const confirmBtn = btnRow.createEl('button', { text: `Delete ${filesToDelete.length} file${filesToDelete.length !== 1 ? 's' : ''}`, cls: 'mod-warning' });
        confirmBtn.addEventListener('click', async () => {
            this.close();
            await this.onConfirm(filesToDelete);
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

module.exports = class AttachmentOrganizer extends Plugin {
    async onload() {
        console.log('Loading Attachment Organizer plugin');
        
        // Initialize processing tracking
        this.processingFiles = new Set();
        this.processedFiles = new Set();
        this.fileWatchers = []; // Track active watchers for cleanup
        this.ocrStopRequested = false; // Flag to stop OCR processing
        
        await this.loadSettings();

        this.addSettingTab(new AttachmentOrganizerSettingTab(this.app, this));

        // Set up file watchers for automatic OCR processing with recursion prevention
        this.setupFileWatchers();

        this.addCommand({
            id: 'organize-attachments',
            name: 'Organize attachments',
            callback: () => this.organizeAttachments()
        });

        this.addCommand({
            id: 'find-unlinked-attachments',
            name: 'Find unlinked attachments',
            callback: () => this.findUnlinkedAttachments()
        });

        this.addCommand({
            id: 'purge-unlinked-attachments',
            name: 'Purge unlinked attachments',
            callback: () => this.purgeUnlinkedAttachments()
        });

        this.addCommand({
            id: 'move-attachments-between-folders',
            name: 'Move attachments between folders',
            callback: () => this.moveAttachmentsBetweenFolders()
        });

        // OCR Commands
        this.addCommand({
            id: 'ocr-watch-folder',
            name: 'OCR: Process watch folder',
            callback: () => this.ocrWatchFolder()
        });

        this.addCommand({
            id: 'ocr-reprocess-all',
            name: 'OCR: Reprocess all files (force update)',
            callback: () => this.ocrReprocessAll()
        });

        this.addCommand({
            id: 'ocr-current-file',
            name: 'OCR: Process current file',
            checkCallback: (checking) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && this.isOcrTarget(activeFile)) {
                    if (!checking) {
                        this.processFileForOcr(activeFile);
                    }
                    return true;
                }
                return false;
            }
        });

        this.addCommand({
            id: 'ocr-stop-processing',
            name: 'OCR: Stop processing',
            callback: () => this.stopOcrProcessing()
        });

        this.addCommand({
            id: 'ocr-pick-attachment',
            name: 'OCR: Pick attachment to process',
            callback: () => this.ocrPickAttachment()
        });

    }

    onunload() {
        // Clean up any remaining resources
    }

    async organizeAttachments() {
        const files = this.app.vault.getFiles();
        const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
        
        let organized = 0;
        let skipped = 0;

        for (const file of files) {
            if (!attachmentExtensions.includes(file.extension?.toLowerCase())) {
                continue;
            }

            // Skip if file is already in attachment folder or ignored folders
            if (file.path.startsWith(this.settings.attachmentFolder + '/')) {
                continue;
            }

            const ignoreFolders = this.settings.ignoreFolders.split(',').map(f => f.trim()).filter(f => f);
            if (ignoreFolders.some(folder => file.path.startsWith(folder + '/'))) {
                skipped++;
                continue;
            }

            try {
                const newPath = this.getNewAttachmentPath(file);
                if (newPath !== file.path) {
                    await this.ensureFolderExists(newPath.substring(0, newPath.lastIndexOf('/')));
                    await this.app.vault.rename(file, newPath);
                    organized++;
                }
            } catch (error) {
                console.error(`Failed to organize ${file.path}:`, error);
                skipped++;
            }
        }

        new Notice(`Organized ${organized} attachments, skipped ${skipped}`);
    }

    getNewAttachmentPath(file) {
        let targetFolder = this.settings.attachmentFolder;

        if (this.settings.autoOrganizeMode === 'date') {
            const date = new Date(file.stat?.mtime || Date.now());
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            targetFolder = `${this.settings.attachmentFolder}/${year}/${month}`;
        } else if (this.settings.autoOrganizeMode === 'type') {
            const ext = file.extension?.toLowerCase() || 'unknown';
            targetFolder = `${this.settings.attachmentFolder}/${ext}`;
        } else if (this.settings.autoOrganizeMode === 'custom' && this.settings.customPattern) {
            const date = new Date(file.stat?.mtime || Date.now());
            const replacements = {
                '{{type}}': file.extension?.toLowerCase() || 'unknown',
                '{{year}}': date.getFullYear().toString(),
                '{{month}}': String(date.getMonth() + 1).padStart(2, '0'),
                '{{day}}': String(date.getDate()).padStart(2, '0'),
                '{{filename}}': file.basename
            };
            
            targetFolder = this.settings.customPattern;
            for (const [placeholder, value] of Object.entries(replacements)) {
                targetFolder = targetFolder.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            }
        }

        return `${targetFolder}/${file.name}`;
    }

    async findUnlinkedAttachments() {
        const files = this.app.vault.getFiles();
        const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
        const attachments = files.filter(file => attachmentExtensions.includes(file.extension?.toLowerCase()));
        
        const linkedAttachments = new Set();
        const markdownFiles = files.filter(file => file.extension === 'md');

        for (const mdFile of markdownFiles) {
            const content = await this.app.vault.read(mdFile);
            const linkRegex = /\[\[([^\]]+)\]\]|!\[\[([^\]]+)\]\]/g;
            let match;
            
            while ((match = linkRegex.exec(content)) !== null) {
                const linkedFile = match[1] || match[2];
                const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(linkedFile, mdFile.path);
                if (resolvedFile) {
                    linkedAttachments.add(resolvedFile.path);
                }
            }
        }

        const unlinkedAttachments = attachments.filter(file => !linkedAttachments.has(file.path));
        
        if (unlinkedAttachments.length === 0) {
            new Notice('No unlinked attachments found');
            return;
        }

        const list = unlinkedAttachments.map(file => `- ${file.path}`).join('\n');
        const content = `# Unlinked Attachments\n\nFound ${unlinkedAttachments.length} unlinked attachments:\n\n${list}`;
        
        await this.app.workspace.openLinkText('Unlinked Attachments Report', '', true);
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            activeView.editor.setValue(content);
        }
    }

    async getUnlinkedAttachments() {
        const files = this.app.vault.getFiles();
        const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
        const attachments = files.filter(file => attachmentExtensions.includes(file.extension?.toLowerCase()));

        const ignoreFolders = this.settings.ignoreFolders.split(',').map(f => f.trim()).filter(f => f);

        const linkedAttachments = new Set();
        const markdownFiles = files.filter(file => file.extension === 'md');

        for (const mdFile of markdownFiles) {
            const resolvedLinks = this.app.metadataCache.resolvedLinks[mdFile.path] || {};
            for (const destPath of Object.keys(resolvedLinks)) {
                linkedAttachments.add(destPath);
            }
        }

        return attachments.filter(file => {
            if (linkedAttachments.has(file.path)) return false;
            if (ignoreFolders.some(folder => file.path.startsWith(folder + '/'))) return false;
            return true;
        });
    }

    async purgeUnlinkedAttachments() {
        new Notice('Scanning for unlinked attachments...');
        const unlinked = await this.getUnlinkedAttachments();

        if (unlinked.length === 0) {
            new Notice('No unlinked attachments found.');
            return;
        }

        new PurgeUnlinkedModal(this.app, unlinked, async (filesToDelete) => {
            let deleted = 0;
            let failed = 0;
            for (const file of filesToDelete) {
                try {
                    await this.app.vault.trash(file, true);
                    deleted++;
                } catch (error) {
                    console.error(`Failed to delete ${file.path}:`, error);
                    failed++;
                }
            }
            let msg = `Deleted ${deleted} unlinked attachment${deleted !== 1 ? 's' : ''}.`;
            if (failed > 0) msg += ` ${failed} failed — check console.`;
            new Notice(msg);
        }).open();
    }

    async ocrPickAttachment() {
        if (!this.settings.ocrEnabled || !this.settings.ocrApiKey) {
            new Notice('OCR is not enabled or API key is missing. Check settings.');
            return;
        }
        const targets = this.app.vault.getFiles().filter(f => this.isOcrTarget(f));
        if (targets.length === 0) {
            new Notice('No OCR-compatible files found in vault (images/PDFs).');
            return;
        }
        new OcrPickerModal(this.app, targets, async (file) => {
            new Notice(`Starting OCR for ${file.name}...`);
            try {
                const ocrPath = this.getOcrNotePath(file, this.settings.ocrOutputFolder);
                const alreadyExists = await this.app.vault.adapter.exists(ocrPath);
                if (alreadyExists && !this.settings.ocrForceReprocess) {
                    new Notice(`OCR note already exists for ${file.name}. Enable "Force reprocess" in settings to overwrite.`);
                    return;
                }
                if (this.settings.ocrOutputFolder) {
                    await this.ensureFolderExists(this.settings.ocrOutputFolder);
                }
                const fileBuffer = await this.app.vault.readBinary(file);
                const mimeType = this.getMimeType(file.extension);
                const extractedText = await this.callGeminiOCR(fileBuffer, mimeType);
                const noteContent = this.buildOcrNote(file, extractedText, 'completed');
                if (alreadyExists) {
                    const existing = this.app.vault.getAbstractFileByPath(ocrPath);
                    await this.app.vault.modify(existing, noteContent);
                } else {
                    await this.app.vault.create(ocrPath, noteContent);
                }
                new Notice(`OCR complete for ${file.name}`);
            } catch (error) {
                console.error('OCR pick error:', error);
                new Notice(`OCR failed for ${file.name}: ${error.message}`);
            }
        }).open();
    }

    async moveAttachmentsBetweenFolders() {
        new Notice('Move attachments feature not yet implemented');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async ensureFolderExists(folder) {
        const existingFile = this.app.vault.getAbstractFileByPath(folder);
        if (!existingFile) {
            await this.app.vault.createFolder(folder);
        } else if (!(existingFile instanceof TFolder)) {
            throw new Error(`Path exists but is not a folder: ${folder}`);
        }
    }

    // OCR Helper Functions
    isOcrTarget(file) {
        if (!file || !file.extension) return false;
        const ext = file.extension.toLowerCase();
        return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'gif', 'bmp', 'heic', 'heif'].includes(ext);
    }

    getMimeType(extension) {
        const ext = extension.toLowerCase();
        if (ext === 'pdf') return 'application/pdf';
        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
            return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        }
        if (['tif', 'tiff'].includes(ext)) return 'image/tiff';
        if (['heic', 'heif'].includes(ext)) return 'image/heic';
        return null;
    }

    getOcrNotePath(sourceFile, outputFolder) {
        const baseName = sourceFile.basename;
        const folder = outputFolder || sourceFile.parent?.path || '';
        return `${folder}/${baseName} (OCR).md`;
    }

    buildOcrNote(sourceFile, extractedText, status = 'completed') {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0];
        
        const template = this.settings.ocrTemplate || '# OCR Result for {{filename}}\n\n**Source:** ![[{{filename}}]]\n**Processed:** {{date}}\n**Status:** {{status}}\n\n## Extracted Text\n\n{{content}}';
        
        // Replace template variables
        const result = template
            .replace(/\{\{filename\}\}/g, sourceFile.name)
            .replace(/\{\{date\}\}/g, now.toISOString())
            .replace(/\{\{status\}\}/g, status)
            .replace(/\{\{content\}\}/g, extractedText);
        
        return result;
    }

    async callGeminiOCR(fileBuffer, mimeType, retryCount = 0) {
        const apiKey = this.settings.ocrApiKey;
        const model = this.settings.ocrModel;
        const prompt = this.settings.ocrPrompt || 'Extract all text from this image/document. Provide the text content clearly and accurately.';
        
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        // Convert ArrayBuffer to base64 string properly (avoid stack overflow for large files)
        const uint8Array = new Uint8Array(fileBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64String = btoa(binaryString);
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64String
                        }
                    }
                ]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API Error Details:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText,
                    url: url,
                    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'missing',
                    model: model,
                    retryCount: retryCount
                });
                
                if (response.status === 429) {
                    // Parse retry delay from error response
                    let retryDelay = 30; // Default 30 seconds
                    try {
                        const errorData = JSON.parse(errorText);
                        if (errorData.error?.details) {
                            const retryInfo = errorData.error.details.find(d => d['@type']?.includes('RetryInfo'));
                            if (retryInfo?.retryDelay) {
                                retryDelay = parseInt(retryInfo.retryDelay.replace('s', '')) || 30;
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors, use default delay
                    }

                    // Implement exponential backoff with max 3 retries
                    if (retryCount < 3) {
                        const backoffDelay = Math.min(retryDelay * Math.pow(2, retryCount), 300); // Max 5 minutes
                        new Notice(`Rate limit hit. Retrying in ${backoffDelay} seconds... (attempt ${retryCount + 1}/3)`);
                        
                        await new Promise(resolve => setTimeout(resolve, backoffDelay * 1000));
                        return await this.callGeminiOCR(fileBuffer, mimeType, retryCount + 1);
                    } else {
                        new Notice('Gemini API quota exceeded. Try again later or switch to gemini-1.5-flash model.');
                        throw new Error(`API_ERROR_429: Rate limit exceeded after ${retryCount} retries. ${errorText}`);
                    }
                }
                throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
                throw new Error('Invalid response from Gemini API');
            }

            return result.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            if (error.message.includes('API_ERROR_429')) {
                throw error; // Re-throw 429 errors as-is
            }
            throw new Error(`Network or API error: ${error.message}`);
        }
    }

    async processFileForOcr(file) {
        if (!this.settings.ocrEnabled || !this.settings.ocrApiKey) {
            return;
        }

        try {
            // Check if file is in watch folder
            if (!file.path.startsWith(this.settings.ocrWatchFolder + '/') && file.path !== this.settings.ocrWatchFolder) {
                return;
            }

            // Check if it's a target file type
            if (!this.isOcrTarget(file)) {
                return;
            }

            // Check if OCR note already exists
            const ocrPath = this.getOcrNotePath(file, this.settings.ocrOutputFolder);
            if (await this.app.vault.adapter.exists(ocrPath)) {
                return;
            }

            new Notice(`Starting OCR for ${file.name}...`);

            // Ensure output folder exists
            if (this.settings.ocrOutputFolder) {
                await this.ensureFolderExists(this.settings.ocrOutputFolder);
            }

            // Process with Gemini
            const fileBuffer = await this.app.vault.readBinary(file);
            const mimeType = this.getMimeType(file.extension);
            const extractedText = await this.callGeminiOCR(fileBuffer, mimeType);
            
            // Create OCR note
            const noteContent = this.buildOcrNote(file, extractedText, this.settings.ocrProcessedField);
            await this.app.vault.create(ocrPath, noteContent);

            new Notice(`OCR completed for ${file.name}`);
        } catch (error) {
            console.error('OCR processing error:', error);
            new Notice(`OCR failed for ${file.name}: ${error.message}`);
        }
    }

    async ocrWatchFolder() {
        if (!this.settings.ocrEnabled || !this.settings.ocrApiKey) {
            new Notice('OCR is not enabled or API key is missing');
            return;
        }

        // Reset stop flag
        this.ocrStopRequested = false;

        const watchFolder = this.settings.ocrWatchFolder;
        let files = this.app.vault.getFiles().filter(f => 
            (f.path.startsWith(watchFolder + '/') || f.path === watchFolder) && 
            this.isOcrTarget(f)
        );

        if (files.length === 0) {
            new Notice('No images or PDFs found in watch folder');
            return;
        }

        // Filter files by size and existing OCR status
        const validFiles = [];
        for (const file of files) {
            const stat = await this.app.vault.adapter.stat(file.path);
            if (stat.size > this.settings.ocrMaxFileSize) {
                console.warn(`Skipping ${file.name}: file too large (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
                continue;
            }

            const ocrPath = this.getOcrNotePath(file, this.settings.ocrOutputFolder);
            const ocrExists = await this.app.vault.adapter.exists(ocrPath);
            
            if (!ocrExists || this.settings.ocrForceReprocess) {
                // Check if file was modified after OCR
                if (ocrExists && !this.settings.ocrForceReprocess) {
                    const ocrStat = await this.app.vault.adapter.stat(ocrPath);
                    if (stat.mtime <= ocrStat.mtime) {
                        continue; // OCR is newer than source file
                    }
                }
                validFiles.push({ file, size: stat.size });
            }
        }

        if (validFiles.length === 0) {
            new Notice('No files need OCR processing');
            return;
        }

        // Sort by file size (smallest first for better batching)
        validFiles.sort((a, b) => a.size - b.size);

        new Notice(`Processing ${validFiles.length} files for OCR in batches...`);
        let processed = 0;
        let failed = 0;

        // Process in batches
        const batchSize = this.settings.ocrBatchSize;
        for (let i = 0; i < validFiles.length; i += batchSize) {
            // Check if stop was requested
            if (this.ocrStopRequested) {
                new Notice(`OCR processing stopped by user. Processed: ${processed}, Failed: ${failed}`);
                return;
            }

            const batch = validFiles.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(validFiles.length / batchSize);
            
            new Notice(`Processing batch ${batchNum}/${totalBatches} (${batch.length} files)...`);

            for (const { file } of batch) {
                // Check if stop was requested before processing each file
                if (this.ocrStopRequested) {
                    new Notice(`OCR processing stopped by user. Processed: ${processed}, Failed: ${failed}`);
                    return;
                }

                try {
                    await this.processFileForOcr(file);
                    processed++;
                } catch (error) {
                    console.error(`Failed to process ${file.name}:`, error);
                    failed++;
                    
                    // Stop entire batch processing on quota exceeded
                    if (error.message.includes('QUOTA_EXCEEDED') || error.message.includes('API_ERROR_429')) {
                        new Notice(`OCR batch stopped due to quota limit. Processed: ${processed}, Failed: ${failed}`);
                        return;
                    }
                }
            }

            // Longer delay between batches to avoid API rate limits
            if (i + batchSize < validFiles.length) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
            }
        }

        new Notice(`OCR batch complete: ${processed} processed, ${failed} failed`);
    }

    async ocrReprocessAll() {
        if (!this.settings.ocrEnabled || !this.settings.ocrApiKey) {
            new Notice('OCR is not enabled or API key is missing');
            return;
        }

        // Temporarily enable force reprocess
        const originalForceReprocess = this.settings.ocrForceReprocess;
        this.settings.ocrForceReprocess = true;

        try {
            await this.ocrWatchFolder();
        } finally {
            // Restore original setting
            this.settings.ocrForceReprocess = originalForceReprocess;
        }
    }

    setupFileWatchers() {
        if (!this.settings.ocrEnabled) {
            return;
        }

        // Watch for file creation with recursion prevention
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (this.settings.ocrAutoProcessNewFiles && this.isOcrTarget(file) && !this.isOcrOutputFile(file)) {
                    this.handleFileCreated(file);
                }
            })
        );

        // Watch for file modification with recursion prevention
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (this.settings.ocrAutoProcessModifiedFiles && this.isOcrTarget(file) && !this.isOcrOutputFile(file)) {
                    this.handleFileModified(file);
                }
            })
        );
    }

    // Prevent processing OCR output files to avoid infinite recursion
    isOcrOutputFile(file) {
        if (!file || !file.name) return false;
        
        // Check if file is in OCR output folder
        if (this.settings.ocrOutputFolder && file.path.startsWith(this.settings.ocrOutputFolder + '/')) {
            return true;
        }
        
        // Check if file name indicates it's an OCR output
        return file.name.includes('(OCR)') || file.name.includes('OCR Result');
    }

    async handleFileCreated(file) {
        const watchFolder = this.settings.ocrWatchFolder;
        
        // Prevent re-entry for files already being processed
        if (this.processingFiles.has(file.path)) {
            console.log(`Skipping ${file.name}: already being processed`);
            return;
        }
        
        // Check if file is in watch folder
        if (!file.path.startsWith(watchFolder + '/') && file.path !== watchFolder) {
            return;
        }

        // Check file size
        try {
            const stat = await this.app.vault.adapter.stat(file.path);
            if (stat.size > this.settings.ocrMaxFileSize) {
                console.warn(`Skipping new file ${file.name}: too large (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
                return;
            }
        } catch (error) {
            console.error(`Failed to get file stats for ${file.name}:`, error);
            return;
        }

        // Add to processing set to prevent re-entry
        this.processingFiles.add(file.path);

        // Small delay to ensure file is fully written
        setTimeout(async () => {
            try {
                await this.processFileForOcr(file);
            } catch (error) {
                console.error(`Auto-OCR failed for new file ${file.name}:`, error);
            } finally {
                // Always remove from processing set
                this.processingFiles.delete(file.path);
            }
        }, 1000);
    }

    async handleFileModified(file) {
        const watchFolder = this.settings.ocrWatchFolder;
        
        // Prevent re-entry for files already being processed
        if (this.processingFiles.has(file.path)) {
            console.log(`Skipping ${file.name}: already being processed`);
            return;
        }
        
        // Check if file is in watch folder
        if (!file.path.startsWith(watchFolder + '/') && file.path !== watchFolder) {
            return;
        }

        // Check if OCR note exists
        const ocrPath = this.getOcrNotePath(file, this.settings.ocrOutputFolder);
        const ocrExists = await this.app.vault.adapter.exists(ocrPath);
        
        if (!ocrExists) {
            return; // No existing OCR to update
        }

        try {
            // Check if source file is newer than OCR note
            const fileStat = await this.app.vault.adapter.stat(file.path);
            const ocrStat = await this.app.vault.adapter.stat(ocrPath);
            
            if (fileStat.mtime <= ocrStat.mtime) {
                return; // OCR is already up to date
            }

            // Check file size
            if (fileStat.size > this.settings.ocrMaxFileSize) {
                console.warn(`Skipping modified file ${file.name}: too large (${(fileStat.size / 1024 / 1024).toFixed(2)}MB)`);
                return;
            }
        } catch (error) {
            console.error(`Failed to check file stats for ${file.name}:`, error);
            return;
        }

        // Add to processing set to prevent re-entry
        this.processingFiles.add(file.path);

        // Small delay to ensure file modifications are complete
        setTimeout(async () => {
            try {
                new Notice(`Updating OCR for modified file: ${file.name}`);
                await this.processFileForOcr(file);
            } catch (error) {
                console.error(`Auto-OCR update failed for ${file.name}:`, error);
            } finally {
                // Always remove from processing set
                this.processingFiles.delete(file.path);
            }
        }, 2000);
    }

    stopOcrProcessing() {
        this.ocrStopRequested = true;
        new Notice('OCR processing will stop after current file completes...');
    }

    onunload() {
        // Stop any ongoing OCR processing
        this.ocrStopRequested = true;
        
        // Clear all processing sets to stop any pending operations
        this.processingFiles.clear();
        this.processedFiles.clear();
        
        // Remove any active file watchers
        if (this.fileWatchers) {
            this.fileWatchers.forEach(watcher => {
                if (watcher && typeof watcher.unregister === 'function') {
                    watcher.unregister();
                }
            });
            this.fileWatchers = [];
        }
    }
};
