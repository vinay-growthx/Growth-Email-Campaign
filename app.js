"use strict";
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
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

  convertToApolloPersona,
  removeEmojiFromName,
  removeDoubleQuotes,
  removeAfterFirstComma,
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
  const page = parseInt(req.query.page) || 1;
  const limit = 50000; // Number of jobs per page

  try {
    const jobs = await findAllJobs(reqId);
    if (Array.isArray(jobs)) {
      let jobSorted = jobs.sort(
        (a, b) =>
          new Date(b.job_posted_at_datetime_utc) -
          new Date(a.job_posted_at_datetime_utc)
      );

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedJobs = jobSorted.slice(startIndex, endIndex);
      const totalPages = Math.ceil(jobSorted.length / limit);

      res.render("showJob", {
        jobs: paginatedJobs,
        currentPage: page,
        totalPages: totalPages,
        reqId,
        locationArr,
        industryArr,
        jobFunctionArr,
      });
    }
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).send("Please Refresh Page");
  }
});
app.get("/persona-reachout/:reqId", async (req, res) => {
  const reqId = req.params.reqId;
  const page = parseInt(req.query.page) || 1;
  const limit = 1000;

  try {
    const { people, totalCount } = await findAllPersonas(reqId, page, limit);
    const totalPages = Math.ceil(totalCount / limit);

    res.render("personaReachout", {
      people,
      reqId,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching personas:", error);
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
  console.log("arr --->", arr);
  console.log("employer name", employerName);
  return arr.filter((job) =>
    job.employer_name.toLowerCase().includes(employerName.toLowerCase())
  );
}
app.post("/send-email", async (req, res) => {
  const { subject, body, emails } = req.body;
  const blockedEmails = [
    "ed@mentalhealthsf.org",

    "mdiaz@ecs-sf.org",

    "abby.dimodica@univarusa.com",

    "geeslin@franciscopartners.com",

    "tao.lu@franciscopartners.com",

    "paul.cormier@franciscopartners.com",

    "barry@franciscopartners.com",

    "ben.peterson@49ers.com",

    "tanya.mera@sfdph.org",

    "michelle.brown@univarsolutions.com",

    "priyanka@braze.com",

    "shalvoyj@fhlbsf.com",

    "stephanie.gott@bbrown.com",

    "cristina.hernandez@49ers.com",

    "tmcneice@sfgoodwill.org",

    "danielle.belanger@toasttab.com",

    "cheri.rubocki@oldnational.com",

    "ann.claspell@oldnational.com",

    "gayle.maneikis@toasttab.com",

    "george.lance@oldnational.com",

    "email_not_unlocked@domain.com",

    "karoline.schroeder@aon.com",

    "jady.fitton@aon.ca",

    "farhang.fattah@se.com",

    "duane.swanson@schneider-electric.com",

    "faren.kelly@usi.com",

    "melissa.dornan@usi.com",

    "svenu@cisco.com",

    "email_not_unlocked@domain.com",

    "aliki.taylor7@gilead.com",

    "brooke.phillips@cybercoders.com",

    "klueh.lion@oracle.com",

    "sara.cerny@cybercoders.com",

    "brooke.phillips@cybercoders.com",

    "miners507@brsnan.net",

    "sara.cerny@cybercoders.com",

    "sarah.boutwell@cybercoders.com",

    "miners507@brsnan.net",

    "vu.le@cybercoders.com",

    "sarah.boutwell@cybercoders.com",

    "email_not_unlocked@domain.com",

    "vu.le@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "email_not_unlocked@domain.com",

    "linda.greytak@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "jack.adventus@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "dustin.eden@oracle.com",

    "jack.adventus@cybercoders.com",

    "daisey.blower@oracle.com",

    "dustin.eden@oracle.com",

    "david.c.morrison@oracle.com",

    "daisey.blower@oracle.com",

    "marianna.gurovich@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "james.e.young@oracle.com",

    "monique.visser@oracle.com",

    "james.e.young@oracle.com",

    "sharonmag@jfrog.com",

    "monique.visser@oracle.com",

    "adityag@jfrog.com",

    "sharonmag@jfrog.com",

    "litals@jfrog.com",

    "adityag@jfrog.com",

    "mayat@juniper.net",

    "litals@jfrog.com",

    "rsanyal@juniper.net",

    "mayat@juniper.net",

    "rsanyal@juniper.net",

    "klueh.lion@oracle.com",

    "brooke.phillips@cybercoders.com",

    "sara.cerny@cybercoders.com",

    "miners507@brsnan.net",

    "sarah.boutwell@cybercoders.com",

    "vu.le@cybercoders.com",

    "email_not_unlocked@domain.com",

    "jennifer.brink@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "jack.adventus@cybercoders.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "james.e.young@oracle.com",

    "monique.visser@oracle.com",

    "sharonmag@jfrog.com",

    "adityag@jfrog.com",

    "litals@jfrog.com",

    "mayat@juniper.net",

    "rsanyal@juniper.net",

    "sarah.boutwell@cybercoders.com",

    "miners507@brsnan.net",

    "email_not_unlocked@domain.com",

    "vu.le@cybercoders.com",

    "sarah.boutwell@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "email_not_unlocked@domain.com",

    "vu.le@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "email_not_unlocked@domain.com",

    "alex.acevedo@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "jack.adventus@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "dustin.eden@oracle.com",

    "jack.adventus@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "jack.adventus@cybercoders.com",

    "dustin.eden@oracle.com",

    "dustin.eden@oracle.com",

    "marianna.gurovich@oracle.com",

    "daisey.blower@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "james.e.young@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "marianna.gurovich@oracle.com",

    "james.e.young@oracle.com",

    "sharonmag@jfrog.com",

    "james.e.young@oracle.com",

    "monique.visser@oracle.com",

    "adityag@jfrog.com",

    "monique.visser@oracle.com",

    "sharonmag@jfrog.com",

    "litals@jfrog.com",

    "sharonmag@jfrog.com",

    "adityag@jfrog.com",

    "mayat@juniper.net",

    "adityag@jfrog.com",

    "rsanyal@juniper.net",

    "litals@jfrog.com",

    "litals@jfrog.com",

    "mayat@juniper.net",

    "mayat@juniper.net",

    "rsanyal@juniper.net",

    "rsanyal@juniper.net",

    "brandi.bruce@cerner.com",

    "stacey.pesce@oracle.com",

    "regan.garrison@oracle.com",

    "brandi.bruce@cerner.com",

    "klueh.lion@oracle.com",

    "regan.garrison@oracle.com",

    "brooke.phillips@cybercoders.com",

    "klueh.lion@oracle.com",

    "sara.cerny@cybercoders.com",

    "brooke.phillips@cybercoders.com",

    "miners507@brsnan.net",

    "sara.cerny@cybercoders.com",

    "sarah.boutwell@cybercoders.com",

    "miners507@brsnan.net",

    "vu.le@cybercoders.com",

    "sarah.boutwell@cybercoders.com",

    "email_not_unlocked@domain.com",

    "vu.le@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "email_not_unlocked@domain.com",

    "linda.greytak@cybercoders.com",

    "jennifer.brink@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "jack.adventus@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "dustin.eden@oracle.com",

    "jack.adventus@cybercoders.com",

    "daisey.blower@oracle.com",

    "dustin.eden@oracle.com",

    "david.c.morrison@oracle.com",

    "daisey.blower@oracle.com",

    "marianna.gurovich@oracle.com",

    "david.c.morrison@oracle.com",

    "james.e.young@oracle.com",

    "marianna.gurovich@oracle.com",

    "james.e.young@oracle.com",

    "monique.visser@oracle.com",

    "monique.visser@oracle.com",

    "sharonmag@jfrog.com",

    "sharonmag@jfrog.com",

    "adityag@jfrog.com",

    "litals@jfrog.com",

    "adityag@jfrog.com",

    "mayat@juniper.net",

    "litals@jfrog.com",

    "mayat@juniper.net",

    "rsanyal@juniper.net",

    "rsanyal@juniper.net",

    "james.giddings@oracle.com",

    "stacey.pesce@oracle.com",

    "brandi.bruce@cerner.com",

    "regan.garrison@oracle.com",

    "klueh.lion@oracle.com",

    "brooke.phillips@cybercoders.com",

    "sara.cerny@cybercoders.com",

    "miners507@brsnan.net",

    "sarah.boutwell@cybercoders.com",

    "vu.le@cybercoders.com",

    "email_not_unlocked@domain.com",

    "jennifer.brink@cybercoders.com",

    "linda.greytak@cybercoders.com",

    "alex.acevedo@cybercoders.com",

    "jack.adventus@cybercoders.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "james.e.young@oracle.com",

    "monique.visser@oracle.com",

    "sharonmag@jfrog.com",

    "adityag@jfrog.com",

    "litals@jfrog.com",

    "mayat@juniper.net",

    "rsanyal@juniper.net",

    "alexa.martinez@oracle.com",

    "jonathan.pellum@oracle.com",

    "bphillips@netsuite.com",

    "dulce.silva@oracle.com",

    "zcole@netsuite.com",

    "christina.massey@oracle.com",

    "ekerker@netsuite.com",

    "aneri.patel@oracle.com",

    "luke.gioffre@oracle.com",

    "lauren.freeman@oracle.com",

    "pmichaelson@containerstore.com",

    "joliver@netsuite.com",

    "cmadden@netsuite.com",

    "ramel.haines@oracle.com",

    "jasmina.zenkic@oracle.com",

    "leslie.fitzpatrick@newyorkredbulls.com",

    "geri.kalinsky@wmg.com",

    "eddie.morales@grafana.com",

    "viridiana.martinez@oracle.com",

    "nicolas.fielden@oracle.com",

    "lkottke@netsuite.com",

    "hal.moretto@oracle.com",

    "cheryl.sanocki@ivanti.com",

    "jim.ramsbottom@ttigroupna.com",

    "taylor.pottmeyer@oracle.com",

    "steven.melanson@oracle.com",

    "kboyer@alixpartners.com",

    "william.childs@oracle.com",

    "aboes@netsuite.com",

    "jrennis@netsuite.com",

    "mark.criscito@oracle.com",

    "brendan.cray@oracle.com",

    "blosty@netsuite.com",

    "tyler.sugg@oracle.com",

    "ksnook@netsuite.com",

    "austin.woffinden@meritagehomes.com",

    "mthompson@netsuite.com",

    "trevan.rocarek@netsuite.com",

    "nicholas.sanborn@oracle.com",

    "srichardson@netsuite.com",

    "csiebold@netsuite.com",

    "nicholas.mintz@netsuite.com",

    "gabrielle.hasselt@netsuite.com",

    "brody.whalen@oracle.com",

    "eamaglo@netsuite.com",

    "yeazmil.ishmam@ttigroup.com",

    "ogarcia@netsuite.com",

    "lily.trunsky@oracle.com",

    "hugh.aguilar@oracle.com",

    "maura.doherty@oracle.com",

    "joseph.lampitt@oracle.com",

    "alex@junipersquare.com",

    "john.brewer@oracle.com",

    "lev.tsybin@oracle.com",

    "mata@logrocket.com",

    "russell.clapp@oracle.com",

    "macy.carreras@wmg.com",

    "shlomib@jfrog.com",

    "emma.jobson@redbull.com",

    "lwilson@netsuite.com",

    "ehines@netsuite.com",

    "ivana.veljovic@assurant.com",

    "bkelly@netsuite.com",

    "cmcevilly@netsuite.com",

    "megna.bhakta@oracle.com",

    "lauren.barrera@oracle.com",

    "ebianca@netsuite.com",

    "jacob.brewer@oracle.com",

    "joey.yamane@oracle.com",

    "paris.boswell@oracle.com",

    "mpimentel@netsuite.com",

    "danielle@webull-us.com",

    "larissa@coinbase.com",

    "natalie.cavanna@oracle.com",

    "subodh.somani@oracle.com",

    "carlos.v@oracle.com",

    "charnae.caldwell@oracle.com",

    "riley.yang@oracle.com",

    "mcleary@netsuite.com",

    "paul.distefano@oracle.com",

    "peter.ressler@bridgebio.com",

    "alexandra_howerter@bose.com",

    "djenkins@netsuite.com",

    "jim.hickey@oracle.com",

    "hector.tena@oracle.com",

    "christine.chasse@oracle.com",

    "mariana.leal@netsuite.com",

    "ryan.kelly@netsuite.com",

    "colivier@netsuite.com",

    "kolton.griffin@oracle.com",

    "jdellamedaglia@netsuite.com",

    "katie.pilgrim@digicert.com",

    "ashley.thomsen@meritagehomes.com",

    "charlie.minor@oracle.com",

    "jrivero@netsuite.com",

    "jrobles@netsuite.com",

    "tslann@netsuite.com",

    "linda_velasquez@bose.com",

    "zoe.gilbert@oracle.com",

    "rbrenenstuhl@netsuite.com",

    "jperry@netsuite.com",

    "russell.dryden@oracle.com",

    "isabelpulidoortega@hotmail.com",

    "sarahlivnat@jfrog.com",

    "evi.cenolli@oracle.com",

    "maryam.ghassemkhani@oracle.com",

    "ray.kandi@oracle.com",

    "stephanie.nguyen@oracle.com",

    "bridget.mcmahon@oracle.com",

    "laura.letts@oracle.com",

    "allyson.dubois@oracle.com",

    "ester.frey@oracle.com",

    "eric.sloan@oracle.com",

    "james.giddings@oracle.com",

    "stacey.pesce@oracle.com",

    "regan.garrison@oracle.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "kolton.griffin@oracle.com",

    "ryan.kelly@netsuite.com",

    "jdellamedaglia@netsuite.com",

    "colivier@netsuite.com",

    "katie.pilgrim@digicert.com",

    "kolton.griffin@oracle.com",

    "ashley.thomsen@meritagehomes.com",

    "jdellamedaglia@netsuite.com",

    "charlie.minor@oracle.com",

    "katie.pilgrim@digicert.com",

    "jrivero@netsuite.com",

    "ashley.thomsen@meritagehomes.com",

    "jrobles@netsuite.com",

    "charlie.minor@oracle.com",

    "tslann@netsuite.com",

    "jrivero@netsuite.com",

    "linda_velasquez@bose.com",

    "jrobles@netsuite.com",

    "zoe.gilbert@oracle.com",

    "rbrenenstuhl@netsuite.com",

    "tslann@netsuite.com",

    "jperry@netsuite.com",

    "linda_velasquez@bose.com",

    "russell.dryden@oracle.com",

    "zoe.gilbert@oracle.com",

    "isabelpulidoortega@hotmail.com",

    "rbrenenstuhl@netsuite.com",

    "sarahlivnat@jfrog.com",

    "jperry@netsuite.com",

    "evi.cenolli@oracle.com",

    "russell.dryden@oracle.com",

    "maryam.ghassemkhani@oracle.com",

    "isabelpulidoortega@hotmail.com",

    "sarahlivnat@jfrog.com",

    "ray.kandi@oracle.com",

    "evi.cenolli@oracle.com",

    "stephanie.nguyen@oracle.com",

    "bridget.mcmahon@oracle.com",

    "maryam.ghassemkhani@oracle.com",

    "laura.letts@oracle.com",

    "ray.kandi@oracle.com",

    "allyson.dubois@oracle.com",

    "stephanie.nguyen@oracle.com",

    "ester.frey@oracle.com",

    "bridget.mcmahon@oracle.com",

    "eric.sloan@oracle.com",

    "laura.letts@oracle.com",

    "james.giddings@oracle.com",

    "allyson.dubois@oracle.com",

    "stacey.pesce@oracle.com",

    "ester.frey@oracle.com",

    "regan.garrison@oracle.com",

    "eric.sloan@oracle.com",

    "dustin.eden@oracle.com",

    "james.giddings@oracle.com",

    "daisey.blower@oracle.com",

    "stacey.pesce@oracle.com",

    "david.c.morrison@oracle.com",

    "regan.garrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "mpimentel@netsuite.com",

    "danielle@webull-us.com",

    "larissa@coinbase.com",

    "natalie.cavanna@oracle.com",

    "subodh.somani@oracle.com",

    "carlos.v@oracle.com",

    "charnae.caldwell@oracle.com",

    "riley.yang@oracle.com",

    "mcleary@netsuite.com",

    "paul.distefano@oracle.com",

    "peter.ressler@bridgebio.com",

    "alexandra_howerter@bose.com",

    "djenkins@netsuite.com",

    "jim.hickey@oracle.com",

    "hector.tena@oracle.com",

    "christine.chasse@oracle.com",

    "mariana.leal@netsuite.com",

    "ryan.kelly@netsuite.com",

    "colivier@netsuite.com",

    "kolton.griffin@oracle.com",

    "jdellamedaglia@netsuite.com",

    "katie.pilgrim@digicert.com",

    "ashley.thomsen@meritagehomes.com",

    "charlie.minor@oracle.com",

    "jrivero@netsuite.com",

    "jrobles@netsuite.com",

    "tslann@netsuite.com",

    "linda_velasquez@bose.com",

    "zoe.gilbert@oracle.com",

    "rbrenenstuhl@netsuite.com",

    "jperry@netsuite.com",

    "russell.dryden@oracle.com",

    "isabelpulidoortega@hotmail.com",

    "sarahlivnat@jfrog.com",

    "evi.cenolli@oracle.com",

    "maryam.ghassemkhani@oracle.com",

    "ray.kandi@oracle.com",

    "stephanie.nguyen@oracle.com",

    "bridget.mcmahon@oracle.com",

    "laura.letts@oracle.com",

    "allyson.dubois@oracle.com",

    "ester.frey@oracle.com",

    "eric.sloan@oracle.com",

    "james.giddings@oracle.com",

    "stacey.pesce@oracle.com",

    "regan.garrison@oracle.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "bridget.mcmahon@oracle.com",

    "laura.letts@oracle.com",

    "allyson.dubois@oracle.com",

    "ester.frey@oracle.com",

    "eric.sloan@oracle.com",

    "james.giddings@oracle.com",

    "stacey.pesce@oracle.com",

    "regan.garrison@oracle.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "bkelly@netsuite.com",

    "cmcevilly@netsuite.com",

    "megna.bhakta@oracle.com",

    "lauren.barrera@oracle.com",

    "ebianca@netsuite.com",

    "jacob.brewer@oracle.com",

    "joey.yamane@oracle.com",

    "paris.boswell@oracle.com",

    "mpimentel@netsuite.com",

    "danielle@webull-us.com",

    "larissa@coinbase.com",

    "natalie.cavanna@oracle.com",

    "subodh.somani@oracle.com",

    "carlos.v@oracle.com",

    "charnae.caldwell@oracle.com",

    "riley.yang@oracle.com",

    "mcleary@netsuite.com",

    "paul.distefano@oracle.com",

    "peter.ressler@bridgebio.com",

    "alexandra_howerter@bose.com",

    "djenkins@netsuite.com",

    "jim.hickey@oracle.com",

    "hector.tena@oracle.com",

    "christine.chasse@oracle.com",

    "mariana.leal@netsuite.com",

    "ryan.kelly@netsuite.com",

    "colivier@netsuite.com",

    "kolton.griffin@oracle.com",

    "jdellamedaglia@netsuite.com",

    "katie.pilgrim@digicert.com",

    "ashley.thomsen@meritagehomes.com",

    "charlie.minor@oracle.com",

    "jrivero@netsuite.com",

    "jrobles@netsuite.com",

    "tslann@netsuite.com",

    "linda_velasquez@bose.com",

    "zoe.gilbert@oracle.com",

    "rbrenenstuhl@netsuite.com",

    "jperry@netsuite.com",

    "russell.dryden@oracle.com",

    "isabelpulidoortega@hotmail.com",

    "sarahlivnat@jfrog.com",

    "evi.cenolli@oracle.com",

    "maryam.ghassemkhani@oracle.com",

    "ray.kandi@oracle.com",

    "stephanie.nguyen@oracle.com",

    "bridget.mcmahon@oracle.com",

    "laura.letts@oracle.com",

    "allyson.dubois@oracle.com",

    "ester.frey@oracle.com",

    "eric.sloan@oracle.com",

    "james.giddings@oracle.com",

    "stacey.pesce@oracle.com",

    "regan.garrison@oracle.com",

    "dustin.eden@oracle.com",

    "daisey.blower@oracle.com",

    "david.c.morrison@oracle.com",

    "marianna.gurovich@oracle.com",

    "monique.visser@oracle.com",

    "email_not_unlocked@domain.com",

    "pusuvarna@paypal.com",

    "mindy.wong@manpower.com.sg",

    "lflores@raland.com",

    "john.podlasek@level-ex.com",

    "nsavoia@bankunited.com",

    "donnie.watson@openly.com",

    "alok.4.kumar@atos.net",

    "suresh.jayanthi_venkata@genesys.com",

    "dave.martin@marriott.com",

    "mindy.wong@manpower.com.sg",

    "normanseth@corporater.com",

    "x-theodora.georgiou@upvest.co",

    "steve.waquad@catonetworks.com",

    "arnaud.gienpawlicki@decathlon.com",

    "kwilson@talentlinkresources.com",

    "lflores@raland.com",

    "john.podlasek@level-ex.com",

    "nsavoia@bankunited.com",

    "donnie.watson@openly.com",

    "alok.4.kumar@atos.net",

    "suresh.jayanthi_venkata@genesys.com",

    "dave.martin@marriott.com",

    "mindy.wong@manpower.com.sg",

    "allison.obrien@huntresslabs.com",

    "bmiller@visa.com",

    "kristin.willi@gd-ms.com",

    "geri.kalinsky@wmg.com",

    "salexander@pswholesale.com",

    "ronald.fish@ivanti.com",

    "wesley.mersinger@diageo.com",

    "dpollek@anomali.com",

    "stephanie.pagan@iliabeauty.com",

    "normanseth@corporater.com",

    "x-theodora.georgiou@upvest.co",

    "steve.waquad@catonetworks.com",

    "arnaud.gienpawlicki@decathlon.com",

    "kwilson@talentlinkresources.com",

    "lflores@raland.com",

    "john.podlasek@level-ex.com",

    "nsavoia@bankunited.com",

    "donnie.watson@openly.com",

    "alok.4.kumar@atos.net",

    "suresh.jayanthi_venkata@genesys.com",

    "dave.martin@marriott.com",

    "mindy.wong@manpower.com.sg",

    "perry@connexissearch.com",

    "nmekler@cinemo.com",

    "marco.antonio@paysafe.com",

    "soeren.frickenschmidt@biontech.de",

    "kate.bryl@homagames.com",

    "angelique.berndt@sensient.com",

    "sarah.lomas@evotec.com",

    "sara.stetic@memgraph.com",

    "sgraf@sphera.com",

    "jasonb@strata.io",

    "jennifer_candee@cargill.com",

    "john_massura@ryder.com",

    "julia.moody@publicissapient.com",

    "zinab@popuptalent.com",

    "shayema.rahim@t-mobile.com",

    "cstokes@rubenstein.com",

    "jackie.leung@wpromote.com",

    "kira.kennedy@landsend.com",

    "sgold@ftei.com",

    "mperry@genevatrading.com",

    "hugo.gerard@ledger.fr",

    "emma.surich@flywheeldigital.com",

    "bnewman@flosum.com",

    "vaibhav.r@isprava.com",

    "alyssa.rhoda@zefr.com",

    "markus.klaiber@karlstorz.com",

    "jonathan.briggs@aviva.com",

    "nick.geifman@crowdstrike.com",

    "sheila.meyer@flintco.com",

    "allison.obrien@huntresslabs.com",

    "bmiller@visa.com",

    "kristin.willi@gd-ms.com",

    "geri.kalinsky@wmg.com",

    "salexander@pswholesale.com",

    "ronald.fish@ivanti.com",

    "wesley.mersinger@diageo.com",

    "dpollek@anomali.com",

    "stephanie.pagan@iliabeauty.com",

    "normanseth@corporater.com",

    "x-theodora.georgiou@upvest.co",

    "steve.waquad@catonetworks.com",

    "arnaud.gienpawlicki@decathlon.com",

    "kwilson@talentlinkresources.com",

    "lflores@raland.com",

    "john.podlasek@level-ex.com",

    "nsavoia@bankunited.com",

    "donnie.watson@openly.com",

    "alok.4.kumar@atos.net",

    "suresh.jayanthi_venkata@genesys.com",

    "dave.martin@marriott.com",

    "mindy.wong@manpower.com.sg",

    "allison.obrien@huntresslabs.com",

    "bmiller@visa.com",

    "kristin.willi@gd-ms.com",

    "geri.kalinsky@wmg.com",

    "salexander@pswholesale.com",

    "ronald.fish@ivanti.com",

    "wesley.mersinger@diageo.com",

    "dpollek@anomali.com",

    "stephanie.pagan@iliabeauty.com",

    "normanseth@corporater.com",

    "x-theodora.georgiou@upvest.co",

    "steve.waquad@catonetworks.com",

    "arnaud.gienpawlicki@decathlon.com",

    "kwilson@talentlinkresources.com",

    "lflores@raland.com",

    "john.podlasek@level-ex.com",

    "nsavoia@bankunited.com",

    "donnie.watson@openly.com",

    "alok.4.kumar@atos.net",

    "mindy.wong@manpower.com.sg",

    "suresh.jayanthi_venkata@genesys.com",

    "dave.martin@marriott.com",

    "mindy.wong@manpower.com.sg",

    "nikhilar@fb.com",

    "sshin@fb.com",

    "nikhilar@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "cyan@fb.com",

    "chawadee@fb.com",

    "suestephens@fb.com",

    "weiyiing@fb.com",

    "kishorep@fb.com",

    "sshin@fb.com",

    "sshrivastava@fb.com",

    "sshin@fb.com",

    "tnguyen@fb.com",

    "rchoudhuri@fb.com",

    "tomokon@fb.com",

    "bradsacks@meta.com",

    "kanona@fb.com",

    "p12praveenk@fb.com",

    "kanand@fb.com",

    "leep@fb.com",

    "ebyjose@fb.com",

    "avik@fb.com",

    "vvu@fb.com",

    "lzhang@fb.com",

    "henrykelly@fb.com",

    "jon@jonkopp.com",

    "nlam@fb.com",

    "ayou@fb.com",

    "kaushikm@fb.com",

    "dki@fb.com",

    "ehsu@fb.com",

    "gang@fb.com",

    "mschwab@fb.com",

    "speters@fb.com",

    "hjenny@fb.com",

    "jasonfuchs@fb.com",

    "beepadalkar@fb.com",

    "liz@fb.com",

    "manishk@fb.com",

    "rishabmangla@fb.com",

    "amishra@fb.com",

    "ptrivedi@fb.com",

    "panagiotis.papadimitriou@fb.com",

    "nshapiro@fb.com",

    "elma@fb.com",

    "mspalekgarcia@fb.com",

    "dianemorovati@gmail.com",

    "mcardoso@fb.com",

    "shobhitv@fb.com",

    "aimeer@fb.com",

    "sattizahn@fb.com",

    "nathanhawks@fb.com",

    "mcarter@fb.com",

    "jeffm@fb.com",

    "fdgarcia@fb.com",

    "katrinahsu@fb.com",

    "xiaohan@fb.com",

    "sharanyaramesh@fb.com",

    "emilyf@fb.com",

    "cpalacio@fb.com",

    "jonathan@meta.com",

    "xlin@fb.com",

    "oyahalom@fb.com",

    "pjeon@fb.com",

    "rsachdev@fb.com",

    "mmo@fb.com",

    "dli@fb.com",

    "rgalusca@fb.com",

    "ninghe@fb.com",

    "alihall@fb.com",

    "wesleychan@fb.com",

    "jcannon@fb.com",

    "sadrnoori@fb.com",

    "mvincent@fb.com",

    "bjacula@meta.com",

    "rayw@fb.com",

    "nissenbaum@fb.com",

    "elisefu@fb.com",

    "phegde@meta.com",

    "jliang@fb.com",

    "ahadbasravi@fb.com",

    "ishadko@meta.com",

    "gmarra@fb.com",

    "sideswipe777@fb.com",

    "meihong@fb.com",

    "upadhyaya@meta.com",

    "akumar@fb.com",

    "bscott@fb.com",

    "vkulshrestha@fb.com",

    "mprasad@fb.com",

    "tom.feng@fb.com",

    "khwang@fb.com",

    "davidl@fb.com",

    "cvtherinek@fb.com",

    "caleydrooff@fb.com",

    "sureshkumar@fb.com",

    "cchandra@fb.com",

    "mhaq@fb.com",

    "than@fb.com",

    "javiervega@fb.com",

    "wesley@fb.com",

    "fliu@fb.com",

    "k.a@fb.com",

    "shannonh@fb.com",

    "szuccarino@fb.com",

    "kwong@fb.com",

    "keving@fb.com",

    "hanuv@fb.com",

    "sagrawal@fb.com",

    "hzhou@fb.com",

    "eddieolivares@fb.com",

    "ssingh@fb.com",

    "mnagwekar@fb.com",

    "anandv98@gmail.com",

    "park.s@fb.com",

    "mpakes@fb.com",

    "pradyumnadhakal@fb.com",

    "dvanwinkle@ascend-innovations.com",

    "ez@fb.com",

    "karangoel@fb.com",

    "lijenny@fb.com",

    "leit@fb.com",

    "kapilg@fb.com",

    "m.a@fb.com",

    "timrich@fb.com",

    "aryapadi@fb.com",

    "csanciaume@fb.com",

    "rhiremath@fb.com",

    "rachelp@fb.com",

    "justinwong1@fb.com",

    "michaela@meta.com",

    "mrafat@fb.com",

    "eluo@fb.com",

    "eringrandstaff@fb.com",

    "mrutman@fb.com",

    "tinakong@fb.com",

    "balazs@meta.com",

    "jasong@fb.com",

    "akamath@fb.com",

    "rahulanand@fb.com",

    "bjohn@fb.com",

    "sxie@fb.com",

    "wenbinw@fb.com",

    "jsantos@fb.com",

    "sajan.sangraula@fb.com",

    "dbriggs@fb.com",

    "hli@fb.com",

    "pmehra@fb.com",

    "gmd@fb.com",

    "pkanuparthy@fb.com",

    "rxn@fb.com",

    "frankzheng@fb.com",

    "elsac@fb.com",

    "clefevre@fb.com",

    "anthonyb@fb.com",

    "jacklynl@fb.com",

    "kwang@fb.com",

    "haihongwang@fb.com",

    "brandiarnold@fb.com",

    "panwang@fb.com",

    "felseradlai@fb.com",

    "mikegreenberg@fb.com",

    "rvalentepais@gmail.com",

    "nicks@fb.com",

    "jeffsoo@fb.com",

    "jenniferlau@fb.com",

    "njain@fb.com",

    "brianl@fb.com",

    "priyankd@fb.com",

    "bryan@fb.com",

    "patrickl@fb.com",

    "zchen@fb.com",

    "loren@fb.com",

    "xub@fb.com",

    "jzhang@fb.com",

    "li@fb.com",

    "nataliabutenko@fb.com",

    "donfwu@gmail.com",

    "pwilliam@fb.com",

    "szhao@fb.com",

    "annapebbles@fb.com",

    "justinc@fb.com",

    "meng.li@fb.com",

    "narmour@fb.com",

    "aiyer@fb.com",

    "nitinsingh@fb.com",

    "chrismarra@fb.com",

    "grayj@fb.com",

    "paulciasullo@fb.com",

    "dsesh@fb.com",

    "tpankaj@meta.com",

    "abharadwaj@fb.com",

    "jwoodbridge@fb.com",

    "tsanders@fb.com",

    "nmittal@fb.com",

    "sjain@fb.com",

    "vsunny@fb.com",

    "badr@fb.com",

    "thahn@fb.com",

    "rkaur@fb.com",

    "wlo@meta.com",

    "davem@fb.com",

    "mrunal@fb.com",

    "shyam@fb.com",

    "sorayakasnavi@fb.com",

    "gedaliahf@fb.com",

    "daniellelepe@fb.com",

    "mattgabor@fb.com",

    "eram@fb.com",

    "rpaul@fb.com",

    "cnez@fb.com",

    "kaceto-netemeyer@fb.com",

    "tkelly@fb.com",

    "veniceg@fb.com",

    "jputnam@fb.com",

    "shuang@fb.com",

    "cherylkessler@fb.com",

    "cookhl13@gmail.com",

    "hpatel@fb.com",

    "sharma.a@fb.com",

    "steven@fb.com",

    "jeffy@fb.com",

    "shickman@fb.com",

    "kravi@fb.com",

    "abhinavj@fb.com",

    "mengx@fb.com",

    "namit@fb.com",

    "smandal@fb.com",

    "ivyliu@fb.com",

    "anya@meta.us",

    "bwen@fb.com",

    "cmccarrick@fb.com",

    "tfeng@fb.com",

    "alivneh@fb.com",

    "vrao@fb.com",

    "luc@fb.com",

    "jade.clarke@fb.com",

    "ammro@meta.com",

    "jamilahw@fb.com",

    "vikasb@fb.com",

    "brunoramos@fb.com",

    "nir@fb.com",

    "anita.anderson@fb.com",

    "amys@fb.com",

    "asanadhya@fb.com",

    "tagarwal@fb.com",

    "nathancombes@fb.com",

    "qzeng@fb.com",

    "yanyuemichelle@fb.com",

    "james.b@fb.com",

    "kaningo@fb.com",

    "ebo@fb.com",

    "stuarts@fb.com",

    "dixiao@fb.com",

    "rene@meta.com",

    "qdong@fb.com",

    "johnr@fb.com",

    "dcarbajal@fb.com",

    "asaurabh@fb.com",

    "lucy@fb.com",

    "yant@fb.com",

    "jeetshah@fb.com",

    "sonalk@fb.com",

    "justincardones@fb.com",

    "ramez@fb.com",

    "xiaonan.duan@lnkd.in",

    "nuttakorn@fb.com",

    "davidi@fb.com",

    "weienlee@fb.com",

    "cmoghbel@fb.com",

    "tenki@meta.org",

    "sbhattacharya@fb.com",

    "dgautam@fb.com",

    "ltoosevich@fb.com",

    "raj.nandy@fb.com",

    "ecaron@fb.com",

    "matthewferrari@fb.com",

    "twu@fb.com",

    "rvasudevan@fb.com",

    "caitlinwalzem@fb.com",

    "akakkar@stanford.edu",

    "jakeyara@meta.com",

    "junbiaot@fb.com",

    "honzhou@fb.com",

    "nbelmonte@fb.com",

    "kgill@fb.com",

    "clarice.chan@fb.com",

    "asifd@fb.com",

    "jjoijoide@fb.com",

    "schefflerjens@meta.com",

    "mandarde@fb.com",

    "sarahespinosa@fb.com",

    "ngao@fb.com",

    "aalarcon@fb.com",

    "angellang@fb.com",

    "camerononeill@fb.com",

    "dorrie.paynter@fb.com",

    "cwei@fb.com",

    "aly@fb.com",

    "cyrusa@fb.com",

    "joshuaf@fb.com",

    "mroch@fb.com",

    "mreed@fb.com",

    "lavina@fb.com",

    "ethelhe@fb.com",

    "csu@fb.com",

    "jgrinage@fb.com",

    "jessiez@fb.com",

    "nkg@fb.com",

    "yhuang@fb.com",

    "aberlin@fb.com",

    "aahmed@fb.com",

    "kartheekp@fb.com",

    "adavid@fb.com",

    "kk1@fb.com",

    "williamking@fb.com",

    "emorgan@fb.com",

    "michaely@fb.com",

    "ernestof@fb.com",

    "jackal2507@gmail.com",

    "kevinj@fb.com",

    "zhijian@fb.com",

    "kuldeepd@fb.com",

    "avitaware@meta.com",

    "ssong@fb.com",

    "rrajendran@fb.com",

    "lruiz@fb.com",

    "amir.frenkel@fb.com",

    "rune@fb.com",

    "lee@fb.com",

    "sudipshah@fb.com",

    "lxiong@fb.com",

    "liangz@fb.com",

    "gmseis@fb.com",

    "bosun@fb.com",

    "pete.campbell@fb.com",

    "kolinjones@fb.com",

    "mami@fb.com",

    "ayadav@fb.com",

    "lvdmaaten@fb.com",

    "kmary@fb.com",

    "gt@fb.com",

    "kennychui@fb.com",

    "amajumdar@fb.com",

    "leoamos@fb.com",

    "jmorrow@fb.com",

    "minaderian@fb.com",

    "mansik@fb.com",

    "andrin.foster@gmail.com",

    "saustin@fb.com",

    "jvishal@fb.com",

    "ramkumarh@fb.com",

    "ddutta@fb.com",

    "wangw@fb.com",

    "avaughan@fb.com",

    "jjia@fb.com",

    "ptolouei@fb.com",

    "henryb@fb.com",

    "yzhu@meta.com",

    "joes@fb.com",

    "gauravchitroda@fb.com",

    "rogerg@fb.com",

    "yupadhyay@fb.com",

    "andreyshtylenko@fb.com",

    "shubhojeet.sarkar@fb.com",

    "pchang@fb.com",

    "benw@fb.com",

    "billap@fb.com",

    "adellecharles@meta.com",

    "dinoyoon@fb.com",

    "janelee@fb.com",

    "awlee@fb.com",

    "johnnance@fb.com",

    "emilyb@fb.com",

    "eric.s@fb.com",

    "sabrinaodah@fb.com",

    "cpio@fb.com",

    "tranle@fb.com",

    "singha@fb.com",

    "walkerc@fb.com",

    "ygao12@fb.com",

    "ligangfb@fb.com",

    "eelshaw@fb.com",

    "atan@fb.com",

    "jgourley@fb.com",

    "ceciliawen@fb.com",

    "michaelz@fb.com",

    "devoncrawford@fb.com",

    "sarahb@fb.com",

    "xuweipeng@fb.com",

    "anair@fb.com",

    "anaid@mac.com",

    "mkarlsson@fb.com",

    "dliu@fb.com",

    "omkar@fb.com",

    "zrehmani@fb.com",

    "mdhillon@fb.com",

    "kaarthic@fb.com",

    "sommer@fb.com",

    "mariahollweck@fb.com",

    "amandam@fb.com",

    "lis@fb.com",

    "rshwetha@fb.com",

    "leeh@fb.com",

    "jacksoncole@fb.com",

    "dmurray@fb.com",

    "theresac@fb.com",

    "bradleyspare@meta.com",

    "zhouc@fb.com",

    "brianab@fb.com",

    "robinc@fb.com",

    "cchamberlin@fb.com",

    "zbodnar@fb.com",

    "aaronfaucher@fb.com",

    "ywu@fb.com",

    "sharmam@fb.com",

    "huanfeng@fb.com",

    "danmo@meta.com",

    "sandippalit@meta.com",

    "xiangli1993@fb.com",

    "ayushis@fb.com",

    "haiderrazvi@fb.com",

    "ango@fb.com",

    "hao@meta.us",

    "johncrenshaw@mageguys.com",

    "parthadroja@meta.com",

    "yaniv@fb.com",

    "spanou@fb.com",

    "knguyen@fb.com",

    "lflosi@fb.com",

    "hma@fb.com",

    "xfei@fb.com",

    "danf@fb.com",

    "jeffrey.warren@fb.com",

    "hcheng@fb.com",

    "wenlei@fb.com",

    "harishbeemaraj@fb.com",

    "cslowik@fb.com",

    "phinguyen712@fb.com",

    "gsong@fb.com",

    "ananda@fb.com",

    "ruchirs@fb.com",

    "sshekhar@fb.com",

    "nak@fb.com",

    "tsamuel@fb.com",

    "fangli@fb.com",

    "mburak@fb.com",

    "vparekh@fb.com",

    "nramachandran@fb.com",

    "chandragarre@fb.com",

    "skunapuli@fb.com",

    "johnsond@fb.com",

    "syang@fb.com",

    "vibhavirmani@fb.com",

    "adit@fb.com",

    "mohana@fb.com",

    "gpaul@fb.com",

    "nikila.srinivasan@fb.com",

    "schmidtk@fb.com",

    "mmetwali@fb.com",

    "amyb@fb.com",

    "danielarubio@meta.com",

    "ejqi-scott@fb.com",

    "huy@fb.com",

    "dannytrinh@meta.com",

    "nclinton@fb.com",

    "vizshine@fb.com",

    "supasate@fb.com",

    "bbharier@fb.com",

    "ncharlton24@gmail.com",

    "ntan@fb.com",

    "vikjankov@fb.com",

    "eonofrey@fb.com",

    "yaoy@fb.com",

    "sudhirrao@fb.com",

    "jr@fb.com",

    "chenj@fb.com",

    "roberty@fb.com",

    "drewshannon@fb.com",

    "al@fb.com",

    "adamc@fb.com",

    "hchristopher@fb.com",

    "qliu@fb.com",

    "jemmynieh@fb.com",

    "rbaker@fb.com",

    "ehuang@fb.com",

    "jaiswalr@fb.com",

    "ashtonudall@meta.com",

    "tarinziyaee@fb.com",

    "singhr@fb.com",

    "karansingh@meta.us",

    "jhan@fb.com",

    "pyuvraj@fb.com",

    "mayoor@fb.com",

    "mbanefo@fb.com",

    "ntran@fb.com",

    "joslynfu@fb.com",

    "fpeng@fb.com",

    "alley@fb.com",

    "baichuan@fb.com",

    "chend@fb.com",

    "jessicaprague@fb.com",

    "sabrinae@fb.com",

    "ljulia@fb.com",

    "pburjanec@fb.com",

    "eduardoreyes@fb.com",

    "jpk2003@fb.com",

    "kathleen.yang@meta.com",

    "jesgoldman@fb.com",

    "skohl@fb.com",

    "wangy@fb.com",

    "kwu@fb.com",

    "shie@fb.com",

    "chenk@fb.com",

    "lizaries@fb.com",

    "zsun@fb.com",

    "zach@fb.com",

    "zhe.wang@fb.com",

    "kejinghuang@fb.com",

    "gduan@fb.com",

    "dasnurkar@fb.com",

    "svemuri@fb.com",

    "lvega@fb.com",

    "spuri@fb.com",

    "szhu@fb.com",

    "hjun@fb.com",

    "lee.j@fb.com",

    "bstrumpf@meta.com",

    "amandakimberlywoo@gmail.com",

    "galejandro@fb.com",

    "nehag@fb.com",

    "ybh@meta.com",

    "jwong@fb.com",

    "rghody@fb.com",

    "adamp@fb.com",

    "omidi@fb.com",

    "nwang@fb.com",

    "tyang@fb.com",

    "joshb@fb.com",

    "lakshmypriyasankaran@fb.com",

    "zjin@fb.com",

    "sagarmiglani@fb.com",

    "rosshochwert@fb.com",

    "gabrieldes@fb.com",

    "elhajoui@fb.com",

    "mattschurman@fb.com",

    "adamcreeger@fb.com",

    "robveres@fb.com",

    "subbu@fb.com",

    "mroenigk@fb.com",

    "psingh@fb.com",

    "davidw@fb.com",

    "cjohn@fb.com",

    "sangeetab@fb.com",

    "meredithwang@fb.com",

    "ehubbard@fb.com",

    "ghashemian@fb.com",

    "fayeh@fb.com",

    "aaronj@fb.com",

    "amukherjee@fb.com",

    "ericavirtue@fb.com",

    "mt02931@fb.com",

    "mpeng@fb.com",

    "priyankaak@fb.com",

    "alexkoz@fb.com",

    "mariamaione@meta.com",

    "jredick@fb.com",

    "mccabe@fb.com",

    "aniketdas@fb.com",

    "eleanorl@fb.com",

    "sseshadri@meta.com",

    "prabhsingh@fb.com",

    "devsengupta@fb.com",

    "selbaghdady@fb.com",

    "sagarwal@fb.com",

    "hzhu@fb.com",

    "srinip@fb.com",

    "bmojica@fb.com",

    "alkanozturk@fb.com",

    "sr@fb.com",

    "qhu@fb.com",

    "matthew.d@fb.com",

    "rpratt@fb.com",

    "zhangtony@fb.com",

    "anthonym@fb.com",

    "jfabian@fb.com",

    "nwertzberger@fb.com",

    "akanksha@meta.com",

    "msandhu@fb.com",

    "michael.clark@fb.com",

    "rgoyal@fb.com",

    "varun.puri@fb.com",

    "kelly@fb.com",

    "micah.collins@fb.com",

    "hsrivastava@fb.com",

    "mpena@fb.com",

    "wuc@fb.com",

    "rsood@fb.com",

    "jlu@fb.com",

    "enho@fb.com",

    "arjunmoudgil@fb.com",

    "vmanickavasagam@fb.com",

    "zhuj@fb.com",

    "ryuan@fb.com",

    "zxie@fb.com",

    "theodorafang@meta.com",

    "meganm@fb.com",

    "samyuktasherugar@fb.com",

    "ejcampbell@fb.com",

    "rlo@fb.com",

    "jandalman@fb.com",

    "jscarangella@fb.com",

    "danielullman@fb.com",

    "lanya@thebaalm.com",

    "bradgash@fb.com",

    "sundaisun@meta.com",

    "cdawson@fb.com",

    "jbyon@fb.com",

    "roger.ibars@oculus.com",

    "fyang@fb.com",

    "miker@fb.com",

    "lmachluf@fb.com",

    "lyang@fb.com",

    "kvu@fb.com",

    "dana@fb.com",

    "fuchen@fb.com",

    "srinivasprasad@fb.com",

    "ebugayong@fb.com",

    "gauravjain@fb.com",

    "guptaprince@fb.com",

    "abond@fb.com",

    "joshuak@fb.com",

    "jnuger@fb.com",

    "david.g@fb.com",

    "ayuship2@fb.com",

    "gvenkatesh@fb.com",

    "chenl@fb.com",

    "hlee@fb.com",

    "skandhp@fb.com",

    "markusl@fb.com",

    "puneetgirdhar@fb.com",

    "kalich@fb.com",

    "iddy@fb.com",

    "shashidhar.gandham@fb.com",

    "andrew.bosworth@fb.com",

    "shrina@fb.com",

    "jeremy.w@fb.com",

    "drewlepp@fb.com",

    "ctang@fb.com",

    "maeboettcher@meta.com",

    "cjin@fb.com",

    "rossbohner@gmail.com",

    "paigenotfound@fb.com",

    "dpurkiss@fb.com",

    "sramesh@fb.com",

    "msaeed@fb.com",

    "gus@fb.com",

    "wangl@fb.com",

    "jchiu@fb.com",

    "qij@fb.com",

    "bryanty@fb.com",

    "cgroom@fb.com",

    "dkumar@fb.com",

    "vshetty@fb.com",

    "rachelbatish@fb.com",

    "danish@fb.com",

    "loiswang@fb.com",

    "elee@fb.com",

    "mparikh@fb.com",

    "cwann@fb.com",

    "monicalee@fb.com",

    "ofer@meta.com",

    "cbustamante@meta.com",

    "fmp@fb.com",

    "ssrivastava@fb.com",

    "anthonyhinds@instagram.com",

    "slin@fb.com",

    "mfaiz@alumni.cmu.edu",

    "ale@fb.com",

    "hjayaraman@zynga.com",

    "nhuang@fb.com",

    "aghuloum@fb.com",

    "tuomas.vallius@fb.com",

    "azhu@fb.com",

    "ergin@fb.com",

    "aschleusener@fb.com",

    "walia@fb.com",

    "jkusuma@fb.com",

    "alvin@fb.com",

    "justinh@fb.com",

    "vincentkswang@fb.com",

    "xuke@fb.com",

    "pane@fb.com",

    "manfeng@fb.com",

    "tranleminhbao@fb.com",

    "vinods@fb.com",

    "yuhuishi@fb.com",

    "jeff.lai@fb.com",

    "evans@fb.com",

    "shizhe@fb.com",

    "david.r@fb.com",

    "loiwalr@fb.com",

    "stephena@fb.com",

    "kapilk@fb.com",

    "samuels@fb.com",

    "hguo@fb.com",

    "astrong@fb.com",

    "yazziz@fb.com",

    "jiesi@fb.com",

    "mzoorob@fb.com",

    "mingrui.wu@plus.ai",

    "athenahuang@fb.com",

    "sena@fb.com",

    "nirdhar.khazanie@fb.com",

    "ro@fb.com",

    "shiy@fb.com",

    "abhishekg@fb.com",

    "vkamma@fb.com",

    "sbhatia@fb.com",

    "tjoseph@fb.com",

    "johnpeng@fb.com",

    "yaos@fb.com",

    "ssait@fb.com",

    "akadimisetty@fb.com",

    "tswarts@fb.com",

    "ruiabreu@meta.com",

    "jonm@fb.com",

    "anthonyc@fb.com",

    "nicostuart@meta.com",

    "laurenb@fb.com",

    "samanthac@fb.com",

    "averychang@fb.com",

    "jjiang@fb.com",

    "sarangb@meta.com",

    "amyh@fb.com",

    "xuhanfacebook@fb.com",

    "jsung@fb.com",

    "mehdia@fb.com",

    "cdaniel@fb.com",

    "luw@fb.com",

    "saatvik@meta.org",

    "ziv@fb.com",

    "jvaidyanathan@fb.com",

    "bliu@fb.com",

    "alexp@fb.com",

    "bcaiado@fb.com",

    "siddharthr@fb.com",

    "twong@fb.com",

    "deepanjan@fb.com",

    "yucheng.liu@fb.com",

    "matthewm@fb.com",

    "peterliu@fb.com",

    "ezhang@fb.com",

    "jyang@fb.com",

    "harshpatel@fb.com",

    "nikhilm@fb.com",

    "cdt303@nyu.edu",

    "ssemov@fb.com",

    "ariannaorland@fb.com",

    "michelle.k@fb.com",

    "cnb@fb.com",

    "debanjalee@fb.com",

    "ptomar@meta.com",

    "timoahonen@fb.com",

    "tfiala@fb.com",

    "ray.he@fb.com",

    "roshann@fb.com",

    "gyu@fb.com",

    "varun@fb.com",

    "shonore@meta.com",

    "alexpanduro@fb.com",

    "panneb@fb.com",

    "ekim@fb.com",

    "faaizakhan@fb.com",

    "sjgray@fb.com",

    "suhd@fb.com",

    "jasono@fb.com",

    "davegrant@fb.com",

    "alanmc@alum.mit.edu",

    "nyao@fb.com",

    "katherinemorris@fb.com",

    "mmalik@fb.com",

    "leoo@fb.com",

    "tdu@fb.com",

    "adityak@fb.com",

    "sli@fb.com",

    "byu@fb.com",

    "h3parikh@edu.uwaterloo.ca",

    "arowley@fb.com",

    "shahk@fb.com",

    "mrogers@fb.com",

    "sliew@fb.com",

    "xguo@fb.com",

    "lesterhung@fb.com",

    "sunnyv@fb.com",

    "yangh@fb.com",

    "matthewh@fb.com",

    "prasadmarla@fb.com",

    "anik@fb.com",

    "xuj@fb.com",

    "yohanyi@fb.com",

    "saranyanvigraham@fb.com",

    "jisaacson@fb.com",

    "hsilverman@fb.com",

    "daniela@fb.com",

    "arvindg@fb.com",

    "qrazaaq@fb.com",

    "neerajb@fb.com",

    "rgarg@fb.com",

    "paulf@fb.com",

    "hdoshi@fb.com",

    "selenasalazar@fb.com",

    "jacob.rossi@fb.com",

    "anikamitchell@fb.com",

    "eyal.ohana@oculus.com",

    "lamy@fb.com",

    "vkelly@fb.com",

    "mengl@fb.com",

    "jessicadurkin@fb.com",

    "pandrade@fb.com",

    "cleo@fb.com",

    "miket@fb.com",

    "elisatingy@gmail.com",

    "hhuang@fb.com",

    "minhh@fb.com",

    "ashah@fb.com",

    "sjohnson@fb.com",

    "kalexander@fb.com",

    "pkumar@fb.com",

    "chrisan@fb.com",

    "gabriel.aul@fb.com",

    "tarun.karuturi@fb.com",

    "hoa@fb.com",

    "zacdrake@fb.com",

    "jyuan@fb.com",

    "shafiulazam@fb.com",

    "jimc@fb.com",

    "dhuang@fb.com",

    "fyu@fb.com",

    "chrisschrader@fb.com",

    "francescac@fb.com",

    "gmalik@fb.com",

    "neunzo@fb.com",

    "dtiwari@fb.com",

    "naomi@fb.com",

    "mhasan@fb.com",

    "sparth@fb.com",

    "jbari@fb.com",

    "aayushp@fb.com",

    "sunilk@fb.com",

    "almango@fb.com",

    "shivashankarhalan@gmail.com",

    "mlevy@fb.com",

    "kkoehler@fb.com",

    "ecoons@fb.com",

    "yanr@fb.com",

    "arondahlgren@meta.com",

    "faresende@fb.com",

    "daphra@fb.com",

    "kjain@fb.com",

    "pbhardwaj@fb.com",

    "jian@fb.com",

    "tsung-ching@meta.org",

    "melissa.saboowala@fb.com",

    "jingf@fb.com",

    "kdesai@fb.com",

    "michelle.yuen@fb.com",

    "sriraml@fb.com",

    "cshields@fb.com",

    "sgong@fb.com",

    "andrewc@fb.com",

    "asadhoo@fb.com",

    "sryan@fb.com",

    "janeg@fb.com",

    "mchen@fb.com",

    "mher@fb.com",

    "yongbo@fb.com",

    "zzhao@fb.com",

    "hyalamanchili@fb.com",

    "arjunsehgal@fb.com",

    "feng.lu@utexas.edu",

    "heidiyang@meta.com",

    "dtucito@fb.com",

    "aarima@fb.com",

    "ehaun@fb.com",

    "xliu@fb.com",

    "mgd67@cornell.edu",

    "neilc@fb.com",

    "ericw@fb.com",

    "mitaligurnani@fb.com",

    "liai@fb.com",

    "rajeshd@fb.com",

    "jennysundel@fb.com",

    "poorvi@meta.com",

    "gjohn@fb.com",

    "jonfelske@fb.com",

    "bb@fb.com",

    "greenleilac@gmail.com",

    "rsongco@fb.com",

    "colemurphy@fb.com",

    "sshah@fb.com",

    "catalinat@fb.com",

    "ckairalla@meta.com",

    "kalis@fb.com",

    "jchen@fb.com",

    "justin.glaeser@fb.com",

    "nicole.g@fb.com",

    "mrohani@fb.com",

    "mlee@fb.com",

    "jcross@fb.com",

    "lmarken@fb.com",

    "vidazhang@fb.com",

    "groblesp@fb.com",

    "tgiang@fb.com",

    "jenlebeau@fb.com",

    "krisrose@meta.com",

    "ashleyeadon@fb.com",

    "lij@fb.com",

    "abhargava@fb.com",

    "yuchenbj@gmail.com",

    "hiten@fb.com",

    "carriej@fb.com",

    "nic@fb.com",

    "susanc@fb.com",

    "akshayb@fb.com",

    "waqarnayyar@fb.com",

    "pbansal@fb.com",

    "jwalters@fb.com",

    "jkrikheli@fb.com",

    "patrickg@fb.com",

    "jeremiahr@fb.com",

    "vsinha@fb.com",

    "khushbu.katariya@wellsfargo.com",

    "yyavuz@fb.com",

    "ck@fb.com",

    "elomarsouza@fb.com",

    "benjaminau@fb.com",

    "denisg@fb.com",

    "jqian@fb.com",

    "joshluo@fb.com",

    "manavs@fb.com",

    "idvorkin@fb.com",

    "mbirkner@fb.com",

    "weir@fb.com",

    "bzhang@fb.com",

    "danchern@fb.com",

    "mafaneh@fb.com",

    "hannahcassius@fb.com",

    "tripathym@fb.com",

    "pbadgujar@fb.com",

    "cedb@fb.com",

    "wangs@fb.com",

    "pdo@fb.com",

    "lcbrown@meta.com",

    "zhangy@fb.com",

    "arodriguez@fb.com",

    "crosby.steiner@fb.com",

    "jwilliams@fb.com",

    "brianessex@meta.com",

    "clairewolf@fb.com",

    "davidhong@fb.com",

    "katiehu@fb.com",

    "nityaverma@fb.com",

    "joshuam@fb.com",

    "bethanyd@fb.com",

    "kharris@fb.com",

    "kimt@fb.com",

    "marcusw@fb.com",

    "perryg@fb.com",

    "kaarin@fb.com",

    "bgoyal@fb.com",

    "dsouza@fb.com",

    "nvartanian@fb.com",

    "nikhilar@fb.com",

    "sshin@fb.com",

    "michelle.yuen@fb.com",

    "jingf@fb.com",

    "sriraml@fb.com",

    "kdesai@fb.com",

    "cshields@fb.com",

    "michelle.yuen@fb.com",

    "sgong@fb.com",

    "sriraml@fb.com",

    "andrewc@fb.com",

    "cshields@fb.com",

    "asadhoo@fb.com",

    "sgong@fb.com",

    "sryan@fb.com",

    "andrewc@fb.com",

    "janeg@fb.com",

    "asadhoo@fb.com",

    "mchen@fb.com",

    "sryan@fb.com",

    "mher@fb.com",

    "janeg@fb.com",

    "yongbo@fb.com",

    "mchen@fb.com",

    "zzhao@fb.com",

    "mher@fb.com",

    "hyalamanchili@fb.com",

    "yongbo@fb.com",

    "arjunsehgal@fb.com",

    "zzhao@fb.com",

    "feng.lu@utexas.edu",

    "hyalamanchili@fb.com",

    "heidiyang@meta.com",

    "arjunsehgal@fb.com",

    "dtucito@fb.com",

    "feng.lu@utexas.edu",

    "aarima@fb.com",

    "heidiyang@meta.com",

    "ehaun@fb.com",

    "dtucito@fb.com",

    "xliu@fb.com",

    "aarima@fb.com",

    "mgd67@cornell.edu",

    "ehaun@fb.com",

    "neilc@fb.com",

    "xliu@fb.com",

    "ericw@fb.com",

    "mgd67@cornell.edu",

    "mitaligurnani@fb.com",

    "neilc@fb.com",

    "liai@fb.com",

    "ericw@fb.com",

    "rajeshd@fb.com",

    "mitaligurnani@fb.com",

    "jennysundel@fb.com",

    "poorvi@meta.com",

    "liai@fb.com",

    "gjohn@fb.com",

    "rajeshd@fb.com",

    "jennysundel@fb.com",

    "jonfelske@fb.com",

    "poorvi@meta.com",

    "bb@fb.com",

    "greenleilac@gmail.com",

    "gjohn@fb.com",

    "rsongco@fb.com",

    "jonfelske@fb.com",

    "bb@fb.com",

    "colemurphy@fb.com",

    "greenleilac@gmail.com",

    "sshah@fb.com",

    "rsongco@fb.com",

    "catalinat@fb.com",

    "ckairalla@meta.com",

    "colemurphy@fb.com",

    "sshah@fb.com",

    "kalis@fb.com",

    "catalinat@fb.com",

    "jchen@fb.com",

    "ckairalla@meta.com",

    "justin.glaeser@fb.com",

    "kalis@fb.com",

    "nicole.g@fb.com",

    "jchen@fb.com",

    "mrohani@fb.com",

    "justin.glaeser@fb.com",

    "mlee@fb.com",

    "nicole.g@fb.com",

    "jcross@fb.com",

    "mrohani@fb.com",

    "lmarken@fb.com",

    "mlee@fb.com",

    "vidazhang@fb.com",

    "groblesp@fb.com",

    "tgiang@fb.com",

    "jcross@fb.com",

    "lmarken@fb.com",

    "jenlebeau@fb.com",

    "vidazhang@fb.com",

    "krisrose@meta.com",

    "groblesp@fb.com",

    "ashleyeadon@fb.com",

    "tgiang@fb.com",

    "jenlebeau@fb.com",

    "lij@fb.com",

    "krisrose@meta.com",

    "ashleyeadon@fb.com",

    "abhargava@fb.com",

    "lij@fb.com",

    "yuchenbj@gmail.com",

    "abhargava@fb.com",

    "hiten@fb.com",

    "yuchenbj@gmail.com",

    "carriej@fb.com",

    "hiten@fb.com",

    "nic@fb.com",

    "carriej@fb.com",

    "susanc@fb.com",

    "nic@fb.com",

    "susanc@fb.com",

    "akshayb@fb.com",

    "akshayb@fb.com",

    "waqarnayyar@fb.com",

    "waqarnayyar@fb.com",

    "pbansal@fb.com",

    "pbansal@fb.com",

    "jwalters@fb.com",

    "jwalters@fb.com",

    "jkrikheli@fb.com",

    "jkrikheli@fb.com",

    "patrickg@fb.com",

    "patrickg@fb.com",

    "jeremiahr@fb.com",

    "jeremiahr@fb.com",

    "vsinha@fb.com",

    "vsinha@fb.com",

    "khushbu.katariya@wellsfargo.com",

    "khushbu.katariya@wellsfargo.com",

    "yyavuz@fb.com",

    "yyavuz@fb.com",

    "ck@fb.com",

    "ck@fb.com",

    "elomarsouza@fb.com",

    "elomarsouza@fb.com",

    "benjaminau@fb.com",

    "benjaminau@fb.com",

    "denisg@fb.com",

    "denisg@fb.com",

    "jqian@fb.com",

    "jqian@fb.com",

    "joshluo@fb.com",

    "joshluo@fb.com",

    "manavs@fb.com",

    "manavs@fb.com",

    "idvorkin@fb.com",

    "idvorkin@fb.com",

    "mbirkner@fb.com",

    "mbirkner@fb.com",

    "weir@fb.com",

    "weir@fb.com",

    "bzhang@fb.com",

    "bzhang@fb.com",

    "danchern@fb.com",

    "mafaneh@fb.com",

    "danchern@fb.com",

    "mafaneh@fb.com",

    "hannahcassius@fb.com",

    "tripathym@fb.com",

    "hannahcassius@fb.com",

    "pbadgujar@fb.com",

    "tripathym@fb.com",

    "cedb@fb.com",

    "pbadgujar@fb.com",

    "cedb@fb.com",

    "wangs@fb.com",

    "wangs@fb.com",

    "pdo@fb.com",

    "pdo@fb.com",

    "lcbrown@meta.com",

    "lcbrown@meta.com",

    "zhangy@fb.com",

    "zhangy@fb.com",

    "arodriguez@fb.com",

    "arodriguez@fb.com",

    "crosby.steiner@fb.com",

    "crosby.steiner@fb.com",

    "jwilliams@fb.com",

    "jwilliams@fb.com",

    "brianessex@meta.com",

    "brianessex@meta.com",

    "clairewolf@fb.com",

    "clairewolf@fb.com",

    "davidhong@fb.com",

    "davidhong@fb.com",

    "katiehu@fb.com",

    "katiehu@fb.com",

    "nityaverma@fb.com",

    "nityaverma@fb.com",

    "joshuam@fb.com",

    "joshuam@fb.com",

    "bethanyd@fb.com",

    "bethanyd@fb.com",

    "kharris@fb.com",

    "kharris@fb.com",

    "kimt@fb.com",

    "kimt@fb.com",

    "marcusw@fb.com",

    "marcusw@fb.com",

    "perryg@fb.com",

    "perryg@fb.com",

    "kaarin@fb.com",

    "kaarin@fb.com",

    "bgoyal@fb.com",

    "bgoyal@fb.com",

    "dsouza@fb.com",

    "dsouza@fb.com",

    "nvartanian@fb.com",

    "nvartanian@fb.com",

    "nikhilar@fb.com",

    "nikhilar@fb.com",

    "sshin@fb.com",

    "sshin@fb.com",

    "lmarken@fb.com",

    "vidazhang@fb.com",

    "groblesp@fb.com",

    "tgiang@fb.com",

    "jenlebeau@fb.com",

    "krisrose@meta.com",

    "ashleyeadon@fb.com",

    "lij@fb.com",

    "abhargava@fb.com",

    "yuchenbj@gmail.com",

    "hiten@fb.com",

    "carriej@fb.com",

    "nic@fb.com",

    "susanc@fb.com",

    "akshayb@fb.com",

    "waqarnayyar@fb.com",

    "pbansal@fb.com",

    "jwalters@fb.com",

    "jkrikheli@fb.com",

    "patrickg@fb.com",

    "jeremiahr@fb.com",

    "vsinha@fb.com",

    "khushbu.katariya@wellsfargo.com",

    "yyavuz@fb.com",

    "ck@fb.com",

    "elomarsouza@fb.com",

    "benjaminau@fb.com",

    "denisg@fb.com",

    "jqian@fb.com",

    "joshluo@fb.com",

    "manavs@fb.com",

    "idvorkin@fb.com",

    "mbirkner@fb.com",

    "weir@fb.com",

    "bzhang@fb.com",

    "danchern@fb.com",

    "mafaneh@fb.com",

    "hannahcassius@fb.com",

    "tripathym@fb.com",

    "pbadgujar@fb.com",

    "cedb@fb.com",

    "wangs@fb.com",

    "pdo@fb.com",

    "lcbrown@meta.com",

    "zhangy@fb.com",

    "arodriguez@fb.com",

    "crosby.steiner@fb.com",

    "jwilliams@fb.com",

    "brianessex@meta.com",

    "clairewolf@fb.com",

    "davidhong@fb.com",

    "katiehu@fb.com",

    "nityaverma@fb.com",

    "joshuam@fb.com",

    "bethanyd@fb.com",

    "kharris@fb.com",

    "kimt@fb.com",

    "marcusw@fb.com",

    "perryg@fb.com",

    "kaarin@fb.com",

    "bgoyal@fb.com",

    "dsouza@fb.com",

    "nvartanian@fb.com",

    "nikhilar@fb.com",

    "sshin@fb.com",

    "chris.g@betterrehab.com.au",

    "dpollek@anomali.com",

    "stephanie.pagan@iliabeauty.com",

    "wesley.mersinger@diageo.com",
  ];
  const personaIds = emails.map((item) => item.id);
  const persona = await apolloPersonaRepository.find(
    {
      id: { $in: personaIds },
    },
    "id name title organization.name first_name"
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
      jobData = await linkedinJobRepository.find(
        { job_id: { $in: jobIds } },
        "job_title job_posted_at_datetime_utc job_city job_state job_country employer_name"
      );
      jobData = addJobLocation(jobData);
    }

    for (const email of emails) {
      if (!uniqueEmails.has(email.email)) {
        uniqueEmails.add(email.email); // Add the email to the Set to track it as processed
        if (blockedEmails.includes(email.email)) {
          console.log(`Skipping blocked email: ${email.email}`);
          continue; // Skip the current iteration if the email is in the blocked list
        }
        try {
          const personData = findPersonById(email.id, persona);
          const foundJob = findJobPostByEmployerName(
            jobData,
            personData.organization.name
          );
          let jobPost = foundJob.map((job) => job.job_title).join(", ");
          const jobDate = foundJob
            .map((job) => job.job_posted_at_datetime_utc)
            .join(", ");
          const jobLocation = foundJob
            .map((job) => job.job_location)
            .join(", ");
          jobPost = removeAfterFirstComma(jobPost);

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
            cc: "vinay.prajapati@hirequotient.com",
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
            console.error(`Failed to send email to ${mailOptions.to}:`, error);
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
          console.error(`Error processing email for ${email.id}:`, error);
        }
      } else {
        console.log(`Skipping duplicate email: ${email.email}`);
      }
    }

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.error("Error in email sending process:", error);
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
    await requestIdRepository.updateOne(
      { reqId: reqUUID },
      { $set: { personaProcessCompleted: false } }
    );
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
    await requestIdRepository.updateOne(
      { reqId: reqUUID },
      { $set: { personaProcessCompleted: true } }
    );
    if (!flag) res.redirect(`/persona-reachout/${reqUUID}`);
  } catch (error) {
    console.error("Error creating persona:", error);
    res.status(500).json({ error: "Failed to create persona" });
  }
});

app.get("/api/check-status/:reqId", async (req, res) => {
  try {
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
    console.error("Error checking status:", error);
    res.status(500).json({ error: `Failed to check status ${error}` });
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
      await updateRequestWithJobIds(reqUUID, jobDataSave, convertedObject);
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
    console.error("Error processing enriched data:", error);
    res.status(500).json({ error: "Failed to process enriched data" });
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
