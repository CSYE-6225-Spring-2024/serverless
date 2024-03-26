const cloudFunction = require("@google-cloud/functions-framework");
const mailgun = require("mailgun-js");
const jwt = require("jsonwebtoken");
const { Sequelize } = require("sequelize");
const { DataTypes } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PWD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  }
);

const UserVerified = sequelize.define(
  "user_verification",
  {
    id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    email_sent_time: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      allowNull: false,
    },
    email_verified_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

cloudFunction.cloudEvent("sendEmail", async (cloudEvent) => {
  try {
    const base64name = cloudEvent.data.message.data;
    const userData = Buffer.from(base64name, "base64").toString();
    if (!userData) {
      console.error("Invalid Pub/Sub message received.");
      return;
    }
    const jsonData = JSON.parse(userData);
    console.log("Data received from pubsub:", jsonData.username);
    const isDBUp = await checkDBConnection();
    if (isDBUp) {
      const token = await createToken(jsonData);
      if (token) {
        await sendEmail(token, jsonData.username);
      }
    }
  } catch (error) {
    var errorLog = { errorLog: error };
    console.error("Error processing mailgun", errorLog);
  }
});

async function checkDBConnection() {
  try {
    await sequelize.authenticate();
    console.log("Database is running");
    return true;
  } catch (error) {
    var errorDBLog = { errorDBLog: error };
    console.log("Database failed to run", errorDBLog);
    return false;
  }
}

async function createToken(userDetails) {
  await UserVerified.sync();
  const new_user = await UserVerified.create({
    username: userDetails.username,
  });
  console.log("User details from DB:", new_user);
  return new_user.id;
}

async function sendEmail(token, username) {
  const verificationLink = `http://safehubnest.me:8080/v1/user/verify?token=${token}`;
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
