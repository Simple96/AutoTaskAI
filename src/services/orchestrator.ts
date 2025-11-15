import { GitHubWebhookPayload } from '../types/github';
import { LLMAnalysisInput } from '../types/llm';
import { AppConfig } from '../types/config';
import { LLMService } from './llm';
import { LinearService } from './linear';
import { createLogger } from '../utils/logger';

export class TaskOrchestrator {
  private llmService: LLMService;
  private linearService: LinearService;
  private config: AppConfig;
  private logger = createLogger('TaskOrchestrator');

  constructor(config: AppConfig) {
    this.logger.info('Initializing Task Orchestrator');
    this.config = config;
    
    this.llmService = new LLMService({
      provider: config.ai.provider || 'openrouter',
      model: config.ai.model || 'openai/gpt-4o-mini',
      apiKey: config.ai.apiKey,
      baseUrl: config.ai.baseUrl,
      maxTokens: 2000,
      temperature: 0.3
    });

    this.linearService = new LinearService(config.linear);
    
    this.logger.info('Task Orchestrator initialized successfully');
  }

  async processGitHubEvent(payload: GitHubWebhookPayload): Promise<void> {
    const requestId = this.generateRequestId();
    
    this.logger.info('Processing GitHub event', {
      action: 'event_processing_start',
      repository: payload.repository.full_name,
      eventType: this.determineEventType(payload),
      commitsCount: payload.commits?.length || 0,
      hasPullRequest: !!payload.pull_request,
      requestId
    });
    
    try {
      // Determine event type
      const eventType = this.determineEventType(payload);
      
      if (!eventType) {
        this.logger.warn('Unsupported event type, skipping processing', {
          action: 'event_skipped',
          repository: payload.repository.full_name,
          requestId
        });
        return;
      }

      // Get existing tasks for context
      let existingTasks: any[] = [];
      try {
        existingTasks = await this.linearService.getTasksByRepository(
          payload.repository.full_name
        );
        this.logger.debug('Existing tasks fetched', {
          action: 'existing_tasks_fetched',
          repository: payload.repository.full_name,
          taskCount: existingTasks.length,
          requestId
        });
      } catch (error) {
        this.logger.warn('Failed to fetch existing tasks, continuing without context', {
          action: 'existing_tasks_failed',
          repository: payload.repository.full_name,
          requestId
        }, error as Error);
        // Continue processing even if we can't fetch existing tasks
        existingTasks = [];
      }

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
      this.logger.info('Starting LLM analysis', {
        action: 'llm_analysis_start',
        repository: payload.repository.full_name,
        eventType,
        existingTasksCount: existingTasks.length,
        requestId
      });
      
      const analysis = await this.llmService.analyzeGitHubChanges(analysisInput);

      if (!analysis.shouldCreateTasks) {
        this.logger.info('LLM determined no tasks should be created', {
          action: 'no_tasks_needed',
          repository: payload.repository.full_name,
          reason: 'llm_decision',
          summary: analysis.summary,
          requestId
        });
        return;
      }

      if (analysis.suggestions.length === 0) {
        this.logger.warn('No task suggestions received from LLM', {
          action: 'no_suggestions',
          repository: payload.repository.full_name,
          requestId
        });
        return;
      }

      this.logger.info('LLM analysis completed with suggestions', {
        action: 'llm_suggestions_received',
        repository: payload.repository.full_name,
        suggestionsCount: analysis.suggestions.length,
        requestId
      });

      // Process suggestions with Linear
      this.logger.info('Processing LLM suggestions with Linear', {
        action: 'suggestions_processing_start',
        repository: payload.repository.full_name,
        suggestionsCount: analysis.suggestions.length,
        requestId
      });
      
      const results = await this.linearService.processLLMSuggestions(
        analysis.suggestions,
        payload.repository.full_name
      );

      // Log results
      this.logger.info('Task processing completed', {
        action: 'task_processing_completed',
        repository: payload.repository.full_name,
        createdCount: results.created.length,
        updatedCount: results.updated.length,
        errorCount: results.errors.length,
        createdTasks: results.created.map(task => ({ id: task.identifier, title: task.title })),
        errors: results.errors,
        requestId
      });

      // Store analysis for debugging/analytics (optional)
      await this.logAnalysis(payload.repository.full_name, analysis, results);

    } catch (error) {
      this.logger.error('Error processing GitHub event', {
        action: 'orchestrator_error',
        repository: payload.repository.full_name,
        requestId
      }, error as Error);
      
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
    // Log detailed analysis results
    this.logger.info('Analysis completed', {
      action: 'analysis_details',
      repository,
      summaryLength: analysis.summary.length,
      suggestionsCount: analysis.suggestions.length,
      createdCount: results.created.length,
      updatedCount: results.updated.length,
      errorCount: results.errors.length,
      tokensUsed: analysis.metadata.tokensUsed,
      model: analysis.metadata.model
    });
  }

  private generateRequestId(): string {
    return `orch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
    health.services.llm = this.config.ai.apiKey ? 'healthy' : 'not_configured';

    if (health.services.llm === 'not_configured') {
      health.status = 'degraded';
    }

    return health;
  }
}
