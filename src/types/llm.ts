import { GitHubCommit, GitHubPullRequest, GitHubRepository } from './github';

export interface LLMAnalysisInput {
  repository: GitHubRepository;
  eventType: 'push' | 'pull_request' | 'release';
  commits?: GitHubCommit[];
  pullRequest?: GitHubPullRequest;
  context?: {
    existingTasks?: LinearTaskSummary[];
    projectInfo?: string;
  };
}

export interface LinearTaskSummary {
  id: string;
  title: string;
  description?: string;
  identifier: string;
  state: string;
  url: string;
}

export interface LLMTaskSuggestion {
  action: 'create' | 'update';
  task: {
    title: string;
    description: string;
    priority: 1 | 2 | 3 | 4; // 1 = Urgent, 2 = High, 3 = Medium, 4 = Low
    labels?: string[];
    assignee?: string;
    estimateHours?: number;
  };
  existingTaskId?: string; // For updates
  reasoning: string;
  confidence: number; // 0-1 scale
}

export interface LLMAnalysisResult {
  summary: string;
  suggestions: LLMTaskSuggestion[];
  shouldCreateTasks: boolean;
  metadata: {
    analysisDate: string;
    model: string;
    tokensUsed?: number;
  };
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}
