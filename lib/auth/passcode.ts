import bcrypt from "bcryptjs";

export async function verifyPasscode(plain: string): Promise<boolean> {
  const hash = process.env.MANAGER_PASSCODE_HASH;
  if (!hash) {
    throw new Error("MANAGER_PASSCODE_HASH is not set in environment");
  }
  return bcrypt.compare(plain, hash);
}
