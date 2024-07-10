const axios = require("axios");
const { processLocation } = require("../util");
async function searchPeople(
  locations,
  orgId,
  personaDesignation,
  employeeSize,
  seniorityLevel
) {
  if (!orgId) return null;
  // console.log("persona designation ===>", personaDesignation);
  // console.log("org ids ====>", orgId);
  // console.log("person seniority ====>", seniorityLevel);
  let personLocations = processLocation(locations);
  // console.log("location =====>", personLocations);
  const url = "https://api.apollo.io/v1/mixed_people/search";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": process.env.APOLLO_API_KEY,
  };

  const body = {
    page: 1,
    per_page: 25,
    person_locations: personLocations,
    person_titles:
      Array.isArray(personaDesignation) && personaDesignation?.length
        ? personaDesignation
        : [
            "VP of Talent Acquisition",
            "HR Director",
            "Director of Talent Acquisition",
            "Head of Talent Acquisition",
          ],
    organization_ids: [orgId],
  };

  if (employeeSize) {
    body.organization_num_employees_ranges = employeeSize;
  }
  if (seniorityLevel) {
    let resultArray = seniorityLevel.split(",");
    const res_seniority = resultArray.map((res) => res.toLowerCase());
    // console.log("person seniority ====>", resultArray);
    body.person_seniorities = res_seniority;
  }

  try {
    const response = await axios.post(url, body, { headers });
    console.log(
      // "response data 0",
      // response.data[0],
      "response len",
      response.data.length
    );
    return response.data;
  } catch (error) {
    console.error("Error searching people:", error);
  }
}

module.exports = { searchPeople };
