import OpenAI from 'openai';
import { LLMAnalysisInput, LLMAnalysisResult, LLMConfig } from '../types/llm';
import { createLogger } from '../utils/logger';

export class LLMService {
  private openai: OpenAI;
  private config: LLMConfig;
  private logger = createLogger('LLMService');

  constructor(config: LLMConfig) {
    this.logger.info('Initializing LLM service', {
      action: 'service_init',
      provider: config.provider,
      model: config.model
    });
    
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
    
    this.logger.info('LLM service initialized successfully');
  }

  async analyzeGitHubChanges(input: LLMAnalysisInput): Promise<LLMAnalysisResult> {
    const requestId = this.generateRequestId();
    
    this.logger.llmAnalysisStarted(input.repository.full_name, input.eventType, requestId);
    this.logger.debug('Building analysis prompt', {
      action: 'prompt_building',
      repository: input.repository.full_name,
      eventType: input.eventType,
      commitsCount: input.commits?.length || 0,
      hasExistingTasks: input.context?.existingTasks?.length || 0,
      requestId
    });
    
    const prompt = this.buildAnalysisPrompt(input);
    const promptLength = prompt.length;
    
    this.logger.debug('Sending request to LLM', {
      action: 'llm_request',
      model: this.config.model || 'gpt-4-turbo-preview',
      promptLength,
      maxTokens: this.config.maxTokens || 2000,
      temperature: this.config.temperature || 0.3,
      requestId
    });
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens || 2000,
        temperature: this.config.temperature || 0.3,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        this.logger.error('No response received from LLM', {
          action: 'llm_no_response',
          requestId
        });
        throw new Error('No response from LLM');
      }

      this.logger.debug('Parsing LLM response', {
        action: 'response_parsing',
        responseLength: response.length,
        tokensUsed: completion.usage?.total_tokens,
        requestId
      });

      const parsed = JSON.parse(response) as LLMAnalysisResult;
      
      // Add metadata
      parsed.metadata = {
        ...parsed.metadata,
        analysisDate: new Date().toISOString(),
        model: this.config.model || 'gpt-4o-mini',
        tokensUsed: completion.usage?.total_tokens
      };

      this.logger.llmAnalysisCompleted(
        input.repository.full_name, 
        parsed.suggestions.length, 
        completion.usage?.total_tokens,
        requestId
      );
      
      this.logger.debug('Analysis result summary', {
        action: 'analysis_summary',
        shouldCreateTasks: parsed.shouldCreateTasks,
        suggestionsCount: parsed.suggestions.length,
        summaryLength: parsed.summary.length,
        requestId
      });

      return parsed;
    } catch (error) {
      this.logger.error('LLM analysis failed', {
        action: 'llm_analysis_failed',
        repository: input.repository.full_name,
        eventType: input.eventType,
        requestId
      }, error as Error);
      
      throw new Error(`LLM analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant that analyzes GitHub repository changes (commits, pull requests) and suggests Linear tasks.

Your job is to:
1. Analyze the code changes, commit messages, and PR descriptions
2. Determine if any tasks should be created or updated in Linear
3. Suggest appropriate task titles, descriptions, priorities, and labels
4. Provide reasoning for your suggestions

Guidelines:
- Focus on actionable items like bug fixes, feature requests, documentation updates, refactoring needs
- Consider the scope and impact of changes when setting priority
- Use clear, concise task titles that describe the work needed
- Include relevant technical details in task descriptions
- Suggest appropriate labels based on the type of work (bug, feature, docs, etc.)
- Only suggest task creation/updates when there's genuine value
- For updates, match against existing task summaries when provided

Priority levels:
1 = Urgent (critical bugs, security issues)
2 = High (important features, significant bugs)
3 = Medium (standard features, minor improvements)
4 = Low (nice-to-have, documentation, cleanup)

Always respond with valid JSON matching the LLMAnalysisResult interface.`;
  }

  private buildAnalysisPrompt(input: LLMAnalysisInput): string {
    this.logger.debug('Building analysis prompt', {
      action: 'prompt_details',
      hasCommits: !!(input.commits?.length),
      hasPullRequest: !!input.pullRequest,
      hasExistingTasks: !!(input.context?.existingTasks?.length),
      hasProjectInfo: !!input.context?.projectInfo
    });
    
    let prompt = `Analyze the following GitHub ${input.eventType} event:\n\n`;
    
    prompt += `Repository: ${input.repository.full_name}\n`;
    prompt += `Description: ${input.repository.description || 'No description'}\n\n`;

    if (input.commits && input.commits.length > 0) {
      prompt += `Commits (${input.commits.length}):\n`;
      input.commits.forEach((commit, index) => {
        prompt += `${index + 1}. ${commit.message}\n`;
        prompt += `   Author: ${commit.author.name}\n`;
        prompt += `   Files: +${commit.added.length} -${commit.removed.length} ~${commit.modified.length}\n`;
        if (commit.added.length > 0) prompt += `   Added: ${commit.added.slice(0, 5).join(', ')}${commit.added.length > 5 ? '...' : ''}\n`;
        if (commit.modified.length > 0) prompt += `   Modified: ${commit.modified.slice(0, 5).join(', ')}${commit.modified.length > 5 ? '...' : ''}\n`;
        prompt += '\n';
      });
    }

    if (input.pullRequest) {
      const pr = input.pullRequest;
      prompt += `Pull Request: #${pr.number} - ${pr.title}\n`;
      prompt += `Author: ${pr.user.login}\n`;
      prompt += `Branch: ${pr.head.ref} -> ${pr.base.ref}\n`;
      prompt += `State: ${pr.state}\n`;
      if (pr.body) {
        prompt += `Description:\n${pr.body}\n`;
      }
      prompt += '\n';
    }

    if (input.context?.existingTasks && input.context.existingTasks.length > 0) {
      prompt += `Existing Linear Tasks (consider for updates):\n`;
      input.context.existingTasks.forEach(task => {
        prompt += `- ${task.identifier}: ${task.title} (${task.state})\n`;
        if (task.description) {
          prompt += `  ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}\n`;
        }
      });
      prompt += '\n';
    }

    if (input.context?.projectInfo) {
      prompt += `Project Context:\n${input.context.projectInfo}\n\n`;
    }

    prompt += `Please analyze these changes and provide task suggestions in JSON format.`;

    return prompt;
  }

  private generateRequestId(): string {
    return `llm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
