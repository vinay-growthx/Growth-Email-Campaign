const Credits = require("../schema/Credit");
const BaseRepository = require("./BaseRepository");

module.exports = class CreditsRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return Credits;
  }
};
