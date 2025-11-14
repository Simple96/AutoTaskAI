import { LinearClient } from '@linear/sdk';
import { LinearConfig, CreateLinearIssueInput, LinearIssue } from '../types/linear';
import { LLMTaskSuggestion, LinearTaskSummary } from '../types/llm';

export class LinearService {
  private client: LinearClient;
  private config: LinearConfig;

  constructor(config: LinearConfig) {
    this.config = config;
    this.client = new LinearClient({
      apiKey: config.apiKey,
    });
  }

  async createTask(input: CreateLinearIssueInput): Promise<LinearIssue> {
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

      const issuePayloadResult = await this.client.createIssue(issuePayload);
      
      if (!issuePayloadResult.success) {
        throw new Error(`Failed to create Linear issue`);
      }

      const issue = await issuePayloadResult.issue;
      if (!issue) {
        throw new Error('Failed to retrieve created issue');
      }
      
      return await this.mapLinearIssue(issue);
    } catch (error) {
      console.error('Error creating Linear task:', error);
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
    const created: LinearIssue[] = [];
    const updated: LinearIssue[] = [];
    const errors: string[] = [];

    for (const suggestion of suggestions) {
      try {
        if (suggestion.confidence < 0.7) {
          console.log(`Skipping low confidence suggestion: ${suggestion.task.title} (confidence: ${suggestion.confidence})`);
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
          const issue = await this.createTask(taskInput);
          created.push(issue);
          console.log(`Created Linear task: ${issue.identifier} - ${issue.title}`);
        } else if (suggestion.action === 'update' && suggestion.existingTaskId) {
          const issue = await this.updateTask(suggestion.existingTaskId, taskInput);
          updated.push(issue);
          console.log(`Updated Linear task: ${issue.identifier} - ${issue.title}`);
        }
      } catch (error) {
        const errorMessage = `Failed to ${suggestion.action} task "${suggestion.task.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }

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
    try {
      const users = await this.client.users({
        filter: { displayName: { containsIgnoreCase: displayName } }
      });
      
      return users.nodes?.[0]?.id;
    } catch (error) {
      console.warn(`Could not find user with name: ${displayName}`);
      return undefined;
    }
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
              }
            }
          } catch (createError) {
            console.warn(`Could not create label: ${labelName}`, createError);
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
