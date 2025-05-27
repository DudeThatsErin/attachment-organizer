const { Plugin, Notice, Modal, Setting, PluginSettingTab, TFile, normalizePath } = require('obsidian');

const DEFAULT_SETTINGS = {
    attachmentFolder: 'attachments',
    attachmentExtensions: 'png,jpg,jpeg,gif,bmp,svg,mp3,wav,mp4,mov,pdf',
    confirmPurge: true,
    ignoreFolders: ''
};

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
            id: 'move-attachments-between-folders',
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
                if (!currentFile || !(currentFile instanceof TFile)) {
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
            // Add safety check for large files
            if (content.length > 1000000) { // Skip files larger than ~1MB
                console.log(`Skipping large file (${content.length} bytes): ${file.path}`);
                return;
            }
            
            // Safer regex processing with iteration limits
            const MAX_ITERATIONS = 10000;
            
            // Process HTML links with iteration limit
            let match;
            let iterations = 0;
            while ((match = htmlLinkRegex.exec(content)) !== null && iterations < MAX_ITERATIONS) {
                iterations++;
                this.addToLinksMap(linksMap, match[1], file.path);
            }
            if (iterations >= MAX_ITERATIONS) {
                console.warn(`Reached iteration limit for HTML links in file: ${file.path}`);
            }
            
            // Check for Markdown links: [text](file.pdf)
            const markdownLinkRegex = /\[(?:[^\[\]]*?)\]\(([^\)]+?)\)/g;
            iterations = 0;
            while ((match = markdownLinkRegex.exec(content)) !== null && iterations < MAX_ITERATIONS) {
                iterations++;
                this.addToLinksMap(linksMap, match[1], file.path);
            }
            if (iterations >= MAX_ITERATIONS) {
                console.warn(`Reached iteration limit for Markdown links in file: ${file.path}`);
            }
            
            // Check for direct URL references that might be attachments
            const urlRegex = /https?:\/\/[^\s"'<>()\[\]]+\.(pdf|jpe?g|png|gif|svg|mp[34]|wav)/g;
            iterations = 0;
            while ((match = urlRegex.exec(content)) !== null && iterations < MAX_ITERATIONS) {
                iterations++;
                // Extract filename from URL
                const fileName = match[0].split('/').pop();
                this.addToLinksMap(linksMap, fileName, file.path);
            }
            if (iterations >= MAX_ITERATIONS) {
                console.warn(`Reached iteration limit for URL regex in file: ${file.path}`);
            }
        } catch (err) {
            console.error(`Error checking file content for links in ${file.path}:`, err);
        }
    }
}

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
            .setName('Move Attachments Between Folders')
            .setDesc('Move attachments from one folder to another')
            .addButton(button => button
                .setButtonText('Move')
                .onClick(() => {
                    this.close();
                    this.plugin.moveAttachmentsBetweenFolders();
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
        contentEl.empty();
        contentEl.addClass('attachment-organizer-modal');
        
        // Create header
        const headerEl = contentEl.createDiv('attachment-organizer-modal-header');
        headerEl.createEl('h2', {text: 'Confirm Purge'});
        
        // Description
        headerEl.createEl('p', {
            text: `The following ${this.unlinkedFiles.length} unlinked attachments will be permanently deleted.`,
            cls: 'attachment-organizer-description'
        });
        
        // File list container
        const fileListEl = contentEl.createDiv('attachment-organizer-file-list');
        
        // Create file list
        this.unlinkedFiles.forEach(file => {
            // Get parent folder to track potential empty folders
            const folderPath = file.parent?.path || '';
            if (folderPath) this.affectedFolders.add(folderPath);
            
            const fileItemEl = fileListEl.createDiv('attachment-organizer-file-item');
            fileItemEl.createDiv('attachment-organizer-file-path', {text: file.path});
        });
        
        // Warning about empty folders
        if (this.plugin.settings.deleteEmptyFolders && this.affectedFolders.size > 0) {
            const warningEl = contentEl.createDiv('attachment-organizer-warning');
            warningEl.createEl('p', {
                text: 'The following folders may become empty and will be deleted:',
                cls: 'attachment-organizer-warning-text'
            });
            
            const folderListEl = warningEl.createDiv('attachment-organizer-folder-list');
            Array.from(this.affectedFolders).forEach(folder => {
                folderListEl.createDiv('attachment-organizer-folder-item', {text: folder});
            });
        }
        
        // Create buttons
        const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
        
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'attachment-organizer-button'
        });
        cancelButton.addEventListener('click', () => this.close());
        
        const deleteButton = buttonContainer.createEl('button', {
            text: 'Delete Files',
            cls: 'attachment-organizer-button attachment-organizer-button-warning'
        });
        deleteButton.addEventListener('click', () => this.deleteFiles());
    }
    
    async deleteFiles() {
        try {
            await this.plugin.purgeUnlinkedAttachments(this.unlinkedFiles);
            this.close();
        } catch (error) {
            console.error('Error deleting files:', error);
            new Notice('Error deleting files: ' + error.message);
        }
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
    
// Add the MoveAttachmentsModal class
class MoveAttachmentsModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.sourceFolder = '';
        this.destinationFolder = '';
        this.files = [];
        this.loading = false;
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
            this.sourceFolder = sourceFolderInput.value.trim();
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
            this.destinationFolder = destFolderInput.value.trim();
        });
        
        // Status message area
        this.statusEl = folderSelectionEl.createDiv('attachment-organizer-status-message');
        
        // Create button section
        const buttonContainer = contentEl.createDiv('attachment-organizer-action-buttons');
        
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'attachment-organizer-button'
        });
        cancelButton.addEventListener('click', () => this.close());
        
        const findButton = buttonContainer.createEl('button', {
            text: 'Find Files',
            cls: 'attachment-organizer-button attachment-organizer-button-cta'
        });
        findButton.addEventListener('click', async () => {
            await this.findFiles(findButton);
        });
        
        // Focus source input
        setTimeout(() => sourceFolderInput.focus(), 50);
    }
    
    showStatus(message, type = 'info') {
        if (!this.statusEl) return;
        
        this.statusEl.empty();
        this.statusEl.setText(message);
        
        // Remove previous status classes
        this.statusEl.removeClass('status-info', 'status-error', 'status-success', 'status-warning');
        // Add the new status class
        this.statusEl.addClass(`status-${type}`);
    }
    
    async findFiles(findButton) {
        if (this.loading) return;
        
        if (!this.sourceFolder) {
            this.showStatus('Please enter a source folder path', 'error');
            return;
        }
        
        // Normalize paths
        const sourceFolder = normalizePath(this.sourceFolder);
        
        // Show loading state
        this.loading = true;
        findButton.setText('Finding files...');
        this.showStatus('Searching for attachments...', 'info');
        
        try {
            // Check if folder exists
            if (!(await this.app.vault.adapter.exists(sourceFolder))) {
                this.showStatus(`Source folder "${sourceFolder}" does not exist`, 'error');
                return;
            }
            
            // Get files in source folder
            const files = await this.plugin.getAttachmentsInFolder(sourceFolder);
            
            if (files.length === 0) {
                this.showStatus(`No attachments found in folder: ${sourceFolder}`, 'warning');
                return;
            }
            
            // Store for confirmation
            this.files = files;
            this.sourceFolder = sourceFolder;
            
            // Show confirmation modal
            this.showConfirmation();
        } catch (err) {
            this.showStatus(`Error finding files: ${err.message || err}`, 'error');
            console.error('Error finding files:', err);
        } finally {
            // Reset loading state
            this.loading = false;
            findButton.setText('Find Files');
        }
    }
    
    showConfirmation() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('attachment-organizer-modal');
        
        // Create header
        const headerEl = contentEl.createDiv('attachment-organizer-modal-header');
        headerEl.createEl('h2', { text: 'Confirm Move' });
        
        // Create destination folder input if not already set
        const folderSection = contentEl.createDiv('attachment-organizer-folder-section');
        
        // Show move details
        folderSection.createEl('p', { 
            text: `Moving ${this.files.length} files from "${this.sourceFolder}"` 
        });
        
        // Destination folder input
        folderSection.createEl('h3', { text: 'Destination Folder:', cls: 'attachment-organizer-section-title' });
        
        const destFolderInput = folderSection.createEl('input', {
            type: 'text',
            placeholder: 'Enter destination folder path (e.g., new-assets)',
            cls: 'attachment-organizer-folder-input'
        });
        destFolderInput.value = this.destinationFolder;
        destFolderInput.addEventListener('input', () => {
            this.destinationFolder = destFolderInput.value.trim();
        });
        
        // Status message for confirmation view
        this.confirmStatusEl = folderSection.createDiv('attachment-organizer-status-message');
        
        // Create the file list container
        const fileListContainer = contentEl.createDiv('attachment-organizer-file-list');
        fileListContainer.createEl('h3', { text: 'Files to be moved:' });
        
        const fileList = fileListContainer.createEl('div', { cls: 'attachment-organizer-files' });
        
        // Add each file to the list
        this.files.forEach(file => {
            fileList.createEl('div', { 
                text: file.path,
                cls: 'attachment-organizer-file-item'
            });
        });
        
        // Create button section
        const buttonSection = contentEl.createDiv('attachment-organizer-action-buttons');
        
        // Cancel button
        const cancelButton = buttonSection.createEl('button', {
            text: 'Cancel',
            cls: 'attachment-organizer-button'
        });
        cancelButton.addEventListener('click', () => this.close());
        
        // Back button
        const backButton = buttonSection.createEl('button', {
            text: 'Back',
            cls: 'attachment-organizer-button'
        });
        backButton.addEventListener('click', () => this.onOpen());
        
        // Move button
        const moveButton = buttonSection.createEl('button', {
            text: 'Move Files',
            cls: 'attachment-organizer-button attachment-organizer-button-cta'
        });
        moveButton.addEventListener('click', async () => {
            await this.moveFiles(moveButton);
        });
        
        // Focus destination input
        setTimeout(() => destFolderInput.focus(), 50);
    }
    
    showConfirmStatus(message, type = 'info') {
        if (!this.confirmStatusEl) return;
        
        this.confirmStatusEl.empty();
        this.confirmStatusEl.setText(message);
        
        // Remove previous status classes
        this.confirmStatusEl.removeClass('status-info', 'status-error', 'status-success', 'status-warning');
        // Add the new status class
        this.confirmStatusEl.addClass(`status-${type}`);
    }
    
    async moveFiles(moveButton) {
        if (this.loading) return;
        
        if (!this.destinationFolder) {
            this.showConfirmStatus('Please enter a destination folder path', 'error');
            return;
        }
        
        if (this.sourceFolder === this.destinationFolder) {
            this.showConfirmStatus('Source and destination folders must be different', 'error');
            return;
        }
        
        // Normalize destination path
        const destinationFolder = normalizePath(this.destinationFolder);
        
        // Show loading state
        this.loading = true;
        moveButton.setText('Moving files...');
        this.showConfirmStatus('Moving files...', 'info');
        
        try {
            const result = await this.plugin.moveAttachments(this.sourceFolder, destinationFolder, this.files);
            
            // Show results
            if (result.movedFiles.length > 0) {
                this.showConfirmStatus(`Successfully moved ${result.movedFiles.length} files`, 'success');
            }
            
            if (result.errors.length > 0) {
                this.showConfirmStatus(`Failed to move ${result.errors.length} files. Check console for details.`, 'error');
                console.error('Move errors:', result.errors);
            }
            
            // Close after a delay to show the status
            if (result.errors.length === 0) {
                setTimeout(() => this.close(), 2000);
            }
        } catch (err) {
            this.showConfirmStatus(`Error moving files: ${err.message || err}`, 'error');
            console.error('Error moving files:', err);
        } finally {
            // Reset loading state
            this.loading = false;
            moveButton.setText('Move Files');
        }
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = AttachmentOrganizerPlugin;
