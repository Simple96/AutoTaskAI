export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  owner: {
    login: string;
    id: number;
    html_url: string;
  };
}

export interface GitHubCommit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: 'open' | 'closed' | 'merged';
  user: {
    login: string;
    id: number;
    html_url: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
}

export interface GitHubWebhookPayload {
  action?: string;
  repository: GitHubRepository;
  commits?: GitHubCommit[];
  pull_request?: GitHubPullRequest;
  sender: {
    login: string;
    id: number;
    html_url: string;
  };
}

export type GitHubWebhookEvent = 'push' | 'pull_request' | 'issues' | 'release';
