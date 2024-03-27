const cloudFunction = require("@google-cloud/functions-framework");
const mailgun = require("mailgun-js");
const { Sequelize, DataTypes } = require("sequelize");

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

cloudFunction.http("sendEmail", async (req, res) => {
  try {
    const base64name = req.body.message.data;
    const userData = Buffer.from(base64name, "base64").toString();
    if (!userData) {
      console.error("Invalid Pub/Sub message received.");
      res.status(400).send();
      return;
    }
    const jsonData = JSON.parse(userData);
    console.log("Data received from pubsub:", jsonData.username);
    const isDBUp = await checkDBConnection();
    if (isDBUp) {
      const token = await createToken(jsonData);
      if (token) {
        await sendEmail(token, jsonData.username);
        res.status(200).send();
        return;
      }
    }
    res.status(200).send();
  } catch (error) {
    var errorLog = { errorLog: error };
    console.error("Error processing mailgun", JSON.stringify(errorLog));
    res.status(400).send();
    return;
  }
});

async function checkDBConnection() {
  try {
    await sequelize.authenticate();
    console.log("Database is running");
    return true;
  } catch (error) {
    var errorDBLog = { errorDBLog: error };
    console.log("Database failed to run", JSON.stringify(errorDBLog));
    return false;
  }
}

async function createToken(userDetails) {
  await UserVerified.sync();
  const new_user = await UserVerified.create({
    username: userDetails.username,
  });
  console.log("User details from DB:", JSON.stringify(new_user));
  return new_user.id;
}

async function sendEmail(token, username) {
  const verificationLink = `http://${process.env.DOMAIN}:8080/v1/user/verify?token=${token}`;
  const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;
  const mg = mailgun({
    apiKey: process.env.MAILGUN_API,
    domain: EMAIL_DOMAIN,
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
