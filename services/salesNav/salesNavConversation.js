const { isArray, isEmpty, has, isString } = require("lodash");
const {
  constructLinkedInURL,
  getCleanedCompanies,
  getCleanedLocations,
  updatePageQueryParam,
} = require("../util");
const { locationArr } = require("../../services/arrValues");
async function generateSalesNavUrl(filters) {
  console.log("FILTERS-----", filters);
  const params = [];
  const keywords = [];

  if (
    has(filters, "title") &&
    isArray(filters.title) &&
    !isEmpty(filters.title)
  ) {
    const values = filters.title.map((item) => ({ text: item }));
    params.push({
      type: "CURRENT_TITLE",
      values,
    });
  }

  //exclusion current title
  if (
    has(filters, "excludedTitle") &&
    isArray(filters.excludedTitle) &&
    !isEmpty(filters.excludedTitle)
  ) {
    const values = filters.excludedTitle.map((item) => ({ text: item }));

    if (values.length) {
      let currentTitleObject = params.find(
        (item) => item.type === "CURRENT_TITLE"
      );

      // Check if the current filter exists else add a new field
      if (currentTitleObject) {
        currentTitleObject.exclusion = values;
      } else {
        params.push({
          type: "CURRENT_TITLE",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "pastTitle") &&
    isArray(filters.pastTitle) &&
    !isEmpty(filters.pastTitle)
  ) {
    const values = filters.pastTitle.map((item) => ({ text: item }));
    params.push({
      type: "PAST_TITLE",
      values,
    });
  }

  //exclusion past title
  if (
    has(filters, "excludedPastTitle") &&
    isArray(filters.excludedPastTitle) &&
    !isEmpty(filters.excludedPastTitle)
  ) {
    const exTitleValues = filters.excludedPastTitle.map((item) => ({
      text: item,
    }));

    if (exTitleValues.length) {
      let currentPastTitleObject = params.find(
        (item) => item.type === "PAST_TITLE"
      );

      // Check if the current filter exists else add a new field
      if (currentPastTitleObject) {
        currentPastTitleObject.exclusion = exTitleValues;
      } else {
        params.push({
          type: "PAST_TITLE",
          exclusion: exTitleValues,
        });
      }
    }
  }
  console.log("filters =====>", filters);
  if (
    has(filters, "currentCompany") &&
    isArray(filters.currentCompany) &&
    !isEmpty(filters.currentCompany)
  ) {
    console.log("current company =====>", filters.currentCompany);
    let values = [];
    if (filters.currentCompany.every((item) => isString(item))) {
      values = await getCleanedCompanies(filters.currentCompany);
    } else {
      values = filters.currentCompany;
    }
    if (values.length) {
      params.push({
        type: "CURRENT_COMPANY",
        values,
      });
    }
  }

  //exclusion current company
  if (
    has(filters, "excludedCurrentCompany") &&
    isArray(filters.excludedCurrentCompany) &&
    !isEmpty(filters.excludedCurrentCompany)
  ) {
    let values = [];
    if (filters.excludedCurrentCompany.every((item) => isString(item))) {
      values = await getCleanedCompanies(filters.excludedCurrentCompany);
    } else {
      values = filters.excludedCurrentCompany;
    }
    if (values.length) {
      let currentCompanyObject = params.find(
        (item) => item.type === "CURRENT_COMPANY"
      );

      // Check if the object exists and then add a new field
      if (currentCompanyObject) {
        currentCompanyObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "CURRENT_COMPANY",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "pastCompany") &&
    isArray(filters.pastCompany) &&
    !isEmpty(filters.pastCompany)
  ) {
    let values = [];
    if (filters.pastCompany.every((item) => isString(item))) {
      values = await getCleanedCompanies(filters.pastCompany);
    } else {
      values = filters.pastCompany;
    }
    if (values.length) {
      params.push({
        type: "PAST_COMPANY",
        values,
      });
    }

    //exclusion past company
    if (
      has(filters, "excludedPastCompany") &&
      isArray(filters.excludedPastCompany) &&
      !isEmpty(filters.excludedPastCompany)
    ) {
      let exCompanyvalues = [];
      if (filters.excludedPastCompany.every((item) => isString(item))) {
        exCompanyvalues = await getCleanedCompanies(
          filters.excludedPastCompany
        );
      } else {
        exCompanyvalues = filters.excludedPastCompany;
      }
      if (exCompanyvalues.length) {
        let currentCompanyObject = params.find(
          (item) => item.type === "PAST_COMPANY"
        );

        // Check if the object exists and then add a new field
        if (currentCompanyObject) {
          currentCompanyObject.exclusion = exCompanyvalues; // Add new field
        } else {
          params.push({
            type: "PAST_COMPANY",
            exclusion: exCompanyvalues,
          });
        }
      }
    }
  }

  if (
    has(filters, "experience") &&
    isArray(filters.experience) &&
    !isEmpty(filters.experience)
  ) {
    const values = filters.experience.map((item) => {
      const { id, text } = getSalesNavExperience(item);
      return {
        id,
        text,
      };
    });
    params.push({
      type: "YEARS_OF_EXPERIENCE",
      values,
    });
  }
  filters.location = [findMatchingObject(locationArr, filters.location?.[0])];
  console.log("filter location ===>", filters.location);
  if (
    has(filters, "location") &&
    isArray(filters.location) &&
    !isEmpty(filters.location)
  ) {
    let locationIdList = [];
    if (filters.location.every((item) => isString(item))) {
      locationIdList = filters.location;
    } else {
      locationIdList = filters.location;
    }
    const values = locationIdList.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      params.push({
        type: "REGION",
        values,
      });
    }
  }

  if (
    has(filters, "companyHeadQuarterLocation") &&
    isArray(filters.companyHeadQuarterLocation) &&
    !isEmpty(filters.companyHeadQuarterLocation)
  ) {
    let locationIdList = [];
    if (filters.companyHeadQuarterLocation.every((item) => isString(item))) {
      locationIdList = await getCleanedLocations(
        filters.companyHeadQuarterLocation
      );
    } else {
      locationIdList = filters.companyHeadQuarterLocation;
    }
    const values = locationIdList.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      params.push({
        type: "COMPANY_HEADQUARTERS",
        values,
      });
    }
  }

  //exclusion location
  if (
    has(filters, "excludedLocation") &&
    isArray(filters.excludedLocation) &&
    !isEmpty(filters.excludedLocation)
  ) {
    let locationIdList = [];
    if (filters.excludedLocation.every((item) => isString(item))) {
      locationIdList = await getCleanedLocations(filters.excludedLocation);
    } else {
      locationIdList = filters.excludedLocation;
    }

    const values = locationIdList.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let currentRegionObject = params.find((item) => item.type === "REGION");

      // Check if the object exists and then add a new field
      if (currentRegionObject) {
        currentRegionObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "REGION",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "excludedCompanyHeadQuarterLocation") &&
    isArray(filters.excludedCompanyHeadQuarterLocation) &&
    !isEmpty(filters.excludedCompanyHeadQuarterLocation)
  ) {
    let locationIdList = [];
    if (
      filters.excludedCompanyHeadQuarterLocation.every((item) => isString(item))
    ) {
      locationIdList = await getCleanedLocations(
        filters.excludedCompanyHeadQuarterLocation
      );
    } else {
      locationIdList = filters.excludedCompanyHeadQuarterLocation;
    }

    const values = locationIdList.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let currentRegionObject = params.find(
        (item) => item.type === "COMPANY_HEADQUARTERS"
      );

      // Check if the object exists and then add a new field
      if (currentRegionObject) {
        currentRegionObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "COMPANY_HEADQUARTERS",
          exclusion: values,
        });
      }
    }
  }

  //postal code
  if (
    has(filters, "postalCode") &&
    isArray(filters.postalCode) &&
    !isEmpty(filters.postalCode)
  ) {
    let values = filters.postalCode.map((item) => ({ text: item }));
    console.log("postal codes : ", filters.postalCode);
    console.log("postal codes values : ", values);
    if (values.length) {
      params.push({
        type: "POSTAL_CODE",
        values,
      });
    }
  }

  // console.log("postal codes in params : ", params);
  if (
    has(filters, "industry") &&
    isArray(filters.industry) &&
    !isEmpty(filters.industry)
  ) {
    const values = filters.industry.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "INDUSTRY",
      values,
    });
  }

  //exclusion industry
  if (
    has(filters, "excludedIndustry") &&
    isArray(filters.excludedIndustry) &&
    !isEmpty(filters.excludedIndustry)
  ) {
    const values = filters.excludedIndustry.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let currentIndustryObject = params.find(
        (item) => item.type === "INDUSTRY"
      );

      // Check if the object exists and then add a new field
      if (currentIndustryObject) {
        currentIndustryObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "INDUSTRY",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "roleFunction") &&
    isArray(filters.roleFunction) &&
    !isEmpty(filters.roleFunction)
  ) {
    const values = filters.roleFunction.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "FUNCTION",
      values,
    });
  }

  //exclusion role function
  if (
    has(filters, "excludedRoleFunction") &&
    isArray(filters.excludedRoleFunction) &&
    !isEmpty(filters.excludedRoleFunction)
  ) {
    const values = filters.excludedRoleFunction.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let currentRoleFunctionObject = params.find(
        (item) => item.type === "FUNCTION"
      );

      // Check if the object exists and then add a new field
      if (currentRoleFunctionObject) {
        currentRoleFunctionObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "FUNCTION",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "seniority") &&
    isArray(filters.seniority) &&
    !isEmpty(filters.seniority)
  ) {
    const values = filters.seniority.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "SENIORITY_LEVEL",
      values,
    });
  }

  // Added new
  if (
    has(filters, "currentCompanyHeadCount") &&
    isArray(filters.currentCompanyHeadCount) &&
    !isEmpty(filters.currentCompanyHeadCount)
  ) {
    const values = filters.currentCompanyHeadCount.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "COMPANY_HEADCOUNT",
      values,
    });
  }

  // Other new filters
  if (
    has(filters, "companyType") &&
    isArray(filters.companyType) &&
    !isEmpty(filters.companyType)
  ) {
    const values = filters.companyType.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "COMPANY_TYPE",
      values,
    });
  }

  if (
    has(filters, "seniorityLevel") &&
    isArray(filters.seniorityLevel) &&
    !isEmpty(filters.seniorityLevel)
  ) {
    const values = filters.seniorityLevel.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "SENIORITY_LEVEL",
      values,
    });
  }

  if (
    has(filters, "excludedSeniorityLevel") &&
    isArray(filters.excludedSeniorityLevel) &&
    !isEmpty(filters.excludedSeniorityLevel)
  ) {
    const values = filters.excludedSeniorityLevel.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let seniorityLevelObject = params.find(
        (item) => item.type === "SENIORITY_LEVEL"
      );

      // Check if the object exists and then add a new field
      if (seniorityLevelObject) {
        seniorityLevelObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "SENIORITY_LEVEL",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "profileLanguage") &&
    isArray(filters.profileLanguage) &&
    !isEmpty(filters.profileLanguage)
  ) {
    const values = filters.profileLanguage.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "PROFILE_LANGUAGE",
      values,
    });
  }

  if (
    has(filters, "currentCompanyExperience") &&
    isArray(filters.currentCompanyExperience) &&
    !isEmpty(filters.currentCompanyExperience)
  ) {
    const values = filters.currentCompanyExperience.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "YEARS_AT_CURRENT_COMPANY",
      values,
    });
  }

  if (
    has(filters, "currentPositionExperience") &&
    isArray(filters.currentPositionExperience) &&
    !isEmpty(filters.currentPositionExperience)
  ) {
    const values = filters.currentPositionExperience.map(
      ({ label, value }) => ({
        id: value,
        text: label,
      })
    );
    params.push({
      type: "YEARS_IN_CURRENT_POSITION",
      values,
    });
  }

  if (
    has(filters, "school") &&
    isArray(filters.school) &&
    !isEmpty(filters.school)
  ) {
    const values = filters.school.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    params.push({
      type: "SCHOOL", //??
      values,
    });
  }

  if (
    has(filters, "excludedSchool") &&
    isArray(filters.excludedSchool) &&
    !isEmpty(filters.excludedSchool)
  ) {
    const values = filters.excludedSchool.map(({ label, value }) => ({
      id: value,
      text: label,
    }));
    if (values.length) {
      let schoolObject = params.find((item) => item.type === "SCHOOL");

      // Check if the object exists and then add a new field
      if (schoolObject) {
        schoolObject.exclusion = values; // Add new field
      } else {
        params.push({
          type: "SCHOOL",
          exclusion: values,
        });
      }
    }
  }

  if (
    has(filters, "skills") &&
    isArray(filters.skills) &&
    filters.skills.filter(Boolean).length &&
    !isEmpty(filters.skills)
  ) {
    keywords.push(...filters.skills);
  }

  console.log("PARAMS ---> ", params);

  const searchUrl = constructLinkedInURL(params, keywords);
  const outputUrl = updatePageQueryParam(searchUrl, 1);
  return outputUrl;
}
function findMatchingObject(objects, searchString) {
  // Normalize the search string: lowercase and remove spaces
  const normalizedSearch = searchString.toLowerCase().replace(/\s/g, "");

  // Iterate over the array of objects
  for (const obj of objects) {
    if (
      obj.label &&
      obj.label.toLowerCase().replace(/\s/g, "") === normalizedSearch
    ) {
      return obj;
    }
  }

  // Return null if no match is found
  return null;
}

module.exports = { generateSalesNavUrl };
