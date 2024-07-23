const ApiCall = require("../schema/ApiCall");
const BaseRepository = require("./BaseRepository");

module.exports = class ApiCallRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return ApiCall;
  }
};
