// === Attachment Organizer Plugin ===

const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, TFolder, MarkdownView } = require('obsidian');

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: '',
    autoOrganizeMode: 'date', // 'none', 'date', 'type', 'tag', 'custom'
    customPattern: '{{type}}/{{year}}-{{month}}',
    organizeOnLoad: false,
    organizeInterval: 0, // minutes, 0 = disabled
    organizationMode: 'obsidian-settings', // 'obsidian-settings', 'same-location', or 'separate-folder'
    separateFolderName: 'attachments',
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
    // Paste Rename Settings
    pasteRenameMode: 'none', // 'none', 'date', 'custom', 'ask', 'date-ask'
    pasteRenameDateFormat: '{{year}}-{{month}}-{{day}}', // tokens: {{year}} {{month}} {{day}} {{time}} {{type}}
    pasteRenameCustomPattern: '{{year}}-{{month}}-{{day}}_{{filename}}',
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
         this.createAccordionSection(containerEl, 'Support & Links', (el) => {
            const supportContainer = el.createDiv();
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

        // General Settings
        this.createAccordionSection(containerEl, 'General Settings', (el) => {
            new Setting(el)
                .setName('Attachment extensions')
                .setDesc('Comma-separated list of file extensions treated as attachments')
                .addTextArea(text => text
                    .setPlaceholder('png,jpg,jpeg,...')
                    .setValue(this.plugin.settings.attachmentExtensions)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentExtensions = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(el)
                .setName('Ignore folders')
                .setDesc('Comma-separated list of folder paths to skip when organizing or purging')
                .addTextArea(text => text
                    .setPlaceholder('folder1,folder2/subfolder')
                    .setValue(this.plugin.settings.ignoreFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.ignoreFolders = value;
                        await this.plugin.saveSettings();
                    }));
        });

        // Organization Settings
        this.createAccordionSection(containerEl, 'Organization Settings', (el) => {
            new Setting(el)
                .setName('Destination')
                .setDesc('Where to move attachments: follow Obsidian\'s built-in attachment folder setting, or always prompt for a specific folder name.')
                .addDropdown(drop => drop
                    .addOption('obsidian-settings', 'Use Obsidian settings')
                    .addOption('same-location', 'Same location as file')
                    .addOption('separate-folder', 'Separate folder')
                    .setValue(this.plugin.settings.organizationMode)
                    .onChange(async (value) => {
                        this.plugin.settings.organizationMode = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.organizationMode === 'separate-folder') {
                new Setting(el)
                    .setName('Default folder name')
                    .setDesc('Pre-filled name shown in the prompt each time you organize. You can change it per-run.')
                    .addText(text => text
                        .setPlaceholder('attachments')
                        .setValue(this.plugin.settings.separateFolderName)
                        .onChange(async (value) => {
                            this.plugin.settings.separateFolderName = value.trim() || 'attachments';
                            await this.plugin.saveSettings();
                        }));
            }

            new Setting(el)
                .setName('Sort into subfolders by')
                .setDesc('Optionally sort attachments into subfolders inside the destination')
                .addDropdown(drop => drop
                    .addOption('none', 'No subfolders')
                    .addOption('date', 'Date (year/month)')
                    .addOption('type', 'File type (extension)')
                    .addOption('custom', 'Custom pattern')
                    .setValue(this.plugin.settings.autoOrganizeMode)
                    .onChange(async (value) => {
                        this.plugin.settings.autoOrganizeMode = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.autoOrganizeMode === 'custom') {
                new Setting(el)
                    .setName('Custom subfolder pattern')
                    .setDesc('Available tokens: {{year}}, {{month}}, {{day}}, {{type}}, {{filename}}')
                    .addText(text => text
                        .setPlaceholder('{{type}}/{{year}}-{{month}}')
                        .setValue(this.plugin.settings.customPattern)
                        .onChange(async (value) => {
                            this.plugin.settings.customPattern = value;
                            await this.plugin.saveSettings();
                        }));
            }

            new Setting(el)
                .setName('Organize on startup')
                .setDesc('Automatically organize attachments each time Obsidian starts')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.organizeOnLoad)
                    .onChange(async (value) => {
                        this.plugin.settings.organizeOnLoad = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(el)
                .setName('Auto-organize interval (minutes)')
                .setDesc('Re-organize on a schedule. Set to 0 to disable.')
                .addSlider(slider => slider
                    .setLimits(0, 120, 5)
                    .setValue(this.plugin.settings.organizeInterval)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.organizeInterval = value;
                        await this.plugin.saveSettings();
                        this.plugin.resetOrganizeInterval();
                    }));
        });

        // Paste Rename Settings
        this.createAccordionSection(containerEl, 'Paste Rename Settings', (el) => {
            el.createEl('p', {
                text: 'Automatically rename files when they are pasted or dropped into Obsidian.',
                cls: 'setting-item-description'
            });

            new Setting(el)
                .setName('Rename mode')
                .setDesc('How to rename attachments when pasted or dropped into a note')
                .addDropdown(drop => drop
                    .addOption('none', 'Do not rename')
                    .addOption('date', 'Date-based (automatic)')
                    .addOption('custom', 'Custom pattern (automatic)')
                    .addOption('ask', 'Ask each time')
                    .addOption('date-ask', 'Date-based + ask to confirm')
                    .setValue(this.plugin.settings.pasteRenameMode)
                    .onChange(async (value) => {
                        this.plugin.settings.pasteRenameMode = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (this.plugin.settings.pasteRenameMode === 'date' || this.plugin.settings.pasteRenameMode === 'date-ask') {
                new Setting(el)
                    .setName('Date format pattern')
                    .setDesc('Tokens: {{year}}, {{month}}, {{day}}, {{time}}, {{type}}, {{filename}} (note name), {{original}} (pasted file name)')
                    .addText(text => text
                        .setPlaceholder('{{year}}-{{month}}-{{day}}')
                        .setValue(this.plugin.settings.pasteRenameDateFormat)
                        .onChange(async (value) => {
                            this.plugin.settings.pasteRenameDateFormat = value.trim() || '{{year}}-{{month}}-{{day}}';
                            await this.plugin.saveSettings();
                        }));
            }

            if (this.plugin.settings.pasteRenameMode === 'custom') {
                new Setting(el)
                    .setName('Custom rename pattern')
                    .setDesc('Tokens: {{year}}, {{month}}, {{day}}, {{time}}, {{type}}, {{filename}} (note name), {{original}} (pasted file name)')
                    .addText(text => text
                        .setPlaceholder('{{year}}-{{month}}-{{day}}_{{filename}}')
                        .setValue(this.plugin.settings.pasteRenameCustomPattern)
                        .onChange(async (value) => {
                            this.plugin.settings.pasteRenameCustomPattern = value.trim() || '{{year}}-{{month}}-{{day}}_{{filename}}';
                            await this.plugin.saveSettings();
                        }));
            }
        });

        // Purge Settings
        this.createAccordionSection(containerEl, 'Purge Settings', (el) => {
            new Setting(el)
                .setName('Confirm before purging')
                .setDesc('Show a confirmation prompt before deleting unlinked attachments')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.confirmPurge)
                    .onChange(async (value) => {
                        this.plugin.settings.confirmPurge = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        // OCR Settings
        this.createAccordionSection(containerEl, 'OCR Settings', (el) => {
            const ocrDesc = el.createEl('p', { 
                text: 'Automatically extract text from images and PDFs using Google Gemini AI',
                cls: 'setting-item-description'
            });
            ocrDesc.className = 'ocr-description';

            new Setting(el)
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
                new Setting(el)
                    .setName('OCR API key')
                    .then(setting => {
                        const frag = document.createDocumentFragment();
                        frag.appendText('Get your API key from ');
                        const link = frag.createEl('a', { text: 'Google AI Studio', href: 'https://makersuite.google.com/app/apikey' });
                        link.setAttr('target', '_blank');
                        link.setAttr('rel', 'noopener noreferrer');
                        setting.setDesc(frag);
                    })
                    .addText(text => text
                        .setPlaceholder('AIza...')
                        .setValue(this.plugin.settings.ocrApiKey)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrApiKey = value.trim();
                            await this.plugin.saveSettings();
                        }));

                new Setting(el)
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

                new Setting(el)
                    .setName('OCR watch folder')
                    .setDesc('Folder to monitor for images and PDFs to OCR')
                    .addText(text => text
                        .setPlaceholder('assets/attachments')
                        .setValue(this.plugin.settings.ocrWatchFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrWatchFolder = value.trim();
                            await this.plugin.saveSettings();
                        }));

                new Setting(el)
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
            this.createAccordionSection(containerEl, 'OCR processing settings', (el) => {
                new Setting(el)
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

                new Setting(el)
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

                new Setting(el)
                    .setName('Force reprocess')
                    .setDesc('Always reprocess files even if OCR already exists (useful for testing)')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrForceReprocess)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrForceReprocess = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(el)
                    .setName('Auto-process new files')
                    .setDesc('Automatically OCR new images and PDFs added to the watch folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrAutoProcessNewFiles)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrAutoProcessNewFiles = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(el)
                    .setName('Auto-process modified files')
                    .setDesc('Automatically OCR files when they are modified or updated')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.ocrAutoProcessModifiedFiles)
                        .onChange(async (value) => {
                            this.plugin.settings.ocrAutoProcessModifiedFiles = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(el)
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
            this.createAccordionSection(containerEl, 'OCR templates', (el) => {
                const ocrPromptSetting = new Setting(el)
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

                const ocrTemplateSetting = new Setting(el)
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

        // Set initial state
        content.classList.add('expanded');
        arrow.classList.add('expanded');
        header.classList.add('expanded');
        
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
        
        // Pass the content div directly so new Setting(el) appends into the accordion
        contentCallback(content);
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

class PasteRenameModal extends Modal {
    constructor(app, file, suggestedName, onRename) {
        super(app);
        this.file = file;
        this.suggestedName = suggestedName;
        this.onRename = onRename;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Rename pasted file' });

        const originalExt = this.file.extension ? `.${this.file.extension}` : '';
        const baseName = this.suggestedName.replace(/\.[^.]+$/, '');

        contentEl.createEl('p', {
            text: `Original: ${this.file.name}`,
            cls: 'setting-item-description'
        });

        const inputRow = contentEl.createDiv({ cls: 'ao-rename-row' });
        const input = inputRow.createEl('input', { type: 'text', cls: 'ao-rename-input' });
        input.value = baseName;
        inputRow.createEl('span', { text: originalExt, cls: 'ao-rename-ext' });

        const btnRow = contentEl.createDiv({ cls: 'ao-purge-btn-row' });

        const cancelBtn = btnRow.createEl('button', { text: 'Keep original' });
        cancelBtn.addEventListener('click', () => {
            this.onRename(null);
            this.close();
        });

        const renameBtn = btnRow.createEl('button', { text: 'Rename', cls: 'mod-cta' });
        renameBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (val) {
                this.onRename(val + originalExt);
            } else {
                this.onRename(null);
            }
            this.close();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') renameBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        });

        setTimeout(() => { input.focus(); input.select(); }, 50);
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

        // Paste rename watcher
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile) {
                    this.handlePastedFile(file);
                }
            })
        );

        // Auto-organize on load
        if (this.settings.organizeOnLoad) {
            this.app.workspace.onLayoutReady(() => this.organizeAttachments());
        }

        // Auto-organize on interval
        this.resetOrganizeInterval();

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

    applyPasteRenamePattern(pattern, file) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const activeNote = this.app.workspace.getActiveFile();
        const tokens = {
            '{{year}}': now.getFullYear().toString(),
            '{{month}}': pad(now.getMonth() + 1),
            '{{day}}': pad(now.getDate()),
            '{{time}}': `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
            '{{type}}': file.extension?.toLowerCase() || 'file',
            '{{filename}}': activeNote?.basename || file.basename,
            '{{note}}': activeNote?.basename || file.basename,
            '{{original}}': file.basename,
        };
        let result = pattern;
        for (const [token, value] of Object.entries(tokens)) {
            result = result.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
        }
        // Sanitize: remove characters not allowed in filenames
        return result.replace(/[\\/:*?"<>|]/g, '_');
    }

    async handlePastedFile(file) {
        const mode = this.settings.pasteRenameMode;
        if (mode === 'none') return;

        const attachmentExtensions = this.settings.attachmentExtensions
            .split(',').map(e => e.trim().toLowerCase());
        if (!attachmentExtensions.includes(file.extension?.toLowerCase())) return;

        // Debounce: skip if already being renamed
        if (this._renamingFiles?.has(file.path)) return;
        if (!this._renamingFiles) this._renamingFiles = new Set();
        this._renamingFiles.add(file.path);

        // Delay to ensure Obsidian's metadata cache has indexed the file
        // before renameFile attempts to update backlinks in notes.
        await new Promise(r => setTimeout(r, 1000));

        // Re-check file still exists using fresh vault reference
        const current = this.app.vault.getAbstractFileByPath(file.path);
        if (!(current instanceof TFile)) {
            this._renamingFiles.delete(file.path);
            return;
        }

        const ext = current.extension ? `.${current.extension}` : '';
        // Prefer the active note's folder as destination so the renamed file
        // lands next to the note it was pasted into, not at vault root.
        const activeNote = this.app.workspace.getActiveFile();
        const noteFolder = activeNote?.parent?.path && activeNote.parent.path !== '/'
            ? activeNote.parent.path : '';
        const parentPath = current.parent?.path && current.parent.path !== '/'
            ? current.parent.path
            : noteFolder;

        const doRename = async (newName) => {
            if (!newName) { this._renamingFiles.delete(current.path); return; }
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            if (newPath === current.path) { this._renamingFiles.delete(current.path); return; }
            const oldName = current.name;
            try {
                await this.app.fileManager.renameFile(current, newPath);
                // Manually patch the active editor — renameFile may not update
                // the link if the embed was just inserted and cache isn't ready.
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView?.editor) {
                    const editor = activeView.editor;
                    const before = editor.getValue();
                    const after = before.split(oldName).join(newName);
                    if (after !== before) {
                        const cursor = editor.getCursor();
                        editor.setValue(after);
                        editor.setCursor(cursor);
                    }
                }
            } catch (e) {
                new Notice(`Rename failed: ${e.message}`);
            }
            this._renamingFiles.delete(current.path);
        };

        if (mode === 'date') {
            const newName = this.applyPasteRenamePattern(this.settings.pasteRenameDateFormat, current) + ext;
            await doRename(newName);
        } else if (mode === 'custom') {
            const newName = this.applyPasteRenamePattern(this.settings.pasteRenameCustomPattern, current) + ext;
            await doRename(newName);
        } else if (mode === 'ask') {
            new PasteRenameModal(this.app, current, current.name, async (newName) => {
                await doRename(newName);
            }).open();
        } else if (mode === 'date-ask') {
            const suggested = this.applyPasteRenamePattern(this.settings.pasteRenameDateFormat, current) + ext;
            new PasteRenameModal(this.app, current, suggested, async (newName) => {
                await doRename(newName);
            }).open();
        } else {
            this._renamingFiles.delete(current.path);
        }
    }

    resetOrganizeInterval() {
        if (this._organizeIntervalId) {
            clearInterval(this._organizeIntervalId);
            this._organizeIntervalId = null;
        }
        if (this.settings.organizeInterval > 0) {
            const ms = this.settings.organizeInterval * 60 * 1000;
            this._organizeIntervalId = setInterval(() => this.organizeAttachments(), ms);
        }
    }

    async organizeAttachments(resolvedFolderName) {
        if (this.settings.organizationMode === 'separate-folder' && !resolvedFolderName) {
            resolvedFolderName = this.settings.separateFolderName || 'attachments';
        }

        const files = this.app.vault.getFiles();
        const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
        
        let organized = 0;
        let skipped = 0;

        for (const file of files) {
            if (!attachmentExtensions.includes(file.extension?.toLowerCase())) {
                continue;
            }

            const ignoreFolders = this.settings.ignoreFolders.split(',').map(f => f.trim()).filter(f => f);
            if (ignoreFolders.some(folder => file.path.startsWith(folder + '/'))) {
                skipped++;
                continue;
            }

            try {
                const newPath = this.getNewAttachmentPath(file, resolvedFolderName);
                if (newPath !== file.path) {
                    const oldFolder = file.parent?.path || '';
                    await this.ensureFolderExists(newPath.substring(0, newPath.lastIndexOf('/')));
                    await this.app.vault.rename(file, newPath);
                    organized++;
                    // Remove old folder (and empty ancestors) if now empty
                    if (oldFolder) {
                        await this.deleteIfEmpty(oldFolder);
                    }
                }
            } catch (error) {
                console.error(`Failed to organize ${file.path}:`, error);
                skipped++;
            }
        }

        new Notice(`Organized ${organized} attachments, skipped ${skipped}`);
    }

    getNewAttachmentPath(file, resolvedFolderName) {
        let baseFolder;

        if (this.settings.organizationMode === 'obsidian-settings') {
            // Read Obsidian's attachment folder path from config directly.
            // getAvailablePathForAttachments(null) is unreliable — it resolves
            // relative paths against the wrong context and causes infinite nesting.
            const cfgPath = this.app.vault.config?.attachmentFolderPath || '';
            if (!cfgPath || cfgPath.startsWith('./') || cfgPath.startsWith('../')) {
                // Relative to note location — we can't know which note owns this
                // attachment, so keep the file in its current folder as the base.
                baseFolder = file.parent?.path || '';
            } else {
                baseFolder = cfgPath;
            }
        } else if (this.settings.organizationMode === 'same-location') {
            // Place attachment in the same folder as the note that links to it.
            // Fall back to the attachment's own folder if no linking note is found.
            const resolvedLinks = this.app.metadataCache.resolvedLinks;
            let linkingNoteFolder = null;
            for (const [notePath, links] of Object.entries(resolvedLinks)) {
                if (links[file.path] !== undefined) {
                    const noteFile = this.app.vault.getAbstractFileByPath(notePath);
                    if (noteFile instanceof TFile && noteFile.parent?.path) {
                        linkingNoteFolder = noteFile.parent.path;
                        break;
                    }
                }
            }
            baseFolder = linkingNoteFolder ?? file.parent?.path ?? '';
        } else {
            // separate-folder: use the resolved (prompted) folder name
            baseFolder = resolvedFolderName || this.settings.separateFolderName || 'attachments';
        }

        // Compute the subfolder suffix independently so we can detect already-organized files.
        let subfolderSuffix = '';
        if (this.settings.autoOrganizeMode === 'date') {
            const date = new Date(file.stat?.mtime || Date.now());
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            subfolderSuffix = `${year}/${month}`;
        } else if (this.settings.autoOrganizeMode === 'type') {
            subfolderSuffix = file.extension?.toLowerCase() || 'unknown';
        } else if (this.settings.autoOrganizeMode === 'custom' && this.settings.customPattern) {
            const date = new Date(file.stat?.mtime || Date.now());
            const replacements = {
                '{{type}}': file.extension?.toLowerCase() || 'unknown',
                '{{year}}': date.getFullYear().toString(),
                '{{month}}': String(date.getMonth() + 1).padStart(2, '0'),
                '{{day}}': String(date.getDate()).padStart(2, '0'),
                '{{filename}}': file.basename
            };
            let pattern = this.settings.customPattern;
            for (const [placeholder, value] of Object.entries(replacements)) {
                pattern = pattern.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            }
            subfolderSuffix = pattern;
        }

        if (subfolderSuffix) {
            baseFolder = `${baseFolder}/${subfolderSuffix}`;
        }

        // Avoid a leading slash when baseFolder is empty
        const newPath = baseFolder ? `${baseFolder}/${file.name}` : file.name;

        // If the file is already in the correct location, skip the move.
        const currentFolder = file.parent?.path || '';
        if (currentFolder === baseFolder) {
            return file.path;
        }

        return newPath;
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
                const ocrPath = this.getOcrNotePath(file);
                const alreadyExists = await this.app.vault.adapter.exists(ocrPath);
                if (alreadyExists && !this.settings.ocrForceReprocess) {
                    new Notice(`OCR note already exists for ${file.name}. Enable "Force reprocess" in settings to overwrite.`);
                    return;
                }
                await this.ensureFolderExists(this.getOcrOutputFolder(file));
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

    async deleteIfEmpty(folderPath) {
        if (!folderPath || folderPath === '/') return;
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!(folder instanceof TFolder)) return;
        // Check if folder has any children left
        if (folder.children && folder.children.length > 0) return;
        try {
            await this.app.vault.delete(folder, true);
            // Walk up and delete parent if also now empty
            const parentPath = folderPath.includes('/')
                ? folderPath.substring(0, folderPath.lastIndexOf('/'))
                : '';
            if (parentPath) {
                await this.deleteIfEmpty(parentPath);
            }
        } catch (e) {
            // Ignore errors (e.g. folder not actually empty on disk)
        }
    }

    async ensureFolderExists(folder) {
        if (!folder) return;
        const existingFile = this.app.vault.getAbstractFileByPath(folder);
        if (existingFile instanceof TFolder) return;
        if (existingFile) throw new Error(`Path exists but is not a folder: ${folder}`);
        try {
            await this.app.vault.createFolder(folder);
        } catch (e) {
            // Ignore "already exists" — vault cache may be stale
            if (!e.message?.includes('already exists')) throw e;
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

    getOcrOutputFolder(sourceFile) {
        const mode = this.settings.organizationMode;
        let base;
        if (mode === 'obsidian-settings') {
            if (this.app.vault.getAvailablePathForAttachments) {
                const suggested = this.app.vault.getAvailablePathForAttachments(sourceFile.name, sourceFile.extension, null);
                const lastSlash = suggested.lastIndexOf('/');
                base = lastSlash >= 0 ? suggested.substring(0, lastSlash) : '';
            } else {
                base = this.app.vault.config?.attachmentFolderPath || '';
            }
        } else if (mode === 'same-location') {
            base = sourceFile.parent?.path || '';
        } else {
            // separate-folder: use saved default (no prompt for OCR auto-runs)
            base = this.settings.separateFolderName || 'attachments';
        }

        // Apply subfolder sorting (autoOrganizeMode)
        if (this.settings.autoOrganizeMode === 'date') {
            const date = new Date(sourceFile.stat?.mtime || Date.now());
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            base = `${base}/${year}/${month}`;
        } else if (this.settings.autoOrganizeMode === 'type') {
            const ext = sourceFile.extension?.toLowerCase() || 'unknown';
            base = `${base}/${ext}`;
        } else if (this.settings.autoOrganizeMode === 'custom' && this.settings.customPattern) {
            const date = new Date(sourceFile.stat?.mtime || Date.now());
            const replacements = {
                '{{type}}': sourceFile.extension?.toLowerCase() || 'unknown',
                '{{year}}': date.getFullYear().toString(),
                '{{month}}': String(date.getMonth() + 1).padStart(2, '0'),
                '{{day}}': String(date.getDate()).padStart(2, '0'),
                '{{filename}}': sourceFile.basename
            };
            let pattern = this.settings.customPattern;
            for (const [placeholder, value] of Object.entries(replacements)) {
                pattern = pattern.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            }
            base = `${base}/${pattern}`;
        }

        // Always put OCR notes in an 'ocr' subfolder within the resolved base
        return base ? `${base}/ocr` : 'ocr';
    }

    getOcrNotePath(sourceFile) {
        const folder = this.getOcrOutputFolder(sourceFile);
        return `${folder}/${sourceFile.basename} (OCR).md`;
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
            const ocrPath = this.getOcrNotePath(file);
            if (await this.app.vault.adapter.exists(ocrPath)) {
                return;
            }

            new Notice(`Starting OCR for ${file.name}...`);

            await this.ensureFolderExists(this.getOcrOutputFolder(file));

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

            const ocrPath = this.getOcrNotePath(file);
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
        if (this.settings.ocrOutputFolder && file.path.startsWith(this.settings.ocrOutputFolder + '/')) { // legacy check, keep for safety
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
        const ocrPath = this.getOcrNotePath(file);
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
        // Clear auto-organize interval
        if (this._organizeIntervalId) {
            clearInterval(this._organizeIntervalId);
            this._organizeIntervalId = null;
        }

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
