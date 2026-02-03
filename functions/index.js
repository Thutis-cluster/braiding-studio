const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ INIT FIREBASE ADMIN ONCE
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// ---------------- CREATE BOOKING (PAYSTACK DEPOSIT) ----------------
app.get("/create-booking", async (req, res) => {
  try {
    const {
      style,
      length,
      price,
      clientName,
      clientPhone,
      date,
      time,
      method,
      email
    } = req.query;

    if (!style || !price || !clientName || !clientPhone || !date || !time || !email) {
      return res.status(400).send("Missing required fields");
    }

    const bookingRef = await db.collection("bookings").add({
      style,
      length,
      price: Number(price),
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

    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: Number(price) * 100,
        metadata: {
          bookingId: bookingRef.id,
          type: "deposit"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
        }
      }
    );

    // 🚀 Redirect user to Paystack
    return res.redirect(paystackRes.data.data.authorization_url);

  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).send("Payment initialization failed");
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
