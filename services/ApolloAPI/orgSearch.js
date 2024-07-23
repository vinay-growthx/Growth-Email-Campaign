const axios = require("axios");
const { trackApiCall } = require("../util");

async function searchCompanyApollo(organizationName) {
  console.log("orgnaization name ====>", organizationName);
  const url = "https://api.apollo.io/api/v1/mixed_companies/search";
  const data = {
    page: 1,
    per_page: 1,
    q_organization_name: organizationName,
  };
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": process.env.APOLLO_API_KEY,
  };

  try {
    const response = await axios.post(url, data, { headers });
    // console.log(response.data);
    trackApiCall("https://api.apollo.io/api/v1/mixed_companies/search");
    return response.data;
  } catch (error) {
    console.error("Error in making request:", error.message);
    return null;
  }
}
module.exports = { searchCompanyApollo };
