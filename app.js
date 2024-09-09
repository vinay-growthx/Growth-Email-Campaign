"use strict";
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { ObjectId } = require("mongodb");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const port = process.env.PORT || 4000;
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const csv = require("csv-writer").createObjectCsvWriter;
const healthRouter = require("./api/health/routes")();
const logtail = require("./services/logtail");
const { Sentry } = require("./services/sentry");
const fs = require("fs/promises"); // const redisClient = require("./services/redis/index");
const { searchPeople } = require("./services/ApolloAPI/searchPeople");
const {
  searchLinkedInJobsMultipleTitles,
} = require("./services/rapidAPI/linkedinJobSearch");
const { getEmailByLinkedInUrl } = require("./services/ApolloAPI/emailEnrich");
const axios = require("axios");
const app = express();
const { smtpTransport } = require("./services/ses");
const { searchCompanyApollo } = require("./services/ApolloAPI/orgSearch");
const { excludeEmail } = require("./excludeEmail");
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

  convertToApolloPersona,
  removeEmojiFromName,
  removeDoubleQuotes,
  removeAfterFirstComma,
  syncLinkedInJobs,
  fetchAllJobs,
  isRoleFunctionEmptyOrFalsy,
  createJDProject,
  uploadBulkData,
  manuallyAddNewJobs,
} = require("./services/util");
const {
  jobFunctionArr,
  industryArr,
  locationArr,
} = require("./services/arrValues");
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
const JobsRepository = require("./repository/JobsRepository");
const jobsRepository = new JobsRepository();
// Set EJS as the templating engine
app.set("view engine", "ejs");
// Optional: Specify the directory for EJS templates, default is /views
app.set("views", "./views/pages");

mongoose.set("strictQuery", false);
const database = process.env.DATABASE;

app.use(
  bodyParser.json({ limit: "50mb", extended: true, parameterLimit: 1000000 })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 1000000,
  })
);
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
  console.log(`Received request for ${req.method} ${req.url}`);
  if (process.env.ENV === "production") {
    const transaction = Sentry.startTransaction({
      op: "Backend",
      name: "HireQuotient BE",
    });
    res.on("finish", () => {
      transaction.finish();
    });
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);
/**
 * Routers Setup
 */
const authMiddleware = (req, res, next) => {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.redirect("/login");
  }
};
app.use("/", healthRouter);

app.get("/", (req, res) => {
  res.redirect("/login");
});
// app.use(async (req, res, next) => {
//   try {
//     // Skip authentication for login route and public assets
//     if (req.path === "/login" || req.path.startsWith("/public")) {
//       return next();
//     }

//     // Check for token in various places
//     const idToken =
//       req.headers.authorization ||
//       req.cookies.token ||
//       (req.body && req.body.token) ||
//       (req.query && req.query.token);

//     if (!idToken) {
//       throw new Error("No token provided");
//     }

//     // Verify the token
//     const decodedToken = await admin.auth().verifyIdToken(idToken);

//     // Attach the user information to the request
//     req.user = decodedToken;
//     next();
//   } catch (error) {
//     console.log("Authentication error:", error);

//     if (req.xhr || req.headers.accept.indexOf("json") > -1) {
//       // If it's an AJAX request, send JSON response
//       res.status(403).json({ error: error.message || "Unauthorized" });
//     } else {
//       // For regular requests, redirect to login
//       res.redirect("/login");
//     }
//   }
// });
app.get("/find-jobs", authMiddleware, (req, res) => {
  res.render("findJob", {
    title: "Find the Best LinkedIn Jobs Available",
    jobFunctionArr: jobFunctionArr,
    industryArr: industryArr,
    locationArr: locationArr,
  });
});
app.get("/get-jobs/:reqId", authMiddleware, async (req, res) => {
  const reqId = req.params.reqId;

  const page = parseInt(req.query.page) || 1;
  const limit = 500;

  try {
    const { jobData, totalCount } = await findAllJobs(reqId, page, limit);
    const totalPages = Math.ceil(totalCount / limit);
    console.log(`Total Jobs: ${totalCount}`);
    console.log(`Total Pages: ${totalPages}`);
    console.log(`Current Page: ${page}`);
    // console.log("job data ===>", jobData);
    res.render("showJob", {
      jobs: jobData,
      reqId,
      currentPage: page,
      totalPages,
      totalCount,
      locationArr,
      industryArr,
      jobFunctionArr,
    });
  } catch (error) {
    console.log("Error fetching jobs:", error);
    res.status(500).send("An error occurred. Please try again later.");
  }
});
app.get("/login", (req, res) => {
  res.render("login", { title: "Login to Advanced Outreach AI" });
});
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log("Error destroying session:", err);
    res.redirect("/login");
  });
});
app.use((req, res, next) => {
  if (req.path === "/login" || req.path === "/logout") {
    next();
  } else {
    authMiddleware(req, res, next);
  }
});
app.post("/logout", function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log("Logout failed:", err);
      return res.status(500).send("Logout failed");
    }
    res.redirect("/login");
  });
});

app.post("/login", async (req, res) => {
  const {
    email,
    password,
    // "user-id": userId
  } = req.body;
  console.log("Login Attempt ---->", `Email: ${email}, Password: ${password}`);

  try {
    // Perform authentication logic here
    // For simplicity, let's assume the authentication is successful if the email is "john@octosp.com",
    // the password is "john@octosp", and the user ID is "12345"
    if (
      email === "john@octosp.com" &&
      password === "john@octosp"
      // &&
      // userId === "858"
    ) {
      req.session.isAuthenticated = true;
      req.session.save((err) => {
        if (err) {
          console.log("Error saving session:", err);
          res.status(500).render("login", { error: "Internal Server Error" });
        } else {
          res.redirect("/find-jobs");
        }
      });
    } else {
      res.status(401).render("login", { error: "Invalid credentials" });
    }
  } catch (error) {
    console.log("Error signing in:", error);
    res.status(500).render("login", { error: "Invalid credentials" });
  }
});

app.get("/persona-reachout/:reqId", authMiddleware, async (req, res) => {
  const reqId = req.params.reqId;
  const page = parseInt(req.query.page) || 1;
  const limit = 1000;

  try {
    const { people, totalCount, personaProcessCompleted } =
      await findAllPersonas(reqId, page, limit);
    const totalPages = Math.ceil(totalCount / limit);

    res.render("personaReachout", {
      people,
      reqId,
      currentPage: page,
      totalPages,
      totalCount,
      personaProcessCompleted,
    });
  } catch (error) {
    console.log("Error fetching personas:", error);
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
//     console.log("Error parsing people data:", error);
//   }

//   res.render("personaReachout", { people });
// });
app.get("/send-email", authMiddleware, (req, res) => {
  console.log("req query data ====>", req.query);

  const enrichedData = JSON.parse(req.query.enrichedId);
  console.log("enriched data --->", enrichedData);
  res.render("sendEmail", { enrichedData });
});
function findJobPostByEmployerName(arr, employerName) {
  console.log("arr --->", arr);
  console.log("employer name", employerName);

  return arr.filter((job) => {
    const name = job.companyName;
    return (
      name &&
      typeof name === "string" &&
      name.toLowerCase().includes(employerName.toLowerCase())
    );
  });
}

app.post("/send-email", async (req, res) => {
  const { subject, body, emails } = req.body;

  const blockedEmails = [];
  const personaIds = emails.map((item) => item.id);
  const persona = await apolloPersonaRepository.find(
    {
      id: { $in: personaIds },
    },
    "id name title organization.linkedin_url organization.name first_name"
  );

  const uniqueEmails = new Set(); // Set to track unique email addresses
  try {
    let reqId = req.body.reqId;

    if (Array.isArray(reqId)) {
      reqId = reqId[0];
    }
    const jobIdReq = await requestIdRepository.findOne({
      reqId: reqId,
    });
    console.log("req id --->", reqId);
    const jobIds = jobIdReq?.jobIds;
    let jobData = [];
    if (jobIds && jobIds.length) {
      // jobData = await linkedinJobRepository.find(
      //   { job_id: { $in: jobIds } }
      //   // "job_title job_posted_at_datetime_utc job_city job_state job_country employer_name"
      // );
      jobData = await jobsRepository.find(
        { job_id: { $in: jobIds } },
        "title listedAt formattedLocation companyName"
      );
      console.log("job data", jobData);
      // jobData = addJobLocation(jobData);
    }
    const emailData = await emailRepository.find(
      null,
      { toEmails: 1, _id: 0 },
      null,
      null,
      null
    );
    const emailArray = emailData.map((obj) => obj.toEmails[0]);
    // console.log("email arr =>", emailArray);
    for (const email of emails) {
      if (!uniqueEmails.has(email.email)) {
        uniqueEmails.add(email.email);
        if (
          blockedEmails
            .map((e) => e.toLowerCase())
            .includes(email.email.toLowerCase()) ||
          excludeEmail
            .map((e) => e.toLowerCase())
            .includes(email.email.toLowerCase()) ||
          emailArray
            .map((e) => e.toLowerCase())
            .includes(email.email.toLowerCase())
        ) {
          console.log("****************************************");
          console.log(`Skipping blocked email: ${email.email}`);
          console.log("****************************************");
          continue; // Skip the current iteration if the email is in the blocked list
        }

        try {
          const personData = findPersonById(email.id, persona);
          const foundJob = findJobPostByEmployerName(
            jobData,
            personData.organization.name
          );
          let jobPost = foundJob.map((job) => job.title).join(", ");
          const jobDate = foundJob.map((job) => job.listedAt).join(", ");
          const jobLocation = foundJob
            .map((job) => job.formattedLocation)
            .join(", ");
          jobPost =
            removeAfterFirstComma(jobPost) || "recently posted job openings";

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
            to: email.email,
            // to: "vinay.prajapati@hirequotient.com",
            bcc: "vinay.prajapati@hirequotient.com",
            from: req.body.fromEmail,
            subject: removeDoubleQuotes(replacedSubject),
            html: body
              .replaceAll("{name}", personData?.name)
              .replaceAll("{companyName}", personData?.organization?.name)
              .replaceAll("{role}", personData?.title)
              .replaceAll("{hiringJobTitle}", jobPost)
              .replaceAll("{dateOfJobPost}", jobDate)
              .replaceAll("{hiringJobLocation}", jobLocation)
              .replaceAll(
                "{firstName}",
                removeEmojiFromName(personData?.first_name)
              ),
          };
          let sesResponse = {};
          try {
            sesResponse = await smtpTransport.sendMail(mailOptions);
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.log(`Failed to send email to ${mailOptions.to}:`, error);
          }
          if (sesResponse.response) {
            await emailRepository.create({
              fromEmail: req?.body?.fromEmail,
              toEmails: [email.email],
              subject: replacedSubject,
              aiGeneratedSubject: replacedSubject,
              originalBody: body,
              personalizedBody: mailOptions.html,
              reqId,
              status: "pending",
              sesMessageId: sesResponse.response,
            });
          }
        } catch (error) {
          console.log(`Error processing email for ${email.id}:`, error);
        }
      } else {
        console.log(`Skipping duplicate email: ${email.email}`);
      }
    }

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.log("Error in email sending process:", error);
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

app.post("/sync-with-easygrowth", async (req, res) => {
  try {
    // Create JD Project
    const { people, reqId } = req.body;

    res.json({
      message: "Sync successful",
    });
  } catch (error) {
    console.log("Error in sync process:", error);

    res.status(500).json({ error: "Failed to sync with EasyGrowth" });
  }
});
app.post("/create-persona", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    let seniorityLevel = req?.body?.seniorityLevel;
    if (req?.body?.seniorityLevel?.length) {
      const allItems = seniorityLevel.flatMap((str) => str.split(","));
      const uniqueItems = [...new Set(allItems)];
      seniorityLevel = uniqueItems.join(",");
    }
    console.log("seniority level", seniorityLevel);
    const { jobSelect } = req.body;
    const employeeSize = req?.body?.employeeSize;
    const selectedIds = Array.isArray(jobSelect) ? jobSelect : [jobSelect];
    const reqUUID = req.body.reqId || uuidv4();
    await requestIdRepository.updateOne(
      { reqId: reqUUID },
      { $set: { personaProcessCompleted: false } }
    );
    let convertedObj = await requestIdRepository.findOne({
      reqId: req.body.reqId,
    });
    console.log("converted obj ===>", convertedObj);
    convertedObj = convertedObj.convertJobObject;
    // console.log("selected ids --->", selectedIds);
    const objectIds = selectedIds.map((id) => new ObjectId(id));
    let linkedinJobs = await jobsRepository.find(
      {
        _id: objectIds,
      },
      "companyName title formattedIndustries jobDescription formattedLocation comapnyURL2"
    );

    // console.log("linkedin jobs ===>", linkedinJobs);
    linkedinJobs.forEach((job) => {
      if (job.comapnyURL2) {
        job.companyLiName = job.comapnyURL2.split("/").pop();
      }
    });
    console.log("linkedin jobs ===>", linkedinJobs);
    const employerNames = linkedinJobs.map((job) => job.companyName);
    let personaDesignation = req?.body?.personaDesignations;
    // console.log("persona designation", personaDesignation);
    personaDesignation = convertToStringArray(personaDesignation);
    console.log("persona designation", personaDesignation);
    const allPeople = [];
    convertedObj.title = personaDesignation;
    let flag = false;
    // for (const name of employerNames) {
    //   try {
    //     convertedObj.currentCompany = name;
    //     // console.log("converted obj ===>", convertedObj);
    //     const salesNavUrl = await generateSalesNavUrl(convertedObj);
    //     // console.log("sales nav url", salesNavUrl);
    //     const searchPeopleLixData = await searchPeopleLix(salesNavUrl);
    //     for (let i = 0; i < searchPeopleLixData?.people?.length; i++) {
    //       let personaLen = await requestIdRepository.findOne({
    //         reqId: reqUUID,
    //       });
    //       personaLen = personaLen.personaIds.length;
    //       console.log("persona len", personaLen);
    //       if (personaLen > 2) {
    //         if (!flag) {
    //           flag = true;
    //           res.redirect(`/persona-reachout/${reqUUID}`);
    //         }
    //         console.log("continue persona getting");
    //       }
    //       if (i == 0) {
    //         console.log(
    //           "search people lix ====>",
    //           JSON.stringify(searchPeopleLixData.people[0].salesNavId)
    //         );
    //       }
    //       const personData = await getLinkedInData(
    //         searchPeopleLixData.people[i]?.salesNavId
    //       );
    //       convertToApolloPersona(personData, reqUUID);
    //     }
    //     const company = await searchCompanyApollo(name);
    //     let orgId = company?.accounts?.[0]?.organization_id;
    //     if (company) {
    //       saveOrganizationData([company]);
    //       const people = await searchPeople(
    //         jobLocations,
    //         orgId,
    //         personaDesignation,
    //         employeeSize,
    //         seniorityLevel
    //       );
    //       if (people?.people) {
    //         allPeople.push(...people.people);
    //         await savePersonaData(allPeople);
    //       }
    //       updateRequestWithPersonaIds(reqUUID, allPeople);
    //     } else {
    //       console.warn(`No company found for name: ${name}`);
    //     }
    //   } catch (error) {
    //     console.log(`Error processing company name ${name}:`, error);
    //   }
    // }
    for (const employer of linkedinJobs) {
      try {
        convertedObj.location = [employer.formattedLocation];
        convertedObj.currentCompany = [employer.companyName];
        console.log("converted obj =====>", convertedObj);
        const salesNavUrl = await generateSalesNavUrl(convertedObj);
        console.log("sales nav url ====>", salesNavUrl);
        const searchPeopleLixData = await searchPeopleLix(salesNavUrl);
        for (let i = 0; i < searchPeopleLixData?.people?.length; i++) {
          let personaLen = await requestIdRepository.findOne({
            reqId: reqUUID,
          });
          personaLen = personaLen.personaIds.length;
          console.log("persona len", personaLen);
          if (personaLen > 2) {
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
        const company = await searchCompanyApollo(employer.companyName);
        let orgId = company?.accounts?.[0]?.organization_id;
        if (company) {
          saveOrganizationData([company]);
          const people = await searchPeople(
            employer.formattedLocation,
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
          console.warn(`No company found for name: ${employer.companyName}`);
        }
      } catch (error) {
        console.log(
          `Error processing company name ${employer.companyName}:`,
          error
        );
      }
    }

    await requestIdRepository.updateOne(
      { reqId: reqUUID },
      { $set: { personaProcessCompleted: true } }
    );
    const notifyCheck = await requestIdRepository.findOne({ reqId: reqUUID });
    if (notifyCheck.notify) {
      const mailOptions = {
        to: notifyCheck.email,
        from: "EasySource <no-reply@hirequotient.com>",
        subject: "EasyGrowth Notification: All Personas fetched Successfully!",
        html: `All personas for your job title search "${notifyCheck?.convertJobObject?.title}" have been successfully fetched. A total of ${notifyCheck?.personaIds?.length} personas were found. <br><br> 
        You can view the personas by following this link: <a href="https://advanced-outbound-ai.hirequotient.co/persona-reachout/${reqUUID}">View Personas</a>. <br><br>
        If you want to check jobs, you can follow this link: <a href="https://advanced-outbound-ai.hirequotient.co/get-jobs/${reqUUID}">View Jobs</a>.`,
      };
      console.log({ mailOptions });
      smtpTransport.sendMail(mailOptions);
    }
    const csvFilePath = "people_data.csv";
    const reqIdDataUpdate = await requestIdRepository.update(
      {
        reqId: reqUUID,
      },
      {
        $set: { syncWithEasyGrowth: true },
      }
    );
    const reqIdData = await requestIdRepository.findOne({
      reqId: reqUUID,
    });
    if (reqIdData?.syncWithEasyGrowth) {
      console.log("req id data --->", reqIdData);
      const projectData = await createJDProject(
        858,
        `Job Title:   ${
          reqIdData?.convertJobObject?.title || ""
        } Automated Project Created by AI Outbound Tool`
      ); // You might want to generate this UUID dynamically
      const csvWriter = csv({
        path: "people_data.csv",
        header: [
          { id: "name", title: "name" },
          { id: "email", title: "email" },
          { id: "linkedInProfileUrl", title: "linkedInProfileUrl" },
        ],
      });
      const people = await apolloPersonaRepository.find({
        id: { $in: reqIdData.personaIds },
      });
      console.log("people ----->", people[0]);
      await csvWriter.writeRecords(
        people.map((person) => ({
          name: `${person.first_name} ${person.last_name}`, // Combine firstName and lastName
          email: person.email,
          linkedInProfileUrl: person.linkedin_url,
          organization: person.Organization?.name || person.organization?.name, // Get the name from Organization or organization field
        }))
      );
      console.log("project data =-==>", projectData.data._id);
      // Upload CSV to EasyGrowth
      await uploadBulkData(projectData.data._id);
    }
    await fs.unlink(csvFilePath);
    if (!flag) res.redirect(`/persona-reachout/${reqUUID}`);
  } catch (error) {
    try {
      const csvFilePath = "people_data.csv";
      await fs.unlink(csvFilePath);
    } catch (unlinkError) {
      console.log("Error deleting CSV file:", unlinkError);
    }
    console.log("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.get("/api/check-status/:reqId", authMiddleware, async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    const reqId = req.params.reqId;

    // Find the request in the database
    const request = await requestIdRepository.findOne({ reqId: reqId });

    // Get the count of persona IDs
    const personaCount = request.personaIds.length;

    const completionThreshold = 100;

    // Calculate progress percentage
    const progress = Math.min((personaCount / completionThreshold) * 100, 100);

    // Check if the process is completed
    const completed = request?.personaProcessCompleted || false;
    if (completed) {
      const response = {
        completed: completed,
        progress: progress,
        personaCount: personaCount,
      };

      res.json(response);
    } else {
      const response = {
        completed: completed,
        progress: progress,
        personaCount: personaCount,
      };

      res.json(response);
    }

    // Prepare the response
  } catch (error) {
    console.log("Error checking status:", error);
    res.status(500).json({ error: `Failed to check status ${error}` });
  }
});
app.post("/search-jobs", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    console.log("req --->", req.body);
    const generateEmailContent = (data) => {
      const fields = [
        { key: "job_title", label: "Search performed on job title" },
        { key: "location", label: "Location" },
        { key: "num_jobs", label: "Maximum Number of Jobs" },
        { key: "job_function", label: "Job Functions" },
        { key: "industry", label: "Industry" },
      ];

      const htmlContent = fields
        .map(({ key, label }) => {
          const value = data[key];
          if (!value) return ""; // Skip falsy values

          let displayValue = value;
          if (Array.isArray(value)) {
            displayValue = value.filter(Boolean).join(", "); // Filter out falsy values in arrays
            if (!displayValue) return ""; // Skip if array is empty after filtering
          }

          return `${label}: ${displayValue}<br>`;
        })
        .filter(Boolean) // Remove empty strings
        .join("\n      ");

      return {
        to: "vinay.prajapati@hirequotient.com,utkarsh@hirequotient.com",
        from: "AI OutBound Tool <no-reply@hirequotient.com>",
        subject: "AI Outbound search Notification: Search has performed!!!",
        html: htmlContent,
      };
    };

    // Usage
    const mailOptions = generateEmailContent(req.body);
    console.log({ mailOptions });
    if (process.env.ENV === "production") smtpTransport.sendMail(mailOptions);
    let query = req.body.job_title.trim() + " in " + req.body.location.trim();

    query = query.toLowerCase();
    let {
      num_jobs,
      job_listed_date,
      job_title,
      job_listed_range,
      location_hidden,
      industry_hidden,
      role_function,
      industry,
      location,
      job_role,
    } = req.body;
    console.log("req body", req.body);
    // const roleFunction = isRoleFunctionEmptyOrFalsy(role_function);
    const reqUUID = uuidv4();

    const totalCount = await fetchAllJobs(
      job_title,
      role_function,
      num_jobs,
      job_listed_date,
      job_listed_range,
      location_hidden,
      industry_hidden,
      industry,
      location,
      job_role,
      reqUUID
    );
    if (num_jobs > 500 && totalCount < 500) {
      manuallyAddNewJobs(job_title);
    }
    // if (role_function) {
    //   job_title = jobRoles[role_function];
    // }
    // console.log("job title ===>", job_title);
    // let locationObj = JSON.parse(location_hidden);
    // let location = locationObj?.label || "USA";
    // let remainingPages = num_pages;
    // if (num_pages > 3) {
    //   num_pages = 3;
    // }
    // const results = await searchLinkedInJobsMultipleTitles(
    //   job_title,
    //   location,
    //   1,
    //   num_pages
    // );

    // const results = await searchJobs(
    //   query,
    //   page,
    //   num_pages,
    //   date_posted,
    //   remote_jobs_only,
    //   employment_types,
    //   job_requirements,
    //   job_titles,
    //   company_types,
    //   employer,
    //   actively_hiring,
    //   radius,
    //   exclude_job_publishers
    // );
    // results.data.forEach((job) => {
    //   let salaryRange = "N/A";
    //   if (job.job_min_salary && job.job_max_salary) {
    //     salaryRange = `$${job.job_min_salary} - $${job.job_max_salary}`;
    //   } else if (job.job_min_salary) {
    //     salaryRange = `$${job.job_min_salary}`;
    //   } else if (job.job_max_salary) {
    //     salaryRange = `$${job.job_max_salary}`;
    //   } else if (job.job_description.includes("Annual Salary Range:")) {
    //     const salaryMatch = job.job_description.match(
    //       /Annual Salary Range:\$\s*([\d,]+)\s*-\s*\$\s*([\d,]+)/
    //     );
    //     if (salaryMatch) {
    //       salaryRange = `${salaryMatch[1]} - ${salaryMatch[2]}`;
    //     }
    //   }
    //   job.salaryRange = salaryRange;
    // });
    // if (results?.length) {
    //   const jobDataSave = await saveJobData(results);
    //   await updateRequestWithJobIds(reqUUID, jobDataSave, convertedObject);
    // } else {
    //   const APIData = await fetchJobListings({
    //     query,
    //     page,
    //     num_pages,
    //     date_posted,
    //     remote_jobs_only,
    //     employment_types,
    //     job_requirements,
    //     job_title,
    //     company_types,
    //     employer,
    //     actively_hiring,
    //     radius,
    //     exclude_job_publishers,
    //   });
    //   const jobDataSave = await saveJobDataJobListing(APIData);
    //   updateRequestWithJobIds(reqUUID, jobDataSave);
    // }
    // if (remainingPages > 3) {
    //   syncLinkedInJobs(
    //     job_title,
    //     location,
    //     3,
    //     remainingPages,
    //     reqUUID,
    //     convertedObject
    //   );
    // }

    res.redirect(`/get-jobs/${reqUUID}`);
  } catch (error) {
    // console.log("error ==>", error);
    res.status(500).send(error.toString());
  }
});

app.get("/enriched-data", authMiddleware, (req, res) => {
  const people = JSON.parse(req.query.data);
  res.render("enrichedData", { people });
});
app.post("/email-enrich-process", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    // console.log(req.body);
    let selectedPeople = req.body.enrichedIds;
    const reqId = req.body.reqId;

    // Ensure selectedPeople is always an array
    if (!Array.isArray(selectedPeople)) {
      selectedPeople = [selectedPeople].filter(Boolean);
    }

    const personas = await apolloPersonaRepository.find(
      {
        _id: { $in: selectedPeople },
      },
      "name id email linkedin_url"
    );

    const updatedData = [];

    for (const item of personas) {
      let newEmail;
      if (!item.email || item.email === "email_not_unlocked@domain.com") {
        newEmail = await getEmailByLinkedInUrl(item?.linkedin_url, item.id);
        if (!newEmail) {
          newEmail = await fetchEmailViaContactOut(item?.linkedin_url, item.id);
        }
        if (!newEmail) {
          newEmail = await fetchWorkEmailFromRb2bapi(
            item?.linkedin_url,
            item.id
          );
        }
        if (newEmail || item.email !== "email_not_unlocked@domain.com") {
          console.log("new email ====>", newEmail);
          updatedData.push({ ...item, email: newEmail || item.email });
        } else if (item.email) {
          updatedData.push(item);
        }
      } else {
        updatedData.push(item);
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
    console.log("Error processing enriched data:", error);
    res.status(500).json({ error: "Failed to process enriched data" });
  }
});
// app.post("/login", async (req, res) => {
//   const { email, password } = req.body; // Assuming you handle password verification
//   try {
//     const userRecord = await admin.auth().getUserByEmail(email);
//     // Initialize the session user object if it doesn't exist
//     if (!req.session.user) {
//       req.session.user = {}; // Always initialize an object
//     }

//     // Set user details and token in the session
//     req.session.user.uid = userRecord.uid;
//     req.session.user.token = await admin
//       .auth()
//       .createCustomToken(userRecord.uid);

//     req.session.isAuthenticated = true; // Mark the session as authenticated
//     res.redirect("/find-jobs"); // Redirect to a protected route
//   } catch (error) {
//     console.log("Error signing in:", error);
//     res.status(401).render("login", { error: "Invalid credentials" });
//   }
// });

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log("Error destroying session:", err);
    res.redirect("/login");
  });
});

app.post("/enriched-data-process", authMiddleware, async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    // console.log("req body", req.body);
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
    console.log("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});
// app.get("/email-stats/:reqId", async (req, res) => {
//   try {
//     const reqId = req.params.reqId;

//     // Fetch email stats from the database based on reqId
//     const emailStats = await emailRepository.aggregate([
//       { $match: { reqId: reqId } },
//       {
//         $group: {
//           _id: null,
//           totalEmails: { $sum: 1 },
//           successfulEmails: {
//             $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
//           },
//           failedEmails: {
//             $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
//           },
//           blockedEmails: {
//             $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] },
//           },
//           skippedEmails: {
//             $sum: { $cond: [{ $eq: ["$status", "skipped"] }, 1, 0] },
//           },
//         },
//       },
//     ]);

//     const stats = emailStats[0] || {};
//     const totalEmails = stats.totalEmails || 0;
//     const successfulEmails = stats.successfulEmails || 0;
//     const failedEmails = stats.failedEmails || 0;
//     const blockedEmails = stats.blockedEmails || 0;
//     const skippedEmails = stats.skippedEmails || 0;

//     // Calculate open rate and click rate (assuming you have the necessary data)
//     const openRate = (stats.openedEmails / totalEmails) * 100 || 0;
//     const clickRate = (stats.clickedEmails / totalEmails) * 100 || 0;

//     res.render("emailStats", {
//       stats: {
//         openRate: openRate.toFixed(2),
//         clickRate: clickRate.toFixed(2),
//         successfulEmails,
//         failedEmails,
//         blockedEmails,
//         skippedEmails,
//       },
//     });
//   } catch (error) {
//     console.log("Error fetching email stats:", error);
//     res.status(500).send("Internal Server Error");
//   }
// });
app.post("/email-enrich", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
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
    console.log("Error during email enrichment:", error);
    res.status(500).json({
      error: "Failed to enrich emails",
      details: error.message,
    });
  }
});
app.post("/email-enrich-new", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    const emails = req.body.emails;
    res.status(200).json({
      message: "Data successfully enriched",
    });
    res.render("sendEmail", { emails });
  } catch (error) {
    console.log("Error during email enrichment:", error);
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
//     console.log("Error sending emails:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send emails", details: error.message });
//   }
// });
// app.get("/", authMiddleware, (req, res) => {
//   res.render("findJob", {
//     title: "Find the Best LinkedIn Jobs Available",
//     jobFunctionArr: jobFunctionArr,
//     industryArr: industryArr,
//     locationArr: locationArr,
//   });
// });
// app.get("/", (req, res) => {
//   if (req.session.views) {
//     req.session.views++;
//     res.setHeader("Content-Type", "text/html");
//     res.write("<p>views: " + req.session.views + "</p>");
//     res.write("<p>expires in: " + req.session.cookie.maxAge / 1000 + "s</p>");
//     res.end();
//   } else {
//     req.session.views = 1;
//     res.end("welcome to the session demo. refresh!");
//   }
// });
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
//     console.log("Error sending emails:", error);
//     res
//       .status(500)
//       .json({ error: "Failed to send emails", details: error.message });
//   }
// });
app.post("/notify", async (req, res) => {
  const { email, reqId } = req.body;

  if (!email || !reqId) {
    return res.status(400).json({ error: "Email and reqId are required." });
  }

  try {
    const existingNotification = await requestIdRepository.findOne({
      reqId: reqId,
    });
    console.log(" notification", existingNotification);
    if (existingNotification) {
      const update = await requestIdRepository.updateOne(
        { _id: existingNotification._id },
        { $set: { notify: true, email: email } }
      );
      console.log("update ===>", update);
    }
    res.status(200).json({ message: "Notification Added successfully!!!" });
  } catch (error) {
    console.log("Error saving notification request:", error);
    res.status(500).json({ error: "Failed to process notification request" });
  }
});

app.post("/send-email", async (req, res) => {
  // console.log("req.body.reqId", req.body);
  const { enrichedData, emailTemplate, emailSubject } = req.body;

  if (!enrichedData || !emailTemplate) {
    return res
      .status(400)
      .json({ error: "Enriched data and email template are required" });
  }

  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login");
    }
    // Send an email to each enriched data entry
    const sendEmailPromises = enrichedData.map((person) => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        // to: person.email,
        to: "vinay.prajapait@hirequotient.com",
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
    console.log("Error sending emails:", error);
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
    console.log("Error fetching job data:", error);
    if (error.response) {
      console.log("Response data:", error.response.data);
      console.log("Response status:", error.response.status);
      console.log("Response headers:", error.response.headers);
    }
    console.log("error:", error);
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
    //     console.log("Failed to connect to Redis:", error);
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
