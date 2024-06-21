const { Logtail } = require("@logtail/node");
// const logtail = new Logtail(process.env.LOGTAIL_ID);
const logtail = {
  info: (message) => {
    console.log("Logging Logatil message: Not printing right now");
  },
  error: (message) => {
    console.log("Logtail error log:", message);
  },
};
module.exports = logtail;
