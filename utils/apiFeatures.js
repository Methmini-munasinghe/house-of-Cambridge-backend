const ALLOWED_SORT_MAP = {
  price_asc: 'price',
  price_desc: '-price',
  rating: '-ratings',
  newest: '-createdAt',
};

export default class ApiFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

search() {
  if (this.queryStr.keyword) {
    const escaped = this.queryStr.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    this.query = this.query.find({
      $or: [
        { name: regex },
        { description: regex },
        { brand: regex },
      ],
    });
  }
  return this;
}

  filter() {
    if (this.queryStr.category) {
      this.query = this.query.find({ category: this.queryStr.category });
    }
    if (this.queryStr.brand) {
      this.query = this.query.find({ brand: this.queryStr.brand });
    }
    if (this.queryStr.minPrice || this.queryStr.maxPrice) {
      const priceFilter = {};
      if (this.queryStr.minPrice) priceFilter.$gte = Number(this.queryStr.minPrice);
      if (this.queryStr.maxPrice) priceFilter.$lte = Number(this.queryStr.maxPrice);
      this.query = this.query.find({ price: priceFilter });
    }
    if (this.queryStr.rating) {
      this.query = this.query.find({ ratings: { $gte: Number(this.queryStr.rating) } });
    }
    if (this.queryStr.preowned === 'true') {
      this.query = this.query.find({ isPreOwned: true });
    }
    if (this.queryStr.newArrival === 'true') {
      this.query = this.query.find({ isNewArrival: true });
    }
    return this;
  }

  sort() {
    const sortBy = ALLOWED_SORT_MAP[this.queryStr.sort] ?? '-createdAt';
    this.query = this.query.sort(sortBy);
    return this;
  }

  paginate(resPerPage) {
    const currentPage = Math.max(1, Number(this.queryStr.page) || 1);
    const skip = resPerPage * (currentPage - 1);
    this.query = this.query.limit(resPerPage).skip(skip);
    return this;
  }
}