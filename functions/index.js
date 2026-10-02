const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");
const crypto = require("crypto");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

// Helper to send Expo or FCM push notifications
async function sendPushNotification(token, title, body, data = {}) {
  if (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken')) {
    // Legacy Expo Push Token
    const messages = [{
      to: token,
      title: title,
      body: body,
      data: data,
      priority: "high",
      channelId: "default",
      badge: 1,
      displayInForeground: true,
      android: {
        channelId: "default",
        priority: "high",
        sticky: false,
        visibility: "public",
      },
    }];

    try {
      const chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
      console.log("Sent via Expo SDK to:", token);
    } catch (error) {
      console.error("Error sending Expo push notification:", error);
    }
  } else {
    // Native FCM Token
    const message = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key]);
        return acc;
      }, {}),
      android: {
        priority: "high",
        notification: {
          channelId: data.channelId || "default",
          sound: data.sound || "default",
          defaultSound: !data.sound,
          defaultVibrateTimings: true,
        },
      },
    };

    try {
      await admin.messaging().send(message);
      console.log("Sent via Firebase Admin SDK (FCM) to:", token);
    } catch (error) {
      console.error("Error sending FCM notification:", error);
    }
  }
}

// 1. Trigger when an order status changes
exports.onOrderStatusChange = onDocumentUpdated("orders/{orderId}", async (event) => {
  const newValue = event.data.after.data();
  const previousValue = event.data.before.data();

  // If status hasn't changed, check if rider was assigned
  if (newValue.status === previousValue.status) {
    if (newValue.riderId && newValue.riderId !== previousValue.riderId) {
      // Notify rider
      await db.collection("delivery_agents").doc(newValue.riderId).collection("notifications").add({
        title: "New Delivery Assigned! 🛵",
        body: "You have a new delivery order to pick up.",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "order_assigned",
        orderId: event.params.orderId,
        channelId: "high_priority_orders",
        sound: "alert.wav"
      });
    }
    return;
  }

  const status = newValue.status;
  const userId = newValue.userId;

  const userDoc = await db.collection("customers").doc(userId).get();
  if (!userDoc.exists) return;

  // Determine message based on status
  let title = "Order Update";
  let body = `Your order status has changed to ${status}.`;

  if (status === "Accepted") {
    title = "Order Accepted! ✅";
    body = "The pharmacy has accepted your order and is preparing it.";
  } else if (status === "Ready for Pickup") {
    title = "Ready for Pickup! 📦";
    body = "Your order is packed and waiting for the delivery agent.";
    
    // Also notify active riders about the new order waiting to be picked up
    const ridersSnapshot = await db.collection("delivery_agents").get();
    const batch = db.batch();
    ridersSnapshot.docs.forEach((riderDoc) => {
      const notifRef = db.collection("delivery_agents").doc(riderDoc.id).collection("notifications").doc();
      batch.set(notifRef, {
        title: "New Delivery Available! 📦",
        body: "A new order is ready for pickup near you.",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "order_ready_pickup",
        orderId: event.params.orderId,
        channelId: "high_priority_orders",
        sound: "alert.wav"
      });
    });
    await batch.commit();
    
  } else if (status === "Out for Delivery") {
    title = "Out for Delivery! 🚚";
    body = "Your medicines are on the way to you!";
  } else if (status === "Delivered") {
    title = "Order Delivered! 🎉";
    body = "Your order has been successfully delivered. Thank you for using MediDoor!";
  } else if (status === "Cancelled") {
    title = "Order Cancelled ❌";
    body = "Your order has been cancelled. If this was a mistake, please contact support.";
  }

  // Write notification to inbox - the onNotificationCreated trigger will handle push delivery
  await db.collection("customers").doc(userId).collection("notifications").add({
    title,
    body,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    type: "order_update",
    orderId: event.params.orderId
  });

  // Notify pharmacy if driver arrived
  if (status === "Driver Arrived") {
    if (newValue.pharmacyId) {
      await db.collection("pharmacies").doc(newValue.pharmacyId).collection("notifications").add({
        title: "Delivery Partner Arrived 🛵",
        body: `The delivery partner has arrived to pick up order #${newValue.numericId || event.params.orderId.slice(-6).toUpperCase()}.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "driver_arrived",
        orderId: event.params.orderId,
        channelId: "high_priority_orders",
        sound: "alert.wav"
      });
    }
  }
});

// 1.5 Trigger when a new order is placed
exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const newOrder = event.data.data();
  if (!newOrder) return;

  const pharmacyId = newOrder.pharmacyId;
  const customerId = newOrder.userId;
  const orderNumber = newOrder.numericId || event.params.orderId.slice(-6).toUpperCase();

  // 1. Notify Pharmacy
  if (pharmacyId) {
    const pharmacyDoc = await db.collection("pharmacies").doc(pharmacyId).get();
    if (pharmacyDoc.exists) {
      // Write notification to inbox - the onNotificationCreated trigger will handle push delivery
      await db.collection("pharmacies").doc(pharmacyId).collection("notifications").add({
        title: "New Order Received! 🚨",
        body: `Order #${orderNumber} is waiting for your approval.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "new_order",
        orderId: event.params.orderId,
        channelId: "high_priority_orders",
        sound: "alert.wav"
      });
    }
  }

  // 2. Notify Customer
  if (customerId) {
    const customerDoc = await db.collection("customers").doc(customerId).get();
    if (customerDoc.exists && customerDoc.data().pushToken) {
      await sendPushNotification(
        customerDoc.data().pushToken,
        "Order Placed Successfully! 🛒",
        `Your order #${orderNumber} has been placed and is awaiting pharmacy approval.`,
        { orderId: event.params.orderId }
      );
    }
  }
});

// 2. Cron Job for Monthly Refill Subscriptions
// Runs every day at 9:00 AM
exports.monthlyRefillCron = onSchedule("0 9 * * *", async (event) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  console.log("Checking for refills needed since:", thirtyDaysAgo.toISOString());

  // Query all orders that have subscribeRefill == true
  const snapshot = await db.collection("orders")
    .where("subscribeRefill", "==", true)
    .where("createdAt", "<=", thirtyDaysAgo.toISOString())
    .get();

  if (snapshot.empty) {
    console.log("No subscriptions due for refill today.");
    return;
  }

  let createdCount = 0;

  for (const doc of snapshot.docs) {
    const orderData = doc.data();
    
    const newOrderData = {
      ...orderData,
      status: 'Placed',
      createdAt: new Date().toISOString(),
      subscribeRefill: true, // The new order carries the subscription forward
      isRefill: true,
      originalOrderId: doc.id
    };

    // Remove ID if present in data
    delete newOrderData.id;
    delete newOrderData.riderId; // Reset rider
    delete newOrderData.deliveredAt;

    // Create the new order
    await db.collection("orders").add(newOrderData);
    
    // Turn off subscription on the old order so it doesn't trigger again
    await db.collection("orders").doc(doc.id).update({
      subscribeRefill: false
    });

    createdCount++;

    // Notify the user
    const userDoc = await db.collection("customers").doc(orderData.userId).get();
    if (userDoc.exists && userDoc.data().pushToken) {
      await sendPushNotification(
        userDoc.data().pushToken,
        "Monthly Refill Processed! 💊",
        "We've automatically placed your monthly medicine refill order.",
        {}
      );
    }
  }

  console.log(`Successfully processed ${createdCount} refill subscriptions.`);
});

// 3. PhonePe Integration
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX;
const PHONEPE_UAT_URL = process.env.PHONEPE_UAT_URL;

exports.initPhonePeOrder = onRequest({ invoker: 'public', cors: true }, async (req, res) => {
  const data = req.body.data || req.body;
  const { orderId, amount, userId } = data || {};
  
  if (!orderId || !amount || !userId) {
    return res.status(400).send({ error: "Missing required parameters: orderId, amount, userId" });
  }

  const payload = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId: orderId,
    merchantUserId: userId,
    amount: Math.round(amount * 100), // convert to paise
    redirectUrl: `https://us-central1-medidoor-f8af9.cloudfunctions.net/phonePeWebhook?orderId=${orderId}`,
    redirectMode: "REDIRECT",
    callbackUrl: `https://us-central1-medidoor-f8af9.cloudfunctions.net/phonePeWebhook?orderId=${orderId}`,
    mobileNumber: "9999999999", 
    paymentInstrument: {
      type: "PAY_PAGE"
    }
  };

  const base64EncodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const stringToSign = base64EncodedPayload + "/pg/v1/pay" + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const xVerify = sha256 + "###" + PHONEPE_SALT_INDEX;

  try {
    const response = await axios.post(PHONEPE_UAT_URL, {
      request: base64EncodedPayload
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify
      }
    });

    if (response.data && response.data.success) {
      return res.status(200).send({ data: { paymentLink: response.data.data.instrumentResponse.redirectInfo.url } });
    } else {
      console.error("PhonePe Initiation failed:", response.data);
      return res.status(500).send({ error: "Failed to initiate payment with PhonePe" });
    }
  } catch (error) {
    console.error("PhonePe API Error:", error.message);
    return res.status(500).send({ error: "Internal server error during payment initiation" });
  }
});

exports.phonePeWebhook = onRequest({ invoker: 'public' }, async (req, res) => {
  try {
    const orderId = req.query.orderId || req.body.transactionId;
    if (req.method === 'POST') {
       if (req.body && req.body.response) {
           const decodedResponse = Buffer.from(req.body.response, 'base64').toString('utf-8');
           const jsonResponse = JSON.parse(decodedResponse);
           
           if (jsonResponse.success && jsonResponse.code === 'PAYMENT_SUCCESS') {
               const orderSnapshot = await db.collection("orders").where("numericId", "==", orderId).get();
               if (!orderSnapshot.empty) {
                  await orderSnapshot.docs[0].ref.update({
                      paymentStatus: "paid"
                  });
               }
           }
       }
       res.status(200).send("OK");
    } else if (req.method === 'GET') {
       // PhonePe redirects back via GET when payment finishes on their UI
       res.status(200).send(`
         <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="background: #FFFFFF; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <script>
               if (window.ReactNativeWebView) {
                 window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYMENT_COMPLETE', orderId: '${orderId}' }));
               } else {
                 window.location.href = "medidoor://payment-complete?orderId=${orderId}";
               }
            </script>
          </body>
         </html>
       `);
    } else {
       res.status(405).send("Method Not Allowed");
    }
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Error");
  }
});

// 4. Trigger Push Notification when a new notification document is created
exports.onNotificationCreated = onDocumentCreated("{collectionId}/{userId}/notifications/{notifId}", async (event) => {
  console.log("onNotificationCreated triggered for path:", event.document);
  const collectionId = event.params.collectionId;
  const allowedCollections = ["customers", "pharmacies", "delivery_agents", "platformAdmins"];
  
  if (!allowedCollections.includes(collectionId)) {
    console.log("Collection not allowed:", collectionId);
    return;
  }

  const notificationData = event.data.data();
  if (!notificationData) {
    console.log("No notification data found");
    return;
  }

  console.log("Notification Data:", JSON.stringify(notificationData));

  // We only want to send push notifications for certain types, or maybe all types?
  // Since it's an admin broadcast or other system notifications, we send it.
  const title = notificationData.title || "New Notification";
  const body = notificationData.body || notificationData.message || "";
  
  const userDoc = await db.collection(collectionId).doc(event.params.userId).get();
  if (!userDoc.exists) {
    console.log("User doc does not exist:", event.params.userId);
    return;
  }

  const pushToken = userDoc.data().pushToken;
  if (!pushToken) {
    console.log("No pushToken for user:", event.params.userId);
    return;
  }

  console.log("Sending push notification to token:", pushToken);
  await sendPushNotification(pushToken, title, body, { 
    type: notificationData.type || "system",
    channelId: notificationData.channelId || "default",
    sound: notificationData.sound || ""
  });
});

// 5. Trigger when a new pharmacy registers (requires approval)
exports.onPharmacySignup = onDocumentCreated("pharmacies/{pharmacyId}", async (event) => {
  const newPharmacy = event.data.data();
  if (!newPharmacy) return;
  
  if (newPharmacy.status === 'pending' || newPharmacy.status === 'under_review') {
    const pharmacyName = newPharmacy.name || "A new pharmacy";
    
    // Get all platform admins
    const adminsSnapshot = await db.collection("platformAdmins").get();
    
    if (adminsSnapshot.empty) return;
    
    // Write notification to all admins' inboxes
    const batch = db.batch();
    adminsSnapshot.docs.forEach((adminDoc) => {
      const notifRef = db.collection("platformAdmins").doc(adminDoc.id).collection("notifications").doc();
      batch.set(notifRef, {
        title: "New Pharmacy Registration 🏥",
        body: `${pharmacyName} has registered and requires approval.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "pharmacy_signup",
        pharmacyId: event.params.pharmacyId
      });
    });
    
    await batch.commit();
  }
});

// 6. Trigger when a new Live Prescription is requested
exports.onLivePrescriptionCreated = onDocumentCreated("prescription_requests/{reqId}", async (event) => {
  const newRequest = event.data.data();
  if (!newRequest) return;
  
  if (newRequest.status === 'pending') {
    // Get all approved pharmacies
    const pharmaciesSnapshot = await db.collection("pharmacies")
      .where("status", "==", "approved")
      .get();
    
    if (pharmaciesSnapshot.empty) return;
    
    // Write notification to all pharmacies' inboxes
    const batch = db.batch();
    pharmaciesSnapshot.docs.forEach((pharmacyDoc) => {
      const data = pharmacyDoc.data();
      // Skip explicitly closed pharmacies
      if (data.open === false) return;

      const notifRef = db.collection("pharmacies").doc(pharmacyDoc.id).collection("notifications").doc();
      batch.set(notifRef, {
        title: "New Live Prescription Request 📄",
        body: "A customer nearby has uploaded a prescription. Tap to view and submit a quote!",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "live_prescription",
        requestId: event.params.reqId,
        channelId: "high_priority_orders",
        sound: "alert.wav"
      });
    });
    
    await batch.commit();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OTP Functions — reads credentials from Firestore settings/otp_config
// ─────────────────────────────────────────────────────────────────────────────
const nodemailer = require("nodemailer");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper: fetch OTP config from Firestore
async function getOtpConfig() {
  const snap = await db.collection("settings").doc("otp_config").get();
  if (!snap.exists) {
    throw new Error("OTP config not set. Please configure it in the Admin Dashboard.");
  }
  return snap.data();
}

// Helper: clean up old OTPs and save new one
async function saveOtpSession(contact, method, otp) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const existing = await db.collection("otp_sessions").where("contact", "==", contact).get();
  const batch = db.batch();
  existing.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  await db.collection("otp_sessions").add({
    contact,
    method,
    otp,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
  });
}

/**
 * sendEmailOtp — sends OTP via Gmail (FREE)
 * Admin must set settings/otp_config in Firestore:
 *   { gmailUser: "medidoor@gmail.com", gmailPass: "xxxx xxxx xxxx xxxx" }
 */
exports.sendEmailOtp = onCall(async (request) => {
  const { email } = request.data;

  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address.");
  }

  const config = await getOtpConfig();
  if (!config.gmailUser || !config.gmailPass) {
    throw new Error("Email OTP not configured. Please contact the admin.");
  }

  const otp = generateOTP();
  await saveOtpSession(email.toLowerCase().trim(), "email", otp);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.gmailUser, pass: config.gmailPass },
  });

  await transporter.sendMail({
    from: `"MediDoor" <${config.gmailUser}>`,
    to: email,
    subject: "Your MediDoor Login OTP",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #f9fafb; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1565C0; margin: 0;">MediDoor</h2>
          <p style="color: #6b7280; margin: 4px 0;">Your trusted medicine delivery app</p>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 24px; text-align: center;">
          <p style="color: #374151; font-size: 16px;">Your one-time login code is:</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #1565C0; margin: 16px 0; padding: 16px; background: #EFF6FF; border-radius: 8px;">
            ${otp}
          </div>
          <p style="color: #9ca3af; font-size: 13px;">Expires in <strong>10 minutes</strong>. Do not share this code.</p>
        </div>
        <p style="text-align: center; color: #d1d5db; font-size: 11px; margin-top: 24px;">MediDoor v3.0 • Secure Login</p>
      </div>
    `,
  });

  return { success: true };
});

/**
 * sendSmsOtp — sends OTP via 2Factor.in (10,000 FREE/month)
 * Admin must set settings/otp_config in Firestore:
 *   { twoFactorApiKey: "your-api-key-here" }
 */
exports.sendSmsOtp = onCall(async (request) => {
  const { phone } = request.data;

  const cleanPhone = String(phone).replace(/\s/g, "").replace(/^\+91/, "");
  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error("Invalid phone number. Must be 10 digits.");
  }

  const config = await getOtpConfig();
  if (!config.twoFactorApiKey) {
    throw new Error("SMS OTP not configured. Please contact the admin.");
  }

  const otp = generateOTP();
  await saveOtpSession(cleanPhone, "phone", otp);

  const url = `https://2factor.in/API/V1/${config.twoFactorApiKey}/SMS/${cleanPhone}/${otp}/MediDoor`;
  const response = await axios.get(url);

  if (response.data.Status !== "Success") {
    console.error("2Factor SMS failed:", response.data);
    throw new Error("Failed to send SMS. Please try again.");
  }

  return { success: true };
});
