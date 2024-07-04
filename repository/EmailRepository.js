const Email = require("../schema/Email");
const BaseRepository = require("./BaseRepository");

module.exports = class EmailRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return Email;
  }
};
