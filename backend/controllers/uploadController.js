const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { AppError } = require('../middleware/errorHandler');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new AppError('Chỉ chấp nhận file ảnh', 400));
  },
});

exports.upload = [
  multerUpload.single('file'),
  async (req, res, next) => {
    if (!req.file) return next(new AppError('Không có file được gửi lên', 400));

    const b64     = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder:         'davinci',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });

    res.json({
      success:   true,
      url:       result.secure_url,
      public_id: result.public_id,
    });
  },
];
