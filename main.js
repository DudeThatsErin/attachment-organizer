// === Attachment Organizer Plugin ===

const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: '',
    autoOrganizeMode: 'date', // 'none', 'date', 'type', 'tag', 'custom'
    customPattern: '{{type}}/{{year}}-{{month}}',
    templateFolder: 'templates',
    ignoreFileCreationFolders: ''
};

class AttachmentOrganizerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Attachment Organizer Settings' });

        new Setting(containerEl)
            .setName('Attachment Folder')
            .setDesc('The base folder where attachments will be organized')
            .addText(text => text
                .setPlaceholder('attachments')
                .setValue(this.plugin.settings.attachmentFolder)
                .onChange(async (value) => {
                    this.plugin.settings.attachmentFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Attachment Extensions')
            .setDesc('Comma-separated list of file extensions considered as attachments')
            .addText(text => text
                .setPlaceholder('png,jpg,jpeg,...')
                .setValue(this.plugin.settings.attachmentExtensions)
                .onChange(async (value) => {
                    this.plugin.settings.attachmentExtensions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignore Folders')
            .setDesc('Comma-separated list of folder paths to ignore when organizing or purging')
            .addTextArea(text => text
                .setPlaceholder('folder1,folder2/subfolder')
                .setValue(this.plugin.settings.ignoreFolders)
                .onChange(async (value) => {
                    this.plugin.settings.ignoreFolders = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Confirm Before Purging')
            .setDesc('Show confirmation prompt before deleting unlinked attachments')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.confirmPurge)
                .onChange(async (value) => {
                    this.plugin.settings.confirmPurge = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-Organize Mode')
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
                .setName('Custom Folder Pattern')
                .setDesc('Use {{year}}, {{month}}, {{type}}, {{basename}} in folder structure')
                .addText(text => text
                    .setPlaceholder('{{type}}/{{year}}-{{month}}')
                    .setValue(this.plugin.settings.customPattern)
                    .onChange(async (value) => {
                        this.plugin.settings.customPattern = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName('Templates Folder')
            .setDesc('Folder where your templates are stored')
            .addText(text => text
                .setPlaceholder('templates')
                .setValue(this.plugin.settings.templateFolder)
                .onChange(async (value) => {
                    this.plugin.settings.templateFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignore Folders During File Creation')
            .setDesc('Comma-separated list of folder paths to exclude from the target folder dropdown')
            .addTextArea(text => text
                .setPlaceholder('e.g., .obsidian,.trash')
                .setValue(this.plugin.settings.ignoreFileCreationFolders)
                .onChange(async (value) => {
                    this.plugin.settings.ignoreFileCreationFolders = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = class AttachmentOrganizer extends Plugin {
    async onload() {
        console.log('Loading Attachment Organizer plugin');
        await this.loadSettings();

        this.addSettingTab(new AttachmentOrganizerSettingTab(this.app, this));

        this.addCommand({
            id: 'create-markdown-file',
            name: 'Create: Markdown File',
            callback: () => this.openFileCreationModal('md')
        });

        this.addCommand({
            id: 'create-pdf-file',
            name: 'Create: PDF File',
            callback: () => this.openFileCreationModal('pdf')
        });

        this.addCommand({
            id: 'organize-attachments',
            name: 'Organize Attachments',
            callback: () => this.organizeAttachments()
        });

        this.addCommand({
            id: 'find-unlinked-attachments',
            name: 'Find Unlinked Attachments',
            callback: () => this.findUnlinkedAttachments()
        });

        this.addCommand({
            id: 'purge-unlinked-attachments',
            name: 'Purge Unlinked Attachments',
            callback: () => this.purgeUnlinkedAttachments()
        });

        this.addCommand({
            id: 'move-attachments-between-folders',
            name: 'Move Attachments Between Folders',
            callback: () => this.moveAttachmentsBetweenFolders()
        });

        this.addRibbonIcon('document', 'Create File', () => this.openFileCreationModal('md'));
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

    async openFileCreationModal(type) {
        const templatesFolderPath = this.settings.templateFolder;
        const templateFiles = this.app.vault.getFiles().filter(f => f.path.startsWith(templatesFolderPath + '/') && f.extension === (type === 'pdf' ? 'pdf' : 'md'));

        const modal = new Modal(this.app);
        const { contentEl } = modal;

        let selectedTemplate = 'none';
        let fileName = '';
        let folderPath = type === 'pdf' ? 'invoices' : 'notes';
        let dateMode = 'none';

        contentEl.createEl('h2', { text: `Create new ${type.toUpperCase()} file` });

        new Setting(contentEl)
            .setName('File Name')
            .setDesc('Enter the name of your new file (without extension)')
            .addText(text => {
                text.setPlaceholder('e.g., meeting-notes')
                    .onChange(value => fileName = value.trim());
            });

        new Setting(contentEl)
            .setName('Use Template')
            .setDesc('Select a template to use for this file')
            .addDropdown(drop => {
                drop.addOption('none', 'None');
                templateFiles.forEach(f => drop.addOption(f.name, f.name));
                drop.setValue('none');
                drop.onChange(value => selectedTemplate = value);
            });

        new Setting(contentEl)
            .setName('Add Date')
            .setDesc('Add current date to the file name')
            .addDropdown(drop => {
                drop.addOption('none', 'None');
                drop.addOption('prefix', 'Prefix');
                drop.addOption('suffix', 'Suffix');
                drop.setValue('none');
                drop.onChange(value => dateMode = value);
            });

        new Setting(contentEl)
            .setName('Target Folder')
            .setDesc('Where to save the new file')
            .addDropdown(drop => {
                drop.addOption('/', '/ (root)');
                this.app.vault.getAllLoadedFiles()
                    .filter(f => f instanceof TFile === false && f.path !== '/' && !this.settings.ignoreFileCreationFolders.split(',').map(x => x.trim()).includes(f.path))
                    .forEach(folder => {
                        drop.addOption(folder.path, folder.path);
                    });
                drop.setValue(folderPath);
                drop.onChange(value => folderPath = value);
            });

        new Setting(contentEl)
            .addButton(btn =>
                btn.setButtonText('Create')
                    .setCta()
                    .onClick(async () => {
                        const date = new Date();
                        const yyyy = date.getFullYear();
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const dd = String(date.getDate()).padStart(2, '0');
                        const dateStr = `${yyyy}-${mm}-${dd}`;

                        if (!fileName) fileName = 'untitled';

                        let fullName = fileName;
                        if (dateMode === 'prefix') fullName = `${dateStr}-${fileName}`;
                        else if (dateMode === 'suffix') fullName = `${fileName}-${dateStr}`;

                        const fullPath = normalizePath(`${folderPath}/${fullName}.${type}`);

                        let content = '';
                        if (selectedTemplate !== 'none') {
                            const templateFile = templateFiles.find(f => f.name === selectedTemplate);
                            if (templateFile) {
                                content = await this.app.vault.read(templateFile);
                            }
                        }

                        await this.ensureFolderExists(folderPath);
                        await this.app.vault.create(fullPath, content);
                        new Notice(`Created ${type.toUpperCase()} file: ${fullPath}`);
                        modal.close();
                    })
            );

        modal.open();
    }

    async ensureFolderExists(folder) {
        const exists = await this.app.vault.adapter.exists(folder);
        if (!exists) await this.app.vault.createFolder(folder);
    }
};
