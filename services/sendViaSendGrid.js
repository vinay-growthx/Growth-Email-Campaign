const sgMail = require("@sendgrid/mail");

async function sendEmailViaSendGrid(
  to,
  from,
  subject,
  text,
  emailRepositoryId,
  attachmentData,
  attachment,
  bcc,
  workflowId,
  sendGridPoolName,
  senderName,
  candidateId,
  emailType
) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  if (process.env.ENV !== "production") {
    to = ["hqchrome@hirequotient.com"];
  }
  // const modifiedText = `${text}<span style="display:none">${emailRepositoryId}</span>`;
  let msg = {};
  to = typeof to === "string" ? to.split(",") : to;
  bcc = typeof bcc === "string" ? bcc.split(",") : bcc;
  senderName =
    senderName && senderName.length ? `${senderName}<${from}>` : from;
  try {
    if (attachment) {
      msg = {
        to: to,
        from: senderName,
        subject: subject,
        html: text,
        bcc: bcc,
        headers: {
          [uniqueHeader]: emailRepositoryId,
        },
        ip_pool_name:
          sendGridPoolName && sendGridPoolName.length
            ? sendGridPoolName
            : "HQ-Assessment",
        custom_args: {
          environment: process.env.MACHINE_TYPE,
        },
        attachments: await prepareAttachments(attachmentData),
      };
    } else {
      msg = {
        to: to,
        from: senderName,
        subject: subject,
        html: text,
        bcc: bcc,
        headers: {
          [uniqueHeader]: emailRepositoryId,
        },
        ip_pool_name: sendGridPoolName ? sendGridPoolName : "HQ-Assessment",
        custom_args: {
          environment: process.env.SENDGRID_ENV,
        },
      };
    }
    const response = await sgMail.send(msg);
    console.log("Email sent using Send Grid!");
    await sendGridEmailProviderMetricsRepository.create({
      messageId: response[0].headers["x-message-id"],
      emailId: to.join(","),
      emailRepositoryId,
      workflowId,
      candidateId,
      emailType,
      bcc,
    });
    return response;
  } catch (error) {
    console.error(error);
    if (error.response && error.response.body) {
      error = error.response.body;
    }
    if (error.response && error.response.body && error.response.body.errors) {
      console.log(error.response.body.errors);
    }
    console.log(error);
  }
}
module.exports = { sendEmailViaSendGrid };
