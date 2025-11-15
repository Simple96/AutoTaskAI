# 🤖 AutoTaskAI

**Automatically turn GitHub commits into Linear tasks using AI**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Discord](https://img.shields.io/badge/Discord-Join%20Community-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/AfwxmZgYkJ)
[![Deploy](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Simple96/AutoTaskAI)

> GitHub commits → AI analysis → Linear tasks ✨

AutoTaskAI watches your GitHub repositories and automatically creates Linear tasks from commits and pull requests using GPT-4.

**Never manually create tasks from development work again!**

## ✨ Features

- 🔗 **GitHub Integration** - Listens to push and PR events
- 🤖 **AI Analysis** - GPT-4 understands your code changes
- 📋 **Linear Tasks** - Auto-creates and updates tasks
- 🏷️ **Smart Labels** - AI determines priority and categories
- ⚡ **Zero Maintenance** - Serverless deployment on Vercel

## 🔄 How it works

```
GitHub Push/PR → Webhook → AI Analysis → Linear Task
```

1. You push code or open a PR
2. AutoTaskAI receives the webhook
3. GPT-4 analyzes the changes
4. Creates or updates Linear tasks automatically

## 🚀 Quick Setup

### 1. Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Simple96/AutoTaskAI)

### 2. Add Environment Variables
In your Vercel dashboard, add:

```env
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
LINEAR_API_KEY=lin_api_your_linear_key_here  
LINEAR_TEAM_ID=your_team_uuid_here
OPENAI_API_KEY=sk-your_openai_key_here
```

**Get your API keys:**
- 🔑 [GitHub Webhook Secret](https://generate-secret.vercel.app/32) (generate random string)
- 🔑 [Linear API Key](https://linear.app/settings/api) (Personal API keys)
- 🔑 [OpenAI API Key](https://platform.openai.com/api-keys) (Create new key)

### 3. Setup GitHub Webhook
1. Go to your repo → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-vercel-url.vercel.app/api/webhook`
3. **Content type**: `application/json`
4. **Secret**: Same as your `GITHUB_WEBHOOK_SECRET`
5. **Events**: Select "Push" and "Pull requests"

### 4. Test
```bash
curl https://your-vercel-url.vercel.app/api/health
```

## 🛠️ Local Development

```bash
git clone https://github.com/Simple96/AutoTaskAI.git
cd AutoTaskAI
npm install
cp env.example .env  # Add your API keys
npm run dev          # Start development server
```

For webhook testing: `npx ngrok http 3000`

## 💡 Examples

**Your commit:** `fix: resolve user authentication timeout`  
**Generated task:** `🐛 Fix user authentication timeout` (High priority, bug label)

**Your PR:** `feat: add dark mode toggle`  
**Generated task:** `✨ Implement dark mode toggle` (Medium priority, feature label)

## 🔗 API Endpoints

- **`GET /`** - Welcome page with service status
- **`GET /api/health`** - Service health check
- **`GET /api/config`** - Configuration status
- **`GET /api/test-linear`** - Interactive Linear testing page
- **`POST /api/webhook`** - GitHub webhook endpoint

## 🚀 Getting Started

After deploying, visit your Vercel URL to:
- **Check service health** - See if all APIs are connected
- **Test Linear integration** - Create test tasks directly  
- **View configuration** - Debug any setup issues
- **Monitor webhook events** - Watch real-time processing

## 📖 Documentation

### Project Structure
```
api/          # Vercel serverless functions
├── webhook.ts    # GitHub webhook handler  
├── health.ts     # Health check
├── test-linear.ts # Linear testing page
└── config.ts     # Configuration check

src/          # Core services
├── services/     # Business logic
├── types/        # TypeScript types  
└── utils/        # Shared utilities
```

### Development Commands
```bash
npm run dev       # Start development server
npm run build     # Build TypeScript
npm run type-check # Validate types
```

## ⚙️ Customization

Modify AI behavior in `src/services/llm.ts` - adjust prompts, confidence thresholds, and task templates.

Control event processing in `src/services/orchestrator.ts` - filter repositories, branches, or authors.

## 🏥 Monitoring

- **`/api/health`** - Check service status
- **`/api/config`** - Verify environment variables  
- **Vercel Dashboard** - View function logs and metrics
- **GitHub Webhook** - Monitor delivery status in repo settings

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repo
2. Create a feature branch
3. Make your changes 
4. Run `npm run type-check`
5. Submit a PR

**Areas to contribute:**
- 🐛 Bug fixes
- ✨ New features  
- 📚 Documentation
- 🧪 Testing
- 🔧 Integrations (Jira, Asana, etc.)

## 💬 Community & Support

- 💬 **[Join our Discord](https://discord.gg/AfwxmZgYkJ)** - Get help and discuss features
- 🐛 **[Report Issues](https://github.com/Simple96/AutoTaskAI/issues)** - Bug reports and feature requests
- 📚 **[GitHub Discussions](https://github.com/Simple96/AutoTaskAI/discussions)** - General discussions

## 🗺️ Roadmap

**Coming Soon:**
- GitLab support
- Custom filtering rules  
- Analytics dashboard
- More integrations (Jira, Asana)
- Slack notifications

## 📄 License

ISC License - see [LICENSE](LICENSE) file

---

<div align="center">

**Made with ❤️ by the AutoTaskAI community**

[⭐ Star](https://github.com/Simple96/AutoTaskAI) • [💬 Discord](https://discord.gg/AfwxmZgYkJ) • [🐛 Issues](https://github.com/Simple96/AutoTaskAI/issues)

</div>

## 🔧 Troubleshooting

**Webhook 401 errors?** Check your `GITHUB_WEBHOOK_SECRET` matches GitHub settings

**Linear connection fails?** Use `/api/test-linear` to get your correct team UUID

**AI analysis failing?** Verify your `OPENAI_API_KEY` is valid

**Debug mode:** Set `LOG_LEVEL=debug` for detailed logs
