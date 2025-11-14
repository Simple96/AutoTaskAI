# AutoTaskAI

🤖 **AI-powered task generation from GitHub commits and pull requests**

AutoTaskAI automatically listens to your GitHub repository changes and uses AI to intelligently create or update Linear tasks based on commits, pull requests, and code changes. Never manually create tasks from development work again!

## ✨ Features

- **🔗 GitHub Integration**: Listens to push and pull request webhooks
- **🧠 AI Analysis**: Uses OpenAI GPT-4 to analyze code changes and generate meaningful tasks
- **📋 Linear Integration**: Automatically creates and updates Linear tasks
- **🎯 Smart Suggestions**: AI determines task priority, labels, and assignees
- **⚡ Serverless**: Runs on Vercel serverless functions
- **🔧 Configurable**: Customizable rules and templates

## 🏗️ Architecture

```
GitHub Webhook → Vercel Function → AI Analysis → Linear Task Creation/Update
```

1. **GitHub sends webhook** on push/PR events
2. **LLM analyzes** the changes and generates task suggestions
3. **Linear service** creates new tasks or updates existing ones

## 🚀 Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd AutoTaskAI
npm install
```

### 2. Environment Configuration

Copy the environment template:
```bash
cp env.example .env
```

Fill in your API keys in `.env`:

```env
# GitHub Configuration
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
GITHUB_TOKEN=ghp_your_github_token_optional

# Linear Configuration  
LINEAR_API_KEY=lin_api_your_linear_key_here
LINEAR_TEAM_ID=your_team_uuid_here
LINEAR_DEFAULT_ASSIGNEE_ID=optional_assignee_uuid

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_key_here
OPENAI_MODEL=gpt-4-turbo-preview

# App Configuration
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### 4. Setup GitHub Webhook

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook with:
   - **Payload URL**: `https://your-vercel-url.vercel.app/api/webhook`
   - **Content type**: `application/json`
   - **Secret**: Same as `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Push" and "Pull requests"

## 🔧 Configuration

### Getting API Keys

#### GitHub
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate token with `repo` scope (optional, for enhanced features)

#### Linear
1. Go to Linear → Settings → API → Personal API keys
2. Create new API key
3. Find your team ID in Linear → Settings → General

#### OpenAI
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create new API key

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | ✅ | Secret for GitHub webhook validation |
| `GITHUB_TOKEN` | ❌ | GitHub token for enhanced API access |
| `LINEAR_API_KEY` | ✅ | Linear API key for task management |
| `LINEAR_TEAM_ID` | ✅ | Linear team UUID |
| `LINEAR_DEFAULT_ASSIGNEE_ID` | ❌ | Default assignee for new tasks |
| `LINEAR_DEFAULT_PRIORITY` | ❌ | Default priority (1-4, default: 3) |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for AI analysis |
| `OPENAI_MODEL` | ❌ | OpenAI model (default: gpt-4-turbo-preview) |

## 🎯 How It Works

### 1. GitHub Event Processing
- Listens for `push` and `pull_request` events
- Extracts commit messages, file changes, PR descriptions
- Filters relevant information for AI analysis

### 2. AI Analysis
The AI analyzes:
- **Commit messages** for task clues
- **Code changes** for complexity and scope  
- **File patterns** for categorization
- **Existing tasks** to avoid duplicates

AI generates:
- Task titles and descriptions
- Priority levels (1-4)
- Appropriate labels
- Assignee suggestions
- Update vs. create decisions

### 3. Linear Task Management
- **Creates new tasks** for new features/bugs
- **Updates existing tasks** when related changes occur
- **Sets appropriate metadata** (priority, labels, assignee)
- **Links back to GitHub** for traceability

## 📊 API Endpoints

### `POST /api/webhook`
GitHub webhook endpoint for processing repository events.

**Headers:**
- `X-GitHub-Event`: Event type
- `X-Hub-Signature-256`: Webhook signature

### `GET /api/health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "llm": "healthy",
    "linear": "healthy"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

### Testing

```bash
# Test webhook locally with ngrok
npx ngrok http 3000

# Use ngrok URL for GitHub webhook during development
```

## 🎨 Customization

### AI Prompts
Modify the AI analysis behavior in `src/services/llm.ts`:
- Adjust system prompts
- Change analysis criteria
- Modify task suggestion logic

### Task Templates
Customize task creation in `src/services/linear.ts`:
- Task description templates
- Label assignment rules
- Priority calculation logic

### Event Filtering
Control which events trigger task creation in `src/services/orchestrator.ts`:
- Repository filtering
- Branch filtering
- Author filtering

## 🔍 Monitoring

### Logs
- Check Vercel function logs for processing details
- Monitor OpenAI API usage
- Track Linear API rate limits

### Health Checks
- Use `/api/health` endpoint for monitoring
- Set up alerts for service degradation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Webhook not receiving events:**
- Verify webhook URL is correct
- Check webhook secret matches environment variable
- Ensure Vercel function is deployed successfully

**AI analysis failing:**
- Verify OpenAI API key is valid
- Check API usage limits
- Monitor function timeout (increase if needed)

**Linear tasks not created:**
- Verify Linear API key and team ID
- Check user permissions in Linear
- Ensure team ID is correct UUID format

**Memory/timeout issues:**
- Reduce batch size for large commits
- Optimize AI prompt length
- Consider function memory settings

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging:

```env
LOG_LEVEL=debug
```
