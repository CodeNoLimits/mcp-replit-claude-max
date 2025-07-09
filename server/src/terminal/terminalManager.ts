import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as pty from 'node-pty';
import { Logger } from '../utils/logger.js';

const logger = new Logger('TerminalManager');

export interface TerminalSession {
  projectId: string;
  sessionId: string;
  pty: pty.IPty;
  workingDir: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

export class TerminalManager extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByProject: Map<string, Set<string>> = new Map();

  constructor() {
    super();
  }

  /**
   * Create a new terminal session for a project
   */
  createSession(projectId: string, workingDir: string): string {
    const sessionId = `terminal_${projectId}_${Date.now()}`;
    
    logger.info(`🖥️  Creating terminal session: ${sessionId} for project ${projectId}`);
    
    try {
      // Create PTY session
      const ptyProcess = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: {
          ...process.env,
          TERM: 'xterm-color',
          PROJECT_ID: projectId,
          PS1: `\\[\\033[32m\\]${projectId}\\[\\033[0m\\]:\\[\\033[34m\\]\\W\\[\\033[0m\\]$ `
        }
      });

      const session: TerminalSession = {
        projectId,
        sessionId,
        pty: ptyProcess,
        workingDir,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      // Set up event handlers
      ptyProcess.onData((data) => {
        session.lastActivity = new Date();
        this.emit('terminal-output', sessionId, data);
      });

      ptyProcess.onExit((exitCode) => {
        logger.info(`Terminal session ${sessionId} exited with code ${exitCode}`);
        session.isActive = false;
        this.emit('terminal-exit', sessionId, exitCode);
        
        // Clean up session
        this.sessions.delete(sessionId);
        const projectSessions = this.sessionsByProject.get(projectId);
        if (projectSessions) {
          projectSessions.delete(sessionId);
          if (projectSessions.size === 0) {
            this.sessionsByProject.delete(projectId);
          }
        }
      });

      // Store session
      this.sessions.set(sessionId, session);
      
      if (!this.sessionsByProject.has(projectId)) {
        this.sessionsByProject.set(projectId, new Set());
      }
      this.sessionsByProject.get(projectId)!.add(sessionId);

      logger.info(`✅ Terminal session created: ${sessionId}`);
      this.emit('session-created', sessionId, session);
      
      return sessionId;
    } catch (error) {
      logger.error(`❌ Failed to create terminal session for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Write data to terminal session
   */
  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      logger.warn(`Terminal session ${sessionId} not found or not active`);
      return false;
    }

    try {
      session.pty.write(data);
      session.lastActivity = new Date();
      return true;
    } catch (error) {
      logger.error(`Failed to write to terminal session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Resize terminal session
   */
  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      logger.warn(`Terminal session ${sessionId} not found or not active`);
      return false;
    }

    try {
      session.pty.resize(cols, rows);
      return true;
    } catch (error) {
      logger.error(`Failed to resize terminal session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Execute a single command in project directory
   */
  async executeCommand(projectId: string, command: string, workingDir?: string): Promise<string> {
    const dir = workingDir || `/projects/${projectId}`;
    
    logger.info(`⚡ Executing command in ${dir}: ${command}`);
    
    return new Promise((resolve, reject) => {
      const process = spawn('bash', ['-c', command], {
        cwd: dir,
        env: {
          ...process.env,
          PROJECT_ID: projectId
        }
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        this.emit('command-output', projectId, chunk);
      });

      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        this.emit('command-error', projectId, chunk);
      });

      process.on('close', (code) => {
        if (code === 0) {
          logger.info(`✅ Command completed successfully: ${command}`);
          this.emit('command-executed', projectId, command, output);
          resolve(output);
        } else {
          logger.error(`❌ Command failed with code ${code}: ${command}`);
          this.emit('command-failed', projectId, command, errorOutput);
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        logger.error(`❌ Command execution error: ${command}`, error);
        reject(error);
      });

      // Set timeout for long-running commands
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          reject(new Error('Command timed out'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Kill terminal session
   */
  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Terminal session ${sessionId} not found`);
      return false;
    }

    try {
      session.pty.kill('SIGTERM');
      session.isActive = false;
      
      // Force cleanup after a delay
      setTimeout(() => {
        if (this.sessions.has(sessionId)) {
          this.sessions.delete(sessionId);
          const projectSessions = this.sessionsByProject.get(session.projectId);
          if (projectSessions) {
            projectSessions.delete(sessionId);
            if (projectSessions.size === 0) {
              this.sessionsByProject.delete(session.projectId);
            }
          }
        }
      }, 5000);

      logger.info(`🛑 Terminal session killed: ${sessionId}`);
      this.emit('session-killed', sessionId);
      
      return true;
    } catch (error) {
      logger.error(`Failed to kill terminal session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get terminal session info
   */
  getSessionInfo(sessionId: string): TerminalSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a project
   */
  getProjectSessions(projectId: string): TerminalSession[] {
    const sessionIds = this.sessionsByProject.get(projectId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(session => session !== undefined) as TerminalSession[];
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const allSessions = Array.from(this.sessions.values());
    const activeSessions = allSessions.filter(s => s.isActive);
    const now = new Date();
    
    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      projectCount: this.sessionsByProject.size,
      oldestSession: allSessions.reduce((oldest, session) => 
        !oldest || session.startTime < oldest.startTime ? session : oldest, 
        null as TerminalSession | null
      ),
      averageSessionAge: allSessions.length > 0 ? 
        allSessions.reduce((sum, session) => sum + (now.getTime() - session.startTime.getTime()), 0) / allSessions.length :
        0,
      sessionsPerProject: Array.from(this.sessionsByProject.entries()).map(([projectId, sessions]) => ({
        projectId,
        count: sessions.size
      }))
    };
  }

  /**
   * Clean up idle sessions
   */
  cleanupIdleSessions(maxIdleTime: number = 30 * 60 * 1000): number { // 30 minutes default
    const now = new Date();
    const sessionsToKill: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (session.isActive && (now.getTime() - session.lastActivity.getTime()) > maxIdleTime) {
        sessionsToKill.push(sessionId);
      }
    }
    
    let killedCount = 0;
    for (const sessionId of sessionsToKill) {
      if (this.killSession(sessionId)) {
        killedCount++;
      }
    }
    
    if (killedCount > 0) {
      logger.info(`🧹 Cleaned up ${killedCount} idle terminal sessions`);
    }
    
    return killedCount;
  }

  /**
   * Kill all sessions for a project
   */
  killProjectSessions(projectId: string): number {
    const sessionIds = this.sessionsByProject.get(projectId) || new Set();
    let killedCount = 0;
    
    for (const sessionId of sessionIds) {
      if (this.killSession(sessionId)) {
        killedCount++;
      }
    }
    
    logger.info(`🛑 Killed ${killedCount} terminal sessions for project ${projectId}`);
    return killedCount;
  }

  /**
   * Send interrupt signal (Ctrl+C) to session
   */
  interruptSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      session.pty.write('\x03'); // Ctrl+C
      return true;
    } catch (error) {
      logger.error(`Failed to interrupt session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Clear terminal session
   */
  clearSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      session.pty.write('\x0c'); // Form feed (clear screen)
      return true;
    } catch (error) {
      logger.error(`Failed to clear session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup all sessions
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up Terminal Manager...');
    
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      this.killSession(sessionId);
    }
    
    // Wait for sessions to clean up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.sessions.clear();
    this.sessionsByProject.clear();
    
    logger.info('✅ Terminal Manager cleanup completed');
  }
}