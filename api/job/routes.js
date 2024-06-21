"use strict";
const express = require("express");
const jobListing = require("./jobListing");

const inboxRouter = function () {
  const router = express.Router();
  router.route("/job-listings").post(async function (req, res) {
    const response = jobListing.create(req, res);
    await response.executeUsecase(req, res);
  });
  return router;
};

module.exports = inboxRouter;
