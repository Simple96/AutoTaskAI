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
      model: config.model,
      baseUrl: config.baseUrl || 'default'
    });
    
    this.config = config;
    
    // Configure OpenAI client for OpenRouter or direct OpenAI
    const clientConfig: any = {
      apiKey: config.apiKey,
    };
    
    if (config.provider === 'openrouter') {
      clientConfig.baseURL = config.baseUrl || 'https://openrouter.ai/api/v1';
      clientConfig.defaultHeaders = {
        'HTTP-Referer': 'https://github.com/Simple96/AutoTaskAI',
        'X-Title': 'AutoTaskAI'
      };
    } else if (config.baseUrl) {
      clientConfig.baseURL = config.baseUrl;
    }
    
    this.openai = new OpenAI(clientConfig);
    
    this.logger.info('LLM service initialized successfully', {
      action: 'service_init_complete',
      provider: config.provider,
      baseUrl: clientConfig.baseURL || 'https://api.openai.com/v1'
    });
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
      model: this.config.model || 'gpt-4o-mini',
      promptLength,
      maxTokens: this.config.maxTokens || 2000,
      temperature: this.config.temperature || 0.3,
      requestId
    });
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model || 'openai/gpt-4o-mini',
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

      console.log(`📄 LLM RAW RESPONSE - Length: ${response.length}`);
      console.log(`📄 LLM RESPONSE PREVIEW - ${response.substring(0, 200)}...`);

      this.logger.debug('Parsing LLM response', {
        action: 'response_parsing',
        responseLength: response.length,
        tokensUsed: completion.usage?.total_tokens,
        requestId
      });

      let parsed: LLMAnalysisResult;
      try {
        parsed = JSON.parse(response) as LLMAnalysisResult;
        console.log(`✅ JSON PARSING SUCCESS - shouldCreateTasks: ${parsed.shouldCreateTasks}, suggestions: ${parsed.suggestions?.length || 0}`);
      } catch (parseError) {
        console.error(`🔴 JSON PARSING ERROR - ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        console.error(`🔴 Raw response that failed to parse: ${response}`);
        throw new Error(`Failed to parse LLM JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      // Ensure required fields exist with defaults
      if (!parsed.suggestions) {
        console.log(`⚠️ MISSING SUGGESTIONS - Adding empty array`);
        parsed.suggestions = [];
      }
      
      if (typeof parsed.shouldCreateTasks === 'undefined') {
        console.log(`⚠️ MISSING shouldCreateTasks - Defaulting to false`);
        parsed.shouldCreateTasks = false;
      }

      if (!parsed.summary) {
        console.log(`⚠️ MISSING SUMMARY - Adding default`);
        parsed.summary = 'Analysis completed';
      }

      // Add metadata
      parsed.metadata = {
        ...parsed.metadata,
        analysisDate: new Date().toISOString(),
        model: this.config.model || 'openai/gpt-4o-mini',
        provider: this.config.provider,
        tokensUsed: completion.usage?.total_tokens
      };

      console.log(`📊 FINAL PARSED RESULT - shouldCreateTasks: ${parsed.shouldCreateTasks}, suggestions: ${parsed.suggestions.length}, summary length: ${parsed.summary.length}`);

      this.logger.llmAnalysisCompleted(
        input.repository.full_name, 
        parsed.suggestions?.length || 0, 
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

CRITICAL: You MUST respond with valid JSON in EXACTLY this format:

{
  "shouldCreateTasks": boolean,
  "summary": "Brief summary of the changes analyzed",
  "suggestions": [
    {
      "action": "create" or "update",
      "task": {
        "title": "Clear task title",
        "description": "Detailed description",
        "priority": 1 | 2 | 3 | 4,
        "labels": ["bug", "feature", "docs", etc.],
        "assignee": "developer name or null",
        "estimateHours": number or null
      },
      "existingTaskId": "optional for updates",
      "reasoning": "Why this task should be created",
      "confidence": 0.8
    }
  ],
  "metadata": {}
}

Do NOT use "tasks" field. Use "suggestions" field as shown above.`;
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
