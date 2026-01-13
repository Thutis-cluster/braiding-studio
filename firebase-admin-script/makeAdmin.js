const admin = require("firebase-admin");

// Load your service account key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Replace with your user's UID
const uid = "YOUR_USER_UID_HERE";

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`Success! User ${uid} is now an admin.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error assigning admin role:", error);
    process.exit(1);
  });
