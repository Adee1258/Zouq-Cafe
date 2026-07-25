// Cloudinary config — falls back to local disk storage if keys not set
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

let cloudinary, uploadProduct, uploadPrize, uploadCategory;

if (hasCloudinary) {
  // ── Cloudinary mode ──────────────────────────────────────────────────────
  cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const makeStorage = (folder, w, h) =>
    new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `zouqcafe/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: w, height: h, crop: 'fill', quality: 'auto' }],
      },
    });

  uploadProduct  = multer({ storage: makeStorage('products',  800, 800) });
  uploadPrize    = multer({ storage: makeStorage('prizes',    400, 400) });
  uploadCategory = multer({ storage: makeStorage('categories', 600, 400) });
  uploadBanner   = multer({ storage: makeStorage('banners',   1280, 720) }); // 16:9

} else {
  // ── Local disk mode (dev fallback) ───────────────────────────────────────
  console.log('⚠️  Cloudinary not configured — using local disk storage for uploads');

  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + path.extname(file.originalname));
    },
  });

  const diskUpload = multer({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      const allowed = /jpg|jpeg|png|webp/i;
      cb(null, allowed.test(path.extname(file.originalname)));
    },
  });

  uploadProduct  = diskUpload;
  uploadPrize    = diskUpload;
  uploadCategory = diskUpload;
  uploadBanner   = diskUpload;
  cloudinary     = null;
}

module.exports = { cloudinary, uploadProduct, uploadPrize, uploadCategory, uploadBanner };
