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

// Helper to send Expo push notifications
async function sendPushNotification(token, title, body, data = {}) {
  if (!Expo.isExpoPushToken(token)) {
    console.error(`Push token ${token} is not a valid Expo push token`);
    return;
  }

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
  } catch (error) {
    console.error("Error sending push notification:", error);
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
      const riderDoc = await db.collection("delivery_agents").doc(newValue.riderId).get();
      if (riderDoc.exists && riderDoc.data().pushToken) {
        await sendPushNotification(
          riderDoc.data().pushToken,
          "New Delivery Assigned! 🛵",
          "You have a new delivery order to pick up.",
          { orderId: event.params.orderId }
        );
      }
    }
    return;
  }

  const status = newValue.status;
  const userId = newValue.userId;

  // Get the customer's push token
  const userDoc = await db.collection("customers").doc(userId).get();
  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const pushToken = userData.pushToken;

  if (!pushToken) {
    console.log(`No push token for user ${userId}`);
    return;
  }

  // Determine message based on status
  let title = "Order Update";
  let body = `Your order status has changed to ${status}.`;

  if (status === "Accepted") {
    title = "Order Accepted! ✅";
    body = "The pharmacy has accepted your order and is preparing it.";
  } else if (status === "Ready for Pickup") {
    title = "Ready for Pickup! 📦";
    body = "Your order is packed and waiting for the delivery agent.";
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

  await sendPushNotification(pushToken, title, body, { orderId: event.params.orderId });
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
    if (pharmacyDoc.exists && pharmacyDoc.data().pushToken) {
      await sendPushNotification(
        pharmacyDoc.data().pushToken,
        "New Order Received! 🚨",
        `Order #${orderNumber} is waiting for your approval.`,
        { orderId: event.params.orderId }
      );
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
const PHONEPE_MERCHANT_ID = "PGTESTPAYUAT86";
const PHONEPE_SALT_KEY = "[REDACTED]";
const PHONEPE_SALT_INDEX = "1";
const PHONEPE_UAT_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";

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
