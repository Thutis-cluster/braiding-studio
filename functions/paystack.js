const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

exports.verifyPaystackPayment = functions.https.onCall(async (data, context) => {
  const { reference, bookingId } = data;

  if (!reference || !bookingId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing reference or bookingId"
    );
  }

  const secret = functions.config().paystack.secret;

  // 🔍 Verify with Paystack
  const res = await axios.get(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );

  const trx = res.data.data;

  if (trx.status !== "success") {
    throw new functions.https.HttpsError("failed-precondition", "Payment failed");
  }

  const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
  const snap = await bookingRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Booking not found");
  }

  const booking = snap.data();

  const paidAmount = trx.amount / 100; // ZAR
  const expectedDeposit = Math.round(booking.price * 0.45);

  if (paidAmount !== expectedDeposit) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Payment amount mismatch"
    );
  }

  // ✅ Update booking securely
  await bookingRef.update({
    paymentStatus: "Deposit Paid",
    depositPaid: paidAmount,
    balanceRemaining: booking.price - paidAmount,
    paymentReference: reference
  });

  return { success: true };
});
