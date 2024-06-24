const axios = require("axios");

async function searchPeople(apiKey, titles, locations, companyNames) {
  const url = "https://api.apollo.io/v1/mixed_people/search";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": apiKey,
  };

  const body = {
    query: {
      titles: [
        "VP of Talent Acquisition",
        "HR Director",
        "Director of TA",
        "Head of TA",
      ],
      locations: locations,
      company_names: companyNames,
    },
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response.data;
  } catch (error) {
    console.error("Error searching people:", error);
    throw error;
  }
}

module.exports = { searchPeople };
