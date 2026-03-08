import rateLimit from 'express-rate-limit';
import env from '../config/env';

const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again later.',
  },
  skip: () => env.NODE_ENV === 'test', // Don't rate-limit during tests
});

export default rateLimiter;