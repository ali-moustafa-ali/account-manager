import bcrypt from "bcryptjs";

/**
 * Reads the bcrypt hash from MANAGER_PASSCODE_HASH_B64 (base64-encoded)
 * to avoid Next.js dotenv-expand interpreting the bcrypt hash's $ characters
 * as variable references. See README "Local setup" section.
 */
export async function verifyPasscode(plain: string): Promise<boolean> {
  const b64 = process.env.MANAGER_PASSCODE_HASH_B64;
  if (!b64) {
    throw new Error("MANAGER_PASSCODE_HASH_B64 is not set in environment");
  }
  const hash = Buffer.from(b64, "base64").toString("utf-8");
  return bcrypt.compare(plain, hash);
}
