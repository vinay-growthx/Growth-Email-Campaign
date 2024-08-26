const Jobs = require("../schema/LiJob");
const BaseRepository = require("./BaseRepository");

module.exports = class JobsRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return Jobs;
  }
};
