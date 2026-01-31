// index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
const axios = require("axios");

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

// -------------------- CREATE BOOKING --------------------
exports.createBooking = functions.https.onCall(async (data, context) => {
  const { style, length, price, clientName, clientPhone, date, time, method, email } = data;

  if (!style || !length || !price || !clientName || !clientPhone || !date || !time || !email) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  // ⏰ Calculate reminder time (5 hours before)
  const appointment = new Date(`${date}T${time}:00`);
  const reminderAt = admin.firestore.Timestamp.fromDate(
    new Date(appointment.getTime() - 5 * 60 * 60 * 1000)
  );

  // 1️⃣ Create booking
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
    paymentStatus: "Unpaid",
    reminderSent: false,
    reminderAt,

    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2️⃣ Paystack init (SERVER ONLY)
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email,
      amount: Number(price) * 100,
      metadata: { bookingId: bookingRef.id }
    },
    {
      headers: {
        Authorization: `Bearer ${functions.config().paystack.secret}`
      }
    }
  );

  await bookingRef.update({
    paymentReference: response.data.data.reference
  });

  return {
    authorization_url: response.data.data.authorization_url
  };
});

// -------------------- PAYSTACK WEBHOOK --------------------
// This handles automatic verification when payment is completed
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  const paystackSignature = req.headers['x-paystack-signature'];
  const secret = functions.config().paystack.secret;

  // Verify webhook signature for security
  const crypto = require('crypto');
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  if (hash !== paystackSignature) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  
  // Only process successful payments
  if (event.event === 'charge.success') {
    const transaction = event.data;
    const bookingId = transaction.metadata.bookingId;

    if (!bookingId) {
      console.error("Webhook missing bookingId in metadata");
      return res.status(400).send('Missing bookingId');
    }

    try {
      const bookingRef = db.collection("bookings").doc(bookingId);

      // Update booking as paid
      await bookingRef.update({
        paymentStatus: "Paid",
        verified: true,
        depositPaid: transaction.amount / 100,
        status: "Accepted",
        receiptEmailSent: false, // 👈 ADD THIS
      });

      // Send confirmation message
      const booking = (await bookingRef.get()).data();
      const message = `✅ Booking confirmed!\nHi ${booking.clientName}, your ${booking.style} (${booking.length}) appointment is confirmed.\n📅 ${booking.date}\n🕒 ${booking.time}`;

      if (booking.method === "whatsapp") await sendWhatsApp(booking.clientPhone, message);
      else await sendSms(booking.clientPhone, message);

      console.log(`Booking ${bookingId} verified and confirmed.`);
      return res.status(200).send('Webhook processed');
    } catch (err) {
      console.error("Error processing webhook:", err);
      return res.status(500).send('Internal Server Error');
    }
  } else {
    // Ignore other events
    return res.status(200).send('Event ignored');
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
