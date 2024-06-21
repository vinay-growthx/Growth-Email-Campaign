const ngrok = require("ngrok");
const port = process.env.PORT || 4000;

(async function () {
  const url = await ngrok.connect(port);
  console.info(url);
})();
