// index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
const axios = require("axios");
const cors = require("cors")({ origin: true }); // allow all origins

admin.initializeApp();
const db = admin.firestore();

// -------------------- TWILIO CONFIG --------------------
const client = twilio(functions.config().twilio.sid, functions.config().twilio.token);
const TWILIO_SMS = functions.config().twilio.phone;
const TWILIO_WHATSAPP = "whatsapp:+14155238886";

// -------------------- HELPERS --------------------
async function sendSms(phone, message) {
  await client.messages.create({ body: message, from: TWILIO_SMS, to: phone });
}

async function sendWhatsApp(phone, message) {
  await client.messages.create({ body: message, from: TWILIO_WHATSAPP, to: "whatsapp:" + phone });
}

// -------------------- CREATE BOOKING --------------------exports.createBooking = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const { style, length, price, clientName, clientPhone, date, time, method, email } = req.body;

      if (!style || !price || !clientName || !clientPhone || !date || !time || !email) {
        return res.status(400).send("Missing required fields");
      }

      // Save booking in Firestore
      const bookingRef = await db.collection("bookings").add({
        style,
        length,
        price,
        clientName,
        clientPhone,
        clientEmail: email,
        date,
        time,
        method,
        status: "Pending",
        paymentStatus: "Deposit Unpaid",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("✅ Booking created with ID:", bookingRef.id);

      // Initialize Paystack
      const secret = functions.config().paystack?.secret || process.env.PAYSTACK_SECRET;
      if (!secret) throw new Error("Paystack secret key not set.");

      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: Number(price) * 100,
          metadata: { bookingId: bookingRef.id, type: "deposit" }
        },
        { headers: { Authorization: `Bearer ${secret}` } }
      );

      const { authorization_url, reference } = response.data.data;

      // Update booking with payment reference
      await bookingRef.update({ paymentReference: reference });

      // 🔹 Redirect user to Paystack directly
      return res.redirect(authorization_url);

    } catch (err) {
      console.error("❌ Error in createBooking:", err.response?.data || err.message);
      return res.status(500).send("Booking failed. Please try again.");
    }
  });
});

// -------------------- PAYSTACK WEBHOOK --------------------
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  const paystackSignature = req.headers['x-paystack-signature'];
  const secret = functions.config().paystack.secret;

  const crypto = require('crypto');
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== paystackSignature) return res.status(400).send('Invalid signature');

  const event = req.body;
  if (event.event !== 'charge.success') return res.status(200).send('Event ignored');

  const transaction = event.data;
  const bookingId = transaction.metadata.bookingId;
  if (!bookingId) return res.status(400).send('Missing bookingId');

  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    const booking = bookingSnap.data();

    let updateData = {};

    if (transaction.metadata.type === "deposit") {
      // Deposit paid
      updateData = {
        paymentStatus: "Deposit Paid",
        depositPaid: transaction.amount / 100,
        balanceRemaining: booking.balanceRemaining,
        verified: true
      };
    } else if (transaction.metadata.type === "balance") {
      // Balance paid
      updateData = {
        balanceRemaining: 0,
        paymentStatus: "Fully Paid"
      };
    }

    await bookingRef.update(updateData);

    // Send confirmation message
    const message = `✅ Booking confirmed!\nHi ${booking.clientName}, your ${booking.style} (${booking.length}) appointment is confirmed.\n📅 ${booking.date}\n🕒 ${booking.time}`;

    if (booking.method === "whatsapp") await sendWhatsApp(booking.clientPhone, message);
    else await sendSms(booking.clientPhone, message);

    console.log(`Booking ${bookingId} payment processed. Type: ${transaction.metadata.type}`);
    res.status(200).send('Webhook processed');

  } catch (err) {
    console.error("Error processing webhook:", err);
    res.status(500).send('Internal Server Error');
  }
});

// -------------------- 5-HOUR REMINDER --------------------
exports.sendFiveHourReminders = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection("bookings")
      .where("status", "==", "Accepted")
      .where("reminderSent", "==", false)
      .where("reminderAt", "<=", now)
      .get();

    if (snapshot.empty) return null;

    for (const doc of snapshot.docs) {
      const booking = doc.data();
      const message = `⏰ Reminder\nHi ${booking.clientName}, your ${booking.style} (${booking.length}) appointment is in 5 hours.\n📅 ${booking.date}\n🕒 ${booking.time}`;

      try {
        if (booking.method === "whatsapp") await sendWhatsApp(booking.clientPhone, message);
        else await sendSms(booking.clientPhone, message);

        await db.collection("reminderLogs").add({
          bookingId: doc.id,
          clientName: booking.clientName,
          phone: booking.clientPhone,
          method: booking.method,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          type: "5-hour",
        });

        await doc.ref.update({ reminderSent: true });
      } catch (err) {
        console.error("Reminder failed for", booking.clientPhone, err);
      }
    }

    return null;
  });
