const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Twilio = require("twilio");

const cfg = functions.config().twilio;
const client = new Twilio(cfg.sid, cfg.token);

// 📌 On booking created
exports.onBookingCreated = functions.firestore
  .document("bookings/{id}")
  .onCreate(async (snap, ctx) => {
    const b = snap.data();

    const message =
`📢 NEW BOOKING
👤 ${b.clientName}
💇 ${b.style} (${b.length})
📅 ${b.date} @ ${b.time}
💰 R${b.price}`;

    // WhatsApp to admin
    await client.messages.create({
      from: `whatsapp:${cfg.whatsapp}`,
      to: `whatsapp:+27794380103`,
      body: message
    });

    // WhatsApp to client
    await client.messages.create({
      from: `whatsapp:${cfg.whatsapp}`,
      to: `whatsapp:${formatPhone(b.clientPhone)}`,
      body: `✅ Booking received!\n${message}`
    });
  });

// 📌 On payment confirmed
exports.onPaymentConfirmed = functions.firestore
  .document("bookings/{id}")
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.paymentStatus === after.paymentStatus) return;

    if (after.paymentStatus === "Deposit Paid") {
      await client.messages.create({
        from: cfg.sms,
        to: formatPhone(after.clientPhone),
        body: `💳 Deposit received for ${after.style} on ${after.date}. Thank you!`
      });
    }
  });

function formatPhone(phone) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.slice(1);
  return "+" + p;
}
