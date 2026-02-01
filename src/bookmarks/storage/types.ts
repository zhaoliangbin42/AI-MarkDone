/**
 * Bookmark types.
 */

/**
 * Folder structure - Path-based architecture
 * No IDs, paths are the primary keys
 */
export interface Folder {
    path: string;          // Full path (e.g., "Work/AI Research") - PRIMARY KEY
    name: string;          // Folder name (last segment of path)
    depth: number;         // 1, 2, or 3
    createdAt: number;     // Timestamp
    updatedAt: number;     // Timestamp
}

/**
 * Simple bookmark structure
 */
export interface Bookmark {
    url: string;
    urlWithoutProtocol: string;
    position: number;
    userMessage: string;
    aiResponse?: string; // AI response text (optional, based on settings)
    timestamp: number;
    title: string; // Custom title (required)
    platform: 'ChatGPT' | 'Gemini' | 'Claude' | 'Deepseek' | string; // Platform identifier (extensible)
    folderPath: string; // Full folder path (required, e.g., "Work/AI Research")
}

/**
 * Folder tree node for UI rendering
 * Represents a folder with its children and bookmarks
 */
export interface FolderTreeNode {
    folder: Folder;
    children: FolderTreeNode[];
    bookmarks: Bookmark[];
    isExpanded: boolean;
    isSelected: boolean;
}
