export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  service?: string;
  action?: string;
  requestId?: string;
  repository?: string;
  taskId?: string;
  userId?: string;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private serviceName: string;

  constructor(serviceName: string = 'AutoTaskAI', logLevel?: LogLevel) {
    this.serviceName = serviceName;
    this.logLevel = logLevel || this.parseLogLevel(process.env.LOG_LEVEL) || LogLevel.INFO;
  }

  static getInstance(serviceName?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(serviceName);
    }
    return Logger.instance;
  }

  private parseLogLevel(level?: string): LogLevel | undefined {
    if (!level) return undefined;
    
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatLog(level: string, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString();
    const service = context?.service || this.serviceName;
    
    // For Vercel, use a more readable format instead of JSON
    let logLine = `[${timestamp}] ${level} ${service}: ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .filter(([key]) => key !== 'service') // Already included above
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      if (contextStr) {
        logLine += ` | ${contextStr}`;
      }
    }
    
    if (error) {
      logLine += ` | ERROR: ${error.name}: ${error.message}`;
      if (process.env.NODE_ENV === 'development' && error.stack) {
        logLine += `\nStack: ${error.stack}`;
      }
    }

    return logLine;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatLog('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatLog('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog('WARN', message, context, error));
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog('ERROR', message, context, error));
    }
  }

  // Add simple console methods for immediate visibility
  simpleInfo(message: string): void {
    console.log(`🔵 ${message}`);
  }

  simpleWarn(message: string): void {
    console.warn(`🟡 WARNING: ${message}`);
  }

  simpleError(message: string, error?: Error): void {
    console.error(`🔴 ERROR: ${message}`);
    if (error) {
      console.error(`🔴 Details: ${error.message}`);
      if (error.stack) {
        console.error(`🔴 Stack: ${error.stack}`);
      }
    }
  }

  // Convenience methods for common scenarios
  webhookReceived(eventType: string, repository: string, requestId?: string): void {
    this.info('GitHub webhook received', {
      service: 'WebhookHandler',
      action: 'webhook_received',
      eventType,
      repository,
      requestId
    });
  }

  llmAnalysisStarted(repository: string, eventType: string, requestId?: string): void {
    this.info('Starting LLM analysis', {
      service: 'LLMService',
      action: 'analysis_started',
      repository,
      eventType,
      requestId
    });
  }

  llmAnalysisCompleted(repository: string, suggestionsCount: number, tokensUsed?: number, requestId?: string): void {
    this.info('LLM analysis completed', {
      service: 'LLMService',
      action: 'analysis_completed',
      repository,
      suggestionsCount,
      tokensUsed,
      requestId
    });
  }

  linearTaskCreated(taskId: string, taskIdentifier: string, repository: string, requestId?: string): void {
    this.info('Linear task created', {
      service: 'LinearService',
      action: 'task_created',
      taskId,
      taskIdentifier,
      repository,
      requestId
    });
  }

  linearTaskUpdated(taskId: string, taskIdentifier: string, repository: string, requestId?: string): void {
    this.info('Linear task updated', {
      service: 'LinearService',
      action: 'task_updated',
      taskId,
      taskIdentifier,
      repository,
      requestId
    });
  }

  healthCheck(service: string, status: string, details?: any): void {
    this.info('Health check performed', {
      service: 'HealthCheck',
      action: 'health_check',
      targetService: service,
      status,
      details
    });
  }

  configLoaded(environment: string, services: string[]): void {
    this.info('Configuration loaded', {
      service: 'ConfigLoader',
      action: 'config_loaded',
      environment,
      configuredServices: services
    });
  }
}

// Export a default logger instance
export const logger = Logger.getInstance();

// Export factory function for service-specific loggers
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}
