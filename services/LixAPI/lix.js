const axios = require("axios");

async function searchPeopleLix(url) {
  const url = "https://api.lix-it.com/v1/li/sales/search/people";
  const apiKey = process.env.LIX_API_KEY;

  const config = {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    params: {
      viewAllFilters: true,
      url: url,
    },
  };

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

module.exports = { searchPeopleLix };
