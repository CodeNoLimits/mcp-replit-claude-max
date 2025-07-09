import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
    const moduleStr = module ? `[${module}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${moduleStr} ${message}${metaStr}`;
  })
);

// Create the main logger
const mainLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    }),
  ],
});

// Add rotating file transport for production
if (process.env.NODE_ENV === 'production') {
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  mainLogger.add(
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    })
  );
}

export class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: string, message: string, meta?: any): void {
    mainLogger.log(level, message, { module: this.module, ...meta });
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.log('error', message, { 
        error: error.message, 
        stack: error.stack 
      });
    } else {
      this.log('error', message, { error });
    }
  }

  // Performance logging
  time(label: string): void {
    console.time(`[${this.module}] ${label}`);
  }

  timeEnd(label: string): void {
    console.timeEnd(`[${this.module}] ${label}`);
  }

  // Structured logging for specific events
  logEvent(event: string, data?: any): void {
    this.log('info', `Event: ${event}`, { event, data });
  }

  logMetric(metric: string, value: number, unit?: string): void {
    this.log('info', `Metric: ${metric}`, { metric, value, unit });
  }

  logRequest(method: string, url: string, statusCode?: number, duration?: number): void {
    this.log('info', `Request: ${method} ${url}`, { 
      method, 
      url, 
      statusCode, 
      duration 
    });
  }

  logClaudeCodeEvent(projectId: string, event: string, data?: any): void {
    this.log('info', `Claude Code [${projectId}]: ${event}`, { 
      projectId, 
      event, 
      data 
    });
  }

  logTerminalEvent(sessionId: string, event: string, data?: any): void {
    this.log('info', `Terminal [${sessionId}]: ${event}`, { 
      sessionId, 
      event, 
      data 
    });
  }

  logProjectEvent(projectId: string, event: string, data?: any): void {
    this.log('info', `Project [${projectId}]: ${event}`, { 
      projectId, 
      event, 
      data 
    });
  }
}

// Export the main logger for direct use
export const logger = new Logger('Main');

// Export utility functions
export const createLogger = (module: string): Logger => new Logger(module);

export const logStartup = (serviceName: string, port?: number): void => {
  const startupLogger = new Logger('Startup');
  startupLogger.info(`🚀 ${serviceName} starting...`, { service: serviceName, port });
};

export const logShutdown = (serviceName: string, reason?: string): void => {
  const shutdownLogger = new Logger('Shutdown');
  shutdownLogger.info(`🛑 ${serviceName} shutting down...`, { service: serviceName, reason });
};

export const logHealthCheck = (service: string, status: 'healthy' | 'unhealthy', details?: any): void => {
  const healthLogger = new Logger('Health');
  healthLogger.info(`Health check: ${service} is ${status}`, { service, status, details });
};

export const logPerformance = (operation: string, duration: number, metadata?: any): void => {
  const perfLogger = new Logger('Performance');
  perfLogger.info(`Performance: ${operation} took ${duration}ms`, { 
    operation, 
    duration, 
    ...metadata 
  });
};

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  const errorLogger = new Logger('Process');
  errorLogger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const errorLogger = new Logger('Process');
  errorLogger.error('Unhandled Rejection at:', { promise, reason });
});

export default Logger;