import Brand from '../model/Brand.js';
import Category from '../model/Category.js';
import { uploadBuffer, deleteResource } from '../utils/cloudinaryHelper.js';
import ErrorResponse from '../utils/errorResponse.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const SAFE_NAME_RE = /^[a-zA-Z0-9 _\-'&.]{1,100}$/;

const generateSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const sanitiseString = (value, maxLen = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLen) : undefined;

const parseBoolean = (value) =>
  value === 'true' || value === true;

export const getBrands = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.category) {
      const rawCat = sanitiseString(req.query.category, 100);
      if (OBJECT_ID_RE.test(rawCat)) {
        filter.category = rawCat;
      } else {
        const cat = await Category.findOne({ slug: rawCat }).select('_id').lean();
        if (cat) filter.category = cat._id;
      }
    }

    if (req.query.active === 'true') filter.isActive = true;

    const brands = await Brand.find(filter)
      .populate('category', 'name slug')
      .sort({ order: 1, name: 1 })
      .lean();

    return res.json({ success: true, count: brands.length, brands });
  } catch (err) {
    return next(err);
  }
};

export const getBrand = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) {
      return next(new ErrorResponse('Invalid brand ID', 400));
    }

    const brand = await Brand.findById(req.params.id)
      .populate('category', 'name slug')
      .lean();

    if (!brand) return next(new ErrorResponse('Brand not found', 404));

    return res.json({ success: true, brand });
  } catch (err) {
    return next(err);
  }
};

export const createBrand = async (req, res, next) => {
  try {
    const name        = sanitiseString(req.body.name, 100);
    const description = sanitiseString(req.body.description);
    const category    = sanitiseString(req.body.category, 24);
    const isActive    = parseBoolean(req.body.isActive);
    const order       = Number.isFinite(Number(req.body.order)) ? Number(req.body.order) : 0;

    if (!name || !SAFE_NAME_RE.test(name)) {
      return next(new ErrorResponse('A valid name is required (max 100 chars)', 400));
    }

    if (!category || !OBJECT_ID_RE.test(category)) {
      return next(new ErrorResponse('A valid category ID is required', 400));
    }

    const cat = await Category.findById(category).select('_id').lean();
    if (!cat) return next(new ErrorResponse('Category not found', 404));

    const baseSlug  = generateSlug(name);
    const collision = await Brand.findOne({ slug: baseSlug }).select('_id').lean();
    const slug      = collision ? `${baseSlug}-${Date.now()}` : baseSlug;

    let logo = { public_id: '', url: '' };
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, 'brands');
      if (!uploaded?.public_id || !uploaded?.secure_url) {
        return next(new ErrorResponse('Logo upload failed', 502));
      }
      logo = { public_id: uploaded.public_id, url: uploaded.secure_url };
    }

    const brand = await Brand.create({ name, slug, description, category, logo, isActive, order });
    await brand.populate('category', 'name slug');

    return res.status(201).json({ success: true, brand });
  } catch (err) {
    return next(err);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) {
      return next(new ErrorResponse('Invalid brand ID', 400));
    }

    const brand = await Brand.findById(req.params.id);
    if (!brand) return next(new ErrorResponse('Brand not found', 404));

    const name        = sanitiseString(req.body.name, 100);
    const description = sanitiseString(req.body.description);
    const category    = sanitiseString(req.body.category, 24);

    if (category !== undefined) {
      if (!OBJECT_ID_RE.test(category)) {
        return next(new ErrorResponse('Invalid category ID', 400));
      }
      const cat = await Category.findById(category).select('_id').lean();
      if (!cat) return next(new ErrorResponse('Category not found', 404));
      brand.category = category;
    }

    if (name !== undefined) {
      if (!SAFE_NAME_RE.test(name)) {
        return next(new ErrorResponse('Invalid brand name', 400));
      }
      if (name !== brand.name) {
        const baseSlug  = generateSlug(name);
        const collision = await Brand.findOne({ slug: baseSlug, _id: { $ne: brand._id } }).select('_id').lean();
        brand.slug = collision ? `${baseSlug}-${Date.now()}` : baseSlug;
        brand.name = name;
      }
    }

    if (description !== undefined) brand.description = description;
    if (req.body.isActive !== undefined) brand.isActive = parseBoolean(req.body.isActive);
    if (req.body.order !== undefined) {
      const parsed = Number(req.body.order);
      if (!Number.isFinite(parsed)) return next(new ErrorResponse('Invalid order value', 400));
      brand.order = parsed;
    }

    if (req.file) {
      const oldId    = brand.logo?.public_id;
      const uploaded = await uploadBuffer(req.file.buffer, 'brands');
      if (!uploaded?.public_id || !uploaded?.secure_url) {
        return next(new ErrorResponse('Logo upload failed', 502));
      }
      brand.logo = { public_id: uploaded.public_id, url: uploaded.secure_url };
      if (oldId) await deleteResource(oldId).catch(() => {});
    }

    await brand.save();
    await brand.populate('category', 'name slug');

    return res.json({ success: true, brand });
  } catch (err) {
    return next(err);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) {
      return next(new ErrorResponse('Invalid brand ID', 400));
    }

    const brand = await Brand.findById(req.params.id);
    if (!brand) return next(new ErrorResponse('Brand not found', 404));

    if (brand.logo?.public_id) {
      await deleteResource(brand.logo.public_id).catch(() => {});
    }

    await brand.deleteOne();

    return res.json({ success: true, message: 'Brand deleted successfully' });
  } catch (err) {
    return next(err);
  }
};