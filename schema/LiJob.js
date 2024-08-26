const mongoose = require("mongoose");
const { Schema } = mongoose;

// Company Schema
const CompanySchema = new Schema({
  name: String,
  logo: String,
  backgroundCoverImage: String,
  description: String,
  staffCount: Number,
  staffCountRange: {
    staffCountRangeStart: Number,
    staffCountRangeEnd: Number,
  },
  universalName: String,
  url: String,
  industries: [String],
  specialities: [String],
});

// Job Schema
const JobSchema = new Schema(
  {
    title: String,
    comapnyURL1: String,
    comapnyURL2: String,
    companyId: String,
    companyUniversalName: String,
    companyName: String,
    salaryInsights: String,
    applicants: Number,
    formattedLocation: String,
    formattedEmploymentStatus: {
      type: String,
    },
    formattedExperienceLevel: String,
    formattedIndustries: String,
    jobDescription: String,
    inferredBenefits: String,
    jobFunctions: String,
    workplaceTypes: [String],
    company_data: CompanySchema,
    companyApplyUrl: String,
    jobPostingUrl: String,
    listedAt: Date,
    job_id: String,
  },
  { timestamps: true }
);

// Ensure that we have proper indexes for better query performance
JobSchema.index({ title: 1, companyName: 1 }, { unique: true });

const Jobs = mongoose.model("jobs", JobSchema);

module.exports = Jobs;
