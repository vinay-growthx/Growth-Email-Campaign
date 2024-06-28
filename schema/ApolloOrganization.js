const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Phone schema
const PhoneSchema = new Schema({
  number: String,
  source: String,
  sanitized_number: String,
});

// Address schema to capture detailed address information
const AddressSchema = new Schema({
  organization_raw_address: String,
  organization_city: String,
  organization_street_address: String,
  organization_state: String,
  organization_country: String,
  organization_postal_code: String,
});

// Custom fields schema for typed_custom_fields and other dynamic data
const CustomFieldsSchema = new Schema({}, { strict: false });

// Organization schema with additional fields
const OrganizationSchema = new Schema({
  id: Schema.Types.ObjectId,
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
  market_cap: String,
  address: AddressSchema,
  domain: String,
  team_id: String,
  organization_id: String,
  account_stage_id: String,
  source: String,
  original_source: String,
  creator_id: String,
  owner_id: String,
  created_at: Date,
  phone_status: String,
  hubspot_id: String,
  salesforce_id: String,
  crm_owner_id: String,
  parent_account_id: String,
  account_playbook_statuses: [String],
  account_rule_config_statuses: [String],
  existence_level: String,
  label_ids: [String],
  typed_custom_fields: CustomFieldsSchema,
  modality: String,
  source_display_name: String,
  crm_record_url: String,
  contact_emailer_campaign_ids: [String],
  contact_campaign_status_tally: CustomFieldsSchema,
  num_contacts: Number,
  last_activity_date: Date,
  intent_strength: Number,
  show_intent: Boolean,
  has_intent_signal_account: Boolean,
  intent_signal_account: String,
});

const ApolloSchema = new Schema(
  {
    breadcrumbs: [
      {
        label: String,
        signal_field_name: String,
        value: String,
        display_name: String,
      },
    ],
    partial_results_only: Boolean,
    has_join: Boolean,
    disable_eu_prospecting: Boolean,
    partial_results_limit: Number,
    pagination: {
      page: Number,
      per_page: Number,
      total_entries: Number,
      total_pages: Number,
    },
    organizations: [OrganizationSchema],
    model_ids: [String],
    derived_params: Schema.Types.Mixed,
  },
  { timestamps: true }
);

const ApolloOrganizationModel = mongoose.model(
  "ApolloOrganization",
  ApolloSchema
);

module.exports = ApolloOrganizationModel;
