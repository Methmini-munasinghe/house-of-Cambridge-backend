import { Readable } from 'stream';
import cloudinary from '../config/cloudinary.js';

const BASE_FOLDER = process.env.CLOUDINARY_FOLDER || 'house-of-cambridge';

export const uploadBuffer = (buffer, subfolder = 'misc', options = {}) =>
  new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: `${BASE_FOLDER}/${subfolder}`,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      ...options,
    };
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });

export const deleteResource = (publicId) => {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId);
};

export const generateSignature = (subfolder = 'misc') => {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${BASE_FOLDER}/${subfolder}`;
  const params = { timestamp, folder };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  return {
    signature,
    timestamp,
    folder,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  };
};