const RequestId = require("../schema/RequestId");
const BaseRepository = require("./BaseRepository");

module.exports = class RequestIdRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return RequestId;
  }
};
