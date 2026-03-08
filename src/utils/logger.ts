import winston from 'winston';
import env from '../config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for development: human-readable, colorized
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`;
  }),
);

// JSON format for production: structured, machine-parseable
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // In production you'd add File / CloudWatch / Datadog transports here
  ],
  // Prevent winston from crashing the process on uncaught exceptions
  exitOnError: false,
});

export default logger;