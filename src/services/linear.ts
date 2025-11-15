import { LinearClient } from '@linear/sdk';
import { LinearConfig, CreateLinearIssueInput, LinearIssue } from '../types/linear';
import { LLMTaskSuggestion, LinearTaskSummary } from '../types/llm';
import { createLogger } from '../utils/logger';

export class LinearService {
  private client: LinearClient;
  private config: LinearConfig;
  private logger = createLogger('LinearService');

  constructor(config: LinearConfig) {
    this.logger.info('Initializing Linear service', {
      action: 'service_init',
      hasTeamId: !!config.teamId,
      hasDefaultAssignee: !!config.defaultAssigneeId,
      defaultPriority: config.defaultPriority
    });
    
    this.config = config;
    this.client = new LinearClient({
      apiKey: config.apiKey,
    });
    
    this.logger.info('Linear service initialized successfully');
  }

  async createTask(input: CreateLinearIssueInput): Promise<LinearIssue> {
    const requestId = this.generateRequestId();
    
    this.logger.info('Creating Linear task', {
      action: 'task_create_start',
      title: input.title,
      teamId: input.teamId || this.config.teamId,
      priority: input.priority || this.config.defaultPriority || 3,
      hasAssignee: !!(input.assigneeId || this.config.defaultAssigneeId),
      labelCount: (input.labelIds || this.config.defaultLabelIds || []).length,
      requestId
    });
    
    try {
      const issuePayload = {
        title: input.title,
        description: input.description,
        teamId: input.teamId || this.config.teamId!,
        priority: input.priority || this.config.defaultPriority || 3,
        assigneeId: input.assigneeId || this.config.defaultAssigneeId,
        labelIds: input.labelIds || this.config.defaultLabelIds || [],
        projectId: input.projectId,
      };

      this.logger.debug('Sending create request to Linear API', {
        action: 'linear_api_create',
        payload: { ...issuePayload, description: issuePayload.description?.substring(0, 100) + '...' },
        requestId
      });

      const issuePayloadResult = await this.client.createIssue(issuePayload);
      
      if (!issuePayloadResult.success) {
        this.logger.error('Linear API returned failure', {
          action: 'linear_api_failed',
          requestId
        });
        throw new Error(`Failed to create Linear issue`);
      }

      const issue = await issuePayloadResult.issue;
      if (!issue) {
        this.logger.error('No issue returned from Linear API', {
          action: 'no_issue_returned',
          requestId
        });
        throw new Error('Failed to retrieve created issue');
      }
      
      const mappedIssue = await this.mapLinearIssue(issue);
      
      this.logger.linearTaskCreated(mappedIssue.id, mappedIssue.identifier, 'unknown', requestId);
      
      return mappedIssue;
    } catch (error) {
      this.logger.error('Failed to create Linear task', {
        action: 'task_create_failed',
        title: input.title,
        requestId
      }, error as Error);
      
      throw new Error(`Failed to create Linear task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateTask(taskId: string, updates: Partial<CreateLinearIssueInput>): Promise<LinearIssue> {
    try {
      const updatePayload: any = {
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        assigneeId: updates.assigneeId,
        labelIds: updates.labelIds,
        projectId: updates.projectId,
      };

      // Remove undefined values
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key];
        }
      });

      const updateResult = await this.client.updateIssue(taskId, updatePayload);
      
      if (!updateResult.success) {
        throw new Error(`Failed to update Linear issue`);
      }

      const issue = await updateResult.issue;
      if (!issue) {
        throw new Error('Failed to retrieve updated issue');
      }
      
      return await this.mapLinearIssue(issue);
    } catch (error) {
      console.error('Error updating Linear task:', error);
      throw new Error(`Failed to update Linear task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTasksByRepository(repositoryName: string, limit = 50): Promise<LinearTaskSummary[]> {
    try {
      const issues = await this.client.issues({
        first: limit,
        filter: {
          team: { id: { eq: this.config.teamId! } },
          // Search in description for repository reference
          or: [
            { title: { containsIgnoreCase: repositoryName } },
            { description: { containsIgnoreCase: repositoryName } }
          ]
        }
      });

      const taskSummaries: LinearTaskSummary[] = [];
      
      if (issues.nodes) {
        for (const issue of issues.nodes) {
          const state = await issue.state;
          taskSummaries.push({
            id: issue.id,
            title: issue.title,
            description: issue.description || undefined,
            identifier: issue.identifier,
            state: state?.name || 'Unknown',
            url: issue.url
          });
        }
      }

      return taskSummaries;
    } catch (error) {
      console.error('Error fetching Linear tasks:', error);
      return [];
    }
  }

  async processLLMSuggestions(
    suggestions: LLMTaskSuggestion[],
    repositoryName: string
  ): Promise<{ created: LinearIssue[]; updated: LinearIssue[]; errors: string[] }> {
    const requestId = this.generateRequestId();
    
    this.logger.info('Processing LLM suggestions', {
      action: 'suggestions_processing_start',
      repository: repositoryName,
      suggestionsCount: suggestions.length,
      requestId
    });
    
    const created: LinearIssue[] = [];
    const updated: LinearIssue[] = [];
    const errors: string[] = [];

    for (const [index, suggestion] of suggestions.entries()) {
      this.logger.debug('Processing suggestion', {
        action: 'suggestion_processing',
        suggestionIndex: index + 1,
        suggestionAction: suggestion.action,
        title: suggestion.task.title,
        confidence: suggestion.confidence,
        requestId
      });
      
      try {
        if (suggestion.confidence < 0.7) {
          this.logger.debug('Skipping low confidence suggestion', {
            action: 'suggestion_skipped',
            title: suggestion.task.title,
            confidence: suggestion.confidence,
            threshold: 0.7,
            requestId
          });
          continue;
        }

        const taskInput: CreateLinearIssueInput = {
          title: suggestion.task.title,
          description: this.enrichTaskDescription(suggestion, repositoryName),
          teamId: this.config.teamId!,
          priority: suggestion.task.priority,
          assigneeId: suggestion.task.assignee ? await this.findUserByName(suggestion.task.assignee) : undefined,
          labelIds: suggestion.task.labels ? await this.findOrCreateLabels(suggestion.task.labels) : undefined,
        };

        if (suggestion.action === 'create') {
          this.logger.debug('Creating task from suggestion', {
            action: 'suggestion_create',
            title: suggestion.task.title,
            requestId
          });
          
          const issue = await this.createTask(taskInput);
          created.push(issue);
          
          this.logger.info('Task created from suggestion', {
            action: 'suggestion_created',
            taskId: issue.id,
            taskIdentifier: issue.identifier,
            title: issue.title,
            requestId
          });
          
        } else if (suggestion.action === 'update' && suggestion.existingTaskId) {
          this.logger.debug('Updating task from suggestion', {
            action: 'suggestion_update',
            existingTaskId: suggestion.existingTaskId,
            title: suggestion.task.title,
            requestId
          });
          
          const issue = await this.updateTask(suggestion.existingTaskId, taskInput);
          updated.push(issue);
          
          this.logger.info('Task updated from suggestion', {
            action: 'suggestion_updated',
            taskId: issue.id,
            taskIdentifier: issue.identifier,
            title: issue.title,
            requestId
          });
        }
      } catch (error) {
        const errorMessage = `Failed to ${suggestion.action} task "${suggestion.task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        
        this.logger.error('Failed to process suggestion', {
          action: 'suggestion_failed',
          suggestionAction: suggestion.action,
          title: suggestion.task.title,
          requestId
        }, error as Error);
      }
    }

    this.logger.info('LLM suggestions processing completed', {
      action: 'suggestions_processing_completed',
      repository: repositoryName,
      createdCount: created.length,
      updatedCount: updated.length,
      errorCount: errors.length,
      requestId
    });

    return { created, updated, errors };
  }

  private enrichTaskDescription(suggestion: LLMTaskSuggestion, repositoryName: string): string {
    let description = suggestion.task.description;
    
    description += `\n\n---\n**Auto-generated from repository:** \`${repositoryName}\`\n`;
    description += `**AI Reasoning:** ${suggestion.reasoning}\n`;
    description += `**Confidence:** ${Math.round(suggestion.confidence * 100)}%\n`;
    
    if (suggestion.task.estimateHours) {
      description += `**Estimated Hours:** ${suggestion.task.estimateHours}h\n`;
    }
    
    description += `**Generated:** ${new Date().toISOString()}`;
    
    return description;
  }

  private async findUserByName(displayName: string): Promise<string | undefined> {
    this.logger.debug('Finding user by name', {
      action: 'user_lookup',
      displayName
    });
    
    try {
      const users = await this.client.users({
        filter: { displayName: { containsIgnoreCase: displayName } }
      });
      
      const userId = users.nodes?.[0]?.id;
      
      if (userId) {
        this.logger.debug('User found', {
          action: 'user_found',
          displayName,
          userId
        });
      } else {
        this.logger.debug('User not found', {
          action: 'user_not_found',
          displayName
        });
      }
      
      return userId;
    } catch (error) {
      this.logger.warn('Failed to find user', {
        action: 'user_lookup_failed',
        displayName
      }, error as Error);
      return undefined;
    }
  }

  private generateRequestId(): string {
    return `linear_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private async findOrCreateLabels(labelNames: string[]): Promise<string[]> {
    const labelIds: string[] = [];
    
    try {
      const existingLabels = await this.client.issueLabels({
        filter: { team: { id: { eq: this.config.teamId! } } }
      });
      
      const existingLabelMap = new Map<string, string>();
      if (existingLabels.nodes) {
        for (const label of existingLabels.nodes) {
          existingLabelMap.set(label.name.toLowerCase(), label.id);
        }
      }
      
      for (const labelName of labelNames) {
        const existingId = existingLabelMap.get(labelName.toLowerCase());
        if (existingId) {
          labelIds.push(existingId);
        } else {
          // Create new label
          try {
            const createResult = await this.client.createIssueLabel({
              name: labelName,
              teamId: this.config.teamId!,
              color: this.getRandomLabelColor()
            });
            
            if (createResult.success) {
              const newLabel = await createResult.issueLabel;
              if (newLabel) {
                labelIds.push(newLabel.id);
                this.logger.debug('Created new label', {
                  action: 'label_created',
                  labelName,
                  labelId: newLabel.id
                });
              }
            }
          } catch (createError) {
            // Check if it's a duplicate label error
            const errorMessage = createError instanceof Error ? createError.message : '';
            if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
              this.logger.debug('Label already exists, skipping creation', {
                action: 'label_already_exists',
                labelName
              });
              // Try to find the existing label by name
              const existingLabel = Array.from(existingLabelMap.entries())
                .find(([name]) => name.toLowerCase().includes(labelName.toLowerCase()));
              if (existingLabel) {
                labelIds.push(existingLabel[1]);
              }
            } else {
              this.logger.warn('Failed to create label', {
                action: 'label_creation_failed',
                labelName
              }, createError as Error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error handling labels:', error);
    }
    
    return labelIds;
  }

  private getRandomLabelColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private async mapLinearIssue(issue: any): Promise<LinearIssue> {
    const state = await issue.state;
    const team = await issue.team;
    const assignee = issue.assignee ? await issue.assignee : undefined;

    return {
      id: issue.id,
      title: issue.title,
      description: issue.description || undefined,
      url: issue.url,
      identifier: issue.identifier,
      priority: issue.priority,
      state: {
        id: state?.id || '',
        name: state?.name || 'Unknown'
      },
      team: {
        id: team?.id || '',
        name: team?.name || '',
        key: team?.key || ''
      },
      assignee: assignee ? {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
        displayName: assignee.displayName
      } : undefined,
      labels: [], // Would need to fetch separately if needed
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt
    } as LinearIssue;
  }
}
