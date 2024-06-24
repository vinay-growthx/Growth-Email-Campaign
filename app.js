/**
 * Backend Server startup file, handles incoming APIs
 */
"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const Fuse = require("fuse.js");
const port = process.env.PORT || 4000;

const healthRouter = require("./api/health/routes")();
const logtail = require("./services/logtail");
const { Sentry } = require("./services/sentry");
const redisClient = require("./services/redis/index");

const app = express();

// Set EJS as the templating engine
app.set("view engine", "ejs");
// Optional: Specify the directory for EJS templates, default is /views
app.set("views", "./views");

mongoose.set("strictQuery", false);
const database = process.env.DATABASE;

/**
 * Middleware to set headers for incoming requests
 */
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

app.use(cors());
app.use((req, res, next) => {
  if (process.env.ENV === "production") {
    const transaction = Sentry.startTransaction({
      op: "Backend",
      name: "HireQuotient BE",
    });
    const date = new Date();
    const dateString = date.toISOString();

    transaction.setName(dateString);
  }
  express.urlencoded({ extended: true, limit: "500mb" });
  express.json({ limit: "500mb" })(req, res, next);
});

/**
 * Routers Setup
 */
app.use("/", healthRouter);

/**
 * Server Configuration
 */
const db = mongoose.connection;
app.listen(port, function () {
  logtail.info(
    `HQ-Server:: HQ-Sourcing Server is Running on http://localhost:${port}`
  );
  console.log(`HQ-Sourcing Server is Running on http://localhost:${port}`);
  const serviceAccount = require("./hq-sourcing-firebase-adminsdk.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  mongoose.connect(database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  db.on("error", function (err) {
    db.close();
  });
  db.once("open", async function () {
    console.log(`Connected successfully with HQ-Sourcing database`);
    logtail.info("MongoDB:: Connected successfully with HQ-Sourcing database");
    redisClient
      .connectToRedis()
      .then(() => {
        console.log("Connected to Redis successfully.");
      })
      .catch((error) => {
        console.error("Failed to connect to Redis:", error);
      });

    // Placeholder for message broker connection, if applicable
    // /*
    // messageBroker.connect().then(() => {
    //   logtail.info("AMQP:: Connected successfully with RabbitMQ");
    // }).catch((err) => {
    //   logtail.error(JSON.stringify({ message: "Error while connecting with RabbitMQ:: ", err }));
    //   console.log("Error while connecting with RabbitMQ:: ", err);
    // });
    // */
  });
});

process.on("SIGINT", async function () {
  await db.close();
  await redisClient.disconnect();
  process.exit(0);
});
