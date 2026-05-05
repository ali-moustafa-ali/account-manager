import { verifyPasscode } from "../lib/auth/passcode";

async function main() {
  console.log("Env check:");
  console.log("  MANAGER_PASSCODE_HASH set:", !!process.env.MANAGER_PASSCODE_HASH);
  console.log("  hash length:", process.env.MANAGER_PASSCODE_HASH?.length);
  console.log("  hash starts with $2:", process.env.MANAGER_PASSCODE_HASH?.startsWith("$2"));

  const correct = await verifyPasscode("1234");
  const wrong = await verifyPasscode("wrong");

  console.log("\nVerification:");
  console.log("  passcode '1234'  →", correct ? "✓ ACCEPTED" : "✗ REJECTED");
  console.log("  passcode 'wrong' →", wrong ? "✗ ACCEPTED (BUG)" : "✓ REJECTED");

  if (correct && !wrong) {
    console.log("\n✓ Auth setup works correctly. Browser sign-in will succeed.");
    process.exit(0);
  } else {
    console.log("\n✗ Auth misconfigured.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
