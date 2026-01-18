const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

function convertCommaSeparatedStringToArray(inputString) {
  if (typeof inputString !== "string") {
    throw new Error("Input must be a string.");
  }

  return inputString.split(",").map((item) => item.trim());
}
// async function searchLinkedInJobsMultipleTitles(
//   jobTitles,
//   location,
//   maxPages,
//   maxRetries = 4,
//   retryDelay = 10000
// ) {
//   const allJobs = [];
//   jobTitles = convertCommaSeparatedStringToArray(jobTitles);
//   async function makeRequestWithRetry(options, retries = 0) {
//     try {
//       const response = await axios.request(options);
//       return response.data;
//     } catch (error) {
//       console.error(`Attempt ${retries + 1} failed:`, error.message);
//       console.error(
//         "Response:",
//         error.response ? error.response.data : "No response data"
//       );

//       if (retries < maxRetries) {
//         console.log(`Retrying in ${retryDelay}ms...`);
//         await new Promise((resolve) => setTimeout(resolve, retryDelay));
//         return makeRequestWithRetry(options, retries + 1);
//       } else {
//         throw error;
//       }
//     }
//   }

//   for (let title of jobTitles) {
//     console.log({ title, location, maxPages });
//     for (let page = 1; page <= maxPages; page++) {
//       const options = {
//         method: "POST",
//         url: "https://linkedin-jobs-search.p.rapidapi.com/",
//         headers: {
//           "x-rapidapi-key": process.env.LI_PROFILE_FETCH_API,
//           "x-rapidapi-host": "linkedin-jobs-search.p.rapidapi.com",
//           "Content-Type": "application/json",
//         },
//         data: {
//           search_terms: title,
//           location: location,
//           page: page.toString(),
//         },
//       };

//       try {
//         await new Promise((resolve) => setTimeout(resolve, 500)); // Throttle requests
//         const rawData = await makeRequestWithRetry(options);

//         if (rawData && rawData.length > 0) {
//           allJobs.push({
//             title: title,
//             page: page,
//             data: rawData,
//           });
//         } else {
//           console.log(`No more data for ${title}, moving to next title.`);
//           break; // Exit loop if no more data is available
//         }
//       } catch (error) {
//         console.error(
//           `Failed to retrieve data for ${title} on page ${page} after ${maxRetries} attempts:`,
//           error.message
//         );
//         break; // Break on error to avoid infinite loops or excessive failed requests
//       }
//     }
//   }

//   console.log(`Job function search completed. All results obtained.`);
//   return allJobs; // Returns the array containing all job data
// }

async function searchLinkedInJobsMultipleTitles(
  searchTerms,
  location,
  startPage,
  endPage
) {
  let jobTitles;

  if (Array.isArray(searchTerms)) {
    jobTitles = searchTerms;
  } else {
    jobTitles = convertCommaSeparatedStringToArray(searchTerms);
  }
  const url = "https://linkedin-jobs-search.p.rapidapi.com/";
  const headers = {
    "Content-Type": "application/json",
    "x-rapidapi-host": "linkedin-jobs-search.p.rapidapi.com",
    "x-rapidapi-key": "78e9712909msh45ca8af7f16d6d3p1ddce9jsn8ce4aba04aac",
  };

  let results = [];

  for (let title of jobTitles) {
    console.log("title ===>", title);
    console.log("location ====>", location);
    for (let page = startPage; page <= endPage; page++) {
      console.log("page ===>", page);
      const data = {
        search_terms: title,
        location: location,
        page: page,
      };

      const maxRetries = 5;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          const response = await axios.post(url, data, { headers });
          results.push(...response.data);
          break; // Break out of retry loop on success
        } catch (error) {
          attempt++;
          console.error(
            `Attempt ${attempt} for ${title}, Page ${page}: Failed to search jobs`,
            error
          );
          if (attempt >= maxRetries) {
            console.error(
              `Max retries reached for ${title}, Page ${page}. Giving up on this page.`
            );
            break; // Stop retrying for this page
          }
          await delay(10000); // 10 seconds delay between retries
        }
      }
    }
  }
  results = results.map((job) => ({
    ...job,
    job_title: job.job_title,
    employer_name: job.normalized_company_name,
    employer_website: job.company_url,
    job_posted_at_datetime_utc: job.posted_date,
    job_country: job.job_location,
    job_id: uuidv4(),
  }));
  return results;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
module.exports = { searchLinkedInJobsMultipleTitles };
