import { LinearConfig } from './linear';

export interface AppConfig {
  github: {
    webhookSecret: string;
    token?: string;
  };
  linear: LinearConfig;
  ai: {
    openaiApiKey?: string;
    model?: string;
  };
  app: {
    environment: 'development' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface TaskGenerationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: {
    events: string[];
    repositories?: string[];
    branches?: string[];
    authors?: string[];
  };
  conditions: {
    commitMessagePatterns?: string[];
    filePatterns?: string[];
    prTitlePatterns?: string[];
    prBodyPatterns?: string[];
  };
  actions: {
    createTask: boolean;
    taskTemplate: {
      title: string;
      description: string;
      priority?: number;
      labels?: string[];
      assignee?: string;
    };
  };
}
