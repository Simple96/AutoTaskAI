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
      provider: 'openai',
      model: config.ai.model || 'gpt-4-turbo-preview',
      apiKey: config.ai.openaiApiKey!,
      maxTokens: 2000,
      temperature: 0.3
    });

    this.linearService = new LinearService(config.linear);
    
    this.logger.info('Task Orchestrator initialized successfully');
  }

  async processGitHubEvent(payload: GitHubWebhookPayload): Promise<void> {
    const requestId = this.generateRequestId();
    
    console.log(`🎯 ORCHESTRATOR START - Processing GitHub event for ${payload.repository.full_name}`);
    
    this.logger.info('Processing GitHub event', {
      action: 'event_processing_start',
      repository: payload.repository.full_name,
      eventType: this.determineEventType(payload),
      requestId
    });
    
    try {
      // Determine event type
      const eventType = this.determineEventType(payload);
      console.log(`🔍 EVENT TYPE DETERMINED - ${eventType || 'null'}`);
      
      if (!eventType) {
        console.log(`❌ UNSUPPORTED EVENT TYPE - Skipping processing`);
        this.logger.warn('Unsupported event type, skipping processing', {
          action: 'event_skipped',
          repository: payload.repository.full_name,
          requestId
        });
        return;
      }

      // Get existing tasks for context
      console.log(`🔍 FETCHING EXISTING TASKS - Checking Linear for existing tasks`);
      
      let existingTasks: any[] = [];
      try {
        existingTasks = await this.linearService.getTasksByRepository(
          payload.repository.full_name
        );
        console.log(`✅ EXISTING TASKS FETCHED - Found ${existingTasks.length} existing tasks`);
      } catch (error) {
        console.error(`⚠️ FAILED TO FETCH EXISTING TASKS - ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log(`🔄 CONTINUING WITHOUT EXISTING TASKS CONTEXT`);
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
      console.log(`🤖 STARTING LLM ANALYSIS - Sending data to GPT-4`);
      
      this.logger.info('Starting LLM analysis', {
        action: 'llm_analysis_start',
        repository: payload.repository.full_name,
        eventType,
        existingTasksCount: existingTasks.length,
        requestId
      });
      
      const analysis = await this.llmService.analyzeGitHubChanges(analysisInput);
      
      console.log(`🧠 LLM ANALYSIS COMPLETED - Should create tasks: ${analysis.shouldCreateTasks}, Suggestions: ${analysis.suggestions.length}`);

      if (!analysis.shouldCreateTasks) {
        console.log(`🚫 NO TASKS NEEDED - LLM determined no tasks should be created`);
        this.logger.info('LLM determined no tasks should be created', {
          action: 'no_tasks_needed',
          repository: payload.repository.full_name,
          reason: 'llm_decision',
          requestId
        });
        return;
      }

      if (analysis.suggestions.length === 0) {
        console.log(`❌ NO SUGGESTIONS - LLM returned zero task suggestions`);
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
      console.log(`📋 PROCESSING SUGGESTIONS - Creating/updating ${analysis.suggestions.length} Linear tasks`);
      
      const results = await this.linearService.processLLMSuggestions(
        analysis.suggestions,
        payload.repository.full_name
      );
      
      console.log(`✅ TASK PROCESSING COMPLETED - Created: ${results.created.length}, Updated: ${results.updated.length}, Errors: ${results.errors.length}`);

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
      console.error(`🔴 ORCHESTRATOR ERROR - Failed to process GitHub event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`🔴 Orchestrator Stack: ${error instanceof Error && error.stack ? error.stack : 'No stack'}`);
      
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
    health.services.llm = this.config.ai.openaiApiKey ? 'healthy' : 'not_configured';

    if (health.services.llm === 'not_configured') {
      health.status = 'degraded';
    }

    return health;
  }
}
