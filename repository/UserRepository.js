const UserModel = require("../schema/User");
const BaseRepository = require("./BaseRepository");

module.exports = class UserRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return UserModel;
  }
  async isExistingUser({ email }) {
    const model = this.model();
    const data = await model.findOne({ email }).lean();
    return {
      status: data ? true : false,
      data,
    };
  }
};
