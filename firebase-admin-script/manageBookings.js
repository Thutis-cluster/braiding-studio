const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fetchAndSortBookings() {
  try {
    // Fetch all bookings, sorted by date and time
    const snapshot = await db.collection("bookings")
      .orderBy("date")
      .orderBy("time")
      .get();

    if (snapshot.empty) {
      console.log("No bookings found.");
      return;
    }

    const bookings = [];
    const dailyTotals = {};    // Track total hours per day
    const dailyRevenue = {};   // Track total revenue per day

    snapshot.forEach(doc => {
      const booking = doc.data();
      booking.id = doc.id;

      // Convert timeEstimate to hours (take max)
      const hours = getHoursFromEstimate(booking.timeEstimate || "0");

      bookings.push({ ...booking, hours });

      // Aggregate daily totals
      dailyTotals[booking.date] = (dailyTotals[booking.date] || 0) + hours;
      dailyRevenue[booking.date] = (dailyRevenue[booking.date] || 0) + (booking.price || 0);
    });

    // Display sorted bookings
    console.log("=== All Bookings (sorted) ===");
    bookings.forEach(b => {
      console.log(
        `${b.date} @ ${b.time} | ${b.clientName} | ${b.style} (${b.length}) | R${b.price} | ${b.timeEstimate} | Status: ${b.status}`
      );
    });

    // Display daily summary
    console.log("\n=== Daily Summary ===");
    for (const date of Object.keys(dailyTotals).sort()) {
      console.log(`${date} → Total Hours: ${dailyTotals[date]} hrs | Revenue: R${dailyRevenue[date]}`);
    }

  } catch (err) {
    console.error("Error fetching bookings:", err);
  }
}

function getHoursFromEstimate(estimate) {
  const numbers = estimate.match(/\d+(\.\d+)?/g);
  if (!numbers) return 0;
  return Math.max(...numbers.map(Number));
}

// Run the script
fetchAndSortBookings();
