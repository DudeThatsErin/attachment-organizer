class PurgeConfirmationModal extends Modal {
    constructor(app, plugin, unlinkedFiles) {
        super(app);
        this.plugin = plugin;
        this.unlinkedFiles = unlinkedFiles;
        this.affectedFolders = new Set(); // Track folders that might become empty
    }
    
    onOpen() {
        const {contentEl} = this;
        
        contentEl.createEl('h2', {text: 'Confirm Purge'});
        contentEl.createEl('p', {
            text: `Are you sure you want to delete ${this.unlinkedFiles.length} unlinked attachments? This action cannot be undone.`
        });
        
        // Log all file paths to console for debugging
        console.log('Files to be deleted:');
        this.unlinkedFiles.forEach(file => {
            console.log(file.path);
        });

        // Display file paths in the modal
        const fileListContainer = contentEl.createEl('div', {
            cls: 'attachment-organizer-file-list'
        });
        
        // Add a label
        fileListContainer.createEl('p', {
            text: 'Files to be deleted:',
            cls: 'attachment-organizer-list-label'
        });
        
        // Create scrollable list
        const fileList = fileListContainer.createEl('div', {
            cls: 'attachment-organizer-scrollable-list'
        });
        
        // Add each file path
        this.unlinkedFiles.forEach(file => {
            fileList.createEl('div', {
                text: file.path,
                cls: 'attachment-organizer-file-path'
            });
        });
        
        const buttonContainer = contentEl.createEl('div', {cls: 'attachment-organizer-action-buttons'});
        
        buttonContainer.createEl('button', {text: 'Cancel'})
            .addEventListener('click', () => {
                this.close();
            });
        
        buttonContainer.createEl('button', {text: 'Delete All', cls: 'mod-warning'})
            .addEventListener('click', async () => {
                let successCount = 0;
                let errorCount = 0;
                
                // Log again before actual deletion
                console.log('Starting deletion of files:');
                
                // Track potential empty folders
                for (const file of this.unlinkedFiles) {
                    // Add the parent folder path to our tracking set
                    const folderPath = file.parent?.path;
                    if (folderPath) {
                        this.affectedFolders.add(folderPath);
                    }
                    
                    console.log(`Attempting to delete: ${file.path}`);
                    try {
                        await this.plugin.app.vault.delete(file);
                        console.log(`Successfully deleted: ${file.path}`);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to delete ${file.path}: ${err}`);
                        errorCount++;
                    }
                }
                
                // Check and delete empty folders
                let deletedFolders = 0;
                if (successCount > 0) {
                    deletedFolders = await this.deleteEmptyFolders();
                }
                
                this.close();
                
                if (deletedFolders > 0) {
                    new Notice(`Deleted ${successCount} unlinked attachments and ${deletedFolders} empty folders. ${errorCount > 0 ? `Failed to delete ${errorCount} files.` : ''}`);
                } else {
                    new Notice(`Deleted ${successCount} unlinked attachments. ${errorCount > 0 ? `Failed to delete ${errorCount} files.` : ''}`);
                }
            });
    }
    
    // Check for and delete empty folders
    async deleteEmptyFolders() {
        const { vault } = this.plugin.app;
        let deletedFolderCount = 0;
        let foldersToCheck = Array.from(this.affectedFolders);
        
        // Sort folders by depth (deepest first) to handle nested folders properly
        foldersToCheck.sort((a, b) => {
            const depthA = a.split('/').length;
            const depthB = b.split('/').length;
            return depthB - depthA; // Descending order
        });
        
        console.log('Checking folders for emptiness:', foldersToCheck);
        
        // Process folders from deepest to shallowest
        for (const folderPath of foldersToCheck) {
            try {
                // Get folder from path
                const folder = vault.getAbstractFileByPath(folderPath);
                if (!folder || folder.children === undefined) continue;
                
                // Check if folder is empty
                if (folder.children.length === 0) {
                    console.log(`Folder is empty, deleting: ${folderPath}`);
                    await vault.delete(folder);
                    deletedFolderCount++;
                    
                    // If we deleted a folder, we need to check its parent too
                    const parentPath = folder.parent?.path;
                    if (parentPath && parentPath !== "/") {
                        this.affectedFolders.add(parentPath);
                        foldersToCheck.push(parentPath);
                    }
                } else {
                    console.log(`Folder is not empty, skipping: ${folderPath} (${folder.children.length} items)`);
                }
            } catch (err) {
                console.error(`Error checking/deleting folder ${folderPath}:`, err);
            }
        }
        
        return deletedFolderCount;
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
