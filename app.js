/**
 * Backend Server startup file, handles incoming APIs
 */
"use strict";
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const port = process.env.PORT || 4000;

const healthRouter = require("./api/health/routes")();
const logtail = require("./services/logtail");
const { Sentry } = require("./services/sentry");
const redisClient = require("./services/redis/index");
const { searchPeople } = require("./services/ApolloAPI/searchPeople");
const { getEmailByLinkedInUrl } = require("./services/ApolloAPI/emailEnrich");
const axios = require("axios");
const app = express();
const { smtpTransport } = require("./services/ses");
const { searchCompanyApollo } = require("./services/ApolloAPI/orgSearch");
const {
  saveJobData,
  savePersonaData,
  updateContactDetails,
} = require("./services/util");
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
  res.render("findJob", { title: "Find the Best LinkedIn Jobs Available" });
});
app.get("/persona-reachout", (req, res) => {
  let people = [];

  try {
    if (req.query.people) {
      people = JSON.parse(decodeURIComponent(req.query.people));
    }
  } catch (error) {
    console.error("Error parsing people data:", error);
  }

  res.render("personaReachout", { people });
});
app.get("/send-email", (req, res) => {
  const enrichedData = JSON.parse(req.query.data);
  const emails = enrichedData.map((item) => item.person.email);
  res.render("sendEmail", { emails });
});

app.post("/send-email", async (req, res) => {
  const { subject, body, emails } = req.body;

  try {
    const sendEmailPromises = emails.map((email) => {
      const mailOptions = {
        //  to: person.email,
        to: "vinay.prajapati@hirequotient.com",
        from: "EasySource <no-reply@hirequotient.com>",
        subject: subject,
        html: body,
        // .replace("{{name}}", person.name)
        // .replace("{{title}}", person.employment_history[0].title)
        // .replace(
        //   "{{companyName}}",
        //   person.employment_history[0].organization_name
        // ),
      };

      return smtpTransport.sendMail(mailOptions);
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
app.post("/create-persona", async (req, res) => {
  try {
    const { locations, companyNames } = req.body;

    console.log("Received locations:", locations);
    console.log("Received company names:", companyNames);
    const allPeople = [];

    // Process each company name one by one
    for (const name of companyNames) {
      try {
        const company = await searchCompanyApollo(name);

        if (company) {
          const people = await searchPeople(locations, company.name);
          allPeople.push(...people.people);
        } else {
          console.warn(`No company found for name: ${name}`);
        }
      } catch (error) {
        console.error(`Error processing company name ${name}:`, error);
      }
    }
    console.log("person data ====>", JSON.stringify(allPeople[0]));
    const personaSave = await savePersonaData(allPeople);
    res.render("personaReachout", { people: allPeople });
  } catch (error) {
    console.error("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.post("/search-jobs", async (req, res) => {
  try {
    const {
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
      exclude_job_publishers,
    } = req.body;
    const results = await searchJobs(
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
      exclude_job_publishers
    );
    // Extract salary range in the backend
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
    saveJobData(results.data);
    res.render("showJob", { results });
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

app.get("/enriched-data", (req, res) => {
  const people = JSON.parse(req.query.data);
  res.render("enrichedData", { people });
});

app.post("/email-enrich", async (req, res) => {
  try {
    const { linkedinUrls } = req.body;
    const enrichedData = [];

    for (let i = 0; i < linkedinUrls.length; i++) {
      const emailEnrich = await getEmailByLinkedInUrl(linkedinUrls[i]);
      enrichedData.push(emailEnrich);
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
    console.log("req.body", req.body);
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
app.post("/send-email", async (req, res) => {
  const { enrichedData, emailTemplate } = req.body;

  if (!enrichedData || !emailTemplate) {
    return res
      .status(400)
      .json({ error: "Enriched data and email template are required" });
  }

  try {
    const sendEmailPromises = enrichedData.map((person) => {
      const mailOptions = {
        to: person.email,
        from: "EasySource <no-reply@hirequotient.com>",
        bcc: "easysource-support@hirequotient.com",
        subject: subject,
        html: emailTemplate
          .replace("{{name}}", person.name)
          .replace("{{title}}", person.employment_history[0].title)
          .replace(
            "{{companyName}}",
            person.employment_history[0].organization_name
          ),
      };

      return smtpTransport.sendMail(mailOptions);
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
app.get("/", (req, res) => {
  res.render("findJob");
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
    redisClient
      .connectToRedis()
      .then(() => {
        console.log("Connected to Redis successfully.");
      })
      .catch((error) => {
        console.error("Failed to connect to Redis:", error);
      });

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
  await redisClient.disconnect();
  process.exit(0);
});
