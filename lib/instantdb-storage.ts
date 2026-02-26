/**
 * InstantDB Storage Helper
 *
 * Utilities for uploading and managing files using InstantDB's storage feature.
 * https://www.instantdb.com/docs/storage
 */

import { db } from "./instant-client";

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
 * Upload a file to InstantDB storage
 *
 * @param file - The file to upload
 * @param path - Optional custom path (defaults to auto-generated)
 * @param options - Optional upload options (contentType)
 * @returns Upload result with URL
 */
export async function uploadFile(
  file: File,
  path?: string,
  options?: UploadOptions
): Promise<UploadResult> {
  try {
    // Generate path if not provided
    const fileName = path || `uploads/${Date.now()}-${file.name}`;

    console.log("📤 Uploading file:", fileName);

    // Upload to InstantDB storage with correct API
    const opts = {
      contentType: options?.contentType || file.type,
    };
    
    const { data } = await db.storage.uploadFile(fileName, file, opts);

    console.log("✅ File uploaded successfully, ID:", data.id);

    // Return the path data
    // Note: To get a displayable URL, the client must query $files or use a Signed URL
    return {
      success: true,
      path: fileName,
      id: data.id,
      url: fileName, // Returning path as 'url' for compatibility, consumer should resolve it
    };
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload an image for inventory item
 *
 * @param file - The image file to upload
 * @param itemId - The inventory item ID
 * @returns Upload result with URL
 */
export async function uploadInventoryImage(
  file: File,
  itemId: string
): Promise<UploadResult> {
  try {
    // Validate file is an image
    if (!file.type.startsWith("image/")) {
      return {
        success: false,
        error: "File must be an image",
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "Image must be less than 5MB",
      };
    }

    // Generate unique path
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `inventory/${itemId}-${Date.now()}.${ext}`;

    return await uploadFile(file, fileName, {
      contentType: file.type,
    });
  } catch (error) {
    console.error("❌ Error uploading inventory image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete a file from InstantDB storage
 *
 * @param url - The file URL to delete
 * @returns Success status
 */
export async function deleteFile(url: string): Promise<boolean> {
  try {
    console.log("🗑️ Deleting file:", url);

    await db.storage.delete(url);

    console.log("✅ File deleted successfully");
    return true;
  } catch (error) {
    console.error("❌ Error deleting file:", error);
    return false;
  }
}

/**
 * Get a file URL from InstantDB storage
 *
 * @param path - The file path
 * @returns The file URL
 */
export function getFileUrl(path: string): string {
  return db.storage.getDownloadUrl(path) as any;
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
  // Check file type
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: "File must be an image (PNG, JPG, GIF, WEBP)",
    };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "Image must be less than 5MB",
    };
  }

  // Check image dimensions (optional)
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

/**
 * Validate any file based on accept string
 *
 * @param file - The file to validate
 * @param accept - The accept string (e.g. "image/*,application/pdf")
 * @returns Validation result
 */
export function validateFile(file: File, accept?: string): {
  valid: boolean;
  error?: string;
} {
  // If no accept string, allow everything
  if (!accept || accept === "*") {
    return { valid: true };
  }

  const acceptedTypes = accept.split(",").map(t => t.trim());
  const fileType = file.type;
  
  // Check if file type matches any accepted type
  const isTypeValid = acceptedTypes.some(type => {
    // Handle wildcards like image/*
    if (type.endsWith("/*")) {
      const mainType = type.split("/")[0];
      return fileType.startsWith(`${mainType}/`);
    }
    // Handle explicit extensions like .pdf (mapped to MIME types usually, but here we check MIME)
    // Note: This is a simple check. For robust file input behavior, usually relying on the input itself is best, 
    // but here we validate post-select.
    return type === fileType;
  });

  if (!isTypeValid) {
     return {
        valid: false,
        error: `File type ${fileType} is not supported. Allowed: ${accept}`,
     };
  }

  // Generic size limit (10MB for documents, 5MB for images usually, but let's stick to 10MB global for now or parameterize)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File must be less than 10MB",
    };
  }

  return { valid: true };
}
