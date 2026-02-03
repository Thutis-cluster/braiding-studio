const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Twilio = require("twilio");

const cfg = functions.config().twilio;
const client = new Twilio(cfg.sid, cfg.token);

exports.sendReminders = functions.pubsub
  .schedule("every 10 minutes")
  .onRun(async () => {
    const now = new Date();

    const snap = await admin.firestore()
      .collection("bookings")
      .where("status", "==", "Accepted")
      .where("reminderSent", "==", false)
      .get();

    snap.forEach(async doc => {
      const b = doc.data();
      const appt = new Date(`${b.date}T${b.time}`);

      const diffHours = (appt - now) / 36e5;

      if (diffHours <= 5 && diffHours > 4) {
        await client.messages.create({
          from: cfg.sms,
          to: formatPhone(b.clientPhone),
          body: `⏰ Reminder: Your appointment is at ${b.time} today.`
        });

        await doc.ref.update({ reminderSent: true });
      }
    });
  });

function formatPhone(phone) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "27" + p.slice(1);
  return "+" + p;
}
