const admin = require("firebase-admin");

// Load your service account key (make sure this file exists in the same folder)
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Replace with the UID of the user you want to make admin
const uid = "USER_UID_HERE";

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Success! User ${uid} is now an admin.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error assigning admin role:", error);
    process.exit(1);
  });
