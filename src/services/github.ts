// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Webhooks, createNodeMiddleware } = require('@octokit/webhooks');
import { IncomingMessage, ServerResponse } from 'http';
import {
  GitHubWebhookPayload,
  GitHubCommit,
  GitHubPullRequest,
  GitHubRepository
} from '../types/github';

export class GitHubWebhookService {
  private webhooks: any;

  constructor(
    secret: string,
    private onPush?: (payload: GitHubWebhookPayload) => Promise<void>,
    private onPullRequest?: (payload: GitHubWebhookPayload) => Promise<void>
  ) {
    this.webhooks = new Webhooks({
      secret,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle push events (commits)
    this.webhooks.on('push', async ({ payload }: { payload: any }) => {
      console.log(`Received push event for ${payload.repository.full_name}`);
      
      if (this.onPush) {
        const transformedPayload = this.transformPushPayload(payload);
        await this.onPush(transformedPayload);
      }
    });

    // Handle pull request events
    this.webhooks.on('pull_request', async ({ payload }: { payload: any }) => {
      console.log(`Received pull_request event for ${payload.repository.full_name}: ${payload.action}`);
      
      if (this.onPullRequest && this.shouldProcessPRAction(payload.action)) {
        const transformedPayload = this.transformPullRequestPayload(payload);
        await this.onPullRequest(transformedPayload);
      }
    });

    // Handle errors
    this.webhooks.onError((error: any) => {
      console.error('GitHub webhook error:', error);
    });
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
    return processedActions.includes(action);
  }

  getMiddleware() {
    return createNodeMiddleware(this.webhooks);
  }

  // For Vercel serverless functions
  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const middleware = this.getMiddleware();
    return new Promise((resolve, reject) => {
      middleware(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
