const { Sentry } = require("../services/sentry");

module.exports = class BaseRepository {
  constructor() {}
  async add(info) {
    const model = this.model();
    return new model(info);
  }

  async create(info) {
    const model = this.model();
    const document = new model(info);
    return await document.save();
  }

  async findOne(predicate = null, projection = null, populateBy = null) {
    const model = this.model();
    if (populateBy) {
      if (projection) {
        return await model
          .findOne(predicate, projection)
          .populate(populateBy)
          .lean();
      } else {
        return await model.findOne(predicate).populate(populateBy).lean();
      }
    } else {
      if (projection) {
        return await model.findOne(predicate, projection).lean();
      } else {
        return await model.findOne(predicate).lean();
      }
    }
  }

  async find(
    predicate = null,
    projection = null,
    populateBy = null,
    sortQuery = null,
    limit = null
  ) {
    const model = this.model();
    let query = model.find(predicate);
    if (projection) {
      query = query.select(projection);
    }
    if (sortQuery) {
      query = query.sort(sortQuery);
    }
    if (populateBy) {
      query = query.populate(populateBy);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return await query.lean();
  }
  async update(predicate, info, options = null) {
    const model = this.model();
    return await model.updateOne(predicate, info, options);
  }
  async updateOne(predicate, info, options = null) {
    const model = this.model();
    return await model.updateOne(predicate, info, options);
  }
  async updateMany(predicate, info, options = null) {
    const model = this.model();
    return await model.updateMany(predicate, info, options);
  }
  async deleteOne(predicate) {
    const model = this.model();
    return await model.deleteOne(predicate);
  }
  async deleteMany(predicate) {
    const model = this.model();
    return await model.deleteMany(predicate);
  }
  async insertMany(data) {
    const model = this.model();
    return await model.insertMany(data);
  }
  async insert(data) {
    const model = this.model();
    console.log(model, "model");
    return await model.insert(data);
  }
  async findOneAndUpdate(predicate = null, update = null, options = {}) {
    const model = this.model();
    return await model.findOneAndUpdate(predicate, update, {
      new: true,
      lean: true,
      ...options,
    });
  }

  async aggregate(data) {
    const model = this.model();
    return await model.aggregate(data).allowDiskUse(true);
  }
  async paginate(
    predicate = null,
    projection = null,
    populateBy = null,
    sortQuery = {},
    page = 0,
    resultsPerPage = 10
  ) {
    const model = this.model();
    return await model
      .find(predicate, projection)
      .sort(sortQuery)
      .populate(populateBy)
      .limit(resultsPerPage)
      .skip(resultsPerPage * page)
      .lean();
  }
  async createTextIndex(fieldName) {
    const model = this.model();
    const index = {};
    index[fieldName] = "text";
    try {
      await model.createIndexes(index);
      console.log(`Text index created on field: ${fieldName}`);
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Error creating index on field: ${fieldName} - ${err}`);
    }
  }
  async createIndex(indexFields, options = {}) {
    const model = this.model();
    //{ field1: 'text', field2: 'text' }
    return await model.createIndex(indexFields, options);
  }
  async multiSearch(queries, fields, projection = null) {
    const model = this.model();
    const conditions = fields
      .map((field) =>
        queries.map((query) => ({
          [field]: { $regex: `^${query}$`, $options: "i" },
        }))
      )
      .flat();

    if (projection) {
      return await model.find({ $or: conditions }, projection).lean();
    } else {
      return await model.find({ $or: conditions }).lean();
    }
  }
  async multiSearchBasedOnField(queryObj, projection = null) {
    const model = this.model();
    const conditions = Object.entries(queryObj).map(([field, query]) => ({
      [field]: { $regex: `\\b${query}\\b`, $options: "i" },
    }));

    if (projection) {
      return await model.find({ $or: conditions }, projection).lean();
    } else {
      return await model.find({ $or: conditions }).lean();
    }
  }

  async partialSearch(query, field, projection = null) {
    const model = this.model();
    const condition = { [field]: { $regex: query, $options: "i" } };

    if (projection) {
      return await model.find(condition, projection).lean();
    } else {
      return await model.find(condition).lean();
    }
  }
  async fuzzySearch(query, projection = null) {
    const model = this.model();

    if (projection) {
      return await model.find({ $text: { $search: query } }, projection).lean();
    } else {
      return await model.find({ $text: { $search: query } }).lean();
    }
  }
  async searchWithHighlighting(query, field) {
    const model = this.model();
    const pipeline = [
      {
        $search: {
          text: {
            query: query,
            path: field,
            score: {
              boost: {
                value: 5.0,
                multiplier: 10,
              },
            },
          },
        },
      },
      {
        $project: {
          score: {
            $meta: "searchScore",
          },
          highlight: {
            $meta: "searchHighlights",
          },
        },
      },
    ];

    return await model.aggregate(pipeline);
  }
  async facetSearch(criteria, facetFields) {
    const model = this.model();
    const facets = facetFields.reduce(
      (acc, field) => ({
        ...acc,
        [field]: [
          { $match: criteria },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      }),
      {}
    );

    const pipeline = [{ $match: criteria }, { $facet: facets }];

    return await model.aggregate(pipeline);
  }
  async autoComplete(query, field) {
    const model = this.model();
    const pipeline = [
      {
        $search: {
          autocomplete: {
            query: query,
            path: field,
            fuzzy: {
              maxEdits: 2,
              prefixLength: 3,
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          [field]: 1,
          score: { $meta: "searchScore" },
        },
      },
    ];

    return await model.aggregate(pipeline);
  }
  async searchWithCustomScoring(query, field, boostValue) {
    const model = this.model();
    const pipeline = [
      {
        $search: {
          text: {
            query: query,
            path: field,
            score: {
              boost: {
                value: boostValue,
              },
            },
          },
        },
      },
      {
        $project: {
          score: {
            $meta: "searchScore",
          },
        },
      },
    ];

    return await model.aggregate(pipeline);
  }
  async createTextIndex(field) {
    const model = this.model();
    const index = {};
    index[field] = "text";
    await model.createIndex(index);
  }
  async searchWithSynonyms(term) {
    const model = this.model();
    const searchPhrase = `"${term}"`;
    const results = await model
      .find({ $text: { $search: searchPhrase } })
      .lean();
    return results;
  }
  async bulkWrite(operations, options = {}) {
    const model = this.model();

    try {
      return await model.bulkWrite(operations, options);
    } catch (error) {
      console.error("Error in bulkWrite operation:", error);
      throw error;
    }
  }

  async count(predicate = null) {
    const model = this.model();
    return await model.countDocuments(predicate);
  }
};
