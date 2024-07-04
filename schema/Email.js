const mongoose = require("mongoose");
const { Schema } = mongoose;

const AttachmentSchema = new Schema({
  filename: String,
  content: Buffer,
  contentType: String,
});
const EmailStatusEnum = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};
const EmailTemplateSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  aiGeneratedSubject: {
    type: String,
  },
  body: {
    type: String,
    required: true,
  },
  variables: [String],
});

const EmailSchema = new Schema(
  {
    sesMessageId: {
      type: String,
    },
    fromEmail: {
      type: String,
      required: true,
    },
    toEmails: [
      {
        type: String,
        required: true,
      },
    ],
    subject: {
      type: String,
      required: true,
    },
    originalBody: {
      type: String,
      required: true,
    },
    personalizedBody: {
      type: String,
      required: true,
    },
    attachments: [AttachmentSchema],
    templates: [EmailTemplateSchema],
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(EmailStatusEnum),
      default: EmailStatusEnum.PENDING,
    },
    error: String,
    reqId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Email = mongoose.model("Email", EmailSchema);

module.exports = Email;
