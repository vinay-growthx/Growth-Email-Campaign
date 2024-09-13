const axios = require("axios");

async function searchLinkedInJobs(query, page, searchLocationId, sortBy) {
  const options = {
    method: "GET",
    url: "https://linkedin-data-scraper.p.rapidapi.com/search_jobs",
    params: {
      query,
      page,
      searchLocationId,
      sortBy,
    },
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY_LIVE,
      "x-rapidapi-host": "linkedin-data-scraper.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

module.exports = { searchLinkedInJobs };
