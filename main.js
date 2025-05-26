const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, normalizePath } = require('obsidian');

class AttachmentOrganizerPlugin extends Plugin {
    async onload() {
        console.log('Loading Attachment Organizer plugin');
        
        // Load settings
        await this.loadSettings();
        
        // Add settings tab
        this.addSettingTab(new AttachmentOrganizerSettingTab(this.app, this));
        
        // Add commands
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
            id: 'move-attachments',
            name: 'Move Attachments Between Folders',
            callback: () => this.moveAttachmentsBetweenFolders()
        });
        
        // Add ribbon icon
        this.addRibbonIcon('folder', 'Attachment Organizer', () => {
            new AttachmentOrganizerModal(this.app, this).open();
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
    
    async organizeAttachments() {
        const { vault } = this.app;
        const { attachmentFolder } = this.settings;
        let count = 0;
        
        try {
            // Get all files in the vault
            const files = vault.getFiles();
            
            // Filter for attachments based on extensions
            const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
            const attachments = files.filter(file => 
                attachmentExtensions.includes(file.extension.toLowerCase())
            );
            
            // Create attachment folder if it doesn't exist
            if (attachmentFolder && attachmentFolder !== '') {
                if (!await vault.adapter.exists(attachmentFolder)) {
                    await vault.createFolder(attachmentFolder);
                }
            }
            
            // Move attachments to the designated folder
            for (const file of attachments) {
                // Skip if already in the right folder
                if (file.path.startsWith(attachmentFolder)) continue;
                
                const newPath = normalizePath(`${attachmentFolder}/${file.name}`);
                try {
                    await vault.rename(file, newPath);
                    count++;
                } catch (err) {
                    console.error(`Failed to move ${file.path}: ${err}`);
                }
            }
            
            new Notice(`Organized ${count} attachments.`);
        } catch (err) {
            new Notice(`Error organizing attachments: ${err}`);
        }
    }
    
    async findUnlinkedAttachments() {
        try {
            const unlinkedFiles = await this.getUnlinkedAttachments();
            
            if (unlinkedFiles.length === 0) {
                new Notice('No unlinked attachments found.');
                return;
            }
            
            new UnlinkedAttachmentsModal(this.app, this, unlinkedFiles).open();
        } catch (err) {
            new Notice(`Error finding unlinked attachments: ${err}`);
        }
    }
    
    async purgeUnlinkedAttachments() {
        try {
            const unlinkedFiles = await this.getUnlinkedAttachments();
            
            if (unlinkedFiles.length === 0) {
                new Notice('No unlinked attachments to purge.');
                return;
            }
            
            new PurgeConfirmationModal(this.app, this, unlinkedFiles).open();
        } catch (err) {
            new Notice(`Error purging unlinked attachments: ${err}`);
        }
    }
    
    async moveAttachmentsBetweenFolders() {
        try {
            new MoveAttachmentsModal(this.app, this).open();
        } catch (err) {
            new Notice(`Error moving attachments: ${err}`);
        }
    }
    
    async getAttachmentsInFolder(folderPath) {
        const { vault } = this.app;
        const files = [];
        const supportedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'mp3', 'webm', 'wav', 'mp4', 'pdf', 'webp'];
        
        // Check if folder exists
        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            new Notice(`Folder not found: ${folderPath}`);
            return [];
        }
        
        // Get all files in vault
        const allFiles = vault.getFiles();
        
        // Filter files in the specified folder
        for (const file of allFiles) {
            if (file.path.startsWith(folderPath + '/')) {
                const extension = file.extension.toLowerCase();
                if (supportedExtensions.includes(extension)) {
                    files.push(file);
                }
            }
        }
        
        return files;
    }
    
    async moveAttachments(sourceFolder, destinationFolder, files) {
        const { vault } = this.app;
        const fileManager = this.app.fileManager;
        const movedFiles = [];
        const errors = [];
        
        // Create destination folder if it doesn't exist
        if (!(await this.app.vault.adapter.exists(destinationFolder))) {
            await this.app.vault.createFolder(destinationFolder);
        }
        
        for (const file of files) {
            try {
                const currentPath = file.path;
                const fileName = currentPath.split('/').pop();
                const newPath = `${destinationFolder}/${fileName}`;
                
                // Get TFile objects for more reliable moving
                const currentFile = this.app.vault.getAbstractFileByPath(currentPath);
                if (!currentFile || !(currentFile instanceof this.app.vault.config.TFile)) {
                    throw new Error(`File not found: ${currentPath}`);
                }
                
                // Move the file using Obsidian's API
                await vault.rename(currentFile, newPath);
                
                movedFiles.push({
                    oldPath: currentPath,
                    newPath: newPath
                });
            } catch (error) {
                console.error(`Error moving file ${file.path}:`, error);
                errors.push({
                    file: file.path,
                    error: error.message || 'Unknown error'
                });
            }
        }
        
        return { movedFiles, errors };
    }
    
    async getUnlinkedAttachments() {
        const { vault, metadataCache } = this.app;
        
        // Get all files
        const files = vault.getFiles();
        
        // Filter for attachments
        const attachmentExtensions = this.settings.attachmentExtensions.split(',').map(ext => ext.trim().toLowerCase());
        
        // Process ignored folders
        const ignoreFolders = this.settings.ignoreFolders
            .split(',')
            .map(folder => folder.trim())
            .filter(folder => folder !== '');
        
        console.log('Ignoring folders:', ignoreFolders);
        
        // Filter attachments and ignore specified folders
        const attachments = files.filter(file => {
            // Check if file is in any of the ignored folders
            if (ignoreFolders.length > 0) {
                for (const folder of ignoreFolders) {
                    if (file.path.startsWith(folder)) {
                        console.log(`Ignoring file in excluded folder: ${file.path}`);
                        return false;
                    }
                }
            }
            
            // Then check if it's an attachment by extension
            return attachmentExtensions.includes(file.extension.toLowerCase());
        });
        
        console.log(`Found ${attachments.length} total attachments to check for links`);
        
        // Get all markdown files
        const markdownFiles = files.filter(file => file.extension === 'md');
        console.log(`Scanning ${markdownFiles.length} markdown files for links`);
        
        // Extract all links from markdown files (using a map for better debugging)
        const allLinksMap = new Map(); // Maps file paths to the notes that link to them
        
        // First, directly check the file cache for links and embeds
        for (const file of markdownFiles) {
            const cache = metadataCache.getFileCache(file);
            if (!cache) continue;
            
            // Check standard links
            if (cache.links) {
                for (const link of cache.links) {
                    this.addToLinksMap(allLinksMap, link.link, file.path);
                }
            }
            
            // Check embeds
            if (cache.embeds) {
                for (const embed of cache.embeds) {
                    this.addToLinksMap(allLinksMap, embed.link, file.path);
                }
            }
            
            // Also get file content and check for alternate link formats
            this.checkFileContentForLinks(file, allLinksMap);
        }
        
        // Log all found links for debugging
        console.log('Found linked files:');
        allLinksMap.forEach((notes, link) => {
            console.log(`- ${link} (linked from ${notes.length} notes)`);
        });
        
        // Find attachments that aren't linked
        const unlinkedAttachments = attachments.filter(file => {
            // Different ways the file might be linked
            const possibleLinkFormats = [
                file.name,            // Just the filename
                file.path,            // Full path
                file.basename,        // Filename without extension
                '/' + file.path,      // Path with leading slash
                file.path.replace(/ /g, '%20'),  // URL encoded spaces
                encodeURI(file.path)  // Fully URL encoded path
            ];
            
            // Also add variations with and without the extension
            const fileBaseParts = file.basename.split('.');
            if (fileBaseParts.length > 1) {
                // Remove extension if present
                possibleLinkFormats.push(fileBaseParts[0]);
            }
            
            // Check all possible link formats
            for (const format of possibleLinkFormats) {
                if (allLinksMap.has(format)) {
                    console.log(`File ${file.path} is linked as "${format}" in ${allLinksMap.get(format).join(', ')}`);
                    return false;
                }
            }
            
            // Additional check: search for the filename in the links map keys
            // This handles cases where the link might have a slightly different format
            for (const linkPath of allLinksMap.keys()) {
                if (linkPath.includes(file.basename) || 
                    linkPath.includes(file.name)) {
                    console.log(`File ${file.path} likely matches link "${linkPath}"`);
                    return false;
                }
            }
            
            // Skip this check as it's causing issues
            // We've already done comprehensive checks above with various link formats
            
            console.log(`File ${file.path} appears to be unlinked`);
            return true;
        });
        
        console.log(`Found ${unlinkedAttachments.length} unlinked attachments out of ${attachments.length} total`);
        return unlinkedAttachments;
    }
    
    // Helper function to add links to the map
    addToLinksMap(linksMap, link, sourcePath) {
        if (!link) return;
        
        // Clean up the link path
        let linkPath = link;
        
        // Remove any link decorators like ^block-ref
        if (linkPath.includes('#^')) {
            linkPath = linkPath.split('#^')[0];
        } else if (linkPath.includes('#')) {
            linkPath = linkPath.split('#')[0];
        }
        
        // Store which note contains this link
        if (!linksMap.has(linkPath)) {
            linksMap.set(linkPath, []);
        }
        linksMap.get(linkPath).push(sourcePath);
    }
    
    // Check file content for additional link formats
    async checkFileContentForLinks(file, linksMap) {
        try {
            const content = await this.app.vault.cachedRead(file);
            if (!content) return;
            
            // Check for HTML style links: <a href="file.pdf">...
            const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/g;
            let match;
            while ((match = htmlLinkRegex.exec(content)) !== null) {
                this.addToLinksMap(linksMap, match[1], file.path);
            }
            
            // Check for Markdown links: [text](file.pdf)
            const markdownLinkRegex = /\[(?:[^\[\]]*?)\]\(([^\)]+?)\)/g;
            while ((match = markdownLinkRegex.exec(content)) !== null) {
                this.addToLinksMap(linksMap, match[1], file.path);
            }
            
            // Check for direct URL references that might be attachments
            const urlRegex = /https?:\/\/[^\s"'<>()\[\]]+\.(pdf|jpe?g|png|gif|svg|mp[34]|wav)/g;
            while ((match = urlRegex.exec(content)) !== null) {
                // Extract filename from URL
                const fileName = match[0].split('/').pop();
                this.addToLinksMap(linksMap, fileName, file.path);
            }
        } catch (err) {
            console.error(`Error checking file content for links in ${file.path}:`, err);
        }
    }
}

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: ''
};

class AttachmentOrganizerSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const {containerEl} = this;
        
        containerEl.empty();
        
        containerEl.createEl('h2', {text: 'Attachment Organizer Settings'});
        
        new Setting(containerEl)
            .setName('Attachment Folder')
            .setDesc('The folder where attachments will be organized to')
            .addTextArea(text => {
                text.setPlaceholder('attachments')
                    .setValue(this.plugin.settings.attachmentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentFolder = value;
                        await this.plugin.saveSettings();
                    });
                
                // Set appropriate size for the text area
                text.inputEl.rows = 3;
                text.inputEl.cols = 40;
            });
        
        new Setting(containerEl)
            .setName('Attachment Extensions')
            .setDesc('Comma-separated list of file extensions to consider as attachments')
            .addText(text => text
                .setPlaceholder('png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf')
                .setValue(this.plugin.settings.attachmentExtensions)
                .onChange(async (value) => {
                    this.plugin.settings.attachmentExtensions = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Ignore Folders')
            .setDesc('Comma-separated list of folder paths to ignore when finding unlinked attachments')
            .addTextArea(text => {
                text.setPlaceholder('folder1,folder2/subfolder')
                    .setValue(this.plugin.settings.ignoreFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.ignoreFolders = value;
                        await this.plugin.saveSettings();
                    });
                    
                // Make the text area taller
                text.inputEl.rows = 4;
                text.inputEl.cols = 40;
            });
        
        new Setting(containerEl)
            .setName('Confirm Purge')
            .setDesc('Show confirmation dialog before purging unlinked attachments')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.confirmPurge)
                .onChange(async (value) => {
                    this.plugin.settings.confirmPurge = value;
                    await this.plugin.saveSettings();
                }));
    }
}

class AttachmentOrganizerModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    
    onOpen() {
        const {contentEl} = this;
        
        contentEl.createEl('h2', {text: 'Attachment Organizer'});
        
        new Setting(contentEl)
            .setName('Organize Attachments')
            .setDesc('Move all attachments to the configured folder')
            .addButton(button => button
                .setButtonText('Organize')
                .onClick(() => {
                    this.plugin.organizeAttachments();
                    this.close();
                }));
        
        new Setting(contentEl)
            .setName('Find Unlinked Attachments')
            .setDesc('Find attachments that are not linked from any notes')
            .addButton(button => button
                .setButtonText('Find')
                .onClick(() => {
                    this.close();
                    this.plugin.findUnlinkedAttachments();
                }));
        
        new Setting(contentEl)
            .setName('Purge Unlinked Attachments')
            .setDesc('Find and delete attachments that are not linked from any notes')
            .addButton(button => button
                .setButtonText('Purge')
                .onClick(() => {
                    this.close();
                    this.plugin.purgeUnlinkedAttachments();
                }));
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class UnlinkedAttachmentsModal extends Modal {
    constructor(app, plugin, unlinkedFiles) {
        super(app);
        this.plugin = plugin;
        this.unlinkedFiles = unlinkedFiles;
    }
    
    onOpen() {
        const {contentEl} = this;
        
        contentEl.createEl('h2', {text: 'Unlinked Attachments'});
        contentEl.createEl('p', {text: `Found ${this.unlinkedFiles.length} unlinked attachments:`});
        
        // Log all file paths to console for debugging
        console.log('Unlinked attachments found:');
        this.unlinkedFiles.forEach(file => {
            console.log(file.path);
        });
        
        const fileList = contentEl.createEl('div', {cls: 'attachment-organizer-file-list'});
        
        for (const file of this.unlinkedFiles) {
            const fileItem = fileList.createEl('div', {cls: 'attachment-organizer-file-item'});
            
            fileItem.createEl('span', {text: file.path});
            
            const buttonContainer = fileItem.createEl('div', {cls: 'attachment-organizer-buttons'});
            
            buttonContainer.createEl('button', {text: 'Delete'})
                .addEventListener('click', async () => {
                    console.log(`Attempting to delete: ${file.path}`);
                    try {
                        // Store the parent folder path to check if it becomes empty
                        const folderPath = file.parent?.path;
                        
                        await this.plugin.app.vault.delete(file);
                        console.log(`Successfully deleted: ${file.path}`);
                        fileItem.remove();
                        
                        // Check if parent folder is now empty and delete if needed
                        if (folderPath) {
                            await this.checkAndDeleteEmptyFolder(folderPath);
                        }
                        
                        // Update count
                        const remainingCount = document.querySelectorAll('.attachment-organizer-file-item').length;
                        document.querySelector('p').textContent = `Found ${remainingCount} unlinked attachments:`;
                        
                        if (remainingCount === 0) {
                            this.close();
                            new Notice('All unlinked attachments have been deleted.');
                        }
                    } catch (err) {
                        console.error(`Failed to delete ${file.path}: ${err}`);
                        new Notice(`Failed to delete ${file.path}: ${err}`);
                    }
                });
            
            buttonContainer.createEl('button', {text: 'Open'})
                .addEventListener('click', () => {
                    this.plugin.app.workspace.getLeaf().openFile(file);
                });
        }
        
        const buttonContainer = contentEl.createEl('div', {cls: 'attachment-organizer-action-buttons'});
        
        buttonContainer.createEl('button', {text: 'Delete All'})
            .addEventListener('click', () => {
                this.close();
                new PurgeConfirmationModal(this.app, this.plugin, this.unlinkedFiles).open();
            });
        
        buttonContainer.createEl('button', {text: 'Close'})
            .addEventListener('click', () => {
                this.close();
            });
    }
    
    // Check if a folder is empty and delete it if it is
    async checkAndDeleteEmptyFolder(folderPath) {
        const { vault } = this.plugin.app;
        try {
            const folder = vault.getAbstractFileByPath(folderPath);
            if (!folder || folder.children === undefined) return;
            
            // Check if folder is empty
            if (folder.children.length === 0) {
                console.log(`Folder is empty, deleting: ${folderPath}`);
                await vault.delete(folder);
                
                // Also check parent folder
                const parentPath = folder.parent?.path;
                if (parentPath && parentPath !== "/") {
                    await this.checkAndDeleteEmptyFolder(parentPath);
                }
            }
        } catch (err) {
            console.error(`Error checking/deleting folder ${folderPath}:`, err);
        }
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class PurgeConfirmationModal extends Modal {
    constructor(app, plugin, unlinkedFiles) {
        super(app);
        this.plugin = plugin;
        this.unlinkedFiles = unlinkedFiles;
        this.affectedFolders = new Set(); // Track folders that might become empty
    }
    
    onOpen() {
        const {contentEl} = this;
        
        // Make the modal container responsive
        contentEl.addClass('attachment-organizer-modal');
        
        // Header section
        const headerEl = contentEl.createDiv({cls: 'attachment-organizer-modal-header'});
        headerEl.createEl('h2', {text: 'Confirm Purge'});
    }
}

class MoveAttachmentsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.sourceFolder = '';
        this.destinationFolder = '';
        this.files = [];
    }
    
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('attachment-organizer-modal');
        
        // Create header
        const headerEl = contentEl.createDiv('attachment-organizer-modal-header');
        headerEl.createEl('h2', { text: 'Move Attachments Between Folders' });
        
        // Create the folder selection section
        const folderSelectionEl = contentEl.createDiv('attachment-organizer-folder-selection');
        
        // Source folder input
        const sourceFolderSection = folderSelectionEl.createDiv('attachment-organizer-folder-section');
        sourceFolderSection.createEl('h3', { text: 'Source Folder:', cls: 'attachment-organizer-section-title' });
        
        const sourceFolderInput = sourceFolderSection.createEl('input', {
            type: 'text',
            placeholder: 'Enter source folder path (e.g., 00-assets)',
            cls: 'attachment-organizer-folder-input'
        });
        sourceFolderInput.value = this.sourceFolder;
        sourceFolderInput.addEventListener('input', () => {
            this.sourceFolder = sourceFolderInput.value;
        });
        
        // Destination folder input
        const destFolderSection = folderSelectionEl.createDiv('attachment-organizer-folder-section');
        destFolderSection.createEl('h3', { text: 'Destination Folder:', cls: 'attachment-organizer-section-title' });
        
        const destFolderInput = destFolderSection.createEl('input', {
            type: 'text',
            placeholder: 'Enter destination folder path (e.g., new-assets)',
            cls: 'attachment-organizer-folder-input'
        });
        destFolderInput.value = this.destinationFolder;
        destFolderInput.addEventListener('input', () => {
            this.destinationFolder = destFolderInput.value;
        });
        
        // Create button section
        const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
        
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'attachment-organizer-button'
        });
        cancelButton.addEventListener('click', () => this.close());
        
        const findButton = buttonContainer.createEl('button', {
            text: 'Find Files',
            cls: 'attachment-organizer-button'
        });
        findButton.addEventListener('click', () => this.findFiles());
    }
    
    async findFiles() {
        if (!this.sourceFolder) {
            new Notice('Please enter a source folder path');
            return;
        }
        
        if (!this.destinationFolder) {
            new Notice('Please enter a destination folder path');
            return;
        }
        
        if (this.sourceFolder === this.destinationFolder) {
            new Notice('Source and destination folders must be different');
            return;
        }
        
        // Normalize paths
        this.sourceFolder = normalizePath(this.sourceFolder);
        this.destinationFolder = normalizePath(this.destinationFolder);
        
        try {
            // Get files in source folder
            this.files = await this.plugin.getAttachmentsInFolder(this.sourceFolder);
            
            if (this.files.length === 0) {
                new Notice(`No attachments found in folder: ${this.sourceFolder}`);
                return;
            }
            
            // Show confirmation modal
            this.showConfirmation();
        } catch (err) {
            new Notice(`Error finding files: ${err}`);
            console.error('Error finding files:', err);
        }
    }
    
    showConfirmation() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('attachment-organizer-modal');
        
        // Create header
        const headerEl = contentEl.createDiv('attachment-organizer-modal-header');
        headerEl.createEl('h2', { text: 'Confirm Move' });
        headerEl.createDiv('attachment-organizer-info-text', { 
            text: `Moving ${this.files.length} files from ${this.sourceFolder} to ${this.destinationFolder}` 
        });
        
        // Create the file list container
        const fileSection = contentEl.createDiv('attachment-organizer-file-section');
        fileSection.createEl('h3', { text: 'Files to be moved:', cls: 'attachment-organizer-section-title' });
        
        const fileListEl = fileSection.createDiv('attachment-organizer-file-list');
        
        for (const file of this.files) {
            const fileItemEl = fileListEl.createDiv('attachment-organizer-file-item');
            
            // Add icon based on file type
            const iconEl = fileItemEl.createDiv('attachment-organizer-file-icon');
            let iconClass = 'document';
            const ext = file.extension.toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
                iconClass = 'image';
            } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                iconClass = 'audio-file';
            } else if (['mp4', 'webm', 'ogv'].includes(ext)) {
                iconClass = 'play';
            }
            iconEl.innerHTML = `<span class="nav-file-icon ${iconClass}"></span>`;
            
            // Add file path
            const pathEl = fileItemEl.createDiv('attachment-organizer-file-path');
            pathEl.textContent = file.path;
            pathEl.setAttribute('title', file.path); // Add tooltip for long paths
        }
        
        // Display new paths (from -> to)
        const pathsSection = contentEl.createDiv('attachment-organizer-paths-section');
        pathsSection.createEl('h3', { text: 'New paths will be:', cls: 'attachment-organizer-section-title' });
        const pathInfoEl = pathsSection.createDiv('attachment-organizer-path-info');
        pathInfoEl.createDiv('attachment-organizer-path-example', {
            text: `Example: ${this.files[0]?.path || 'file.png'} → ${this.destinationFolder}/${this.files[0]?.name || 'file.png'}`
        });
        
        // Create buttons
        const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
        
        const backButton = buttonContainer.createEl('button', {
            text: 'Back',
            cls: 'attachment-organizer-button'
        });
        backButton.addEventListener('click', () => this.onOpen());
        
        const moveButton = buttonContainer.createEl('button', {
            text: 'Move Files',
            cls: 'attachment-organizer-button attachment-organizer-button-warning'
        });
        moveButton.addEventListener('click', () => this.moveFiles());
    }
    
    async moveFiles() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('attachment-organizer-modal');
        
        contentEl.createEl('h2', { text: 'Moving Files...' });
        const statusEl = contentEl.createDiv('attachment-organizer-status');
        statusEl.setText('Please wait while files are being moved...');
        
        try {
            // Move the files
            const { movedFiles, errors } = await this.plugin.moveAttachments(this.files, this.destinationFolder);
            
            // Create summary
            contentEl.empty();
            contentEl.createEl('h2', { text: 'Move Complete' });
            
            const summaryEl = contentEl.createDiv('attachment-organizer-summary');
            summaryEl.createEl('p', { 
                text: `Successfully moved ${movedFiles.length} files to ${this.destinationFolder}.`,
                cls: 'attachment-organizer-success-text'
            });
            
            if (errors.length > 0) {
                const errorSection = contentEl.createDiv('attachment-organizer-error-section');
                errorSection.createEl('h3', { 
                    text: `Failed to move ${errors.length} files:`, 
                    cls: 'attachment-organizer-section-title attachment-organizer-error-title' 
                });
                
                const errorList = errorSection.createDiv('attachment-organizer-error-list');
                for (const error of errors) {
                    errorList.createDiv('attachment-organizer-error-item', {
                        text: `${error.file}: ${error.error}`
                    });
                }
            }
            
            // Add a done button
            const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
            const doneButton = buttonContainer.createEl('button', {
                text: 'Done',
                cls: 'attachment-organizer-button'
            });
            doneButton.addEventListener('click', () => this.close());
            
            new Notice(`Moved ${movedFiles.length} files to ${this.destinationFolder}.`);
        } catch (err) {
            statusEl.setText(`Error moving files: ${err}`);
            console.error('Error moving files:', err);
            
            // Add a close button
            const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
            const closeButton = buttonContainer.createEl('button', {
                text: 'Close',
                cls: 'attachment-organizer-button'
            });
            closeButton.addEventListener('click', () => this.close());
        }
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
};

module.exports = AttachmentOrganizerPlugin;
