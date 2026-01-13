const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();
const db = admin.firestore();

// 🔐 Twilio config (from firebase functions:config:set)
const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.token;
const TWILIO_SMS = functions.config().twilio.phone;
const TWILIO_WHATSAPP = "whatsapp:+14155238886"; // sandbox

const client = twilio(accountSid, authToken);

/* -------------------- HELPERS -------------------- */

async function sendSms(phone, message) {
  await client.messages.create({
    body: message,
    from: TWILIO_SMS,
    to: phone
  });
}

async function sendWhatsApp(phone, message) {
  await client.messages.create({
    body: message,
    from: TWILIO_WHATSAPP,
    to: "whatsapp:" + phone
  });
}

/* -------------------- 5-HOUR REMINDER JOB -------------------- */

exports.sendFiveHourReminders = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {

    const now = admin.firestore.Timestamp.now();

    const snapshot = await db.collection("bookings")
      .where("status", "==", "Accepted")
      .where("reminderSent", "==", false)
      .where("reminderAt", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("No reminders to send");
      return null;
    }

    for (const doc of snapshot.docs) {
      const booking = doc.data();

      const message =
        `⏰ Reminder\n` +
        `Hi ${booking.clientName},\n\n` +
        `Your ${booking.style} (${booking.length}) appointment is in 5 hours.\n` +
        `📅 ${booking.date}\n` +
        `🕒 ${booking.time}`;

      try {
        if (booking.method === "whatsapp") {
          await sendWhatsApp(booking.clientPhone, message);
        } else {
          await sendSms(booking.clientPhone, message);
        }

        // 🧾 Log reminder
        await db.collection("reminderLogs").add({
          bookingId: doc.id,
          clientName: booking.clientName,
          phone: booking.clientPhone,
          method: booking.method,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          type: "5-hour"
        });

        // ✅ Mark as sent
        await doc.ref.update({ reminderSent: true });

        console.log("Reminder sent to", booking.clientPhone);

      } catch (err) {
        console.error("Reminder failed for", booking.clientPhone, err);
      }
    }

    return null;
  });
