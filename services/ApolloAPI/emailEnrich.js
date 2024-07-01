const axios = require("axios");
const ApolloPersonaRepository = require("../../repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();

async function getEmailByLinkedInUrl(linkedinUrl, personaId) {
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
    await apolloPersonaRepository.updateOne(
      { id: personaId },
      { $set: { email: response?.data?.person?.email } }
    );
    return response?.data?.person?.email || "";
  } catch (error) {
    console.error("Error during API call:", error.message);
    return null;
  }
}
module.exports = { getEmailByLinkedInUrl };
