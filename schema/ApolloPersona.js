const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmploymentHistorySchema = new Schema({
  _id: Schema.Types.ObjectId,
  created_at: Date,
  current: Boolean,
  degree: String,
  description: String,
  emails: [String],
  end_date: Date,
  grade_level: String,
  kind: String,
  major: String,
  organization_id: String,
  organization_name: String,
  raw_address: String,
  start_date: Date,
  title: String,
  updated_at: Date,
  id: String,
  key: String,
});

const PhoneSchema = new Schema({
  number: String,
  sanitized_number: String,
  source: String,
});

const PhoneNumberSchema = new Schema({
  raw_number: String,
  sanitized_number: String,
  type: String,
  position: Number,
  status: String,
  dnc_status: String,
  dnc_other_info: String,
  dialer_flags: String,
});

const OrganizationSchema = new Schema({
  id: String,
  name: String,
  website_url: String,
  blog_url: String,
  angellist_url: String,
  linkedin_url: String,
  twitter_url: String,
  facebook_url: String,
  primary_phone: PhoneSchema,
  languages: [String],
  alexa_ranking: Number,
  phone: String,
  linkedin_uid: String,
  founded_year: Number,
  publicly_traded_symbol: String,
  publicly_traded_exchange: String,
  logo_url: String,
  crunchbase_url: String,
  primary_domain: String,
  sanitized_phone: String,
});

const ApolloPersonaSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    first_name: String,
    last_name: String,
    name: String,
    linkedin_url: String,
    title: String,
    email_status: { type: String, default: "unavailable" },
    photo_url: String,
    twitter_url: String,
    github_url: String,
    facebook_url: String,
    extrapolated_email_confidence: Number,
    headline: String,
    email: String,
    organization_id: String,
    employment_history: [EmploymentHistorySchema],
    state: String,
    city: String,
    country: String,
    organization: OrganizationSchema,
    is_likely_to_engage: Boolean,
    departments: [String],
    subdepartments: [String],
    seniority: String,
    functions: [String],
    phone_numbers: [PhoneNumberSchema],
    intent_strength: Number,
    show_intent: Boolean,
    revealed_for_current_team: Boolean,
  },
  { timestamps: true }
);

const ApolloPersona = mongoose.model("ApolloPersona", ApolloPersonaSchema);
module.exports = ApolloPersona;
