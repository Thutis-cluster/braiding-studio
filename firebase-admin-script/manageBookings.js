// manageBookings.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fetchAndSortBookings() {
  try {
    const snapshot = await db.collection("bookings").get();

    if (snapshot.empty) {
      console.log("No bookings found.");
      return;
    }

    // Convert docs to an array
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by date then time
    bookings.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB;
    }));

    console.log("Sorted Bookings:");
    bookings.forEach(b => {
      console.log(`🔹 ${b.date} ${b.time} | ${b.clientName} | ${b.style} - ${b.length} | R${b.price} | Status: ${b.status}`);
    });
  } catch (err) {
    console.error("Error fetching bookings:", err);
  }
}

fetchAndSortBookings();
