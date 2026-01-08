const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const accountSid = "YOUR_TWILIO_ACCOUNT_SID";
const authToken = "YOUR_TWILIO_AUTH_TOKEN";
const fromNumber = "YOUR_TWILIO_PHONE_NUMBER";

const client = twilio(accountSid, authToken);

app.post("/sendSMS", async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: "Missing phone or message" });

    try {
        const sms = await client.messages.create({
            body: message,
            from: fromNumber,
            to: phone
        });
        res.json({ success: true, sid: sms.sid });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(3000, () => console.log("SMS server running on port 3000"));
