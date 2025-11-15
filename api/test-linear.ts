import { VercelRequest, VercelResponse } from '@vercel/node';
import { LinearService } from '../src/services/linear';
import { loadConfig, validateConfig } from '../src/utils/config';
import { logger } from '../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info('Linear test request received', {
    service: 'LinearTestAPI',
    action: 'test_request',
    method: req.method
  });

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // GET: Show test form
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoTaskAI - Linear Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8fafc;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .test-section {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
        h2 {
            color: #334155;
            margin-bottom: 1rem;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #374151;
        }
        input, textarea, select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
        }
        textarea {
            min-height: 100px;
            resize: vertical;
        }
        button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
        }
        button:hover {
            background: #2563eb;
        }
        button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        .result {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 6px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
        }
        .success {
            background: #ecfdf5;
            border: 1px solid #10b981;
            color: #065f46;
        }
        .error {
            background: #fef2f2;
            border: 1px solid #ef4444;
            color: #991b1b;
        }
        .info {
            background: #eff6ff;
            border: 1px solid #3b82f6;
            color: #1e40af;
        }
        .loading {
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AutoTaskAI - Linear Connection Test</h1>
        <p>Test AutoTaskAI connection to Linear and task creation functionality</p>
    </div>

    <div class="test-section">
        <h2>📋 Create Test Task</h2>
        <form id="testForm">
            <div class="form-group">
                <label for="title">Task Title *</label>
                <input type="text" id="title" name="title" value="AutoTaskAI Test Task" required>
            </div>
            
            <div class="form-group">
                <label for="description">Task Description</label>
                <textarea id="description" name="description" placeholder="This is a test task created via AutoTaskAI...">This is a test task created via AutoTaskAI.

🎯 Objective: Verify AutoTaskAI to Linear connection
📅 Created: ${new Date().toLocaleString()}
🔧 Tool: AutoTaskAI test page</textarea>
            </div>
            
            <div class="form-group">
                <label for="priority">Priority</label>
                <select id="priority" name="priority">
                    <option value="4">Low (4)</option>
                    <option value="3" selected>Medium (3)</option>
                    <option value="2">High (2)</option>
                    <option value="1">Urgent (1)</option>
                </select>
            </div>
            
            <button type="submit">🚀 Create Test Task</button>
            <button type="button" onclick="testConnection()">🔍 Test Connection</button>
            <button type="button" onclick="getTeams()">👥 Get Team Info</button>
        </form>
        
        <div id="result"></div>
    </div>

    <div class="test-section">
        <h2>🏥 Service Status</h2>
        <button onclick="checkHealth()">Check Health</button>
        <button onclick="checkConfig()">Check Configuration</button>
        <div id="healthResult"></div>
    </div>

    <script>
        // Create test task
        document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const resultDiv = document.getElementById('result');
            
            resultDiv.innerHTML = '<div class="info loading">Creating task...</div>';
            
            try {
                const response = await fetch('/api/test-linear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'create',
                        title: formData.get('title'),
                        description: formData.get('description'),
                        priority: parseInt(formData.get('priority'))
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    resultDiv.innerHTML = \`<div class="success">✅ Task created successfully!
                    
Task ID: \${result.task.id}
Task Identifier: \${result.task.identifier}
Task URL: \${result.task.url}

Full Response:
\${JSON.stringify(result, null, 2)}</div>\`;
                } else {
                    resultDiv.innerHTML = \`<div class="error">❌ Creation failed: \${result.error || result.message}

Details:
\${JSON.stringify(result, null, 2)}</div>\`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`<div class="error">❌ Request failed: \${error.message}</div>\`;
            }
        });

        // Test connection
        async function testConnection() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="info loading">Testing connection...</div>';
            
            try {
                const response = await fetch('/api/test-linear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'test' })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    resultDiv.innerHTML = \`<div class="success">✅ Linear connection working!
                    
\${JSON.stringify(result, null, 2)}</div>\`;
                } else {
                    resultDiv.innerHTML = \`<div class="error">❌ Connection failed: \${result.error}
                    
\${JSON.stringify(result, null, 2)}</div>\`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`<div class="error">❌ Test failed: \${error.message}</div>\`;
            }
        }

        // Get teams info
        async function getTeams() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="info loading">Getting team information...</div>';
            
            try {
                const response = await fetch('/api/test-linear', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'teams' })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    resultDiv.innerHTML = \`<div class="info">📋 Team Information:
                    
\${JSON.stringify(result.teams, null, 2)}

💡 Tip: Use the UUID from above as your LINEAR_TEAM_ID</div>\`;
                } else {
                    resultDiv.innerHTML = \`<div class="error">❌ Failed to get teams: \${result.error}
                    
\${JSON.stringify(result, null, 2)}</div>\`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`<div class="error">❌ Request failed: \${error.message}</div>\`;
            }
        }

        // Check health
        async function checkHealth() {
            const resultDiv = document.getElementById('healthResult');
            resultDiv.innerHTML = '<div class="info loading">Checking health...</div>';
            
            try {
                const response = await fetch('/api/health');
                const result = await response.json();
                
                const statusClass = result.status === 'healthy' ? 'success' : 'error';
                resultDiv.innerHTML = \`<div class="\${statusClass}">Health Status: \${result.status}
                
\${JSON.stringify(result, null, 2)}</div>\`;
            } catch (error) {
                resultDiv.innerHTML = \`<div class="error">❌ Health check failed: \${error.message}</div>\`;
            }
        }

        // Check config
        async function checkConfig() {
            const resultDiv = document.getElementById('healthResult');
            resultDiv.innerHTML = '<div class="info loading">Checking configuration...</div>';
            
            try {
                const response = await fetch('/api/config');
                const result = await response.json();
                
                const statusClass = result.configurationScore === 100 ? 'success' : 'error';
                resultDiv.innerHTML = \`<div class="\${statusClass}">Configuration Status: \${result.status} (\${result.configurationScore}%)
                
\${JSON.stringify(result, null, 2)}</div>\`;
            } catch (error) {
                resultDiv.innerHTML = \`<div class="error">❌ Configuration check failed: \${error.message}</div>\`;
            }
        }
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
    
  } else if (req.method === 'POST') {
    // POST: Handle test actions
    try {
      const config = loadConfig();
      validateConfig(config);
      
      const linearService = new LinearService(config.linear);
      const { action, title, description, priority } = req.body;

      logger.info('Linear test action requested', {
        service: 'LinearTestAPI',
        action: 'test_action_start',
        testAction: action
      });

      switch (action) {
        case 'test':
          // Simple connection test
          try {
            await linearService.getTasksByRepository('test', 1);
            return res.status(200).json({
              success: true,
              message: 'Linear connection working',
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.error('Linear connection test failed', {
              action: 'connection_test_failed'
            }, error as Error);
            
            return res.status(400).json({
              success: false,
              error: 'Linear connection failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }

        case 'teams':
          // Get teams info to help find correct team ID
          try {
            const client = new (require('@linear/sdk').LinearClient)({
              apiKey: config.linear.apiKey
            });
            
            const teamsResult = await client.teams();
            const teams = teamsResult.nodes?.map((team: any) => ({
              id: team.id,
              name: team.name,
              key: team.key,
              description: team.description
            })) || [];

            logger.info('Teams retrieved successfully', {
              action: 'teams_retrieved',
              teamsCount: teams.length
            });

            return res.status(200).json({
              success: true,
              teams,
              message: `Found ${teams.length} teams`,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.error('Failed to get teams', {
              action: 'get_teams_failed'
            }, error as Error);
            
            return res.status(400).json({
              success: false,
              error: 'Failed to get team information',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }

        case 'create':
          // Create test task
          if (!title) {
            return res.status(400).json({
              success: false,
              error: 'Task title is required'
            });
          }

          try {
            const task = await linearService.createTask({
              title: title || 'AutoTaskAI Test Task',
              description: description || 'This is a test task created via AutoTaskAI',
              teamId: config.linear.teamId!,
              priority: priority || 3
            });

            logger.info('Test task created successfully', {
              action: 'test_task_created',
              taskId: task.id,
              taskIdentifier: task.identifier
            });

            return res.status(200).json({
              success: true,
              message: 'Task created successfully!',
              task: {
                id: task.id,
                identifier: task.identifier,
                title: task.title,
                url: task.url,
                priority: task.priority,
                state: task.state?.name
              },
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.error('Test task creation failed', {
              action: 'test_task_failed',
              title
            }, error as Error);
            
            return res.status(400).json({
              success: false,
              error: 'Task creation failed',
              details: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            });
          }

        default:
          return res.status(400).json({
            success: false,
            error: 'Unknown test action'
          });
      }
    } catch (configError) {
      logger.error('Configuration error in Linear test', {
        action: 'config_error'
      }, configError as Error);
      
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        details: configError instanceof Error ? configError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
