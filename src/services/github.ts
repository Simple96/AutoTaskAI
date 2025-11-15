// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Webhooks, createNodeMiddleware } = require('@octokit/webhooks');
import { IncomingMessage, ServerResponse } from 'http';
import {
  GitHubWebhookPayload,
  GitHubCommit,
  GitHubPullRequest,
  GitHubRepository
} from '../types/github';
import { createLogger } from '../utils/logger';

export class GitHubWebhookService {
  private webhooks: any;
  private logger = createLogger('GitHubWebhookService');

  constructor(
    secret: string,
    private onPush?: (payload: GitHubWebhookPayload) => Promise<void>,
    private onPullRequest?: (payload: GitHubWebhookPayload) => Promise<void>
  ) {
    this.logger.info('Initializing GitHub webhook service');
    
    this.webhooks = new Webhooks({
      secret,
    });

    this.setupEventHandlers();
    this.logger.info('GitHub webhook service initialized successfully');
  }

  private setupEventHandlers(): void {
    this.logger.debug('Setting up GitHub webhook event handlers');
    
    // Handle push events (commits)
    this.webhooks.on('push', async ({ payload }: { payload: any }) => {
      const requestId = this.generateRequestId();
      
      this.logger.webhookReceived('push', payload.repository.full_name, requestId);
      this.logger.debug('Processing push event', {
        action: 'push_received',
        repository: payload.repository.full_name,
        commitsCount: payload.commits?.length || 0,
        ref: payload.ref,
        requestId
      });
      
      if (this.onPush) {
        try {
          const transformedPayload = this.transformPushPayload(payload);
          await this.onPush(transformedPayload);
          
          this.logger.info('Push event processed successfully', {
            action: 'push_processed',
            repository: payload.repository.full_name,
            requestId
          });
        } catch (error) {
          this.logger.error('Failed to process push event', {
            action: 'push_failed',
            repository: payload.repository.full_name,
            requestId
          }, error as Error);
        }
      } else {
        this.logger.warn('No push handler configured', {
          action: 'push_ignored',
          repository: payload.repository.full_name,
          requestId
        });
      }
    });

    // Handle pull request events
    this.webhooks.on('pull_request', async ({ payload }: { payload: any }) => {
      const requestId = this.generateRequestId();
      
      this.logger.webhookReceived('pull_request', payload.repository.full_name, requestId);
      this.logger.debug('Processing pull request event', {
        action: 'pr_received',
        repository: payload.repository.full_name,
        prAction: payload.action,
        prNumber: payload.pull_request?.number,
        requestId
      });
      
      if (this.onPullRequest && this.shouldProcessPRAction(payload.action)) {
        try {
          const transformedPayload = this.transformPullRequestPayload(payload);
          await this.onPullRequest(transformedPayload);
          
          this.logger.info('Pull request event processed successfully', {
            action: 'pr_processed',
            repository: payload.repository.full_name,
            prAction: payload.action,
            prNumber: payload.pull_request?.number,
            requestId
          });
        } catch (error) {
          this.logger.error('Failed to process pull request event', {
            action: 'pr_failed',
            repository: payload.repository.full_name,
            prAction: payload.action,
            requestId
          }, error as Error);
        }
      } else {
        this.logger.debug('Pull request event ignored', {
          action: 'pr_ignored',
          repository: payload.repository.full_name,
          prAction: payload.action,
          reason: this.onPullRequest ? 'action_not_processed' : 'no_handler',
          requestId
        });
      }
    });

    // Handle errors
    this.webhooks.onError((error: any) => {
      this.logger.error('GitHub webhook error occurred', {
        action: 'webhook_error'
      }, error);
    });
    
    this.logger.debug('GitHub webhook event handlers configured');
  }

  private transformPushPayload(payload: any): GitHubWebhookPayload {
    return {
      repository: this.transformRepository(payload.repository),
      commits: payload.commits?.map((commit: any) => this.transformCommit(commit)) || [],
      sender: {
        login: payload.sender.login,
        id: payload.sender.id,
        html_url: payload.sender.html_url
      }
    };
  }

  private transformPullRequestPayload(payload: any): GitHubWebhookPayload {
    return {
      action: payload.action,
      repository: this.transformRepository(payload.repository),
      pull_request: this.transformPullRequest(payload.pull_request),
      sender: {
        login: payload.sender.login,
        id: payload.sender.id,
        html_url: payload.sender.html_url
      }
    };
  }

  private transformRepository(repo: any): GitHubRepository {
    return {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      owner: {
        login: repo.owner.login,
        id: repo.owner.id,
        html_url: repo.owner.html_url
      }
    };
  }

  private transformCommit(commit: any): GitHubCommit {
    return {
      id: commit.id,
      message: commit.message,
      timestamp: commit.timestamp,
      url: commit.url,
      author: {
        name: commit.author.name,
        email: commit.author.email,
        username: commit.author.username
      },
      added: commit.added || [],
      removed: commit.removed || [],
      modified: commit.modified || []
    };
  }

  private transformPullRequest(pr: any): GitHubPullRequest {
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      html_url: pr.html_url,
      state: pr.state,
      user: {
        login: pr.user.login,
        id: pr.user.id,
        html_url: pr.user.html_url
      },
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha
      },
      base: {
        ref: pr.base.ref,
        sha: pr.base.sha
      },
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      merged_at: pr.merged_at
    };
  }

  private shouldProcessPRAction(action: string): boolean {
    // Process these PR actions
    const processedActions = ['opened', 'closed', 'reopened', 'synchronize', 'ready_for_review'];
    const shouldProcess = processedActions.includes(action);
    
    this.logger.debug('Evaluating PR action for processing', {
      action: 'pr_action_check',
      prAction: action,
      shouldProcess,
      processedActions
    });
    
    return shouldProcess;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  getMiddleware() {
    return createNodeMiddleware(this.webhooks);
  }

  // For Vercel serverless functions
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const middleware = this.getMiddleware();
    return new Promise((resolve, reject) => {
      middleware(req, res, (err: any) => {
        if (err) {
          this.logger.error('GitHub webhook middleware error', {
            action: 'middleware_error'
          }, err);
          reject(err);
        } else {
          this.logger.debug('GitHub webhook middleware completed', {
            action: 'middleware_completed'
          });
          resolve();
        }
      });
    });
  }
}
