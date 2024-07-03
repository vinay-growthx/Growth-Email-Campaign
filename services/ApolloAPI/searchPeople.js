const axios = require("axios");

async function searchPeople(locations, orgId, personaDesignation) {
  console.log("persona designation ===>", personaDesignation);
  console.log("org ids ====>", orgId);
  console.log("location =====>", locations);
  const url = "https://api.apollo.io/v1/mixed_people/search";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": process.env.APOLLO_API_KEY,
  };

  const body = {
    page: 1,
    per_page: 25,
    person_locations: locations,
    person_titles: personaDesignation?.length
      ? personaDesignation
      : [
          "VP of Talent Acquisition",
          "HR Director",
          "Director of Talent Acquisition",
          "Head of Talent AcquisitionA",
        ],
    organization_ids: [orgId],
  };

  try {
    const response = await axios.post(url, body, { headers });
    console.log(JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error("Error searching people:", error);
  }
}

module.exports = { searchPeople };
