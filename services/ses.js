const AWS = require("aws-sdk");
const nodemailer = require("nodemailer");
const { Sentry } = require("../services/sentry");
const sgMail = require("@sendgrid/mail");
const axios = require("axios");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let smtpTransport, smtpTransport1;

async function fetchAndEncodeFile(s3Url) {
  try {
    const response = await axios.get(s3Url, {
      responseType: "arraybuffer",
    });
    const fileBuffer = Buffer.from(response.data, "binary");
    return fileBuffer.toString("base64");
  } catch (error) {
    console.error("Error fetching the file from S3:", error);
    throw error;
  }
}

const createTransporter = (region) => {
  const ses = new AWS.SES({
    apiVersion: "2010-12-01",
    accessKeyId: process.env.SES_AWSACCESSKEY,
    secretAccessKey: process.env.SES_AWSSECRETKEY,
    region: region,
  });
  return nodemailer.createTransport({
    SES: ses,
  });
};
smtpTransport = createTransporter(process.env.SES_AWSREGION);
smtpTransport1 = createTransporter(process.env.SES_AWSREGION);

module.exports = { smtpTransport, smtpTransport1 };
