// === Attachment Organizer Plugin ===

const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, TFolder, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: '',
    autoOrganizeMode: 'date', // 'none', 'date', 'type', 'tag', 'custom'
    customPattern: '{{type}}/{{year}}-{{month}}',
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
};
