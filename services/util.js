const LinkedinJobRepository = require("../repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();

async function saveJobData(jobData) {
  const jobEntries = jobData.map((job) => ({
    job_id: job.job_id,
    employer_name: job.employer_name,
    employer_logo: job.employer_logo,
    employer_website: job.employer_website,
    employer_company_type: job.employer_company_type,
    job_publisher: job.job_publisher,
    job_employment_type: job.job_employment_type,
    job_title: job.job_title,
    job_apply_link: job.job_apply_link,
    job_apply_is_direct: job.job_apply_is_direct,
    job_apply_quality_score: job.job_apply_quality_score,
    apply_options: job.apply_options.map((opt) => ({
      publisher: opt.publisher,
      apply_link: opt.apply_link,
      is_direct: opt.is_direct,
    })),
    job_description: job.job_description,
    job_is_remote: job.job_is_remote,
    job_posted_at_timestamp: job.job_posted_at_timestamp,
    job_posted_at_datetime_utc: new Date(job.job_posted_at_datetime_utc),
    job_city: job.job_city,
    job_state: job.job_state,
    job_country: job.job_country,
    job_latitude: job.job_latitude,
    job_longitude: job.job_longitude,
    job_benefits: job.job_benefits,
    job_google_link: job.job_google_link,
    job_offer_expiration_datetime_utc: job.job_offer_expiration_datetime_utc
      ? new Date(job.job_offer_expiration_datetime_utc)
      : null,
    job_offer_expiration_timestamp: job.job_offer_expiration_timestamp,
    job_required_experience: job.job_required_experience,
    job_required_skills: job.job_required_skills,
    job_required_education: job.job_required_education,
    job_experience_in_place_of_education:
      job.job_experience_in_place_of_education,
    job_min_salary: job.job_min_salary,
    job_max_salary: job.job_max_salary,
    job_salary_currency: job.job_salary_currency,
    job_salary_period: job.job_salary_period,
    job_highlights: job.job_highlights,
    job_posting_language: job.job_posting_language,
    job_onet_soc: job.job_onet_soc,
    job_onet_job_zone: job.job_onet_job_zone,
    job_occupational_categories: job.job_occupational_categories,
    job_naics_code: job.job_naics_code,
    job_naics_name: job.job_naics_name,
  }));

  try {
    const jobIds = jobEntries.map((job) => job.job_id);

    const existingJobs = await linkedinJobRepository.find(
      { job_id: { $in: jobIds } },
      "job_id"
    );
    const existingJobIds = existingJobs.map((job) => job.job_id);

    const newJobEntries = jobEntries.filter(
      (job) => !existingJobIds.includes(job.job_id)
    );

    if (newJobEntries.length > 0) {
      const savedJobs = await linkedinJobRepository.insertMany(newJobEntries);
      console.log(`Saved ${savedJobs.length} new jobs successfully.`);
      return savedJobs;
    } else {
      console.log("No new jobs to save.");
      return [];
    }
  } catch (error) {
    console.log("Failed to save jobs:", error);
    throw error;
  }
}

module.exports = { saveJobData };
