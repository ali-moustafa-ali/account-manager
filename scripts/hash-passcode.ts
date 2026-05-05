import bcrypt from "bcryptjs";

async function main() {
  const passcode = process.argv[2];

  if (!passcode || passcode.length < 4) {
    console.error("Usage: npm run hash-passcode '<passcode at least 4 chars>'");
    process.exit(1);
  }

  const hash = await bcrypt.hash(passcode, 10);

  console.log("Add this to .env.local as MANAGER_PASSCODE_HASH:");
  console.log();
  console.log(hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
