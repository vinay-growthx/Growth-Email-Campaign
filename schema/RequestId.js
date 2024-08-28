const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const RequestIdSchema = new Schema(
  {
    reqId: { type: String, required: true, unique: true },
    jobIds: { type: [String], default: [] },
    personaIds: { type: [String], default: [] },
    convertJobObject: { type: Object },
    personaProcessCompleted: { type: Boolean, default: false },
    jobProcessCompleted: { type: Boolean, default: false },
    notify: { type: Boolean, default: false },
    email: { type: String },
  },
  {
    timestamps: true,
    strict: true,
  }
);

const RequestId = mongoose.model("RequestId", RequestIdSchema);
module.exports = RequestId;
