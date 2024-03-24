const cloudFunction = require("@google-cloud/functions-framework");
const mailgun = require("mailgun-js");
const jwt = require("jsonwebtoken");

cloudFunction.cloudEvent("sendEmail", async (cloudEvent) => {
  try {
    const base64name = cloudEvent.data.message.data;
    const userData = Buffer.from(base64name, "base64").toString();
    const jsonData = JSON.parse(userData);
    if (!userData) {
      console.error("Invalid Pub/Sub message received.");
      return;
    }
    console.log(`Data received from pubsub:', ${jsonData}`);
    const token = await createToken(jsonData);
    if (token) {
      await sendEmail(token, jsonData.username);
    }
  } catch (error) {
    console.error("Error processing mailgun", JSON.stringify(error));
  }
});

async function createToken(userDetails) {
  const currTime = Math.floor(Date.now() / 1000);
  const expiryTime = currTime + 120;
  const token = jwt.sign(
    {
      username: userDetails.username,
      timestamp: currTime,
      exp: expiryTime,
    },
    "csye6225-webapp"
  );
  return token;
}

async function sendEmail(token, username) {
  const verificationLink = `https://safehubnest.me:8080/v1/user/verify?token=${token}`;
  const DOMAIN = "mailgun.safehubnest.me";
  const mg = mailgun({
    apiKey: "5e2674fcba67855d52d261cfeafb5857-309b0ef4-a134dd2c",
    domain: DOMAIN,
  });
  const data = {
    from: "Mailgun Sandbox <postmaster@mailgun.safehubnest.me>",
    to: username,
    subject: "Google Cloud: Verify User",
    template: "csye6225",
    "h:X-Mailgun-Variables": JSON.stringify({ Verify: verificationLink }),
  };
  mg.messages().send(data, function (error, body) {
    console.log(JSON.stringify(body));
  });
}
