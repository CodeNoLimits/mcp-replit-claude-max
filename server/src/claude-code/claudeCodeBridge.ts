import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ClaudeCodeBridge');

export interface ClaudeCodeSession {
  projectId: string;
  process: ChildProcess;
  workingDir: string;
  startTime: Date;
  lastActivity: Date;
  isInteractive: boolean;
}

export class ClaudeCodeBridge extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private sessionStates: Map<string, ClaudeCodeSession> = new Map();
  private isClaudeCodeAvailable: boolean = false;

  constructor() {
    super();
    this.verifyClaudeCodeAccess();
  }

  private async verifyClaudeCodeAccess(): Promise<void> {
    try {
      logger.info('Verifying Claude Code CLI access...');
      const process = spawn('claude', ['--version'], { stdio: 'pipe' });
      
      process.on('close', (code) => {
        if (code === 0) {
          this.isClaudeCodeAvailable = true;
          logger.info('✅ Claude Code CLI is accessible');
          this.emit('ready');
        } else {
          this.isClaudeCodeAvailable = false;
          logger.error('❌ Claude Code CLI not accessible. Please ensure you are logged in.');
          this.emit('error', new Error('Claude Code CLI not accessible'));
        }
      });

      process.on('error', (error) => {
        this.isClaudeCodeAvailable = false;
        logger.error('❌ Claude Code CLI error:', error);
        this.emit('error', error);
      });
    } catch (error) {
      this.isClaudeCodeAvailable = false;
      logger.error('❌ Claude Code CLI not found:', error);
      this.emit('error', error);
    }
  }

  /**
   * Execute a single command in Claude Code
   */
  async executeCommand(
    projectId: string,
    command: string,
    workingDir: string,
    interactive: boolean = false
  ): Promise<string> {
    if (!this.isClaudeCodeAvailable) {
      throw new Error('Claude Code CLI is not available. Please ensure it is installed and you are logged in.');
    }

    return new Promise((resolve, reject) => {
      logger.info(`🤖 Executing Claude Code command in ${workingDir}: ${command}`);
      
      const claudeProcess = spawn('claude', {
        cwd: workingDir,
        stdio: interactive ? 'pipe' : ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          CLAUDE_CODE_PROJECT_ID: projectId
        }
      });

      let output = '';
      let errorOutput = '';
      let timeout: NodeJS.Timeout;

      // Set timeout for non-interactive commands
      if (!interactive) {
        timeout = setTimeout(() => {
          claudeProcess.kill('SIGTERM');
          reject(new Error('Claude Code command timed out'));
        }, 30000); // 30 second timeout
      }

      if (claudeProcess.stdout) {
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          this.emit('stdout', projectId, chunk);
        });
      }

      if (claudeProcess.stderr) {
        claudeProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorOutput += chunk;
          this.emit('stderr', projectId, chunk);
        });
      }

      // Send the command to Claude Code
      if (claudeProcess.stdin) {
        claudeProcess.stdin.write(command + '\n');
        if (!interactive) {
          claudeProcess.stdin.end();
        }
      }

      claudeProcess.on('close', (code) => {
        if (timeout) clearTimeout(timeout);
        this.activeProcesses.delete(projectId);
        
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Claude Code error (exit code ${code}): ${errorOutput}`));
        }
      });

      claudeProcess.on('error', (error) => {
        if (timeout) clearTimeout(timeout);
        this.activeProcesses.delete(projectId);
        reject(error);
      });

      this.activeProcesses.set(projectId, claudeProcess);
    });
  }

  /**
   * Start an interactive Claude Code session
   */
  async startInteractiveSession(
    projectId: string,
    workingDir: string,
    onOutput: (data: string) => void,
    onError: (data: string) => void
  ): Promise<void> {
    if (!this.isClaudeCodeAvailable) {
      throw new Error('Claude Code CLI is not available');
    }

    // Stop existing session if any
    this.terminateSession(projectId);

    logger.info(`🚀 Starting interactive Claude Code session for ${projectId}`);
    
    const claudeProcess = spawn('claude', {
      cwd: workingDir,
      stdio: 'pipe',
      env: { 
        ...process.env,
        CLAUDE_CODE_PROJECT_ID: projectId,
        CLAUDE_CODE_INTERACTIVE: 'true'
      }
    });

    const session: ClaudeCodeSession = {
      projectId,
      process: claudeProcess,
      workingDir,
      startTime: new Date(),
      lastActivity: new Date(),
      isInteractive: true
    };

    if (claudeProcess.stdout) {
      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        session.lastActivity = new Date();
        onOutput(output);
        this.emit('interactive-output', projectId, output);
      });
    }

    if (claudeProcess.stderr) {
      claudeProcess.stderr.on('data', (data) => {
        const error = data.toString();
        session.lastActivity = new Date();
        onError(error);
        this.emit('interactive-error', projectId, error);
      });
    }

    claudeProcess.on('close', (code) => {
      logger.info(`Claude Code session ${projectId} ended with code ${code}`);
      this.activeProcesses.delete(projectId);
      this.sessionStates.delete(projectId);
      this.emit('session-ended', projectId, code);
    });

    claudeProcess.on('error', (error) => {
      logger.error(`Claude Code session ${projectId} error:`, error);
      this.activeProcesses.delete(projectId);
      this.sessionStates.delete(projectId);
      this.emit('session-error', projectId, error);
    });

    this.activeProcesses.set(projectId, claudeProcess);
    this.sessionStates.set(projectId, session);

    // Send initial context message
    this.sendToSession(projectId, `I'm working on a project in ${workingDir}. Please help me with coding tasks.`);
  }

  /**
   * Send a message to an active Claude Code session
   */
  sendToSession(projectId: string, input: string): boolean {
    const process = this.activeProcesses.get(projectId);
    const session = this.sessionStates.get(projectId);
    
    if (process && process.stdin && session) {
      try {
        process.stdin.write(input + '\n');
        session.lastActivity = new Date();
        logger.info(`📤 Sent message to Claude Code session ${projectId}:`, input.substring(0, 100));
        return true;
      } catch (error) {
        logger.error(`Error sending message to session ${projectId}:`, error);
        return false;
      }
    }
    
    logger.warn(`No active session found for project ${projectId}`);
    return false;
  }

  /**
   * Terminate a Claude Code session
   */
  terminateSession(projectId: string): boolean {
    const process = this.activeProcesses.get(projectId);
    const session = this.sessionStates.get(projectId);
    
    if (process && session) {
      try {
        // Send exit command first
        if (process.stdin) {
          process.stdin.write('exit\n');
        }
        
        // Force kill after a short delay
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGTERM');
          }
        }, 1000);

        this.activeProcesses.delete(projectId);
        this.sessionStates.delete(projectId);
        
        logger.info(`🛑 Terminated Claude Code session for ${projectId}`);
        return true;
      } catch (error) {
        logger.error(`Error terminating session ${projectId}:`, error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Check if a session is active
   */
  isSessionActive(projectId: string): boolean {
    return this.activeProcesses.has(projectId);
  }

  /**
   * Get session information
   */
  getSessionInfo(projectId: string): ClaudeCodeSession | null {
    return this.sessionStates.get(projectId) || null;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const sessions = Array.from(this.sessionStates.values());
    const now = new Date();
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isInteractive).length,
      oldestSession: sessions.reduce((oldest, session) => 
        !oldest || session.startTime < oldest.startTime ? session : oldest, 
        null as ClaudeCodeSession | null
      ),
      averageSessionAge: sessions.length > 0 ? 
        sessions.reduce((sum, session) => sum + (now.getTime() - session.startTime.getTime()), 0) / sessions.length :
        0
    };
  }

  /**
   * Health check for Claude Code CLI
   */
  async healthCheck(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const version = await this.executeCommand('health-check', '--version', process.cwd(), false);
      return {
        available: true,
        version: version.trim()
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cleanup all sessions and processes
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up Claude Code Bridge...');
    
    const sessions = Array.from(this.activeProcesses.keys());
    
    for (const projectId of sessions) {
      this.terminateSession(projectId);
    }

    // Wait a bit for processes to clean up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force kill any remaining processes
    for (const [projectId, process] of this.activeProcesses) {
      if (!process.killed) {
        logger.warn(`Force killing process for ${projectId}`);
        process.kill('SIGKILL');
      }
    }

    this.activeProcesses.clear();
    this.sessionStates.clear();
    
    logger.info('✅ Claude Code Bridge cleanup completed');
  }
}