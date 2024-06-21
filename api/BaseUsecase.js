const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const logtail = require("../services/logtail");
const UserRepository = require("../repository/UserRepository");
const { Sentry } = require("../services/sentry");
const migrateLinkedInUserData = require("../Utils/migrateLinkedInUserData");

module.exports = class BaseUsecase {
  constructor(request, response) {
    this.request = request;
    this.response = response;
    this.userRepository = new UserRepository();
  }
  async authenticate() {
    let user = null;
    let userByFirebase = null;
    let liUser = null;
    if (process.env.ENV === "local") {
      user = await this.userRepository.findOne(
        {
          uuid: process.env.TEST_USER_UID,
        },
        { userPassword: 0, emailAuth: 0, authTokens: 0 }
      );

      if (user) {
        return {
          authenticate: true,
          firebaseUser: {},
          user: user,
        };
      } else {
        throw new Error("Access Denied");
      }
    }
    const { headers } = this.request;
    const authToken = headers["x-authorization"];
    const webToken = headers["x-webauthorization"];

    try {
      let firebaseUser = {};
      let linkedInUser = {};
      if (authToken) {
        try {
          linkedInUser = jwt.verify(authToken, process.env.JWT_SECRET_TOKEN);
          if (linkedInUser.uid) {
            firebaseUser = linkedInUser;
          }
        } catch (err) {
          try {
            firebaseUser = await admin.auth().verifyIdToken(authToken);
          } catch (err) {
            Sentry.captureException(err);
          }
        }
      }
      if (webToken) {
        try {
          firebaseUser = await admin.auth().verifyIdToken(webToken);
        } catch (err) {}
      }

      if (firebaseUser.uid) {
        userByFirebase = await this.userRepository.findOne(
          { uuid: firebaseUser.uid },
          { userPassword: 0, emailAuth: 0, authTokens: 0 }
        );
      }
      if (linkedInUser.linkedInId) {
        liUser = await this.userRepository.findOne(
          {
            linkedInId: linkedInUser.linkedInId,
          },
          { userPassword: 0, emailAuth: 0, authTokens: 0 }
        );
      }

      if (userByFirebase && !liUser) {
        user = userByFirebase;
      } else if (!userByFirebase && liUser) {
        user = liUser;
      } else if (userByFirebase && liUser) {
        if (userByFirebase._id === liUser._id) {
          user = userByFirebase;
        } else {
          /**
           * Migrate user linkedIn data to existing firebase user
           */
          user = userByFirebase;
          // user = await migrateLinkedInUserData(userByFirebase, liUser);
        }
      }
      if (!user && !firebaseUser?.uid && !linkedInUser?.linkedInId) {
        throw new Error("Access Denied. Please refresh or login again.");
      }
      const validEndPoints = [
        "/v2/project/list",
        "/v2/project/stats",
        "/workflow/template/list",
        "/organization/members",
        "/organization/get-credit",
        "/invitations/pending",
        "/super-admin/userList",
        "/v2/project/get/",
        "/relevancy/",
      ];
      try {
        const restrictUrl = this.request.originalUrl.trim();
        const isEndpointValid = validEndPoints.some((endpoint) =>
          restrictUrl.startsWith(endpoint)
        );
        if (restrictUrl.includes("isSuperAdminView=true") && !isEndpointValid) {
          console.log("this url is invalid", this.request.originalUrl);
          throw new Error(
            "This URL endpoint is not allowed in Super Admin View Mode."
          );
          // return {
          //   code: 400,
          //   message:
          //     "This URL endpoint is not allowed in Super Admin View Mode.",
          // };
        }
      } catch (err) {
        console.log(`error while finding superAdminView`, err);
      }
      return {
        authenticate: true,
        firebaseUser,
        user,
        linkedInUser,
        token: linkedInUser,
      };
    } catch (err) {
      console.log("BaseUsecase err", err);
      throw err;
    }
  }
  async authenticateLiChatExt() {
    try {
      const { headers } = this.request;
      const authToken = headers["x-authorization"];
      if (!authToken) {
        throw new Error("Token expired");
      }
      const token = jwt.verify(authToken, process.env.JWT_SECRET_TOKEN);
      const userList = [
        "pratyush-rai",
        "siddsax",
        "lakshyakumar27",
        "srinjoyghosh",
        "aniketjha646",
        "kalpna-thakur",
        "sourabh-mundhra",
        "the-iter8",
        "punit-bhat",
        "priyanshu05",
      ];
      if (!token?.linkedInId || userList.includes(token.linkedInId)) {
        throw new Error("Invalid token!");
      }
      const user = await this.userRepository.findOne({
        linkedInId: token.linkedInId,
      });
      if (!user) {
        return {
          authenticate: false,
          user: null,
          token,
        };
      }
      return {
        authenticate: true,
        user,
      };
    } catch (err) {
      throw err;
    }
  }
  async authenticateSuperAdmin() {
    const { authenticate, user } = await this.authenticate();
    if (!user?.isSuperAdmin) {
      throw new Error(
        "Permission Restricted: Please contact your account manager to perform this action."
      );
    }
    return { authenticate, user };
  }
  async execute() {}
  async executeUsecase(req, res) {
    let data = null;
    try {
      data = await this.execute();
      if (!data?.code) {
        res.status(200).json(data);
      } else if (data?.redirect) {
        res.redirect(data.link);
      } else {
        res.status(data.code).json(data);
      }
    } catch (err) {
      const { method, url } = req;
      const errorMsg = { message: "Internal Error", error: err.message };
      if (process.env.ENV === "production" && err.message !== "Token expired") {
        Sentry.captureException(err);
      }
      const logMsg = { ...errorMsg, url, method };
      logtail.error(logMsg);
      if (err?.send) return res.status(err.status).send(err.message);
      res.status(500).json(errorMsg);
    }
  }
};
