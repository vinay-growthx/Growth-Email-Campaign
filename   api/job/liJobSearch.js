const axios = require("axios");

async function searchLinkedinJobs(query, page, options = {}) {
  const {
    searchLocationId,
    easyApply,
    experience,
    jobType,
    postedAgo,
    workplaceType,
    sortBy,
    companyIdsList,
    industryIdsList,
    functionIdsList,
    titleIdsList,
    locationIdsList,
  } = options;

  const params = {
    query: query,
    page: page,
    searchLocationId: searchLocationId || undefined,
    experience: experience || undefined,
    jobType: jobType || undefined,
    postedAgo: postedAgo || undefined,
    workplaceType: workplaceType || undefined,
    sortBy: sortBy || undefined,
    companyIdsList: companyIdsList || undefined,
    industryIdsList: industryIdsList || undefined,
    functionIdsList: functionIdsList || undefined,
    titleIdsList: titleIdsList || undefined,
    locationIdsList: locationIdsList || undefined,
  };

  const axiosOptions = {
    method: "GET",
    url: "https://linkedin-data-scraper.p.rapidapi.com/search_jobs",
    params: params,
    headers: {
      "x-rapidapi-key": process.env.RAPIDAPI_KEY_NEW,
      "x-rapidapi-host": "linkedin-data-scraper.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(axiosOptions);
    return response.data;
  } catch (error) {
    console.error("Failed to search LinkedIn jobs:", error);
  }
}
module.exports = { searchLinkedinJobs };
