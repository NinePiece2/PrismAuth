import crypto from "crypto";

function generateKeys() {
  console.log("🔐 Generating RSA key pair for JWT signing...\n");

  // Generate RSA key pair using Node.js crypto
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  console.log("Private Key (JWT_PRIVATE_KEY):");
  console.log("================================");
  console.log(privateKey);
  console.log("\n");

  console.log("Public Key (JWT_PUBLIC_KEY):");
  console.log("================================");
  console.log(publicKey);
  console.log("\n");

  console.log("✓ Keys generated successfully!");
  console.log("\n📝 Add these to your .env file:");
  console.log('\nJWT_PRIVATE_KEY="' + privateKey.replace(/\n/g, "\\n") + '"');
  console.log('\nJWT_PUBLIC_KEY="' + publicKey.replace(/\n/g, "\\n") + '"');
}

generateKeys();
