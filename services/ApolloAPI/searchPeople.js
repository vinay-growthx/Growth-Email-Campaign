const axios = require("axios");

async function searchPeople(locations, companyNames) {
  const url = "https://api.apollo.io/v1/mixed_people/search";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": process.env.APOLLO_API_KEY,
  };

  const body = {
    page: 1,
    per_page: 50,
    organization_locations: locations,
    person_titles: [
      "VP of Talent Acquisition",
      "HR Director",
      "Director of Talent Acquisition",
      "Head of Talent AcquisitionA",
    ],
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response.data;
  } catch (error) {
    console.error("Error searching people:", error);
  }
}

module.exports = { searchPeople };
