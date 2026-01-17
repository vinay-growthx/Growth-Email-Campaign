const mongoose = require("mongoose");
const { autoIncrement } = require("mongoose-plugin-autoinc");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    orgId: {
      type: Number,
      ref: "Organization",
    },
    emailVerified: {
      type: Boolean,
    },
    uuid: {
      type: String,
      index: true,
    },
    userPassword: {
      type: String,
    },
    countryCode: {
      type: String,
      default: "",
    },
    phoneNumber: {
      type: String,
      default: "",
    },
    emailSource: {
      type: String,
      enum: ["Gmail", "Outlook"],
    },
    emailAuthorized: {
      type: Boolean,
      default: false,
    },
    isLoggedOut: {
      type: Boolean,
      default: false,
    },
    emailAuth: {
      type: String,
      default: "",
    },
    authorizedEmailAddress: {
      type: String,
      default: "",
    },
    authTokens: {
      access_token: {
        type: String,
      },
      refresh_token: {
        type: String,
      },
      scope: {
        type: String,
      },
      token_type: {
        type: String,
      },
      expiry_date: {
        type: Number,
      },
    },
    scrapRequest: [
      {
        createdAt: { type: String },
        count: { type: Number, default: 0 },
        publicCount: { type: Number, default: 0 },
        privateCount: { type: Number, default: 0 },
      },
    ],
    scrapTime: [
      {
        scrapId: { type: String },
        timeToScrap: { type: String },
      },
    ],
    liCookie: {
      type: String,
    },
    bCookie: {
      type: String,
    },
    bsCookie: {
      type: String,
    },
    isLiCookieExpired: {
      type: Boolean,
      default: false,
    },
    liProfile: {
      type: String,
    },
    companyName: {
      type: String,
    },
    companyLink: {
      type: String,
    },
    companyVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordCode: {
      type: Number,
    },
    referralCode: {
      type: String,
      unique: true,
      index: true,
    },
    newProfileFieldstats: {
      marketing: { type: Number },
      sales: { type: Number },
      others: { type: Number },
      extractProfile: { type: Number },
      startSearch: { type: Number },
    },
    canHideWalkThrough: {
      type: Boolean,
      default: false,
    },
    installExtension: {
      type: Boolean,
      default: false,
    },
    showEmail: {
      type: Boolean,
      default: false,
    },
    addToWorkflow: {
      type: Boolean,
      default: false,
    },
    firstEmailNA: {
      type: String,
      default: "Initial",
    },
    lastLogin: {
      type: Number,
      default: new Date().getTime(),
    },
    slackAuth: {
      id: { type: String },
      scope: { type: String },
      access_token: { type: String },
      token_type: { type: String },
      app_id: { type: String },
      bot_user_id: { type: String },
      team: {
        id: { type: String },
        name: { type: String },
      },
      enterprise: { type: String, default: null },
      is_enterprise_install: { type: Boolean, default: false },
    },
    slackAuthorized: {
      type: Boolean,
      default: false,
    },
    requiredJobs: {
      type: [String],
    },
    userLiProfile: {
      name: {
        type: String,
        default: "-",
      },
      status: {
        type: String,
        default: "-",
      },
      profileUrl: {
        type: String,
        index: true,
        default: "-",
      },
      sourceId: {
        type: String,
        default: "-",
      },
      title: {
        type: String,
        default: "-",
      },
      profileImage: {
        type: String,
        default: "-",
      },
      description: {
        type: String,
        default: "-",
      },
      education: [
        {
          institute: {
            type: String,
          },
          course: {
            type: String,
          },
          description: {
            type: String,
          },
          duration: {
            type: String,
          },
        },
      ],
      experience: [
        {
          position: {
            type: String,
          },
          org: {
            type: String,
          },
          orgUrl: {
            type: String,
          },
          location: {
            type: String,
          },
          duration: {
            type: String,
          },
          description: {
            type: String,
          },
          engagementType: {
            type: String,
          },
          totalMonths: {
            type: Number, // calculated
          },
        },
      ],
      certifications: [
        {
          course: {
            type: String,
          },
          issuedBy: {
            type: String,
          },
          duration: {
            type: String,
          },
          credentials: {
            // url
            type: String,
          },
        },
      ],
      skills: [
        {
          name: {
            type: String,
          },
          endorsements: {
            type: Number,
          },
        },
      ],
      accountType: {
        type: String,
        enum: ["NORMAL", "RECRUITER", "PREMIUM", "SALESNAV"],
        default: "PREMIUM",
      },
    },
    /**
     * linkedIn Chat Ext Attributes
     */
    linkedInId: {
      type: String,
      index: true,
    },
    linkedInEmail: {
      type: String,
    },
    greenHouse: {
      apiKey: {
        type: String,
      },
      harvestApiKey: {
        type: String,
      },
      serviceUser: {
        type: String,
      },
    },
    workflowStats: {
      inMail: { type: Number, default: 0 },
      connReq: { type: Number, default: 0 },
    },
    leverRefreshToken: {
      type: String,
    },
    zohoRefreshToken: {
      type: String,
    },
    jobVites: {
      apiKey: {
        type: String,
      },
      apiSecret: {
        type: String,
      },
    },
    sesIntegrated: {
      type: Boolean,
      default: false,
    },
    clientSES: {
      type: Boolean,
    },
    sesVerifiedEmail: {
      type: String,
    },
    lastAuthUpdated: {
      type: Date,
    },
    region: {
      type: String,
      default: "us-east-1",
    },
    liId: {
      type: String,
    },
    liPass: {
      type: String,
    },
    liOtp: {
      type: String,
    },
    calendlyAuthTokens: {
      type: Object,
    },
    calendlyAuthorized: {
      type: Boolean,
      default: false,
    },
    calendlyUserData: {
      type: Object,
    },
    atsIntegrations: {
      zoho: { type: Object },
      lever: { type: Object },
      greenhouse: { type: Object },
      bambooHR: { type: Object },
    },
    vmId: {
      type: String,
    },
    roleType: {
      type: String,
      enum: ["ADMIN", "MEMBER"],
      // default: "ADMIN",
    },
    accessProjects: [{ type: Number, ref: "Project" }],
    defaultOrgs: [{ type: Number, ref: "Organization" }],
    smsAuth: {
      phoneNumber: {
        type: String,
      },
      campaignSid: {
        type: String,
      },
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    tracking: {
      email: { type: Boolean, default: false },
      linkedin: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      calendly: { type: Boolean, default: false },
      weeklyOutreach: { type: Boolean, default: false },
    },
    lastEmailAuthorizedAt: {
      type: Date,
    },
    bambooHR: {
      apiKey: { type: String },
      companyDomain: { type: String },
    },
    jazzHR: {
      username: { type: String },
      password: { type: String },
      projectXMLUrl: { type: String },
    },
    signature: {
      type: String,
    },
    indeedCredentials: {
      email: { type: String },
      password: { type: String },
      otp: { type: String },
    },
    salesNavPoolIds: { type: [Number] },
    features: {
      smsEnabled: { type: Boolean },
      analytics: { type: String, enum: ["v1", "v2"], default: "v2" },
      blendedSearch: { type: String, enum: ["v1"], default: "v1" },
      inbox: { type: String, enum: ["v1"], default: "v1" },
      followUpInMail: { type: Boolean, default: false },
      zeroBounce: { type: Boolean, default: true },
      emailExtraction: { type: Boolean, default: true },
      recruiterInMail: { type: Boolean },
    },
    aiControls: {
      claude3: { type: Boolean },
      llama3: { type: Boolean },
      gemini: { type: Boolean },
      perplexity: { type: Boolean },
    },
    zohoRecruitCreds: {
      accountUrl: { type: String },
      access_token: { type: String },
      refresh_token: { type: String },
      api_domain: { type: String },
      scope: { type: String },
      token_type: { type: String },
      expires_in: { type: Number },
      baseUrl: { type: String },
      location: { type: String },
    },
    emailSendType: {
      type: String,
      enum: [
        "ONLY_PERSONAL",
        "ONLY_PROFESSIONAL",
        "PERSONAL_PREFERRED",
        "PROFESSIONAL_PREFERRED",
      ],
      default: "PERSONAL_PREFERRED",
    },
    showAllProjects: {
      type: Boolean,
      default: true,
    },
    growthxId: {
      type: String,
    },
  },

  { timestamps: true }
);

const user = mongoose.model("User", UserSchema);
module.exports = user;
