require("dotenv").config();
const { createClient } = require("redis");
const { Sentry } = require("../../services/sentry");

class RedisClient {
  constructor() {
    this.client = createClient({
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      },
    });
  }
  async connectToRedis() {
    try {
      await this.client.connect();
      console.log("Connected Successfully with Redis");
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
  async setValue(key, value, expiry = 2592000) {
    // 30 days * 24 hours * 60 minutes * 60 seconds
    try {
      let valueToSet = "";
      if (typeof value === "string" || typeof value === "number") {
        valueToSet = value.toString();
      } else {
        valueToSet = JSON.stringify(value);
      }
      // 'expiry' will be 2592000 seconds (30 days) by default if not provided
      await this.client.setEx(key, expiry, valueToSet);
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getValue(key) {
    try {
      let value = await this.client.get(key);
      if (value && (value.startsWith("[") || value.startsWith("{"))) {
        value = JSON.parse(value);
      }
      return value;
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
  async delKey(key) {
    try {
      await this.client.del(key);
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
  async disconnect() {
    try {
      await this.client.disconnect();
    } catch (err) {
      Sentry.captureException(err);
      throw err;
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
