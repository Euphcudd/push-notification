import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, admin } from "./firebase.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// Endpoint to send push notification after payment
// ----------------------
app.post("/send-order-notification", async (req, res) => {
  try {
    const { orderId, customerName, instaHandle } = req.body;

    if (!orderId || !customerName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Fetch admin FCM tokens
    const tokensSnapshot = await db.collection("adminTokens").get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (!tokens.length) {
      return res.status(400).json({ error: "No admin tokens found" });
    }

    // 2️⃣ Build FCM message
    const message = {
      data: {
        title: "New Order Received",
        body: `-------------------------\nOrder ID: #${orderId}\nName: ${customerName}\nInsta: ${instaHandle || "N/A"}\n-------------------------`,
        orderId,
        customerName,
        instaHandle: instaHandle || "N/A",
        click_action: "https://retro-fifty.web.app", // optional redirect URL
      },
      tokens,
    };

    // 3️⃣ Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`Push notifications sent: ${response.successCount}`);
    if (response.failureCount > 0) {
      console.error("Some notifications failed:", response.responses.filter(r => !r.success));
    }

    return res.json({ success: true, message: "Notification sent successfully" });
  } catch (error) {
    console.error("Error sending push notification:", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
