require("dotenv").config();
const axios = require("axios");

async function fetchJobData(keywords, locationId, datePosted, sort) {
  try {
    const response = await axios.get(
      `https://${process.env.RAPIDAPI_HOST}/search-jobs-v2`,
      {
        params: {
          keywords,
          locationId,
          datePosted,
          sort,
        },
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY_JOB,
          "x-rapidapi-host": process.env.RAPIDAPI_HOST_JOB,
        },
      }
    );
    console.log(response.data);
  } catch (error) {
    console.error("Error fetching job data:", error);
  }
}

module.exports = { fetchJobData };
// Example usage
// fetchJobData("golang", "92000000", "anyTime", "mostRelevant");
