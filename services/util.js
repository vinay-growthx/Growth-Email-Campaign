const { isArray, isEmpty, has, isString, uniq } = require("lodash");

const LinkedinJobRepository = require("../repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();
const ApolloPersonaRepository = require("../repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();
const ApolloOrganizationRepository = require("../repository/ApolloOrganizationRepository");
const apolloOrganizationRepository = new ApolloOrganizationRepository();
const RequestIdRepository = require("../repository/RequestIdRepository");
const ApiCallRepository = require("../repository/ApiCallRepository");
const apiCallRepository = new ApiCallRepository();
const requestIdRepository = new RequestIdRepository();
const { fetchEmailViaContactOut } = require("../services/emailAPI/contactsout");
const {
  generateJobSummary,
  extractIndustryFromSummary,
} = require("../services/chatgpt");

const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

function checkValueAndFormat(value, label) {
  if (!value) return "";
  return `${label}${value}. `;
}

function formatJobDetails(job) {
  let jobDetailsString = "";

  jobDetailsString += checkValueAndFormat(job.job_title, "Job Title: ");
  jobDetailsString += checkValueAndFormat(job.employer_name, "Company: ");
  jobDetailsString += checkValueAndFormat(job.job_country, "Location: ");
  jobDetailsString += checkValueAndFormat(
    job.job_employment_type,
    "Employment Type: "
  );

  jobDetailsString += checkValueAndFormat(job.job_description, "Description: ");

  if (typeof job.job_is_remote === "boolean") {
    jobDetailsString += job.job_is_remote
      ? "This position is remote. "
      : "This position is not remote. ";
  }

  return jobDetailsString.trim();
}
async function saveJobData(jobData) {
  console.log("job data ===>", jobData[0]);
  const jobEntries = [];
  for (const job of jobData) {
    let summary = "";
    let ai_industry = "";
    try {
      // const generatedSummary = await generateJobSummary(formatJobDetails(job));
      // summary = generatedSummary?.summary || "";
    } catch (error) {
      console.error("Error generating summary for job", job.job_id, error);
      summary = ""; // Continue with an empty string if summary generation fails
    }
    if (summary) {
      // ai_industry = await extractIndustryFromSummary(summary);
      // console.log("ai industry ===>", ai_industry);
    }
    const formattedJob = {
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
      summary: summary,
      ai_industry: ai_industry?.industry || "",
    };
    jobEntries.push(formattedJob);
  }

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
    let allProcessedJobIds = [...existingJobIds];

    if (newJobEntries.length > 0) {
      const savedJobs = await linkedinJobRepository.insertMany(newJobEntries);
      console.log(`Saved ${savedJobs.length} new jobs successfully.`);
      const savedJobIds = savedJobs.map((job) => job.job_id);
      console.log("all perocessed job ids ===>", allProcessedJobIds);
      allProcessedJobIds = [...allProcessedJobIds, ...savedJobIds]; // Combine arrays
    } else {
      console.log("No new jobs to save.");
    }

    return allProcessedJobIds;
  } catch (error) {
    console.log("Failed to save jobs:", error);
  }
}

async function saveJobDataJobListing(apiResponse) {
  // Assuming apiResponse is already parsed JSON from the API
  const jobs = apiResponse.jobs.map((job) => ({
    job_id: job.id || "",
    employer_name: job.company || "",
    employer_logo: job.image || "",
    employer_website: job.jobProviders.length ? job.jobProviders[0].url : "",
    job_publisher: job.jobProviders.length
      ? job.jobProviders[0].jobProvider
      : "",
    job_employment_type: job.employmentType || "",
    job_title: job.title || "",
    job_apply_link: job.jobProviders.length ? job.jobProviders[0].url : "",
    job_apply_is_direct: true, // Assuming all are direct since they're linked to a jobProvider
    job_description: job.description || "",
    job_is_remote: job.location === "Anywhere",
    job_posted_at_datetime_utc: new Date(), // Assuming we set the posting time to now if not available
    job_city: job.location, // This might need parsing if the location includes more than just a city name
    job_country: "", // You would need to parse or determine the country from another source if possible
    job_state: "", // Similarly, this needs handling if location can be parsed into a state
    job_min_salary: job.salaryRange.split("-")[0] || 0, // Assuming salaryRange is a string like "50000-70000"
    job_max_salary: job.salaryRange.split("-")[1] || 0,
    job_salary_currency: "", // Currency needs to be handled if available
    job_salary_period: "", // Period needs to be handled if available
  }));

  try {
    const jobIds = jobs.map((job) => job.job_id);

    const existingJobs = await linkedinJobRepository.find(
      { job_id: { $in: jobIds } },
      "job_id"
    );
    const existingJobIds = existingJobs.map((job) => job.job_id);

    const newJobEntries = jobs.filter(
      (job) => !existingJobIds.includes(job.job_id)
    );
    let allProcessedJobIds = [...existingJobIds];

    if (newJobEntries.length > 0) {
      const savedJobs = await linkedinJobRepository.insertMany(newJobEntries);
      console.log(`Saved ${savedJobs.length} new jobs successfully.`);
    } else {
      console.log("No new jobs to save.");
    }
    return allProcessedJobIds;
  } catch (error) {
    console.error("Failed to save jobs:", error);
  }
}

async function findAllJobs(reqId) {
  const jobIds = await requestIdRepository.findOne({
    reqId: reqId,
  });
  console.log("jobIds ===>", jobIds);
  console.log("job ids ===>", jobIds.jobIds);
  const cleanedJobIdsArray = jobIds.jobIds;

  let jobData;
  if (cleanedJobIdsArray?.length) {
    jobData = await linkedinJobRepository.find({ job_id: cleanedJobIdsArray });
  }
  return jobData;
}
async function findAllPersonas(reqId, page, limit) {
  try {
    const personaIds = await requestIdRepository.findOne({
      reqId: reqId,
    });

    if (
      !personaIds ||
      !personaIds.personaIds ||
      !Array.isArray(personaIds.personaIds)
    ) {
      console.error("No persona IDs found for reqId:", reqId);
      return { people: [], totalCount: 0 };
    }

    const totalCount = personaIds.personaIds.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedIds = personaIds.personaIds.slice(startIndex, endIndex);

    const jobData = await apolloPersonaRepository.find({
      id: { $in: paginatedIds },
    });

    if (!jobData || !Array.isArray(jobData)) {
      console.error("No job data found for paginatedIds:", paginatedIds);
      return { people: [], totalCount };
    }

    return { people: jobData, totalCount };
  } catch (error) {
    console.error("Error in findAllPersonas:", error);
    throw error;
  }
}
async function updateRequestWithJobIds(reqId, jobIdsObject, convertJobObject) {
  console.log("Updating request:", reqId, "with job IDs object:", jobIdsObject);
  try {
    // Ensure jobIdsObject is an object and not null
    if (typeof jobIdsObject !== "object" || jobIdsObject === null) {
      // throw new Error("jobIdsObject must be a non-null object");
    }

    console.log("Converted job IDs array:", jobIdsObject);

    // Validate that the conversion has been successful
    if (!Array.isArray(jobIdsObject) || jobIdsObject.length === 0) {
      // throw new Error("Failed to convert jobIdsObject to a non-empty array");
    }

    // Create a new document using the base repository create function
    const updatedRequest = await requestIdRepository.create({
      reqId: reqId,
      jobIds: jobIdsObject,
      convertJobObject: convertJobObject,
    });

    console.log("Created request:", updatedRequest);
    return updatedRequest;
  } catch (error) {
    console.error("Error creating request with job IDs:", error);
  }
}
async function updateRequestWithPersonaIds(reqId, personaIdsObject) {
  // console.log(
  //   "Updating request:",
  //   reqId,
  //   "with job personas object:",
  //   personaIdsObject
  // );
  try {
    // Ensure jobIdsObject is an object and not null

    // Convert the object values to an array of strings

    // Validate that the conversion has been successful

    // Create a new document using the base repository create function
    // Assuming personaIdsObject is the object from your image
    const idArray = personaIdsObject.map((id) => String(id.id));
    // console.log("Converted persona IDs array:", idArray);

    // Validate that the conversion has been successful
    if (
      !Array.isArray(idArray) ||
      idArray.some((id) => typeof id !== "string")
    ) {
      console.log("Conversion to array of strings failed");
    }

    // Update or create a document using the base repository updateOne function
    const updatedRequest = await requestIdRepository.updateOne(
      { reqId: reqId },
      { $addToSet: { personaIds: { $each: idArray } } },
      { upsert: true }
    );

    console.log("Created request:", updatedRequest);
    return updatedRequest;
  } catch (error) {
    console.error("Error creating request with job IDs:", error);
  }
}
async function savePersonaData(personaData) {
  const personaEntries = personaData.map((persona) => ({
    id: persona.id || "",
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
          _id: history._id || null,
          created_at: history.created_at ? new Date(history.created_at) : null,
          current: history.current || false,
          degree: history.degree || "",
          description: history.description || "",
          emails: history.emails || [],
          end_date: history.end_date ? new Date(history.end_date) : null,
          grade_level: history.grade_level || "",
          kind: history.kind || "",
          major: history.major || "",
          organization_id: history.organization_id || "",
          organization_name: history.organization_name || "",
          raw_address: history.raw_address || "",
          start_date: history.start_date ? new Date(history.start_date) : null,
          title: history.title || "",
          updated_at: history.updated_at ? new Date(history.updated_at) : null,
          id: history.id || "",
          key: history.key || "",
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
          blog_url: persona.organization.blog_url || null,
          angellist_url: persona.organization.angellist_url || null,
          linkedin_url: persona.organization.linkedin_url || "",
          twitter_url: persona.organization.twitter_url || null,
          facebook_url: persona.organization.facebook_url || null,
          primary_phone: {
            number: persona.organization.primary_phone
              ? persona.organization.primary_phone.number || ""
              : "",
            sanitized_number: persona.organization.primary_phone
              ? persona.organization.primary_phone.sanitized_number || ""
              : "",
            source: persona.organization.primary_phone
              ? persona.organization.primary_phone.source || ""
              : "",
          },
          languages: persona.organization.languages || [],
          alexa_ranking: persona.organization.alexa_ranking || 0,
          phone: persona.organization.phone || "",
          linkedin_uid: persona.organization.linkedin_uid || "",
          founded_year: persona.organization.founded_year || 0,
          publicly_traded_symbol:
            persona.organization.publicly_traded_symbol || "",
          publicly_traded_exchange:
            persona.organization.publicly_traded_exchange || "",
          logo_url: persona.organization.logo_url || "",
          crunchbase_url: persona.organization.crunchbase_url || null,
          primary_domain: persona.organization.primary_domain || "",
          sanitized_phone: persona.organization.sanitized_phone || "",
        }
      : {},
    is_likely_to_engage: persona.is_likely_to_engage || false,
    departments: persona.departments || [],
    subdepartments: persona.subdepartments || [],
    seniority: persona.seniority || "",
    functions: persona.functions || [],
    phone_numbers: persona.phone_numbers
      ? persona.phone_numbers.map((phone) => ({
          raw_number: phone.raw_number || "",
          sanitized_number: phone.sanitized_number || "",
          type: phone.type || "",
          position: phone.position || 0,
          status: phone.status || "",
          dnc_status: phone.dnc_status || null,
          dnc_other_info: phone.dnc_other_info || null,
          dialer_flags: phone.dialer_flags || null,
        }))
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
  }
}
async function updateContactDetails(personaData) {
  for (let persona of personaData) {
    try {
      const { id, email, organization } = persona.person;
      const phone = organization.primary_phone.number || null;

      const updated = await apolloPersonaRepository.findOneAndUpdate(
        { id: id },
        {
          $set: {
            email: email,
            "organization.primary_phone.number": phone,
          },
        },
        {
          new: true,
          upsert: false,
        }
      );

      if (updated) {
        console.log(`Updated contact details for persona with ID: ${id}`);
      } else {
        console.log(`No persona found with ID: ${id} to update.`);
      }
    } catch (error) {
      console.error(
        `Error updating contact details for persona with ID: ${persona.person.id}: ${error}`
      );
    }
  }
}
async function saveOrganizationData(orgData) {
  try {
    await apolloOrganizationRepository.create(orgData[0]);
  } catch (error) {
    console.error("Failed to save organizations:", error);
  }
}
function findPersonById(id, data) {
  return data.find((person) => person.id === id);
}
function processLocation(arr) {
  if (arr.length > 0) {
    const firstElement = arr[0];
    const parts = firstElement.split(",");
    const lastPart = parts[parts.length - 1].trim();

    if (!arr.includes(lastPart)) {
      arr.push(lastPart);
    }
  }
  return arr;
}
function addJobLocation(job) {
  const locationParts = [];
  if (job.job_city) locationParts.push(job.job_city);
  if (job.job_state) locationParts.push(job.job_state);
  if (job.job_country) locationParts.push(job.job_country);

  job.job_location = locationParts.join(", ");
  return job;
}
async function enrichPersonasData(personas) {
  const updatedData = [];

  for (const item of personas) {
    let email = item.email;

    if (!email || email === "email_not_unlocked@domain.com") {
      const newEmail = await getEmailByLinkedInUrl(item.linkedin_url, item.id);
      console.log("new email ====>", newEmail);

      if (!newEmail) {
        const contactOutEmail = await fetchEmailViaContactOut(
          item.linkedin_url
        );
        email = contactOutEmail || item.email;
      } else {
        email = newEmail;
      }
    }

    if (email && email !== "email_not_unlocked@domain.com") {
      updatedData.push({ ...item, email });
    }
  }

  return updatedData;
}
function customEncodeURIComponent(str) {
  // First, use encodeURIComponent to encode all characters
  let encodedStr = encodeURIComponent(str);

  // Then, encode the parentheses since they are escaped in encodeURIComponent
  encodedStr = encodedStr.replace(/\(/g, "%28").replace(/\)/g, "%29");

  return encodedStr;
}

function constructFilterString(type, values, exclusion) {
  const valuesArr = values?.map((value) => {
    if (value.id) {
      return `(id:${encodeURIComponent(
        value.id
      )},text:${customEncodeURIComponent(value.text)},selectionType:INCLUDED)`;
    } else {
      return `(text:${customEncodeURIComponent(
        value.text
      )},selectionType:INCLUDED)`;
    }
  });

  const exclusionArr = exclusion?.map((value) => {
    if (value.id) {
      return `(id:${encodeURIComponent(
        value.id
      )},text:${customEncodeURIComponent(value.text)},selectionType:EXCLUDED)`;
    } else {
      return `(text:${customEncodeURIComponent(
        value.text
      )},selectionType:EXCLUDED)`;
    }
  });

  let finalArr;
  if (valuesArr && exclusionArr) {
    finalArr = [...valuesArr, ...exclusionArr];
  } else if (valuesArr) {
    finalArr = valuesArr;
  } else if (exclusionArr) {
    finalArr = exclusionArr;
  }

  return `(type:${type},values:List(${finalArr.join(",")}))`;
}
function constructLinkedInURL(filters, keywords) {
  const filterStrings = filters.map(({ type, values, exclusion }) =>
    constructFilterString(type, values, exclusion)
  );

  let url = `(recentSearchParam:(doLogHistory:true),spellCorrectionEnabled:true,filters:List(${filterStrings.join(
    ","
  )}))`;

  if (isArray(keywords) && keywords.length > 0) {
    const keywordString = keywords.join(" OR ");
    url = url.slice(0, -1);
    url += `,keywords:${customEncodeURIComponent(keywordString)})`;
  }

  url = encodeURIComponent(url);
  url = `https://www.linkedin.com/sales/search/people?query=${url}&viewAllFilters=true`;

  return url;
}
function constructLinkedInURL(filters, keywords) {
  const filterStrings = filters.map(({ type, values, exclusion }) =>
    constructFilterString(type, values, exclusion)
  );

  let url = `(recentSearchParam:(doLogHistory:true),spellCorrectionEnabled:true,filters:List(${filterStrings.join(
    ","
  )}))`;

  if (isArray(keywords) && keywords.length > 0) {
    const keywordString = keywords.join(" OR ");
    url = url.slice(0, -1);
    url += `,keywords:${customEncodeURIComponent(keywordString)})`;
  }

  url = encodeURIComponent(url);
  url = `https://www.linkedin.com/sales/search/people?query=${url}&viewAllFilters=true`;

  return url;
}
async function getCleanedCompanies(companies) {
  let entityList = companies.map(async (company) => {
    try {
      return { result: { status: 500, name: company } };
      const apiResponse = await axios.post(
        "https://chat.juicebox.work/api/clean/cc",
        { company },
        {
          headers: {
            Fbauthorization: process.env.JUICE_BOX_API,
          },
        }
      );
      console.log(
        "Company: " + company + " - ",
        apiResponse.data?.result?.linkedin_id
      );
      return apiResponse.data;
    } catch (err) {
      console.log("Company: " + company + " - Not Found");
      return { result: { status: 500, name: company } };
    }
  });
  entityList = await Promise.all(entityList);
  const companyList = entityList
    .map((entity) => {
      const { name, linkedin_id } = entity?.result || {};
      const result = {};
      if (linkedin_id) {
        result.id = linkedin_id;
      }
      if (name) {
        result.text = name;
      }
      return result;
    })
    .filter((item) => !isEmpty(item));
  return companyList;
}

async function getCleanedLocations(locations) {
  let entityList = locations.map(async (location) => {
    try {
      if (location?.toLowerCase().trim() == "us") {
        return {
          result: {
            status: 200,
            country: "united states",
            name: "united states",
          },
        };
      }
      return { result: { status: 500 } };
      let apiResponse = await axios.post(
        "https://chat.juicebox.work/api/clean/cl",
        { location },
        {
          headers: {
            Fbauthorization: process.env.JUICE_BOX_API,
          },
        }
      );
      console.log("Location: " + location + " - ", apiResponse.data?.result);
      return apiResponse.data;
    } catch (err) {
      if (location?.toLowerCase().trim() == "us") {
        return {
          result: {
            status: 200,
            country: "united states",
            name: "united states",
          },
        };
      }
      console.log("Location: " + location + " - Not Found");
      return { result: { status: 500 } };
    }
  });
  entityList = await Promise.all(entityList);
  const locationList = entityList
    .map((entity) => {
      try {
        return matchLabel(entity.result.name);
      } catch (err) {
        console.log("Error getting location from juicebox", err);
        return { label: null, value: null };
      }
    })
    .filter((location) => {
      return location.value != null;
    });
  return locationList;
}
function updatePageQueryParam(url, startPage) {
  const newUrl = new URL(url);
  if (newUrl.pathname.includes("people")) {
    newUrl.searchParams.set("page", startPage);
    newUrl.searchParams.set("coach", "false");
  }
  return newUrl.href;
}
function convertData(data) {
  const convertedData = {
    id: data.salesNavId || "",
    first_name: data.firstName || "",
    last_name: data.lastName || "",
    name: data.name || "",
    linkedin_url: data.salesNavLink || "",
    title: data.experience[0]?.title || "",
    photo_url: data.img || "",
    headline: data.aboutSummaryText || "",
    employment_history: data.experience.map((exp) => ({
      created_at: new Date(),
      current: exp.dateEnded === "Present",
      description: "",
      emails: [],
      end_date:
        exp.dateEnded === "Present" ? undefined : new Date(exp.dateEnded),
      grade_level: "",
      kind: "",
      major: "",
      organization_id: "",
      organization_name: exp.organisation.name || "",
      raw_address: "",
      start_date: new Date(exp.dateStarted),
      title: exp.title || "",
      updated_at: new Date(),
      id: "",
      key: "",
    })),
    state: data.location?.split(", ")[1] || "",
    city: data.location?.split(", ")[0] || "",
    country: data.location?.split(", ")[2] || "",
    organization: {
      id: "",
      name: data.experience[0]?.organisation.name || "",
      website_url: "",
      blog_url: "",
      angellist_url: "",
      linkedin_url: data.experience[0]?.organisation.salesNavLink || "",
      twitter_url: "",
      facebook_url: "",
      primary_phone: {},
      languages: [],
      alexa_ranking: 0,
      phone: "",
      linkedin_uid: "",
      founded_year: 0,
      publicly_traded_symbol: "",
      publicly_traded_exchange: "",
      logo_url: "",
      crunchbase_url: "",
      primary_domain:
        data.experience[0]?.organisation.salesNavLink?.split("/")[2] || "",
      sanitized_phone: "",
    },
    is_likely_to_engage: false,
    departments: [],
    subdepartments: [],
    seniority: "",
    functions: [],
    phone_numbers: [],
    intent_strength: 0,
    show_intent: false,
    revealed_for_current_team: false,
  };

  return convertedData;
}

async function convertToApolloPersona(user, reqUUID) {
  console.log("json stringify ====>", user);
  try {
    // Helper function to format dates
    const formatDate = (year, month, day) => {
      if (year && month && day) return new Date(year, month - 1, day);
      if (year && month) return new Date(year, month - 1);
      return null;
    };

    // Create employment history entries
    const employmentHistory = user.position.map((pos) => ({
      _id: new mongoose.Types.ObjectId(),
      created_at: new Date(),
      current: !pos.end.year,
      degree: pos.degree || "",
      description: pos.description,
      emails: [], // Assuming no emails provided in position
      end_date: formatDate(pos.end.year, pos.end.month, pos.end.day),
      grade_level: "", // Not provided
      kind: "employment", // Assuming all are employment
      major: "", // Not provided
      organization_id: pos.companyUsername || "", // Assuming organization ID is the username
      organization_name: pos.companyName,
      raw_address: pos.location,
      start_date: formatDate(pos.start.year, pos.start.month, pos.start.day),
      title: pos.title,
      updated_at: new Date(),
      id: pos.companyUsername, // Assuming unique identifier is the companyUsername
      key: pos.title + "_" + pos.location, // Custom key made of title and location
    }));

    // Create the ApolloPersona object

    const apolloPersona = {
      id: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      linkedin_url: `https://linkedin.com/in/${user.username}`,
      title: user.headline,
      email_status: "unavailable", // Assuming status as unavailable
      photo_url: user.profilePicture,
      twitter_url: "", // Not provided
      github_url: "", // Not provided
      facebook_url: "", // Not provided
      extrapolated_email_confidence: 0, // Assuming no confidence score
      headline: user.headline,
      email: "", // Assuming no email provided
      organization_id: user.position[0].companyUsername, // Assuming first position's company as current organization
      employment_history: employmentHistory,
      state: "", // Not directly provided, could be parsed from geo.full if needed
      city: user.geo.city,
      country: user.geo.country,
      organization: {
        id: user.position[0].companyUsername, // Assuming first position's company as current organization
        name: user.position[0].companyName,
        website_url: user.position[0].companyURL,
        // Other URLs and phone details are not provided in the data
      },
      is_likely_to_engage: false, // Assuming default engagement likelihood
      departments: [], // Assuming no departments provided
      subdepartments: [],
      seniority: "", // Not provided
      functions: [], // Assuming no functions provided
      phone_numbers: [], // Assuming no phone numbers provided
      intent_strength: 0, // Assuming default intent strength
      show_intent: false,
      revealed_for_current_team: false,
    };
    try {
      await apolloPersonaRepository.create(apolloPersona);
    } catch (err) {
      console.log("err", err);
      if (err.name === "MongoServerError" && err.code === 11000) {
        console.log("Handling duplicate key error for apolloPersona");
        console.log("error: duplicate key");
      }
    }

    try {
      const updatedRequest = await requestIdRepository.updateOne(
        { reqId: reqUUID },
        { $addToSet: { personaIds: user.username } },
        { upsert: true }
      );
      console.log("updated req", updatedRequest);
    } catch (err) {
      console.log("Error updating requestIdRepository", err);
    }

    return apolloPersona;
  } catch (err) {
    console.log("err", err);
  }
}
function removeEmojiFromName(str) {
  try {
    if (!str) return "there";
    const namePrefixes = [
      "Mr",
      "Mrs",
      "Ing",
      "Ms",
      "Miss",
      "Dr",
      "Prof",
      "Phd",
      "PhD",
      "Rev",
      "Sir",
      "Lord",
      "Lady",
      "Honorable",
      "Madam",
      "Madame",
      "Mademoiselle",
      "Señor",
      "Señora",
      "Señorita",
      "Herr",
      "Frau",
      "Fräulein",
    ];
    let inputName = str;
    str = str.replace(/\d+/g, "");

    if (!str) return inputName;
    const res = str.replace(/[^\p{L}\p{N}\p{P}\p{Z}^$\n]/gu, "");
    const specialCharactersRegex =
      /[,\(\)\[\]\{\}\!\@\#\$\%\^\&\*\=\_\+\/\\\<\>\?\'\"\;\:\|.\\`~]/g;
    const cleanedInput = res.replace(specialCharactersRegex, " ");
    const words = cleanedInput.split(" ");
    const isValidName = (word) => {
      if (!word || word.length === 0) {
        return false;
      }
      word = word.replace(
        /[,\(\)\[\]\{\}\!\@\#\$\%\^\&\*\=\-\+\/\\\<\>\?\'\"\;\:\|.\\`~]/g,
        ""
      );
      return word.length >= 3 && !namePrefixes.includes(word);
    };
    // Find the first valid name
    let firstName = "";
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Case 1: Starting with spaces, and first word is <= 2 chars, pick next word with at least 3 letters
      if (i === 0 && word.length <= 2) {
        const nextWord = words[i + 1];
        if (isValidName(nextWord)) {
          firstName = nextWord;
          break;
        }
      }
      // Case 2: Starting word with a special character and emojis (basically anything that is not a letter)
      if (i === 0 && !isValidName(word)) {
        const nextWord = words[i + 1];
        if (isValidName(nextWord)) {
          firstName = nextWord;
          break;
        }
      }
      // Case 3: First name if is <= 2 chars, pick 2nd name
      if (word.length <= 2 && isValidName(words[i + 1])) {
        firstName = words[i + 1];
        break;
      }
      // Case 4: In cases where there is first, middle and last name, if name is MD R. Colin, then third name should be picked.
      if (
        word.length >= 3 &&
        isValidName(word) &&
        words[i + 1] &&
        words[i + 1].length === 1 &&
        isValidName(words[i + 2]) &&
        words[i + 3]
      ) {
        firstName = words[i];
        break;
      }
      // Case 5: First word is a special character/s itself
      if (i === 0 && !isValidName(word)) {
        continue;
      }
      // If none of the above cases apply, pick the first valid name
      if (isValidName(word)) {
        firstName = word;
        break;
      }
    }
    // If the input string contains only numbers and special characters, return null
    if (cleanedInput.length === 0) {
      return "there";
    }
    // console.log(
    //   "removeEmojiFromName Called:-->",
    //   inputName,
    //   "--to-->",
    //   firstName
    // );
    return firstName
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
      : inputName;
  } catch (err) {
    console.log("error", err);
    return str;
  }
}
// H. J.👨🏻‍💻 Y.
function removeDoubleQuotes(str) {
  if (typeof str !== "string") {
    console.log("subject: Input must be a string");
    return str;
  }

  if (str.length === 0) {
    return str;
  }

  if (str.length >= 2 && str[0] === '"' && str[str.length - 1] === '"') {
    return str.slice(1, -1);
  }

  return str;
}

async function trackApiCall(apiName) {
  const update = { $inc: { count: 1 } };
  const options = { upsert: true, new: true };
  try {
    return await apiCallRepository.findOneAndUpdate(
      { apiName },
      update,
      options
    );
  } catch (err) {
    console.error(`Error tracking API call for ${apiName}: ${err}`);
  }
}

module.exports = {
  convertData,
  findAllJobs,
  saveJobData,
  trackApiCall,
  addJobLocation,
  findPersonById,
  findAllPersonas,
  processLocation,
  savePersonaData,
  removeDoubleQuotes,
  removeEmojiFromName,
  constructLinkedInURL,
  getCleanedCompanies,
  getCleanedLocations,
  enrichPersonasData,
  updatePageQueryParam,
  updateContactDetails,
  saveJobDataJobListing,
  saveOrganizationData,
  convertToApolloPersona,
  updateRequestWithJobIds,
  updateRequestWithPersonaIds,
};
