const axios = require("axios");

async function fetchJobListings(data) {
  console.log("date posted", data);
  const config = {
    method: "get",
    url: "https://jobs-api14.p.rapidapi.com/list",
    headers: {
      "x-rapidapi-host": "jobs-api14.p.rapidapi.com",
      "x-rapidapi-key": "2de43991aemshe3b4baf8ce9c093p15c229jsn39aee9a08a04", // Replace YOUR_RAPIDAPI_KEY with your actual RapidAPI key
    },
    params: {
      query: `${data.job_titles} in ${data.query}`,
      location: data.query.split(" in ")[1], // assuming the location is the part after 'in'
      distance: data.radius,
      language: "en_GB",
      remoteOnly: data.remote_jobs_only === "on",
      datePosted: data.date_posted === "all" ? "" : data.date_posted,
      employmentTypes: data.employment_types.toUpperCase(),
      index:
        parseInt(data.num_pages - data.page) - 1 <= 0
          ? 0
          : parseInt(data.num_pages - data.page), // Convert page number to zero-based index for the API
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error fetching job listings:", error);
    return null;
  }
}

module.exports = { fetchJobListings };
