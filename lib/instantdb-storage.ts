/**
 * Storage Helper - Migrated to Firebase
 *
 * Utilities for file handling.
 * This maintains backward compatibility with the old InstantDB storage API.
 */

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  id?: string;
  error?: string;
}

export interface UploadOptions {
  contentType?: string;
}

/**
 * Upload a file (stub implementation - extend with Firebase Storage if needed)
 *
 * @param file - The file to upload
 * @param path - Optional custom path
 * @param options - Optional upload options
 * @returns Upload result with URL
 */
export async function uploadFile(
  file: File,
  path?: string,
  options?: UploadOptions
): Promise<UploadResult> {
  try {
    // For now, return the file as a data URL
    // In production, you would upload to Firebase Storage or another service
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          success: true,
          url: reader.result as string,
          path: path || file.name,
          id: crypto.randomUUID(),
        });
      };
      reader.onerror = () => {
        resolve({
          success: false,
          error: "Failed to read file",
        });
      };
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Get a file URL
 *
 * @param path - The file path or URL
 * @returns The file URL
 */
export function getFileUrl(path: string): string {
  // If already a full URL, return as-is
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  // Otherwise return the path (could be extended to use Firebase Storage URLs)
  return path;
}

/**
 * Delete a file (stub implementation)
 *
 * @param url - The file URL to delete
 * @returns Success status
 */
export async function deleteFile(url: string): Promise<boolean> {
  console.log("deleteFile stub called for:", url);
  return true;
}

/**
 * Validate image file
 *
 * @param file - The file to validate
 * @returns Validation result
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: "File must be an image (PNG, JPG, GIF, WEBP)",
    };
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "Image must be less than 5MB",
    };
  }

  const validTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
  ];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Supported formats: PNG, JPG, GIF, WEBP",
    };
  }

  return { valid: true };
}
