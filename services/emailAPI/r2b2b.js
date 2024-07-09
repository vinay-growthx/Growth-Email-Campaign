const axios = require("axios");
const ApolloPersonaRepository = require("../../repository/ApolloPersonaRepository");
const apolloPersonaRepository = new ApolloPersonaRepository();

async function fetchWorkEmailFromRb2bapi(linkedinUrl, personaId) {
  try {
    const authToken = process.env.AUTH_TOKEN; // Make sure to set this environment variable
    const encodedLinkedinUrl = encodeURIComponent(linkedinUrl);
    const url = `https://rb2bapi.com/api/v1/public/b2b-data/emails/GetAllEmail?url=${encodedLinkedinUrl}`;

    const response = await axios.get(url, {
      headers: {
        authorization: "basic",
        token: authToken,
      },
    });

    const data = response.data;

    // Extracting only the work_email from the response
    const workEmail = data.work_email;
    await apolloPersonaRepository.updateOne(
      { id: personaId },
      { $set: { email: response.data.work_email } }
    );
    return workEmail;
  } catch (error) {
    console.error("Error fetching emails from rb2bapi:", error);
  }
}
module.exports = { fetchWorkEmailFromRb2bapi };
