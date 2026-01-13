/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

exports.sendFiveHourReminders = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db.collection("bookings")
      .where("status", "==", "Accepted")
      .where("reminderSent", "==", false)
      .where("reminderAt", "<=", now)
      .get();

    snapshot.forEach(async doc => {
      const booking = doc.data();

      // 🔔 SEND REMINDER (WhatsApp or SMS)
      console.log("Sending reminder to:", booking.clientPhone);

      // Example: call your SMS / WhatsApp API here

      await doc.ref.update({ reminderSent: true });
    });

    return null;
  });

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();
const db = admin.firestore();

const client = twilio(
  functions.config().twilio.sid,
  functions.config().twilio.token
);

const TWILIO_SMS = functions.config().twilio.phone;
const TWILIO_WHATSAPP = "whatsapp:+14155238886"; // Twilio sandbox

async function sendSmsReminder(booking, message) {
  await client.messages.create({
    body: message,
    from: TWILIO_SMS,
    to: booking.clientPhone
  });
}

async function sendWhatsAppReminder(booking, message) {
  await client.messages.create({
    body: message,
    from: TWILIO_WHATSAPP,
    to: "whatsapp:" + booking.clientPhone
  });
}

exports.sendFiveHourReminders = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {

    const now = admin.firestore.Timestamp.now();

    const snapshot = await db.collection("bookings")
      .where("status", "==", "Accepted")
      .where("reminderSent", "==", false)
      .where("reminderAt", "<=", now)
      .get();

    for (const doc of snapshot.docs) {
      const booking = doc.data();

      const message =
        `⏰ Reminder:\nHi ${booking.clientName},\n` +
        `Your ${booking.style} appointment is in 5 hours.\n` +
        `📅 ${booking.date}\n🕒 ${booking.time}`;

      if (booking.method === "whatsapp") {
        await sendWhatsAppReminder(booking, message);
      } else {
        await sendSmsReminder(booking, message);
      }

      // 🧾 LOG REMINDER
      await db.collection("reminderLogs").add({
        bookingId: doc.id,
        clientName: booking.clientName,
        phone: booking.clientPhone,
        method: booking.method,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "5-hour"
      });

      await doc.ref.update({ reminderSent: true });
    }

    return null;
  });



// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
