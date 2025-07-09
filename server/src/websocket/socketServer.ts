import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ClaudeCodeBridge } from '../claude-code/claudeCodeBridge.js';
import { TerminalManager } from '../terminal/terminalManager.js';
import { ProjectManager } from '../filesystem/projectManager.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('WebSocketServer');

export interface SocketSession {
  socketId: string;
  projectId?: string;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private claudeCodeBridge: ClaudeCodeBridge;
  private terminalManager: TerminalManager;
  private projectManager: ProjectManager;
  private sessions: Map<string, SocketSession> = new Map();

  constructor(
    httpServer: HTTPServer,
    claudeCodeBridge: ClaudeCodeBridge,
    terminalManager: TerminalManager,
    projectManager: ProjectManager
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3030",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.claudeCodeBridge = claudeCodeBridge;
    this.terminalManager = terminalManager;
    this.projectManager = projectManager;
    
    this.setupEventHandlers();
    this.setupClaudeCodeEvents();
    this.setupTerminalEvents();
    this.setupProjectEvents();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const socketSession: SocketSession = {
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date()
      };
      
      this.sessions.set(socket.id, socketSession);
      logger.info(`🔌 Client connected: ${socket.id}`);

      // Update activity on any event
      const updateActivity = () => {
        const session = this.sessions.get(socket.id);
        if (session) {
          session.lastActivity = new Date();
        }
      };

      // Project events
      socket.on('join_project', (projectId: string) => {
        updateActivity();
        socket.join(`project_${projectId}`);
        socketSession.projectId = projectId;
        logger.info(`📁 Socket ${socket.id} joined project ${projectId}`);
      });

      socket.on('leave_project', (projectId: string) => {
        updateActivity();
        socket.leave(`project_${projectId}`);
        socketSession.projectId = undefined;
        logger.info(`📁 Socket ${socket.id} left project ${projectId}`);
      });

      // Terminal events
      socket.on('join_terminal', (sessionId: string) => {
        updateActivity();
        socket.join(`terminal_${sessionId}`);
        logger.info(`🖥️  Socket ${socket.id} joined terminal ${sessionId}`);
      });

      socket.on('leave_terminal', (sessionId: string) => {
        updateActivity();
        socket.leave(`terminal_${sessionId}`);
        logger.info(`🖥️  Socket ${socket.id} left terminal ${sessionId}`);
      });

      socket.on('terminal_input', ({ sessionId, data }) => {
        updateActivity();
        const success = this.terminalManager.writeToSession(sessionId, data);
        if (!success) {
          socket.emit('terminal_error', { sessionId, error: 'Session not found or inactive' });
        }
      });

      socket.on('terminal_resize', ({ sessionId, cols, rows }) => {
        updateActivity();
        this.terminalManager.resizeSession(sessionId, cols, rows);
      });

      socket.on('terminal_clear', (sessionId: string) => {
        updateActivity();
        this.terminalManager.clearSession(sessionId);
      });

      socket.on('terminal_interrupt', (sessionId: string) => {
        updateActivity();
        this.terminalManager.interruptSession(sessionId);
      });

      // Claude Code events
      socket.on('claude_code_execute', async ({ projectId, command, interactive = false }) => {
        updateActivity();
        try {
          const projectPath = this.projectManager.getProjectPath(projectId);
          const result = await this.claudeCodeBridge.executeCommand(
            projectId,
            command,
            projectPath,
            interactive
          );
          socket.emit('claude_code_result', { projectId, success: true, result });
        } catch (error) {
          logger.error(`Claude Code execution failed for project ${projectId}:`, error);
          socket.emit('claude_code_result', { 
            projectId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      socket.on('claude_code_start_session', async (projectId: string) => {
        updateActivity();
        try {
          const projectPath = this.projectManager.getProjectPath(projectId);
          
          await this.claudeCodeBridge.startInteractiveSession(
            projectId,
            projectPath,
            (output) => {
              this.io.to(`project_${projectId}`).emit('claude_code_output', { 
                projectId, 
                type: 'stdout', 
                data: output 
              });
            },
            (error) => {
              this.io.to(`project_${projectId}`).emit('claude_code_output', { 
                projectId, 
                type: 'stderr', 
                data: error 
              });
            }
          );
          
          socket.emit('claude_code_session_started', { projectId, success: true });
        } catch (error) {
          logger.error(`Failed to start Claude Code session for project ${projectId}:`, error);
          socket.emit('claude_code_session_started', { 
            projectId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      socket.on('claude_code_send_message', ({ projectId, message }) => {
        updateActivity();
        const sent = this.claudeCodeBridge.sendToSession(projectId, message);
        if (!sent) {
          socket.emit('claude_code_error', { 
            projectId, 
            error: 'No active Claude Code session' 
          });
        }
      });

      socket.on('claude_code_stop_session', (projectId: string) => {
        updateActivity();
        const stopped = this.claudeCodeBridge.terminateSession(projectId);
        socket.emit('claude_code_session_stopped', { projectId, success: stopped });
      });

      // File system events
      socket.on('watch_file', ({ projectId, filePath }) => {
        updateActivity();
        socket.join(`file_${projectId}_${filePath}`);
        logger.info(`👁️  Socket ${socket.id} watching file ${filePath} in project ${projectId}`);
      });

      socket.on('unwatch_file', ({ projectId, filePath }) => {
        updateActivity();
        socket.leave(`file_${projectId}_${filePath}`);
        logger.info(`👁️  Socket ${socket.id} stopped watching file ${filePath} in project ${projectId}`);
      });

      // Health check
      socket.on('ping', () => {
        updateActivity();
        socket.emit('pong');
      });

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        logger.info(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
        this.sessions.delete(socket.id);
      });

      // Error handler
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    logger.info('🚀 WebSocket server event handlers set up');
  }

  private setupClaudeCodeEvents() {
    // Claude Code Bridge events
    this.claudeCodeBridge.on('stdout', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('claude_code_output', { 
        projectId, 
        type: 'stdout', 
        data 
      });
    });

    this.claudeCodeBridge.on('stderr', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('claude_code_output', { 
        projectId, 
        type: 'stderr', 
        data 
      });
    });

    this.claudeCodeBridge.on('session-ended', (projectId, code) => {
      this.io.to(`project_${projectId}`).emit('claude_code_session_ended', { 
        projectId, 
        exitCode: code 
      });
    });

    this.claudeCodeBridge.on('session-error', (projectId, error) => {
      this.io.to(`project_${projectId}`).emit('claude_code_error', { 
        projectId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });

    this.claudeCodeBridge.on('interactive-output', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('claude_code_interactive_output', { 
        projectId, 
        data 
      });
    });

    this.claudeCodeBridge.on('interactive-error', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('claude_code_interactive_error', { 
        projectId, 
        data 
      });
    });

    logger.info('🤖 Claude Code Bridge events connected to WebSocket');
  }

  private setupTerminalEvents() {
    // Terminal Manager events
    this.terminalManager.on('terminal-output', (sessionId, data) => {
      this.io.to(`terminal_${sessionId}`).emit('terminal_output', data);
    });

    this.terminalManager.on('terminal-exit', (sessionId, exitCode) => {
      this.io.to(`terminal_${sessionId}`).emit('terminal_exit', { sessionId, exitCode });
    });

    this.terminalManager.on('session-created', (sessionId, session) => {
      this.io.to(`project_${session.projectId}`).emit('terminal_session_created', { 
        sessionId, 
        projectId: session.projectId 
      });
    });

    this.terminalManager.on('session-killed', (sessionId) => {
      this.io.to(`terminal_${sessionId}`).emit('terminal_session_killed', { sessionId });
    });

    this.terminalManager.on('command-output', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('command_output', { projectId, data });
    });

    this.terminalManager.on('command-error', (projectId, data) => {
      this.io.to(`project_${projectId}`).emit('command_error', { projectId, data });
    });

    this.terminalManager.on('command-executed', (projectId, command, result) => {
      this.io.to(`project_${projectId}`).emit('command_executed', { 
        projectId, 
        command, 
        result 
      });
    });

    this.terminalManager.on('command-failed', (projectId, command, error) => {
      this.io.to(`project_${projectId}`).emit('command_failed', { 
        projectId, 
        command, 
        error 
      });
    });

    logger.info('🖥️  Terminal Manager events connected to WebSocket');
  }

  private setupProjectEvents() {
    // Project Manager events
    this.projectManager.on('project-created', (projectId, info) => {
      this.io.emit('project_created', { projectId, info });
    });

    this.projectManager.on('project-deleted', (projectId) => {
      this.io.emit('project_deleted', { projectId });
    });

    logger.info('📁 Project Manager events connected to WebSocket');
  }

  /**
   * Send message to all clients in a room
   */
  public sendToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  /**
   * Send message to a specific socket
   */
  public sendToSocket(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Get connected sessions
   */
  public getConnectedSessions(): SocketSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions for a specific project
   */
  public getProjectSessions(projectId: string): SocketSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.projectId === projectId
    );
  }

  /**
   * Get session statistics
   */
  public getSessionStats() {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();
    
    return {
      totalSessions: sessions.length,
      activeProjects: new Set(sessions.map(s => s.projectId).filter(Boolean)).size,
      averageSessionDuration: sessions.length > 0 ? 
        sessions.reduce((sum, session) => sum + (now.getTime() - session.connectedAt.getTime()), 0) / sessions.length :
        0,
      sessionsPerProject: sessions.reduce((acc, session) => {
        if (session.projectId) {
          acc[session.projectId] = (acc[session.projectId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Clean up idle sessions
   */
  public cleanupIdleSessions(maxIdleTime: number = 30 * 60 * 1000): number {
    const now = new Date();
    const socketsToDisconnect: string[] = [];
    
    for (const [socketId, session] of this.sessions) {
      if ((now.getTime() - session.lastActivity.getTime()) > maxIdleTime) {
        socketsToDisconnect.push(socketId);
      }
    }
    
    for (const socketId of socketsToDisconnect) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
    
    if (socketsToDisconnect.length > 0) {
      logger.info(`🧹 Cleaned up ${socketsToDisconnect.length} idle WebSocket sessions`);
    }
    
    return socketsToDisconnect.length;
  }

  /**
   * Health check
   */
  public healthCheck() {
    const stats = this.getSessionStats();
    const sockets = this.io.sockets.sockets.size;
    
    return {
      healthy: true,
      connectedSockets: sockets,
      activeSessions: stats.totalSessions,
      activeProjects: stats.activeProjects,
      uptime: process.uptime()
    };
  }
}