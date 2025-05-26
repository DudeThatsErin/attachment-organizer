# Attachment Organizer for Obsidian

A plugin that helps you organize attachments in your Obsidian vault, find unlinked files, and move attachments between folders.

## Features

- **Organize Attachments**: Automatically move all attachments to a designated folder
- **Find Unlinked Attachments**: Identify attachments that aren't linked in any note
- **Purge Unlinked Attachments**: Safely delete unlinked attachments with confirmation
- **Move Attachments Between Folders**: Easily move attachments from one folder to another
- **Clean Empty Folders**: Automatically remove empty folders after operations

## Installation with BRAT

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian Community Plugins
2. Open BRAT settings
3. Click "Add Beta Plugin"
4. Enter the repository URL: `https://github.com/DudeThatsErin/attachment-organizer`
5. Click "Add Plugin"
6. Go to Community Plugins in Obsidian settings and enable "Attachment Organizer"

## Usage

### Organizing Attachments

The plugin will automatically organize your attachments into a designated folder (default: "00-assets").

1. Go to Settings > Attachment Organizer
2. Set your preferred attachment folder path
3. Run the "Organize Attachments" command from the Command Palette (Ctrl/Cmd+P)

### Finding Unlinked Attachments

1. Run the "Find Unlinked Attachments" command from the Command Palette
2. The plugin will list all attachments not linked in any note

### Purging Unlinked Attachments

1. Run the "Purge Unlinked Attachments" command from the Command Palette
2. Review the list of files to be deleted in the confirmation modal
3. Click "Delete Files" to permanently remove the unlinked attachments

### Moving Attachments Between Folders

1. Run the "Move Attachments Between Folders" command from the Command Palette
2. Enter the source folder path (e.g., "00-assets/old-images")
3. Enter the destination folder path (e.g., "00-assets/new-images")
4. Click "Find Files" to locate attachments in the source folder
5. Review the files to be moved in the confirmation modal
6. Click "Move Files" to transfer the attachments to the destination folder

## Screenshots

![image](https://github.com/user-attachments/assets/98e1c1bc-7160-4d07-a389-937d4e927b81)
<img width="702" alt="image" src="https://github.com/user-attachments/assets/129e9133-be0c-4ff8-a0c4-a1fe78aebac8" />



## Configuration

You can configure the following settings:

- **Attachment Folder**: The folder where attachments will be organized
- **Attachment Extensions**: File extensions to be considered as attachments
- **Delete Empty Folders**: Whether to automatically delete empty folders after purging

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/DudeThatsErin/attachment-organizer).
