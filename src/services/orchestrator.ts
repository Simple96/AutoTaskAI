import { GitHubWebhookPayload } from '../types/github';
import { LLMAnalysisInput } from '../types/llm';
import { AppConfig } from '../types/config';
import { LLMService } from './llm';
import { LinearService } from './linear';

export class TaskOrchestrator {
  private llmService: LLMService;
  private linearService: LinearService;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    
    this.llmService = new LLMService({
      provider: 'openai',
      model: config.ai.model || 'gpt-4-turbo-preview',
      apiKey: config.ai.openaiApiKey!,
      maxTokens: 2000,
      temperature: 0.3
    });

    this.linearService = new LinearService(config.linear);
  }

  async processGitHubEvent(payload: GitHubWebhookPayload): Promise<void> {
    try {
      console.log(`Processing GitHub event for ${payload.repository.full_name}`);

      // Determine event type
      const eventType = this.determineEventType(payload);
      if (!eventType) {
        console.log('Unsupported event type, skipping');
        return;
      }

      // Get existing tasks for context
      const existingTasks = await this.linearService.getTasksByRepository(
        payload.repository.full_name
      );

      // Prepare LLM analysis input
      const analysisInput: LLMAnalysisInput = {
        repository: payload.repository,
        eventType,
        commits: payload.commits,
        pullRequest: payload.pull_request,
        context: {
          existingTasks,
          projectInfo: payload.repository.description || undefined
        }
      };

      // Analyze with LLM
      console.log('Analyzing changes with LLM...');
      const analysis = await this.llmService.analyzeGitHubChanges(analysisInput);

      if (!analysis.shouldCreateTasks) {
        console.log('LLM determined no tasks should be created');
        return;
      }

      if (analysis.suggestions.length === 0) {
        console.log('No task suggestions from LLM');
        return;
      }

      console.log(`LLM suggested ${analysis.suggestions.length} task(s)`);

      // Process suggestions with Linear
      const results = await this.linearService.processLLMSuggestions(
        analysis.suggestions,
        payload.repository.full_name
      );

      // Log results
      if (results.created.length > 0) {
        console.log(`Created ${results.created.length} Linear task(s):`);
        results.created.forEach(task => {
          console.log(`  - ${task.identifier}: ${task.title}`);
        });
      }

      if (results.updated.length > 0) {
        console.log(`Updated ${results.updated.length} Linear task(s):`);
        results.updated.forEach(task => {
          console.log(`  - ${task.identifier}: ${task.title}`);
        });
      }

      if (results.errors.length > 0) {
        console.log(`Encountered ${results.errors.length} error(s):`);
        results.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }

      // Store analysis for debugging/analytics (optional)
      await this.logAnalysis(payload.repository.full_name, analysis, results);

    } catch (error) {
      console.error('Error processing GitHub event:', error);
      throw error;
    }
  }

  private determineEventType(payload: GitHubWebhookPayload): 'push' | 'pull_request' | null {
    if (payload.commits && payload.commits.length > 0) {
      return 'push';
    }
    
    if (payload.pull_request) {
      return 'pull_request';
    }

    return null;
  }

  private async logAnalysis(
    repository: string,
    analysis: any,
    results: any
  ): Promise<void> {
    // Optional: Store analysis results for debugging/analytics
    // Could be saved to a database, log service, or file
    if (this.config.app.logLevel === 'debug') {
      console.log('Analysis Details:', {
        repository,
        timestamp: new Date().toISOString(),
        summary: analysis.summary,
        suggestions: analysis.suggestions.length,
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length,
        tokensUsed: analysis.metadata.tokensUsed
      });
    }
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; services: any }> {
    const health = {
      status: 'healthy',
      services: {
        llm: 'unknown',
        linear: 'unknown'
      }
    };

    try {
      // Test Linear connection
      await this.linearService.getTasksByRepository('test', 1);
      health.services.linear = 'healthy';
    } catch (error) {
      health.services.linear = 'error';
      health.status = 'degraded';
    }

    // LLM doesn't have a simple health check, so we'll assume it's healthy if we have an API key
    health.services.llm = this.config.ai.openaiApiKey ? 'healthy' : 'not_configured';

    if (health.services.llm === 'not_configured') {
      health.status = 'degraded';
    }

    return health;
  }
}
