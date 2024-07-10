"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const port = process.env.PORT || 4000;
const { v4: uuidv4 } = require("uuid");

const healthRouter = require("./api/health/routes")();
const logtail = require("./services/logtail");
const { Sentry } = require("./services/sentry");
// const redisClient = require("./services/redis/index");
const { searchPeople } = require("./services/ApolloAPI/searchPeople");
const { getEmailByLinkedInUrl } = require("./services/ApolloAPI/emailEnrich");
const axios = require("axios");
const app = express();
const { smtpTransport } = require("./services/ses");
const { searchCompanyApollo } = require("./services/ApolloAPI/orgSearch");
const {
  saveJobData,
  findAllJobs,
  savePersonaData,
  updateContactDetails,
  saveOrganizationData,
  saveJobDataJobListing,
  updateRequestWithJobIds,
  updateRequestWithPersonaIds,
  findAllPersonas,
  findPersonById,
  addJobLocation,
  jobFunctionArr,
  industryArr,
  locationArr,
  convertToApolloPersona,
  removeEmojiFromName,
  removeDoubleQuotes,
} = require("./services/util");
const { fetchEmailViaContactOut } = require("./services/emailAPI/contactsout");
const { fetchWorkEmailFromRb2bapi } = require("./services/emailAPI/r2b2b");
const { fetchJobListings } = require("./services/rapidAPI/jobListing");
const LinkedinJobRepository = require("./repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();
const ApolloPersonaRepository = require("./repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();
const EmailRepository = require("./repository/EmailRepository");
const emailRepository = new EmailRepository();
const RequestIdRepository = require("./repository/RequestIdRepository");
const requestIdRepository = new RequestIdRepository();
const { generateProfessionalSubject } = require("./services/chatgpt");
const { getLinkedInData } = require("./services/rapidAPI/linkedInData");
const {
  generateSalesNavUrl,
} = require("./services/salesNav/salesNavConversation");
const { searchPeopleLix } = require("./services/LixAPI/lix");
// Set EJS as the templating engine
app.set("view engine", "ejs");
// Optional: Specify the directory for EJS templates, default is /views
app.set("views", "./views/pages");

mongoose.set("strictQuery", false);
const database = process.env.DATABASE;

app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(express.json({ limit: "500mb" }));
/**
 * Middleware to set headers for incoming requests
 */
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Credentials", true);
  next();
});

app.use(cors());
app.use((req, res, next) => {
  if (process.env.ENV === "production") {
    const transaction = Sentry.startTransaction({
      op: "Backend",
      name: "HireQuotient BE",
    });
    const date = new Date();
    const dateString = date.toISOString();

    transaction.setName(dateString);
  }
  express.urlencoded({ extended: true, limit: "500mb" });
  express.json({ limit: "500mb" })(req, res, next);
});

/**
 * Routers Setup
 */
app.use("/", healthRouter);
app.get("/find-jobs", (req, res) => {
  res.render("findJob", {
    title: "Find the Best LinkedIn Jobs Available",
    jobFunctionArr: jobFunctionArr,
    industryArr: industryArr,
    locationArr: locationArr,
  });
});
app.get("/get-jobs/:reqId", async (req, res) => {
  const reqId = req.params.reqId;
  try {
    const jobs = await findAllJobs(reqId);
    if (Array.isArray(jobs)) {
      let jobSorted = jobs.sort(
        (a, b) =>
          new Date(b.job_posted_at_datetime_utc) -
          new Date(a.job_posted_at_datetime_utc)
      );
      res.render("showJob", { jobs: jobSorted, reqId });
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).send("Please Refresh Page");
  }
});
app.get("/persona-reachout/:reqId", async (req, res) => {
  const reqId = req.params.reqId;
  try {
    const people = await findAllPersonas(reqId);
    console.log(people?.length, "people here");
    res.render("personaReachout", { people, reqId });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).send("Internal Server Error");
  }
});
// app.get("/persona-reachout", (req, res) => {
//   let people = [];

//   try {
//     if (req.query.people) {
//       people = JSON.parse(decodeURIComponent(req.query.people));
//     }
//   } catch (error) {
//     console.error("Error parsing people data:", error);
//   }

//   res.render("personaReachout", { people });
// });
app.get("/send-email", (req, res) => {
  console.log("req query data ====>", req.query);
  const enrichedData = JSON.parse(req.query.enrichedId);
  console.log("enriched data --->", enrichedData);
  res.render("sendEmail", { enrichedData });
});
function findJobPostByEmployerName(arr, employerName) {
  return arr.filter(
    (job) => job.employer_name.toLowerCase() === employerName.toLowerCase()
  );
}
app.post("/send-email", async (req, res) => {
  console.log("req body ===>", req.body);
  const { subject, body, emails } = req.body;
  console.log("req body ===>", req.body);
  const personaIds = emails.map((item) => item.id);
  const persona = await apolloPersonaRepository.find(
    {
      id: { $in: personaIds },
    },
    "id name title organization.name first_name"
  );
  try {
    let reqId = req.body.reqId;

    if (Array.isArray(reqId)) {
      reqId = reqId[0];
    }
    const jobIdReq = await requestIdRepository.findOne({
      reqId: reqId,
    });
    console.log("req id --->", reqId);
    const jobIds = jobIdReq.jobIds;
    let jobData = [];
    if (jobIds.length) {
      jobData = await linkedinJobRepository.find(
        { job_id: { $in: jobIds } },
        "job_title job_posted_at_datetime_utc job_city job_state job_country employer_name"
      );
      jobData = addJobLocation(jobData);
      console.log("job data ====>", jobData);
    }
    for (const email of emails) {
      const personData = findPersonById(email.id, persona);
      console.log("person data ==>", personData);
      const foundJob = findJobPostByEmployerName(
        jobData,
        personData.organization.name
      );
      console.log("job data", foundJob);
      const jobPost = foundJob.map((job) => job.job_title).join(", ");
      const jobDate = foundJob
        .map((job) => job.job_posted_at_datetime_utc)
        .join(", ");
      const jobLocation = foundJob.map((job) => job.job_location).join(", ");
      console.log("job post", jobPost);
      let replacedSubject = subject
        .replaceAll("{name}", personData?.name)
        .replaceAll("{companyName}", personData?.organization?.name)
        .replaceAll("{role}", personData?.title)
        .replaceAll("{hiringJobTitle}", jobPost)
        .replaceAll("{dateOfJobPost}", jobDate)
        .replaceAll("{hiringJobLocation}", jobLocation)
        .replaceAll("{firstName}", personData?.first_name);
      let aiGeneratedSubject = await generateProfessionalSubject(
        replacedSubject
      );
      aiGeneratedSubject = aiGeneratedSubject?.subject;
      const mailOptions = {
        // to: email.email,
        to: "vinay.prajapati@hirequotient.com",
        // bcc: "vinay91098@gmail.com,sidhartha@hirequotient.com,vinay.prajapati@hirequotient.com,amartya@hirequotient.com",
        from: req.body.fromEmail,
        subject:
          removeDoubleQuotes(aiGeneratedSubject) ||
          removeDoubleQuotes(replacedSubject),
        html: body
          .replaceAll("{name}", removeEmojiFromName(personData?.name))
          .replaceAll("{companyName}", personData?.organization?.name)
          .replaceAll("{role}", personData?.title)
          .replaceAll("{hiringJobTitle}", jobPost)
          .replaceAll("{dateOfJobPost}", jobDate)
          .replaceAll("{hiringJobLocation}", jobLocation)
          .replaceAll("{firstName}", personData?.first_name),
      };
      let personalizedBody = body
        .replaceAll("{name}", removeEmojiFromName(personData?.name))
        .replaceAll("{companyName}", personData?.organization?.name)
        .replaceAll("{role}", personData?.title)
        .replaceAll("{hiringJobTitle}", jobPost)
        .replaceAll("{dateOfJobPost}", jobDate)
        .replaceAll("{hiringJobLocation}", jobLocation)
        .replaceAll("{firstName}", personData?.first_name);
      if (email.email) {
        const emailData = {
          fromEmail: req?.body?.fromEmail,
          toEmails: [email.email],
          subject: subject,
          aiGeneratedSubject: aiGeneratedSubject || replacedSubject,
          originalBody: body,
          personalizedBody: personalizedBody,
          reqId,
          status: "pending",
        };

        let sesResponse = {};
        try {
          sesResponse = await smtpTransport.sendMail(mailOptions);
          console.log("ses email response ====>", sesResponse);
          console.log(`Email sent successfully to ${mailOptions.to}`);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          // Handle or log any errors
          console.error(`Failed to send email to ${mailOptions.to}:`, error);
        }
        if (sesResponse.response) {
          emailData.sesMessageId = sesResponse.response;
        }
        await emailRepository.create(emailData);
      } else {
        console.log(
          `Skipping email: ${email.id} due to missing email address.`
        );
      }
    }

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.error("Error sending emails:", error);
    res
      .status(500)
      .json({ error: "Failed to send emails", details: error.message });
  }
});
function convertToStringArray(commaString) {
  return commaString
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}
app.post("/create-persona", async (req, res) => {
  try {
    console.log("req body ===>", req.body);
    let seniorityLevel = req?.body?.seniorityLevel;
    if (req?.body?.seniorityLevel?.length) {
      const allItems = seniorityLevel.flatMap((str) => str.split(","));
      const uniqueItems = [...new Set(allItems)];
      seniorityLevel = uniqueItems.join(",");
    }
    const { jobSelect } = req.body;
    const employeeSize = req?.body?.employeeSize;
    const selectedIds = Array.isArray(jobSelect) ? jobSelect : [jobSelect];
    const reqUUID = req.body.reqId || uuidv4();
    let convertedObj = await requestIdRepository.findOne({
      reqId: req.body.reqId,
    });
    convertedObj = convertedObj.convertJobObject;
    const linkedinJobs = await linkedinJobRepository.find(
      {
        _id: selectedIds,
      },
      "employer_name job_title employer_company_type job_description job_city job_state job_country"
    );
    const jobLocations = linkedinJobs.map((job) =>
      `${job.job_city || ""}, ${job.job_state || ""}, ${job.job_country || ""}`
        .trim()
        .replace(/^,\s*|,\s*$/g, "")
    );
    const employerNames = linkedinJobs.map((job) => job.employer_name);
    let personaDesignation = req?.body?.personaDesignations;
    console.log("persona designation", personaDesignation);
    personaDesignation = convertToStringArray(personaDesignation);
    console.log("persona designation", personaDesignation);
    const allPeople = [];
    convertedObj.title = personaDesignation;
    let flag = false;
    for (const name of employerNames) {
      try {
        convertedObj.currentCompany = name;
        console.log("converted obj ===>", convertedObj);
        const salesNavUrl = await generateSalesNavUrl(convertedObj);
        console.log("sales nav url", salesNavUrl);
        const searchPeopleLixData = await searchPeopleLix(salesNavUrl);
        for (let i = 0; i < searchPeopleLixData?.people?.length; i++) {
          let personaLen = await requestIdRepository.findOne({
            reqId: reqUUID,
          });
          personaLen = personaLen.personaIds.length;
          console.log("persona len", personaLen);
          if (personaLen > 15) {
            if (!flag) {
              flag = true;
              res.redirect(`/persona-reachout/${reqUUID}`);
            }
            console.log("continue persona getting");
          }
          if (i == 0) {
            console.log(
              "search people lix ====>",
              JSON.stringify(searchPeopleLixData.people[0].salesNavId)
            );
          }
          const personData = await getLinkedInData(
            searchPeopleLixData.people[i]?.salesNavId
          );
          convertToApolloPersona(personData, reqUUID);
        }
        const company = await searchCompanyApollo(name);
        let orgId = company?.accounts?.[0]?.organization_id;
        if (company) {
          saveOrganizationData([company]);
          const people = await searchPeople(
            jobLocations,
            orgId,
            personaDesignation,
            employeeSize,
            seniorityLevel
          );
          if (people?.people) {
            allPeople.push(...people.people);
            await savePersonaData(allPeople);
          }
          updateRequestWithPersonaIds(reqUUID, allPeople);
        } else {
          console.warn(`No company found for name: ${name}`);
        }
      } catch (error) {
        console.error(`Error processing company name ${name}:`, error);
      }
    }
    const mailOptions = {
      from: "noreply@hirequotient.com",
      to: "vinay.prajapati@hirequotient.com",
      subject: "Persona Addition",
      text: `All personas have been added successfully. Please refresh the page, enrich the email content, and send the email`,
    };
    await smtpTransport.sendMail(mailOptions);
    if (!flag) res.redirect(`/persona-reachout/${reqUUID}`);
  } catch (error) {
    console.error("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.post("/search-jobs", async (req, res) => {
  try {
    console.log("req.body ===>", req.body);
    let query = req.body.job_title.trim() + " in " + req.body.location.trim();

    query = query.toLowerCase();
    const {
      page,
      num_pages,
      date_posted,
      remote_jobs_only,
      employment_types,
      job_requirements,
      job_titles,
      company_types,
      employer,
      actively_hiring,
      radius,
      exclude_job_publishers,
      location_hidden,
      industry_hidden,
      role_function,
    } = req.body;
    const convertedObject = {
      title: job_titles,
      location: location_hidden,
      roleFunction: role_function,
      industryFunction: industry_hidden,
    };

    const reqUUID = uuidv4();

    const results = await searchJobs(
      query,
      page,
      num_pages,
      date_posted,
      remote_jobs_only,
      employment_types,
      job_requirements,
      job_titles,
      company_types,
      employer,
      actively_hiring,
      radius,
      exclude_job_publishers
    );
    results.data.forEach((job) => {
      let salaryRange = "N/A";
      if (job.job_min_salary && job.job_max_salary) {
        salaryRange = `$${job.job_min_salary} - $${job.job_max_salary}`;
      } else if (job.job_min_salary) {
        salaryRange = `$${job.job_min_salary}`;
      } else if (job.job_max_salary) {
        salaryRange = `$${job.job_max_salary}`;
      } else if (job.job_description.includes("Annual Salary Range:")) {
        const salaryMatch = job.job_description.match(
          /Annual Salary Range:\$\s*([\d,]+)\s*-\s*\$\s*([\d,]+)/
        );
        if (salaryMatch) {
          salaryRange = `${salaryMatch[1]} - ${salaryMatch[2]}`;
        }
      }
      job.salaryRange = salaryRange;
    });
    if (results?.data?.length) {
      const jobDataSave = await saveJobData(results.data);
      updateRequestWithJobIds(reqUUID, jobDataSave, convertedObject);
    } else {
      console.log("inside else");
      const APIData = await fetchJobListings({
        query,
        page,
        num_pages,
        date_posted,
        remote_jobs_only,
        employment_types,
        job_requirements,
        job_titles,
        company_types,
        employer,
        actively_hiring,
        radius,
        exclude_job_publishers,
      });
      const jobDataSave = await saveJobDataJobListing(APIData);
      updateRequestWithJobIds(reqUUID, jobDataSave);
    }
    res.redirect(`/get-jobs/${reqUUID}`);
  } catch (error) {
    // console.log("error ==>", error);
    res.status(500).send(error.toString());
  }
});

app.get("/enriched-data", (req, res) => {
  const people = JSON.parse(req.query.data);
  res.render("enrichedData", { people });
});

app.post("/email-enrich-process", async (req, res) => {
  try {
    console.log(req.body);
    let selectedPeople = req.body.selectedPeople;
    const reqId = Array.isArray(req.body.reqId)
      ? req.body.reqId[req.body.reqId.length - 1]
      : req.body.reqId;
    console.log("req id ===>", reqId);
    if (typeof selectedPeople === "string") {
      selectedPeople = selectedPeople.split(",").map((id) => id.trim());
    } else if (!Array.isArray(selectedPeople)) {
      selectedPeople = [selectedPeople];
    }
    const personas = await apolloPersonaRepository.find(
      {
        _id: { $in: selectedPeople },
      },
      "name id email linkedin_url"
    );

    const updatedData = [];

    for (const item of personas) {
      // if (item.email === "email_not_unlocked@domain.com") {
      //   console.log(item.email);
      let newEmail;
      if (
        !item.email ||
        (item.email && item.email == "email_not_unlocked@domain.com")
      ) {
        newEmail = await getEmailByLinkedInUrl(item?.linkedin_url, item.id);
        if (!newEmail && !item.email) {
          newEmail = await fetchEmailViaContactOut(item?.linkedin_url, item.id);
        }
        if (!newEmail && !item.email) {
          newEmail = await fetchWorkEmailFromRb2bapi(
            item?.linkedin_url,
            item.id
          );
        }
        if (
          newEmail ||
          (item.email && item.email != "email_not_unlocked@domain.com")
        ) {
          console.log("new email ====>", newEmail);
          updatedData.push({ ...item, email: newEmail || item.email });
        } else {
          if (item.email) updatedData.push(item);
        }
      }
    }
    const personaValidData = updatedData.reduce((acc, item) => {
      const newItem = { ...item };
      if (!newItem.email) {
        delete newItem.email;
      }

      const existingItem = acc.find((i) => i.email === newItem.email);
      if (!existingItem) {
        acc.push(newItem);
      }

      return acc;
    }, []);
    res.render("sendEmail", { reqId, enrichedData: personaValidData });
  } catch (error) {
    console.error("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.post("/enriched-data-process", async (req, res) => {
  try {
    console.log("req body", req.body);
    let selectedPeople = req.body.selectedPeople;
    const reqId = req.body.reqId;
    // If you need to ensure it's an array (for older Express versions)
    if (typeof selectedPeople === "string") {
      selectedPeople = selectedPeople.split(",").map((id) => id.trim());
    } else if (!Array.isArray(selectedPeople)) {
      // If it's neither a string nor an array, wrap it in an array
      selectedPeople = [selectedPeople];
    }
    const allPersonas = await apolloPersonaRepository.find(
      { id: { $in: selectedPeople } },
      "id photo_url name title organization.name email"
    );
    res.render("enrichedData", { people: allPersonas, reqId });
  } catch (error) {
    console.error("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.post("/email-enrich", async (req, res) => {
  try {
    const { linkedinUrls } = req.body;
    const enrichedData = [];

    for (let i = 0; i < linkedinUrls.length; i++) {
      const emailEnrich = await getEmailByLinkedInUrl(linkedinUrls[i]);
      if (!emailEnrich || emailEnrich.length === 0) {
        emailEnrich = await fetchEmailViaContactOut(linkedinUrls[i]);
      }
      if (!emailEnrich || emailEnrich.length === 0) {
        emailEnrich = await fetchWorkEmailFromRb2bapi(linkedinUrls[i]);
      }

      if (emailEnrich) {
        enrichedData.push(emailEnrich);
      }
    }
    updateContactDetails(enrichedData);
    res.status(200).json({
      message: "Data successfully enriched",
      data: enrichedData,
    });
    // res.render("enrichedData", { people: enrichedData });
  } catch (error) {
    console.error("Error during email enrichment:", error);
    res.status(500).json({
      error: "Failed to enrich emails",
      details: error.message,
    });
  }
});
app.post("/email-enrich-new", async (req, res) => {
  try {
    const emails = req.body.emails;
    res.status(200).json({
      message: "Data successfully enriched",
    });
    res.render("sendEmail", { emails });
  } catch (error) {
    console.error("Error during email enrichment:", error);
    res.status(500).json({
      error: "Failed to enrich emails",
      details: error.message,
    });
  }
});
// app.post("/send-email", async (req, res) => {
//   const { enrichedData, emailTemplate } = req.body;

//   if (!enrichedData || !emailTemplate) {
//     return res
//       .status(400)
//       .json({ error: "Enriched data and email template are required" });
//   }

//   try {
//     const sendEmailPromises = enrichedData.map((person) => {
//       const mailOptions = {
//         to: person.email,
//         from: "EasySource <no-reply@hirequotient.com>",
//         bcc: "easysource-support@hirequotient.com",
//         subject: subject,
//         html: emailTemplate
//           .replace("{{name}}", person.name)
//           .replace("{{title}}", person.employment_history[0].title)
//           .replace(
//             "{{companyName}}",
//             person.employment_history[0].organization_name
//           ),
//       };

//       return smtpTransport.sendMail(mailOptions);
//     });

//     await Promise.all(sendEmailPromises);

//     res.status(200).json({ message: "Emails sent successfully" });
//   } catch (error) {
//     console.error("Error sending emails:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send emails", details: error.message });
//   }
// });
app.get("/", (req, res) => {
  res.render("findJob", {
    title: "Find the Best LinkedIn Jobs Available",
    jobFunctionArr: jobFunctionArr,
    industryArr: industryArr,
    locationArr: locationArr,
  });
});

// app.post("/send-email", async (req, res) => {
//   const { enrichedData, emailTemplate } = req.body;

//   if (!enrichedData || !emailTemplate) {
//     return res
//       .status(400)
//       .json({ error: "Enriched data and email template are required" });
//   }

//   try {
//     // Create a transporter object using the default SMTP transport
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER, // Your email address
//         pass: process.env.EMAIL_PASS, // Your email password or app password
//       },
//     });

//     // Send an email to each enriched data entry
//     const sendEmailPromises = enrichedData.map((person) => {
//       const latestJob = person.employment_history[0];
//       const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to: person.email,
//         subject: "Collaboration Opportunity",
//         text: emailTemplate
//           .replace("{{name}}", person.name)
//           .replace("{{title}}", latestJob.title)
//           .replace("{{companyName}}", latestJob.organization_name),
//       };

//       return transporter.sendMail(mailOptions);
//     });

//     await Promise.all(sendEmailPromises);

//     res.status(200).json({ message: "Emails sent successfully" });
//   } catch (error) {
//     console.error("Error sending emails:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send emails", details: error.message });
//   }
// });
app.post("/send-email", async (req, res) => {
  console.log("req.body.reqId", req.body);
  const { enrichedData, emailTemplate, emailSubject } = req.body;

  if (!enrichedData || !emailTemplate) {
    return res
      .status(400)
      .json({ error: "Enriched data and email template are required" });
  }

  try {
    // Send an email to each enriched data entry
    const sendEmailPromises = enrichedData.map((person) => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: person.email,
        subject: emailSubject,
        text: emailTemplate
          .replace("{{name}}", person.name)
          .replace("{{title}}", person.employment_history[0].title)
          .replace(
            "{{companyName}}",
            person.employment_history[0].organization_name
          ),
      };

      return transporter.sendMail(mailOptions);
    });

    await Promise.all(sendEmailPromises);

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.error("Error sending emails:", error);
    res
      .status(500)
      .json({ error: "Failed to send emails", details: error.message });
  }
});
async function searchJobs(
  query,
  page,
  numPages,
  datePosted,
  remoteJobsOnly,
  employmentTypes,
  jobRequirements,
  jobTitles,
  companyTypes,
  employer,
  activelyHiring,
  radius,
  excludeJobPublishers
) {
  // Base URL of the API
  const baseURL = `https://${process.env.LI_JOB_RAPIDAPI_HOST}/search`;

  // Prepare the params object dynamically
  const params = new URLSearchParams();

  if (query) params.append("query", query.replace(/\s+/g, "+"));
  if (page) params.append("page", page);
  if (numPages) params.append("num_pages", numPages);
  if (datePosted) params.append("date_posted", datePosted);
  if (remoteJobsOnly !== undefined)
    params.append("remote_jobs_only", remoteJobsOnly ? "true" : "false");
  if (employmentTypes) params.append("employment_types", employmentTypes);
  if (jobRequirements) params.append("job_requirements", jobRequirements);
  if (jobTitles) params.append("job_titles", jobTitles);
  if (companyTypes) params.append("company_types", companyTypes);
  if (employer) params.append("employer", employer);
  if (activelyHiring !== undefined)
    params.append("actively_hiring", activelyHiring ? "true" : "false");
  if (radius) params.append("radius", radius);
  if (excludeJobPublishers)
    params.append("exclude_job_publishers", excludeJobPublishers);

  // Log all parameters to help with debugging
  console.log("Constructed URL:", `${baseURL}?${params.toString()}`);
  console.log("Headers:", {
    "x-rapidapi-key": process.env.LI_JOB_RAPIDAPI_KEY,
    "x-rapidapi-host": process.env.LI_JOB_RAPIDAPI_HOST,
  });

  // Set the headers
  const headers = {
    "x-rapidapi-key": process.env.LI_JOB_RAPIDAPI_KEY,
    "x-rapidapi-host": process.env.LI_JOB_RAPIDAPI_HOST,
  };

  try {
    const response = await axios.get(`${baseURL}?${params.toString()}`, {
      headers,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching job data:", error);
    if (error.response) {
      console.log("Response data:", error.response.data);
      console.log("Response status:", error.response.status);
      console.log("Response headers:", error.response.headers);
    }
    throw error;
  }
}
/**
 * Server Configuration
 */
const db = mongoose.connection;
app.listen(port, function () {
  logtail.info(
    `HQ-Server:: HQ-Sourcing Server is Running on http://localhost:${port}`
  );
  console.log(`HQ-Sourcing Server is Running on http://localhost:${port}`);
  const serviceAccount = require("./hq-sourcing-firebase-adminsdk.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  mongoose.connect(database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  db.on("error", function (err) {
    db.close();
  });
  db.once("open", async function () {
    console.log(`Connected successfully with HQ-Sourcing database`);
    logtail.info("MongoDB:: Connected successfully with HQ-Sourcing database");
    // redisClient
    //   .connectToRedis()
    //   .then(() => {
    //     console.log("Connected to Redis successfully.");
    //   })
    //   .catch((error) => {
    //     console.error("Failed to connect to Redis:", error);
    //   });

    // Placeholder for message broker connection, if applicable
    // /*
    // messageBroker.connect().then(() => {
    //   logtail.info("AMQP:: Connected successfully with RabbitMQ");
    // }).catch((err) => {
    //   logtail.error(JSON.stringify({ message: "Error while connecting with RabbitMQ:: ", err }));
    //   console.log("Error while connecting with RabbitMQ:: ", err);
    // });
    // */
  });
});

process.on("SIGINT", async function () {
  await db.close();
  // await redisClient.disconnect();
  process.exit(0);
});
