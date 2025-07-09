import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { ReplicClaudeMaxServer } from './mcp/server.js';
import { ClaudeCodeBridge } from './claude-code/claudeCodeBridge.js';
import { ProjectManager } from './filesystem/projectManager.js';
import { TerminalManager } from './terminal/terminalManager.js';
import { WebSocketServer } from './websocket/socketServer.js';
import { createRoutes } from './api/routes.js';
import { Logger, logStartup, logShutdown } from './utils/logger.js';

const logger = new Logger('Server');

class MCPReplicLaudeServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private mcpServer: ReplicClaudeMaxServer;
  private claudeCodeBridge: ClaudeCodeBridge;
  private projectManager: ProjectManager;
  private terminalManager: TerminalManager;
  private webSocketServer: WebSocketServer;
  private port: number;
  private isShuttingDown = false;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001', 10);
    this.app = express();
    this.httpServer = createServer(this.app);
    
    // Initialize services
    this.claudeCodeBridge = new ClaudeCodeBridge();
    this.projectManager = new ProjectManager(process.env.PROJECTS_DIR || './projects');
    this.terminalManager = new TerminalManager();
    this.mcpServer = new ReplicClaudeMaxServer();
    
    // Initialize WebSocket server
    this.webSocketServer = new WebSocketServer(
      this.httpServer,
      this.claudeCodeBridge,
      this.terminalManager,
      this.projectManager
    );
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.logRequest(req.method, req.url, res.statusCode, duration);
      });
      
      next();
    });

    // Health check endpoint (before other routes)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', createRoutes(
      this.claudeCodeBridge,
      this.projectManager,
      this.terminalManager
    ));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'MCP Replit Claude Max Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/health',
          api: '/api',
          websocket: `ws://localhost:${this.port}`
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error:', error);
      
      if (res.headersSent) {
        return next(error);
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
      
      if (!this.isShuttingDown) {
        this.gracefulShutdown('unhandledRejection');
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      
      if (!this.isShuttingDown) {
        this.gracefulShutdown('uncaughtException');
      }
    });
  }

  private setupGracefulShutdown(): void {
    // Handle SIGTERM (Docker, Kubernetes)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });

    // Handle SIGHUP (service reload)
    process.on('SIGHUP', () => {
      logger.info('SIGHUP received');
      this.gracefulShutdown('SIGHUP');
    });
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logShutdown('MCP Replit Claude Max Server', signal);

    try {
      // Set a timeout for shutdown
      const shutdownTimeout = setTimeout(() => {
        logger.error('Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds

      // Stop accepting new connections
      this.httpServer.close(() => {
        logger.info('HTTP server closed');
      });

      // Cleanup services
      logger.info('Cleaning up services...');
      
      await Promise.all([
        this.mcpServer.stop(),
        this.claudeCodeBridge.cleanup(),
        this.terminalManager.cleanup(),
        this.projectManager.cleanup()
      ]);

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      logStartup('MCP Replit Claude Max Server', this.port);

      // Start Claude Code Bridge
      this.claudeCodeBridge.on('ready', () => {
        logger.info('✅ Claude Code Bridge ready');
      });

      this.claudeCodeBridge.on('error', (error) => {
        logger.error('❌ Claude Code Bridge error:', error);
      });

      // Start the HTTP server
      this.httpServer.listen(this.port, () => {
        logger.info(`🚀 Server running on port ${this.port}`);
        logger.info(`📡 WebSocket server ready`);
        logger.info(`🔧 API endpoints available at http://localhost:${this.port}/api`);
        logger.info(`📊 Health check available at http://localhost:${this.port}/health`);
        
        if (process.env.NODE_ENV === 'development') {
          logger.info(`🌐 Frontend URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
        }
      });

      // Start MCP server in background
      this.mcpServer.start().catch(error => {
        logger.error('Failed to start MCP server:', error);
      });

      // Setup periodic cleanup
      setInterval(() => {
        this.performPeriodicCleanup();
      }, 5 * 60 * 1000); // Every 5 minutes

      // Log startup completion
      logger.info('🎉 MCP Replit Claude Max Server started successfully');
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private performPeriodicCleanup(): void {
    try {
      logger.info('🧹 Performing periodic cleanup...');
      
      // Clean up idle terminal sessions
      const terminalsCleanedUp = this.terminalManager.cleanupIdleSessions();
      
      // Clean up idle WebSocket sessions
      const websocketsCleanedUp = this.webSocketServer.cleanupIdleSessions();
      
      if (terminalsCleanedUp > 0 || websocketsCleanedUp > 0) {
        logger.info(`✅ Cleanup completed: ${terminalsCleanedUp} terminals, ${websocketsCleanedUp} websockets`);
      }
      
      // Log current statistics
      const stats = {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        projects: this.projectManager.listProjects().length,
        claudeSessions: this.claudeCodeBridge.getActiveSessions().length,
        terminalSessions: this.terminalManager.getActiveSessions().length,
        websocketSessions: this.webSocketServer.getConnectedSessions().length
      };
      
      logger.info('📊 Current stats:', stats);
      
    } catch (error) {
      logger.error('Error during periodic cleanup:', error);
    }
  }
}

// Start the server
const server = new MCPReplicLaudeServer();
server.start().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});