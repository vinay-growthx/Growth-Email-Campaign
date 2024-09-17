const axios = require("axios");
const LinkedinJobRepository = require("../repository/LinkedinJobRepository");
const linkedinJobRepository = new LinkedinJobRepository();
async function saveJobs(jobs) {
  console.log("json jobs ===>", JSON.stringify(jobs));
  for (const job of jobs) {
    try {
      const result = await linkedinJobRepository.create(job);
      console.log("Job saved successfully:", result);
    } catch (error) {
      console.error("Error saving job:", error);
    }
  }
}
async function searchLinkedInJobs(query, maxPages, searchLocationId, sortBy) {
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

        const response = await axios.request(options);
        let i = 0;
        await new Promise((resolve) => setTimeout(resolve, 800));
        response.data.response.jobs.forEach((job) => {
          if (
            !combinedResults.some(
              (existingJob) => existingJob.jobId === job.jobId
            )
          ) {
            console.log("i ======>", i);
            i++;
            combinedResults.push(job);
          }
        });
      }
    }
    saveJobs(combinedResults);
    return combinedResults;
  } catch (error) {
    console.log(error);
  }
}

module.exports = { searchLinkedInJobs };
