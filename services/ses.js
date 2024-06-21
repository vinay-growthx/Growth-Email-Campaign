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

if (process.env.USE_SMTP === "SES") {
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
} else {
  smtpTransport = {
    sendMail: async (mailOptions) => {
      try {
        let { to, cc, bcc, attachments = [], ...restData } = mailOptions;
        const msg = {
          to: to && to.length ? to.split(",") : [],
          cc: cc && cc.length ? cc.split(",") : [],
          bcc: Array.isArray(bcc)
            ? bcc
            : bcc && bcc.length
            ? bcc.split(",")
            : [],
          ...restData,
          ip_pool_name: "HQ-Assessment",
          custom_args: {
            environment: process.env.ENV,
          },
        };

        try {
          if (Array.isArray(attachments) && attachments.length) {
            msg.attachments = [];
            for (let attachment of attachments) {
              const { filename, path } = attachment;
              const base64File = await fetchAndEncodeFile(path);
              msg.attachments.push({
                content: base64File,
                filename: filename,
                type: "application/octet-stream",
                disposition: "attachment",
              });
            }
          } else if (attachments && attachments.filename && attachments.path) {
            const { filename, path } = attachments;
            const base64File = await fetchAndEncodeFile(path);
            msg.attachments = [
              {
                content: base64File,
                filename: filename,
                type: "application/octet-stream",
                disposition: "attachment",
              },
            ];
          }
        } catch (error) {
          console.error("Error preparing attachments:", error);
          Sentry.captureException(error);
        }

        await sgMail.send(msg);
        console.log("Email sent successfully");
        return true;
      } catch (error) {
        console.error("Error sending email:", error);
        Sentry.captureException(error);
        if (error.response && error.response.body) {
          error = error.response.body;
        }
        console.error(error);
        return false;
      }
    },
  };
  smtpTransport1 = smtpTransport;
}

module.exports = { smtpTransport, smtpTransport1 };
