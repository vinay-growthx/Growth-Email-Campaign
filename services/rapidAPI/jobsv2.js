const axios = require("axios");

async function searchJobs(query, page, numPages, datePosted) {
  const options = {
    method: "GET",
    url: `https://${process.env.LI_JOB_RAPIDAPI_HOST}/search`,
    params: {
      query: query,
      page: page,
      num_pages: numPages,
      date_posted: datePosted,
    },
    headers: {
      "x-rapidapi-key": `${process.env.LI_JOB_RAPIDAPI_KEY}`,
      "x-rapidapi-host": `${process.env.LI_JOB_RAPIDAPI_HOST}`,
    },
  };

  try {
    const response = await axios.request(options);
    return response.data;
  } catch (error) {
    throw error;
  }
}

// const query = "Python developer in Texas, USA";
// const page = 1;
// const numPages = 1;
// const datePosted = "all";
// const result = await searchJobs(query, page, numPages, datePosted);

module.exports = { searchJobs };
