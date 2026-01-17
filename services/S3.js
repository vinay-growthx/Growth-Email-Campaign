const fs = require("fs");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { Sentry } = require("../services/sentry");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const uploadJD = multer({
  storage: multerS3({
    s3: s3,
    bucket: "growthx-jd",
    // acl: "public-read",
    key: async function (req, file, cb) {
      const path = `JD_${Date.now().toString()}_${file.originalname}`;
      cb(null, path);
    },
  }),
});

const uploadCV = multer({
  storage: multerS3({
    s3: s3,
    bucket: "growthx-jd",
    key: async function (req, file, cb) {
      const path = `CV_${Date.now().toString()}_${file.originalname}`;
      cb(null, path);
    },
  }),
});

async function uploadFileToS3(filePath) {
  const fileStream = fs.createReadStream(filePath);
  let bucketName = "growthx-jd";

  const timestamp = Date.now().toString();
  const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

  const uploadParams = {
    Bucket: bucketName,
    Key: `JD_${timestamp}_${fileName}`,
    Body: fileStream,
  };
  try {
    const data = await s3.upload(uploadParams).promise();
    const fileURL = data.Location;
    return fileURL;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

async function uploadStreamToS3(bufferStream, fileName) {
  let bucketName = "growthx-jd";

  const timestamp = Date.now().toString();
  const bufferData = Buffer.from(bufferStream, "binary");

  const uploadPromise = s3
    .upload({
      Bucket: bucketName,
      Key: `JD_${timestamp}_${fileName}`,
      Body: bufferData,
      ContentType: "application/pdf",
    })
    .promise();

  // Wait for the upload to complete
  return uploadPromise
    .then((data) => {
      console.log("Upload completed:", data);
      return data.Location;
      // Send response here, after upload is completed
    })
    .catch((err) => {
      console.error("Error uploading file:", err);
      // Send error response here, if upload fails
      return "";
    });
}

async function uploadCandidateResumeToS3(
  fileData,
  fileName,
  contentType,
  source
) {
  const bucketName = "growthx-jd";
  const uploadParams = {
    Bucket: bucketName,
    Key: `${source}_${fileName}`,
    Body: fileData,
    ContentType: contentType,
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    const fileURL = data.Location;
    return fileURL;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const uploadCSVToS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: "growthx-jd",
    key: async function (req, file, cb) {
      const { projectId } = req.body;
      const path = `UploadCSV_Project-${projectId}_${Date.now().toString()}_${
        file.originalname
      }`;
      cb(null, path);
    },
  }),
});

async function getFileBufferFromS3(bucket, key) {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
    };
    const data = await s3.getObject(params).promise();
    return data.Body;
  } catch (error) {
    console.error("Error downloading file from S3:", error);
    throw error;
  }
}

async function uploadBase64ToS3(key, base64String) {
  const base64Data = Buffer.from(
    base64String.replace(/^data:application\/pdf;base64,/, ""),
    "base64"
  );

  const params = {
    Bucket: "growthx-jd",
    Key: key,
    Body: base64Data,
    ContentEncoding: "base64",
    ContentType: "application/pdf",
  };

  try {
    const uploadResponse = await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${uploadResponse.Location}`);
    return uploadResponse.Location;
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  uploadJD,
  uploadFileToS3,
  uploadBase64ToS3,
  uploadCandidateResumeToS3,
  uploadCV,
  uploadCSVToS3,
  getFileBufferFromS3,
  uploadStreamToS3,
};
