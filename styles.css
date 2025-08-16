// === Attachment Organizer Plugin ===

const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, TFolder, normalizePath } = require('obsidian');

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
    ocrModel: 'gemini-1.5-pro',
    ocrWatchFolder: 'assets/attachments',
    ocrOutputFolder: 'assets/attachments/ocr',
    ocrAutoProcess: true,
    ocrProcessedField: 'ocr-processed',
    ocrPrompt: 'Extract all text from this image/document. Provide the text content clearly and accurately.',
    ocrTemplate: '# OCR Result for {{filename}}\n\n**Source:** ![[{{filename}}]]\n**Processed:** {{date}}\n**Status:** {{status}}\n\n## Extracted Text\n\n{{content}}',
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
            .setName('Confirm before purging')
            .setDesc('Show confirmation prompt before deleting unlinked attachments')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.confirmPurge)
                .onChange(async (value) => {
                    this.plugin.settings.confirmPurge = value;
                    await this.plugin.saveSettings();
                }));

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

        // OCR Settings Section
        containerEl.createEl('h3', { text: 'OCR Settings' });
        containerEl.createEl('p', { text: 'Automatically extract text from images and PDFs using Google Gemini AI' });

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
                .setName('Gemini API Key')
                .setDesc('Get your API key from Google AI Studio (https://makersuite.google.com/app/apikey)')
                .addText(text => text
                    .setPlaceholder('AIza...')
                    .setValue(this.plugin.settings.ocrApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrApiKey = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Gemini Model')
                .setDesc('The Gemini model to use for OCR')
                .addDropdown(drop => drop
                    .addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
                    .addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
                    .setValue(this.plugin.settings.ocrModel)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrModel = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OCR Watch Folder')
                .setDesc('Folder to monitor for images and PDFs to OCR')
                .addText(text => text
                    .setPlaceholder('assets/attachments')
                    .setValue(this.plugin.settings.ocrWatchFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrWatchFolder = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OCR Output Folder')
                .setDesc('Where to save OCR notes (leave empty to use same folder as source)')
                .addText(text => text
                    .setPlaceholder('assets/attachments/ocr')
                    .setValue(this.plugin.settings.ocrOutputFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrOutputFolder = value.trim();
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Auto-process new files')
                .setDesc('Automatically OCR new images and PDFs added to the watch folder')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.ocrAutoProcess)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrAutoProcess = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OCR Processed Field')
                .setDesc('YAML frontmatter field name to mark files as processed')
                .addText(text => text
                    .setPlaceholder('ocr-processed')
                    .setValue(this.plugin.settings.ocrProcessedField)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrProcessedField = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OCR Prompt')
                .setDesc('Custom prompt to send to Gemini for OCR processing')
                .addTextArea(text => text
                    .setPlaceholder('Extract all text from this image/document...')
                    .setValue(this.plugin.settings.ocrPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrPrompt = value;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('OCR Output Template')
                .setDesc('Template for OCR output notes. Available variables: {{filename}}, {{date}}, {{status}}, {{content}}')
                .addTextArea(text => text
                    .setPlaceholder('# OCR Result for {{filename}}...')
                    .setValue(this.plugin.settings.ocrTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.ocrTemplate = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}

module.exports = class AttachmentOrganizer extends Plugin {
    async onload() {
        console.log('Loading Attachment Organizer plugin');
        await this.loadSettings();

        this.addSettingTab(new AttachmentOrganizerSettingTab(this.app, this));

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

        // File watching for auto-OCR
        if (this.settings.ocrEnabled && this.settings.ocrAutoProcess) {
            this.registerEvent(this.app.vault.on('create', (file) => {
                if (file instanceof TFile) {
                    this.processFileForOcr(file);
                }
            }));
            
            this.registerEvent(this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    this.processFileForOcr(file);
                }
            }));
        }
    }

    onunload() {
        console.log('Unloading Attachment Organizer plugin');
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
        return normalizePath(`${folder}/${baseName} (OCR).md`);
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

    async callGeminiOCR(fileBuffer, mimeType) {
        const apiKey = this.settings.ocrApiKey;
        const model = this.settings.ocrModel;
        const prompt = this.settings.ocrPrompt || 'Extract all text from this image/document. Provide the text content clearly and accurately.';
        
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: prompt
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: fileBuffer.toString('base64')
                        }
                    }
                ]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }

        return result.candidates[0].content.parts[0].text.trim();
    }

    async processFileForOcr(file) {
        if (!this.settings.ocrEnabled || !this.settings.ocrApiKey) {
            return;
        }

        try {
            // Check if file is in watch folder
            const watchFolder = normalizePath(this.settings.ocrWatchFolder);
            if (!file.path.startsWith(watchFolder + '/') && file.path !== watchFolder) {
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
            const extractedText = await this.makeGeminiRequest(file, this.settings.ocrApiKey, this.settings.ocrModel);
            
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

        const watchFolder = normalizePath(this.settings.ocrWatchFolder);
        const files = this.app.vault.getFiles().filter(f => 
            (f.path.startsWith(watchFolder + '/') || f.path === watchFolder) && 
            this.isOcrTarget(f)
        );

        if (files.length === 0) {
            new Notice('No images or PDFs found in watch folder');
            return;
        }

        new Notice(`Processing ${files.length} files for OCR...`);
        let processed = 0;
        let skipped = 0;

        for (const file of files) {
            const ocrPath = this.getOcrNotePath(file, this.settings.ocrOutputFolder);
            if (await this.app.vault.adapter.exists(ocrPath)) {
                skipped++;
                continue;
            }

            await this.processFileForOcr(file);
            processed++;
        }

        new Notice(`OCR batch complete: ${processed} processed, ${skipped} skipped`);
    }
};
