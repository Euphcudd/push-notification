import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sgMail from "@sendgrid/mail";
import { db, admin } from "./firebase.js"; // import admin instead of messaging

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ----------------------
// Initialize SendGrid
// ----------------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ----------------------
// Firestore listener for new orders with status "paid"
// ----------------------
db.collection("orders")
  .where("status", "==", "paid")
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const orderId = change.doc.id;
        console.log("New order placed:", orderId);

        // Send push notification
        sendOrderPushNotification(orderId);
      }
    });
  });

// ----------------------
// Function to send push notifications (with data payload)
// ----------------------
async function sendOrderPushNotification(orderId) {
  try {
    // 1. Fetch the order document
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      console.error("Order not found:", orderId);
      return;
    }

    const orderData = orderDoc.data();

    // 2. Extract values from order document
    const customerName = orderData.address?.name || "Unknown";
    const instaHandle = orderData.address?.insta || "N/A";

    // 3. Fetch admin tokens
    const tokensSnapshot = await db.collection("adminTokens").get();
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    if (!tokens.length) return;

    // 4. Build the notification (as data only)
const message = {
  data: {
    title: "New Order Received",
    body: 
`-------------------------
Order ID: #${orderId}
Name: ${customerName}
Insta: ${instaHandle}
-------------------------`,
    orderId,
    customerName,
    instaHandle,
    click_action: "https://retro-fifty.web.app", // optional, for click redirect
  },
  tokens,
};

    // 5. Send notification
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`Push notifications sent: ${response.successCount}`);
    if (response.failureCount > 0) {
      console.error("Some notifications failed:", response.responses.filter(r => !r.success));
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

// ----------------------
// SendGrid email route
// ----------------------
app.post("/send-email", async (req, res) => {
  const { 
    to, 
    customerName, 
    orderId, 
    items, 
    subtotal,
    deliveryCharge,
    total, 
    trackingId,
    customerAddressLine1,
  } = req.body;

  if (!to || !customerName || !orderId || !items || !total || !trackingId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const msg = {
    to,
    from: {
      email: process.env.FROM_EMAIL,
      name: "RETRO FIFTY"
    },
    subject: "Your Order Has Been Shipped!",
    template_id: "d-fb8e666ee1de42afa9133334b1cd038a",
    dynamic_template_data: {
      customerName,
      orderId,
      items,
      subtotal,
      deliveryCharge,
      total,
      trackingId,
      customerAddressLine1,
      unsubscribe: "https://example.com/unsubscribe",
      unsubscribe_preferences: "https://example.com/preferences"
    }
  };

  try {
    await sgMail.send(msg);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Full error:", error);
    if (error.response) console.error("SendGrid Response Error:", error.response.body);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------
// Start Express server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));