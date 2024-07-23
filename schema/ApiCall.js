const mongoose = require("mongoose");
const { Schema } = mongoose;

const ApiCallStatusEnum = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};

const RequestHeaderSchema = new Schema({
  key: String,
  value: String,
});

const RequestParameterSchema = new Schema({
  key: String,
  value: String,
});

const ApiResponseSchema = new Schema({
  statusCode: Number,
  headers: [RequestHeaderSchema],
  body: Schema.Types.Mixed, // This can hold any data type returned by the API
});

const ApiCallSchema = new Schema(
  {
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Restrict to common HTTP methods
    },
    headers: [RequestHeaderSchema],
    parameters: [RequestParameterSchema],
    requestBody: {
      type: Schema.Types.Mixed, // Allows flexibility in what can be sent
    },
    response: ApiResponseSchema,
    status: {
      type: String,
      enum: Object.values(ApiCallStatusEnum),
      default: ApiCallStatusEnum.PENDING,
    },
    error: String,
    reqId: {
      type: String,
      required: true,
    },
    callCount: {
      type: Number,
      default: 1, // Starts from 1 on the first call
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ApiCallSchema.index({ endpoint: 1, method: 1 }, { unique: true });

const ApiCall = mongoose.model("ApiCall", ApiCallSchema);

module.exports = ApiCall;
