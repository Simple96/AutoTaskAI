import dotenv from 'dotenv';
import { AppConfig } from '../types/config';
import { logger } from './logger';

// Load environment variables
dotenv.config();

export function loadConfig(): AppConfig {
  logger.debug('Loading configuration from environment variables');
  
  // Validate required environment variables
  const requiredVars = [
    'GITHUB_WEBHOOK_SECRET',
    'LINEAR_API_KEY',
    'OPENAI_API_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', {
      service: 'ConfigLoader',
      action: 'validation_failed',
      missingVars: missing
    });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    github: {
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
      token: process.env.GITHUB_TOKEN
    },
    linear: {
      apiKey: process.env.LINEAR_API_KEY!,
      teamId: process.env.LINEAR_TEAM_ID,
      defaultAssigneeId: process.env.LINEAR_DEFAULT_ASSIGNEE_ID,
      defaultPriority: process.env.LINEAR_DEFAULT_PRIORITY 
        ? parseInt(process.env.LINEAR_DEFAULT_PRIORITY) 
        : 3,
      defaultLabelIds: process.env.LINEAR_DEFAULT_LABEL_IDS?.split(',') || []
    },
    ai: {
      openaiApiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    },
    app: {
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
    }
  };
}

export function validateConfig(config: AppConfig): void {
  logger.debug('Validating configuration');
  
  // Additional validation logic
  if (!config.linear.teamId) {
    logger.warn('LINEAR_TEAM_ID not set. You may need to specify teamId for each task creation.', {
      service: 'ConfigLoader',
      action: 'validation_warning'
    });
  }

  if (config.ai.model?.includes('gpt-4') && !config.ai.openaiApiKey) {
    logger.error('OpenAI API key is required for GPT-4 models', {
      service: 'ConfigLoader',
      action: 'validation_failed',
      model: config.ai.model
    });
    throw new Error('OpenAI API key is required for GPT-4 models');
  }

  const configuredServices = [];
  if (config.github.webhookSecret) configuredServices.push('GitHub');
  if (config.linear.apiKey) configuredServices.push('Linear');
  if (config.ai.openaiApiKey) configuredServices.push('OpenAI');

  logger.configLoaded(config.app.environment, configuredServices);
}
