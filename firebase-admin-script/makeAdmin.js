const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to format time as HH:mm
function formatTime(time) {
  // Accept strings like "9", "09", "9:0", "9:00"
  const parts = time.split(":");
  let h = parts[0] || "00";
  let m = parts[1] || "00";
  h = String(h).padStart(2, "0");
  m = String(m).padStart(2, "0");
  return `${h}:${m}`;
}

async function listAndFixBookings() {
  try {
    const snapshot = await db.collection("bookings").get();
    if (snapshot.empty) {
      console.log("No bookings found in Firestore.");
      return;
    }

    let updateCount = 0;

    for (const doc of snapshot.docs) {
      const booking = doc.data();
      const originalDate = booking.date;
      const originalTime = booking.time;

      const fixedDate = formatDate(originalDate);
      const fixedTime = formatTime(originalTime);

      console.log(`Booking ID: ${doc.id}`);
      console.log(`  Original Date: ${originalDate}, Time: ${originalTime}`);
      console.log(`  Fixed Date:    ${fixedDate}, Time: ${fixedTime}`);

      // Only update if something changed
      if (originalDate !== fixedDate || originalTime !== fixedTime) {
        await db.collection("bookings").doc(doc.id).update({
          date: fixedDate,
          time: fixedTime
        });
        updateCount++;
        console.log("  ✅ Updated booking in Firestore");
      }
    }

    console.log(`\nDone! ${updateCount} bookings were updated.`);
  } catch (err) {
    console.error("Error fetching or updating bookings:", err);
  }
}

listAndFixBookings();

