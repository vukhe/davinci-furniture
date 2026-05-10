const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';

  // SQL Server unique constraint
  if (err.number === 2627 || err.number === 2601) {
    statusCode = 400;
    message = 'Dữ liệu đã tồn tại';
  }

  // SQL Server foreign key
  if (err.number === 547) {
    statusCode = 400;
    message = 'Dữ liệu liên quan không tồn tại';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };
