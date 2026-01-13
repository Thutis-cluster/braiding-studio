// index.js (Node.js)
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // download from Firebase Console

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixOldBookings() {
  try {
    const snapshot = await db.collection("bookings").get();
    if (snapshot.empty) {
      console.log("📂 No bookings to fix.");
      return;
    }

    let batch = db.batch();
    let updatesCount = 0;

    snapshot.forEach(doc => {
      const booking = doc.data();
      const bookingRef = db.collection("bookings").doc(doc.id);

      let updateData = {};

      // Fix 'date' field: must be YYYY-MM-DD
      if (booking.date) {
        const parsedDate = new Date(booking.date);
        if (!isNaN(parsedDate)) {
          const yyyy = parsedDate.getFullYear();
          const mm = String(parsedDate.getMonth() + 1).padStart(2, "0");
          const dd = String(parsedDate.getDate()).padStart(2, "0");
          updateData.date = `${yyyy}-${mm}-${dd}`;
        }
      }

      // Fix 'time' field: must be HH:mm
      if (booking.time) {
        let [h, m] = booking.time.split(":");
        if (h !== undefined && m !== undefined) {
          h = String(parseInt(h, 10)).padStart(2, "0");
          m = String(parseInt(m, 10)).padStart(2, "0");
          updateData.time = `${h}:${m}`;
        }
      }

      if (Object.keys(updateData).length > 0) {
        batch.update(bookingRef, updateData);
        updatesCount++;
      }
    });

    if (updatesCount === 0) {
      console.log("✅ All bookings already correctly formatted.");
      return;
    }

    await batch.commit();
    console.log(`✅ Fixed ${updatesCount} bookings in Firebase!`);
  } catch (err) {
    console.error("❌ Error fixing bookings:", err);
  }
}

fixOldBookings();
