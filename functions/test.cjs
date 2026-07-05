const crypto = require("crypto");
const axios = require("axios");

async function testPhonePe() {
  const PHONEPE_MERCHANT_ID = "PGTESTPAYUAT";
  const PHONEPE_SALT_KEY = "[REDACTED]";
  const PHONEPE_SALT_INDEX = "1";
  const PHONEPE_UAT_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";

  const orderId = "1234567890";
  const userId = "testUser123";
  const amount = 150.50;

  const payload = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId: orderId,
    merchantUserId: userId,
    amount: Math.round(amount * 100),
    redirectUrl: `https://example.com`,
    redirectMode: "REDIRECT",
    callbackUrl: `https://example.com`,
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
    console.log("SUCCESS:", JSON.stringify(response.data));
  } catch (error) {
    if (error.response) {
      console.log("ERROR 400:", JSON.stringify(error.response.data));
    } else {
      console.log("OTHER ERROR:", error.message);
    }
  }
}

testPhonePe();
