const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EmploymentHistorySchema = new Schema({
  title: String,
  start_date: Date,
  end_date: Date,
  is_current: Boolean,
  company_name: String,
  description: String,
});

const OrganizationSchema = new Schema({
  id: String,
  name: String,
  website_url: String,
  linkedin_url: String,
  primary_phone: String,
  phone: String,
  linkedin_uid: String,
  founded_year: Number,
  logo_url: String,
  primary_domain: String,
});

const ApolloPersonaSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    first_name: String,
    last_name: String,
    name: String,
    linkedin_url: String,
    title: String,
    email_status: String,
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
    phone_numbers: [String],
    intent_strength: Number,
    show_intent: Boolean,
    revealed_for_current_team: Boolean,
  },
  { timestamps: true }
);

const ApolloPersona = mongoose.model("ApolloPersona", ApolloPersonaSchema);
module.exports = ApolloPersona;
