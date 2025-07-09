import express from 'express';
import { ClaudeCodeBridge } from '../claude-code/claudeCodeBridge.js';
import { ProjectManager } from '../filesystem/projectManager.js';
import { TerminalManager } from '../terminal/terminalManager.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('APIRoutes');

export function createRoutes(
  claudeCodeBridge: ClaudeCodeBridge,
  projectManager: ProjectManager,
  terminalManager: TerminalManager
): express.Router {
  const router = express.Router();

  // Middleware for request logging
  router.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.logRequest(req.method, req.path, res.statusCode, duration);
    });
    next();
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        claudeCode: claudeCodeBridge.getActiveSessions().length,
        terminals: terminalManager.getActiveSessions().length,
        projects: projectManager.listProjects().length
      }
    });
  });

  // Project endpoints
  router.get('/projects', async (req, res) => {
    try {
      const projects = await projectManager.listProjects();
      res.json(projects);
    } catch (error) {
      logger.error('Failed to list projects:', error);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  router.post('/projects', async (req, res) => {
    try {
      const { name, template = 'empty', description } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      const projectId = await projectManager.createProject(name, template, description);
      const projectInfo = await projectManager.getProjectInfo(projectId);
      
      res.json({ projectId, project: projectInfo });
    } catch (error) {
      logger.error('Failed to create project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  router.get('/projects/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const projectInfo = await projectManager.getProjectInfo(projectId);
      res.json(projectInfo);
    } catch (error) {
      logger.error(`Failed to get project ${req.params.projectId}:`, error);
      res.status(404).json({ error: 'Project not found' });
    }
  });

  router.delete('/projects/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      await projectManager.deleteProject(projectId);
      res.json({ success: true });
    } catch (error) {
      logger.error(`Failed to delete project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // File system endpoints
  router.get('/files/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { path = '.' } = req.query;
      
      const files = await projectManager.listFiles(projectId, path as string);
      res.json(files);
    } catch (error) {
      logger.error(`Failed to list files for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  router.get('/files/:projectId/*', async (req, res) => {
    try {
      const { projectId } = req.params;
      const filePath = req.params[0];
      
      const content = await projectManager.readFile(projectId, filePath);
      res.json({ content });
    } catch (error) {
      logger.error(`Failed to read file ${req.params[0]} from project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  router.put('/files/:projectId/*', async (req, res) => {
    try {
      const { projectId } = req.params;
      const filePath = req.params[0];
      const { content } = req.body;
      
      if (content === undefined) {
        return res.status(400).json({ error: 'Content is required' });
      }

      await projectManager.writeFile(projectId, filePath, content);
      res.json({ success: true });
    } catch (error) {
      logger.error(`Failed to write file ${req.params[0]} to project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to write file' });
    }
  });

  // Terminal endpoints
  router.post('/terminal/:projectId/create', async (req, res) => {
    try {
      const { projectId } = req.params;
      const projectPath = projectManager.getProjectPath(projectId);
      
      const sessionId = terminalManager.createSession(projectId, projectPath);
      res.json({ sessionId });
    } catch (error) {
      logger.error(`Failed to create terminal session for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to create terminal session' });
    }
  });

  router.get('/terminal/:projectId/sessions', (req, res) => {
    try {
      const { projectId } = req.params;
      const sessions = terminalManager.getProjectSessions(projectId);
      res.json(sessions);
    } catch (error) {
      logger.error(`Failed to get terminal sessions for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to get terminal sessions' });
    }
  });

  router.post('/terminal/:sessionId/kill', (req, res) => {
    try {
      const { sessionId } = req.params;
      const killed = terminalManager.killSession(sessionId);
      res.json({ success: killed });
    } catch (error) {
      logger.error(`Failed to kill terminal session ${req.params.sessionId}:`, error);
      res.status(500).json({ error: 'Failed to kill terminal session' });
    }
  });

  router.post('/terminal/:projectId/execute', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const result = await terminalManager.executeCommand(projectId, command);
      res.json({ result });
    } catch (error) {
      logger.error(`Failed to execute command in project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to execute command' });
    }
  });

  // Claude Code endpoints
  router.post('/claude-code/:projectId/execute', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { command, interactive = false } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const projectPath = projectManager.getProjectPath(projectId);
      const result = await claudeCodeBridge.executeCommand(
        projectId,
        command,
        projectPath,
        interactive
      );
      
      res.json({ result });
    } catch (error) {
      logger.error(`Failed to execute Claude Code command for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to execute Claude Code command' });
    }
  });

  router.post('/claude-code/:projectId/start-session', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { context } = req.body;
      
      const projectPath = projectManager.getProjectPath(projectId);
      
      await claudeCodeBridge.startInteractiveSession(
        projectId,
        projectPath,
        (output) => logger.info('Claude output:', output),
        (error) => logger.error('Claude error:', error)
      );
      
      res.json({ success: true, message: 'Claude Code session started' });
    } catch (error) {
      logger.error(`Failed to start Claude Code session for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to start Claude Code session' });
    }
  });

  router.post('/claude-code/:projectId/send-message', (req, res) => {
    try {
      const { projectId } = req.params;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const sent = claudeCodeBridge.sendToSession(projectId, message);
      
      if (sent) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'No active session for this project' });
      }
    } catch (error) {
      logger.error(`Failed to send message to Claude Code session for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  router.post('/claude-code/:projectId/stop-session', (req, res) => {
    try {
      const { projectId } = req.params;
      
      const terminated = claudeCodeBridge.terminateSession(projectId);
      
      res.json({ success: terminated });
    } catch (error) {
      logger.error(`Failed to stop Claude Code session for project ${req.params.projectId}:`, error);
      res.status(500).json({ error: 'Failed to stop Claude Code session' });
    }
  });

  router.get('/claude-code/sessions', (req, res) => {
    try {
      const activeSessions = claudeCodeBridge.getActiveSessions();
      const sessionStats = claudeCodeBridge.getSessionStats();
      
      res.json({ 
        sessions: activeSessions,
        stats: sessionStats
      });
    } catch (error) {
      logger.error('Failed to get Claude Code sessions:', error);
      res.status(500).json({ error: 'Failed to get Claude Code sessions' });
    }
  });

  router.get('/claude-code/health', async (req, res) => {
    try {
      const health = await claudeCodeBridge.healthCheck();
      res.json(health);
    } catch (error) {
      logger.error('Claude Code health check failed:', error);
      res.status(500).json({ error: 'Claude Code health check failed' });
    }
  });

  // Statistics endpoints
  router.get('/stats', (req, res) => {
    try {
      const stats = {
        projects: projectManager.listProjects().length,
        claudeCodeSessions: claudeCodeBridge.getActiveSessions().length,
        terminalSessions: terminalManager.getActiveSessions().length,
        timestamp: new Date().toISOString()
      };
      
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  router.get('/stats/detailed', async (req, res) => {
    try {
      const projects = await projectManager.listProjects();
      const claudeCodeStats = claudeCodeBridge.getSessionStats();
      const terminalStats = terminalManager.getSessionStats();
      
      const stats = {
        projects: {
          total: projects.length,
          active: projects.filter(p => p.status === 'active').length,
          templates: projects.reduce((acc, p) => {
            acc[p.template] = (acc[p.template] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        claudeCode: claudeCodeStats,
        terminals: terminalStats,
        timestamp: new Date().toISOString()
      };
      
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get detailed statistics:', error);
      res.status(500).json({ error: 'Failed to get detailed statistics' });
    }
  });

  // Error handling middleware
  router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('API route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return router;
}