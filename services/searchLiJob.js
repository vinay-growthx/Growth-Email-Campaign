const axios = require("axios");

async function searchLinkedInJobs(query, maxPages, searchLocationId, sortBy) {
  console.log("query ---->", query);
  console.log("max pages ---->", maxPages);
  console.log("search location id ---->", searchLocationId);
  console.log("sort by ---->", sortBy);
  console.log("query ===>", query);
  const [andPart, orPart] = query.split(/\s+AND\s+/);
  const orKeywords = orPart
    ? orPart.replace(/[()]/g, "").split(/\s+OR\s+/)
    : [];

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
      console.log("or keywords", orKeywords);
      for (const keyword of orKeywords) {
        const options = {
          ...baseOptions,
          params: {
            ...baseOptions.params,
            page,
            searchLocationId,
            sortBy,
            query: `${andPart.trim()} ${keyword.trim()}`,
          },
        };

        const response = await axios.request(options);
        console.log("response data response ===>", response.data.response);
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
    console.log("combined results ====>", combinedResults);
    return combinedResults;
  } catch (error) {
    console.log(error);
  }
}

module.exports = { searchLinkedInJobs };
