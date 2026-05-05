import bcrypt from "bcryptjs";

async function main() {
  const passcode = process.argv[2];

  if (!passcode || passcode.length < 4) {
    console.error("Usage: npm run hash-passcode '<passcode at least 4 chars>'");
    process.exit(1);
  }

  const hash = await bcrypt.hash(passcode, 10);
  const b64 = Buffer.from(hash, "utf-8").toString("base64");

  console.log("Add this to .env.local:");
  console.log();
  console.log(`MANAGER_PASSCODE_HASH_B64=${b64}`);
  console.log();
  console.log("(Base64-encoded to avoid Next.js env var $-expansion of the bcrypt hash.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
