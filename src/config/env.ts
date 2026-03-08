import { cleanEnv, str, port, num } from 'envalid';

// Validates all env vars at startup — app will crash fast with a clear
// message if anything is missing or wrong, rather than failing silently later.
const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'production', 'test'],
    default: 'development',
  }),
  PORT: port({ default: 3000 }),
  API_PREFIX: str({ default: '/api/v1' }),

  // Database
  DATABASE_URL: str(),

  // Security
  CORS_ORIGIN: str({ default: '*' }),
  RATE_LIMIT_WINDOW_MS: num({ default: 15 * 60 * 1000 }), // 15 min
  RATE_LIMIT_MAX: num({ default: 100 }),
});

export default env;