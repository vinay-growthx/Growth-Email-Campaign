const axios = require("axios");
const ApolloPersonaRepository = require("../../repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();

async function fetchEmailViaContactOut(profileUrl, personaId) {
  try {
    const apiKey = process.env.CONTACT_OUT; // Make sure to set this environment variable
    const encodedProfileUrl = encodeURIComponent(profileUrl);
    const url = `https://api.contactout.com/v1/people/linkedin?profile=${encodedProfileUrl}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: "basic",
        token: apiKey,
      },
    });

    const workEmail = response?.data?.profile?.work_email?.[0] || "";
    await apolloPersonaRepository.updateOne(
      { id: personaId },
      { $set: { email: response?.data?.profile?.work_email?.[0] } }
    );
    return workEmail;
  } catch (error) {
    console.error("Error fetching LinkedIn profile:", error);
    throw error;
  }
}

module.exports = { fetchEmailViaContactOut };
