const LinkedinJob = require("../schema/LinkedinJob");
const BaseRepository = require("./BaseRepository");

module.exports = class LinkedinJobRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return LinkedinJob;
  }
};
