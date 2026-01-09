import express from "express";
import cors from "cors";
import twilio from "twilio";

const API_KEY = process.env.API_KEY;

app.post("/sendSMS", async (req, res) => {
  if (req.headers["x-api-key"] !== API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { phone, message } = req.body;
  ...
});


const app = express();
app.use(cors());
app.use(express.json());

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post("/sendSMS", async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ success: false });
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: `+${phone}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SMS server running"));
