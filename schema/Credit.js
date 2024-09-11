const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CreditUsageSchema = new Schema({
  date: { type: Date, default: Date.now },
  action: { type: String, required: true },
  amount: { type: Number, required: true },
  category: {
    type: String,
    enum: ["persona", "job", "email_enrich", "email_send"],
    required: true,
  },
});

const CreditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalCredits: { type: Number, default: 0 },
    availableCredits: { type: Number, default: 0 },
    usedCredits: { type: Number, default: 0 },
    creditHistory: [CreditUsageSchema],
    lastPurchaseDate: { type: Date },
    lastUsageDate: { type: Date },
  },
  {
    timestamps: true,
    strict: true,
  }
);

const Credit = mongoose.model("Credit", CreditSchema);
module.exports = Credit;
