import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db, admin } from "./firebase.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// Debug helper
// ----------------------
function logDebug(message, data = null) {
  console.log(`[DEBUG] ${message}`, data || "");
}

// ----------------------
// Endpoint to send push notification after payment
// ----------------------
app.post("/send-order-notification", async (req, res) => {
  try {
    const { orderId, customerName, instaHandle } = req.body;

    logDebug("Request body received", req.body);

    if (!orderId || !customerName) {
      logDebug("Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Fetch admin FCM tokens
    const tokensSnapshot = await db.collection("adminTokens").get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    logDebug("Fetched admin tokens", tokens);

    if (!tokens.length) {
      logDebug("No admin tokens found");
      return res.status(400).json({ error: "No admin tokens found" });
    }

    // 2️⃣ Build FCM message
   const message = {
  data: { // optional extra info
    orderId,
    customerName,
    instaHandle: instaHandle || "N/A",
    click_action: "https://retro-fifty.web.app"
  },
  tokens,
  webpush: {
    notification: {
      title: `New Order Received`,
      body: `Order #${orderId} | ${customerName} | Insta: ${instaHandle || "N/A"}`,
      icon: "/assets/splash.png",
      badge: "/favicon.png",
      click_action: "https://retro-fifty.web.app"
    }
  }
};

    logDebug("FCM message payload", message);

    // 3️⃣ Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    logDebug(`FCM response`, response);

    console.log(`✅ Push notifications sent: ${response.successCount}`);
    if (response.failureCount > 0) {
      console.error("❌ Some notifications failed:", response.responses
        .map((r, idx) => r.success ? null : { token: tokens[idx], error: r.error })
        .filter(Boolean)
      );
    }

    return res.json({ success: true, message: "Notification sent successfully", response });
  } catch (error) {
    console.error("❌ Error sending push notification:", error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logDebug(`🚀 Server running on port ${PORT}`));