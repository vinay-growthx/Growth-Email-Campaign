const axios = require("axios");
const LinkedinJobRepository = require("../repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();
const RequestIdRepository = require("../repository/RequestIdRepository");
const requestIdRepository = new RequestIdRepository();
const { transformData } = require("../services/util");
async function saveJobs(jobs) {
  for (const job of jobs) {
    try {
      let convertedJob = transformData(job);
      const result = await linkedinJobRepository.create(convertedJob);
      console.log("Job saved successfully:", result);
    } catch (error) {
      console.error("Error saving job:", error);
    }
  }
}
async function searchLinkedInJobs(
  query,
  maxPages,
  searchLocationId,
  sortBy,
  reqUUID
) {
  console.log("query ---->", query);

  let keywords = [query];
  if (query.includes(" AND ")) {
    const [andPart, orPart] = query.split(/\s+AND\s+/);
    if (orPart && orPart.includes(" OR ")) {
      keywords = orPart
        .replace(/[()]/g, "")
        .split(/\s+OR\s+/)
        .map((keyword) => `${andPart.trim()} ${keyword.trim()}`);
    } else {
      keywords = [query];
    }
  } else if (query.includes(" OR ")) {
    keywords = query.split(/\s+OR\s+/);
  }

  const baseOptions = {
    method: "GET",
    url: "https://linkedin-data-scraper.p.rapidapi.com/search_jobs",
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY_LIVE,
      "x-rapidapi-host": "linkedin-data-scraper.p.rapidapi.com",
    },
  };

  try {
    const combinedResults = [];
    for (let page = 1; page <= maxPages; page++) {
      console.log("page ====>", page);
      console.log("keywords", keywords);
      for (const keyword of keywords) {
        const options = {
          ...baseOptions,
          params: {
            ...baseOptions.params,
            page,
            searchLocationId,
            sortBy,
            query: keyword.trim(),
          },
        };

        try {
          const response = await axios.request(options);
          await new Promise((resolve) => setTimeout(resolve, 800));

          if (
            response.data &&
            response.data.response &&
            Array.isArray(response.data.response.jobs)
          ) {
            response.data.response.jobs.forEach((job) => {
              // Extract jobId from jobPostingUrl
              let jobId = null;
              if (job.jobPostingUrl) {
                const match = job.jobPostingUrl.match(/view\/(\d+)/);
                if (match && match[1]) {
                  jobId = match[1];
                }
              }

              if (
                jobId &&
                !combinedResults.some(
                  (existingJob) => existingJob.jobId === jobId
                )
              ) {
                combinedResults.push({
                  ...job,
                  jobId: jobId,
                });
              }
            });

            console.log(`Added ${combinedResults.length} jobs so far.`);
          } else {
            console.log(
              "No jobs found or invalid response structure for keyword:",
              keyword
            );
          }
        } catch (error) {
          console.error("Error fetching jobs for keyword:", keyword, error);
        }
      }
    }
    if (combinedResults.length > 0) {
      const allJobIds = combinedResults.map((job) => job.jobId);
      const updatedDoc = await requestIdRepository.findOneAndUpdate(
        { reqId: reqUUID },
        { $addToSet: { jobIds: { $each: allJobIds } } },
        { upsert: true }
      );
      const uniqueJobIdsCount = updatedDoc.jobIds
        ? updatedDoc.jobIds.length
        : 0;
      if (process.env.ENV == "production") {
        const mailOptions = {
          to: `vinay.prajapati@hirequotient.com,utkarsh@hirequotient.com`,
          from: "EasySource <no-reply@hirequotient.com>",
          subject: `AI Outbound search Notification: Data from live search`,
          html: `Search performed on job title: ${query}<br>
          Total unique jobs found from live search: ${uniqueJobIdsCount}<br>
          `,
        };
        console.log({ mailOptions });
        smtpTransport.sendMail(mailOptions);
        console.log("Email sent");
      }
      await saveJobs(combinedResults);
    } else {
      console.log("No jobs found to save.");
    }
    await requestIdRepository.updateOne(
      { reqId: reqUUID },
      { $set: { jobProcessCompleted: true } }
    );

    return combinedResults;
  } catch (error) {
    console.error("Error in searchLinkedInJobs:", error);
    return [];
  }
}

module.exports = { searchLinkedInJobs };
