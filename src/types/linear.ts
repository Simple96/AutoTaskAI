export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  url: string;
  identifier: string;
  priority: number;
  state: {
    id: string;
    name: string;
  };
  team: LinearTeam;
  assignee?: LinearUser;
  labels: LinearLabel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLinearIssueInput {
  title: string;
  description?: string;
  teamId: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  projectId?: string;
}

export interface LinearConfig {
  apiKey: string;
  teamId?: string;
  defaultAssigneeId?: string;
  defaultPriority?: number;
  defaultLabelIds?: string[];
}
