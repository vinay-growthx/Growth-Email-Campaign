const axios = require("axios");

const getLinkedInData = async (username) => {
  const apiKey = process.env.RAPID_API_SALES_NAV_KEY;
  const apiHost = process.env.RAPID_API_SALES_NAV_HOST;

  const url = `https://${apiHost}?username=${username}`;

  const options = {
    method: "GET",
    url: url,
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  };

  try {
    const response = await axios.request(options);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

module.exports = {
  getLinkedInData,
};
