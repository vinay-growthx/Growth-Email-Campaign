const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ApplyOptionSchema = new Schema({
  publisher: String,
  apply_link: String,
  is_direct: Boolean,
});

const RequiredExperienceSchema = new Schema({
  no_experience_required: Boolean,
  required_experience_in_months: Number,
  experience_mentioned: Boolean,
  experience_preferred: Boolean,
});

const RequiredEducationSchema = new Schema({
  postgraduate_degree: Boolean,
  professional_certification: Boolean,
  high_school: Boolean,
  associates_degree: Boolean,
  bachelors_degree: Boolean,
  degree_mentioned: Boolean,
  degree_preferred: Boolean,
  professional_certification_mentioned: Boolean,
});

const JobHighlightsSchema = new Schema({
  Qualifications: [String],
  Responsibilities: [String],
  Benefits: [String],
});

const LinkedinJobSchema = new Schema(
  {
    job_id: { type: String, required: true, unique: true },
    employer_name: String,
    employer_logo: String,
    employer_website: String,
    employer_company_type: String,
    job_publisher: String,
    job_employment_type: String,
    job_title: String,
    job_apply_link: String,
    job_apply_is_direct: Boolean,
    job_apply_quality_score: Number,
    apply_options: [ApplyOptionSchema],
    job_description: String,
    job_is_remote: Boolean,
    job_posted_at_timestamp: Number,
    job_posted_at_datetime_utc: Date,
    job_city: String,
    job_state: String,
    job_country: String,
    job_latitude: Number,
    job_longitude: Number,
    job_benefits: [String],
    job_google_link: String,
    job_offer_expiration_datetime_utc: Date,
    job_offer_expiration_timestamp: Number,
    job_required_experience: RequiredExperienceSchema,
    job_required_skills: [String],
    job_required_education: RequiredEducationSchema,
    job_experience_in_place_of_education: Boolean,
    job_min_salary: String,
    job_max_salary: String,
    job_salary_currency: String,
    job_salary_period: String,
    job_highlights: JobHighlightsSchema,
    job_posting_language: String,
    job_onet_soc: String,
    job_onet_job_zone: Number,
    job_occupational_categories: [String],
    job_naics_code: String,
    job_naics_name: String,
    summary: String,
  },
  { timestamps: true }
);

const LinkedinJob = mongoose.model("LinkedinJob", LinkedinJobSchema);
module.exports = LinkedinJob;
