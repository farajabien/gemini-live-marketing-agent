import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export interface CreateUserInput {
  email?: string;
  phone?: string;
  name: string;
  password?: string;
}

export interface MagicCodeData {
  code: string;
  identifier: string; // email or phone
  type: "email" | "phone";
  expiresAt: number;
  userId?: string; // For existing users
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a 6-digit magic code
 */
export function generateMagicCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a unique subdomain from business name
 */
export function generateSubdomain(businessName: string): string {
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Add random suffix to ensure uniqueness
  const suffix = nanoid(6).toLowerCase();
  return `${base}-${suffix}`;
}

/**
 * Validate subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
  const regex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
  return regex.test(subdomain);
}

/**
 * Create a magic code with expiry (10 minutes)
 */
export function createMagicCodeData(
  identifier: string,
  type: "email" | "phone",
  userId?: string
): MagicCodeData {
  return {
    code: generateMagicCode(),
    identifier,
    type,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    userId,
  };
}

/**
 * Verify if magic code is still valid
 */
export function isMagicCodeValid(magicCodeData: MagicCodeData): boolean {
  return Date.now() < magicCodeData.expiresAt;
}
