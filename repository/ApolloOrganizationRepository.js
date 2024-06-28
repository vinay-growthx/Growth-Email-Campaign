const ApolloOrganization = require("../schema/ApolloOrganization");
const BaseRepository = require("./BaseRepository");

module.exports = class ApolloOrganizationRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return ApolloOrganization;
  }
};
