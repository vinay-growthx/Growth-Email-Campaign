const axios = require("axios");

async function getEmailByLinkedInUrl(linkedinUrl) {
  const apiKey = process.env.APOLLO_API_KEY;
  const url = "https://api.apollo.io/v1/people/match";

  try {
    const response = await axios.post(
      url,
      {
        linkedin_url: linkedinUrl,
        reveal_personal_emails: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
      }
    );

    console.log("Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error during API call:", error.message);
    return null;
  }
}
module.exports = { getEmailByLinkedInUrl };
