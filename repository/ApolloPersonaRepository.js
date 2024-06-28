const ApolloPersona = require("../schema/ApolloPersona");
const BaseRepository = require("./BaseRepository");

module.exports = class ApolloPersonaRepository extends BaseRepository {
  constructor() {
    super();
  }
  model() {
    return ApolloPersona;
  }
};
