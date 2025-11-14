import dotenv from 'dotenv';
import { AppConfig } from '../types/config';

// Load environment variables
dotenv.config();

export function loadConfig(): AppConfig {
  // Validate required environment variables
  const requiredVars = [
    'GITHUB_WEBHOOK_SECRET',
    'LINEAR_API_KEY',
    'OPENAI_API_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
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
  // Additional validation logic
  if (!config.linear.teamId) {
    console.warn('LINEAR_TEAM_ID not set. You may need to specify teamId for each task creation.');
  }

  if (config.ai.model?.includes('gpt-4') && !config.ai.openaiApiKey) {
    throw new Error('OpenAI API key is required for GPT-4 models');
  }

  console.log(`Configuration loaded successfully for ${config.app.environment} environment`);
}
