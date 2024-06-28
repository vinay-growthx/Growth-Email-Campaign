const BaseUsecase = require("../BaseUsecase");
const { Sentry } = require("../../services/sentry");
const Joi = require("joi");

module.exports = class jobListing extends BaseUsecase {
  constructor(request, response) {
    super(request, response);
    this.request = request;
  }

  validate(body) {
    const apiBody = Joi.object({});
    const { error, value } = apiBody.validate(body, { allowUnknown: false });
    if (error) {
      console.log(error);
    } else {
      return value;
    }
  }

  async execute() {
    try {
      const { user } = await this.authenticate();
      const { body } = this.request;
      this.validate(body);

      return {
        success: true,
        message: `All Jobs fetched successfully!!!`,
      };
    } catch (err) {
      Sentry.captureException(err);
      console.log("Error in jobListing", err);
      return {
        success: false,
        message: `Error While fetching jobs`,
      };
    }
  }
  static create(request, response) {
    const usecase = new jobListing(request, response);
    return usecase;
  }
};
