const axios = require("axios");

async function searchLinkedInPeopleViaLix(params) {
  try {
    const url = "https://api.lix-it.com/v1/li/sales/search/people";
    const authorization = process.env.LIX_IT_AUTH_TOKEN;

    if (!authorization) {
      throw new Error("LIX_IT_AUTH_TOKEN is not set in environment variables");
    }

    const response = await axios.post(
      url,
      new URLSearchParams({
        viewAllFilters: params.viewAllFilters || "true",
        url: params.linkedInSearchUrl,
      }),
      {
        headers: {
          Authorization: authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error searching LinkedIn people:", error);
    throw error;
  }
}

module.exports = { searchLinkedInPeopleViaLix };
