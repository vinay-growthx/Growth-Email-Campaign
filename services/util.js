const LinkedinJobRepository = require("../repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();
const ApolloPersonaRepository = require("../repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();
async function saveJobData(jobData) {
  const jobEntries = jobData.map((job) => ({
    job_id: job.job_id || "",
    employer_name: job.employer_name || "",
    employer_logo: job.employer_logo || "",
    employer_website: job.employer_website || "",
    employer_company_type: job.employer_company_type || "",
    job_publisher: job.job_publisher || "",
    job_employment_type: job.job_employment_type || "",
    job_title: job.job_title || "",
    job_apply_link: job.job_apply_link || "",
    job_apply_is_direct: job.job_apply_is_direct || false,
    job_apply_quality_score: job.job_apply_quality_score || 0,
    apply_options: job.apply_options
      ? job.apply_options.map((opt) => ({
          publisher: opt.publisher || "",
          apply_link: opt.apply_link || "",
          is_direct: opt.is_direct || false,
        }))
      : [],
    job_description: job.job_description || "",
    job_is_remote: job.job_is_remote || false,
    job_posted_at_timestamp: job.job_posted_at_timestamp || 0,
    job_posted_at_datetime_utc: new Date(
      job.job_posted_at_datetime_utc || Date.now()
    ),
    job_city: job.job_city || "",
    job_state: job.job_state || "",
    job_country: job.job_country || "",
    job_latitude: job.job_latitude || 0,
    job_longitude: job.job_longitude || 0,
    job_benefits: job.job_benefits || [],
    job_google_link: job.job_google_link || "",
    job_offer_expiration_datetime_utc: job.job_offer_expiration_datetime_utc
      ? new Date(job.job_offer_expiration_datetime_utc)
      : null,
    job_offer_expiration_timestamp: job.job_offer_expiration_timestamp || 0,
    job_required_experience: job.job_required_experience || {},
    job_required_skills: job.job_required_skills || [],
    job_required_education: job.job_required_education || {},
    job_experience_in_place_of_education:
      job.job_experience_in_place_of_education || false,
    job_min_salary: job.job_min_salary || 0,
    job_max_salary: job.job_max_salary || 0,
    job_salary_currency: job.job_salary_currency || "",
    job_salary_period: job.job_salary_period || "",
    job_highlights: job.job_highlights || {},
    job_posting_language: job.job_posting_language || "",
    job_onet_soc: job.job_onet_soc || "",
    job_onet_job_zone: job.job_onet_job_zone || 0,
    job_occupational_categories: job.job_occupational_categories || [],
    job_naics_code: job.job_naics_code || "",
    job_naics_name: job.job_naics_name || "",
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

async function savePersonaData(personaData) {
  const personaEntries = personaData.map((persona) => ({
    id: persona.id || "", // Default to empty string if undefined
    first_name: persona.first_name || "",
    last_name: persona.last_name || "",
    name: persona.name || "",
    linkedin_url: persona.linkedin_url || "",
    title: persona.title || "",
    email_status: persona.email_status || "unknown",
    photo_url: persona.photo_url || "",
    twitter_url: persona.twitter_url || null,
    github_url: persona.github_url || null,
    facebook_url: persona.facebook_url || null,
    extrapolated_email_confidence: persona.extrapolated_email_confidence || 0,
    headline: persona.headline || "",
    email: persona.email || "",
    organization_id: persona.organization_id || "",
    employment_history: persona.employment_history
      ? persona.employment_history.map((history) => ({
          title: history.title || "",
          start_date: history.start_date ? new Date(history.start_date) : null,
          end_date: history.end_date ? new Date(history.end_date) : null,
          is_current: history.is_current || false,
          company_name: history.company_name || "",
          description: history.description || "",
        }))
      : [],
    state: persona.state || "",
    city: persona.city || "",
    country: persona.country || "",
    organization: persona.organization
      ? {
          id: persona.organization.id || "",
          name: persona.organization.name || "",
          website_url: persona.organization.website_url || "",
          linkedin_url: persona.organization.linkedin_url || "",
          primary_phone:
            (persona.organization.primary_phone &&
              persona.organization.primary_phone.toString()) ||
            "",
          phone:
            (persona.organization.phone &&
              persona.organization.phone.toString()) ||
            "",
          linkedin_uid: persona.organization.linkedin_uid || "",
          founded_year: persona.organization.founded_year || 0,
          logo_url: persona.organization.logo_url || "",
          primary_domain: persona.organization.primary_domain || "",
        }
      : {},
    is_likely_to_engage: persona.is_likely_to_engage || false,
    departments: persona.departments || [],
    subdepartments: persona.subdepartments || [],
    seniority: persona.seniority || "",
    functions: persona.functions || [],
    phone_numbers: persona.phone_numbers
      ? persona.phone_numbers.map((phone) => {
          return phone.number ? phone.number.toString() : "";
        })
      : [],
    intent_strength: persona.intent_strength || 0,
    show_intent: persona.show_intent || false,
    revealed_for_current_team: persona.revealed_for_current_team || false,
  }));

  try {
    const personaIds = personaEntries.map((persona) => persona.id);

    const existingPersonas = await apolloPersonaRepository.find(
      { id: { $in: personaIds } },
      "id"
    );
    const existingPersonaIds = existingPersonas.map((persona) => persona.id);

    const newPersonaEntries = personaEntries.filter(
      (persona) => !existingPersonaIds.includes(persona.id)
    );

    if (newPersonaEntries.length > 0) {
      const savedPersonas = await apolloPersonaRepository.insertMany(
        newPersonaEntries
      );
      console.log(`Saved ${savedPersonas.length} new personas successfully.`);
      return savedPersonas;
    } else {
      console.log("No new personas to save.");
      return [];
    }
  } catch (error) {
    console.log("Failed to save personas:", error);
    throw error;
  }
}

module.exports = { saveJobData, savePersonaData };
