const axios = require("axios");
const { trackApiCall } = require("../util");

async function searchPeopleLix(searchUrl) {
  const url = "https://api.lix-it.com/v1/li/sales/search/people";
  const apiKey = process.env.LIX_API_KEY;

  const config = {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    params: {
      viewAllFilters: true,
      url: searchUrl,
    },
  };

  try {
    const response = await axios.get(url, config);
    trackApiCall(`https://api.lix-it.com/v1/li/sales/search/people`);
    console.log("response =----->", JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

module.exports = { searchPeopleLix };
