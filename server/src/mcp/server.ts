import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ClaudeCodeBridge } from '../claude-code/claudeCodeBridge.js';
import { ProjectManager } from '../filesystem/projectManager.js';
import { TerminalManager } from '../terminal/terminalManager.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MCPServer');

export class ReplicClaudeMaxServer {
  private server: Server;
  private claudeCodeBridge: ClaudeCodeBridge;
  private projectManager: ProjectManager;
  private terminalManager: TerminalManager;
  
  constructor() {
    this.server = new Server(
      {
        name: 'repliclaude-max-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.claudeCodeBridge = new ClaudeCodeBridge();
    this.projectManager = new ProjectManager();
    this.terminalManager = new TerminalManager();
    
    this.setupTools();
    this.setupEventHandlers();
  }

  private setupTools() {
    const tools: Tool[] = [
      {
        name: 'create_project',
        description: 'Crée un nouveau projet avec environnement Docker isolé',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string',
              description: 'Nom du projet'
            },
            template: { 
              type: 'string', 
              enum: ['node', 'python', 'react', 'vue', 'empty'],
              description: 'Template de projet à utiliser'
            },
            description: {
              type: 'string',
              description: 'Description du projet (optionnel)'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'claude_code_execute',
        description: 'Exécute une commande dans Claude Code pour un projet',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            command: { 
              type: 'string',
              description: 'Commande à exécuter dans Claude Code'
            },
            interactive: { 
              type: 'boolean', 
              default: false,
              description: 'Mode interactif (optionnel)'
            }
          },
          required: ['projectId', 'command']
        }
      },
      {
        name: 'claude_code_start_session',
        description: 'Démarre une session interactive Claude Code',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            context: {
              type: 'string',
              description: 'Contexte initial pour la session (optionnel)'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'claude_code_send_message',
        description: 'Envoie un message à une session Claude Code active',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            message: { 
              type: 'string',
              description: 'Message à envoyer'
            }
          },
          required: ['projectId', 'message']
        }
      },
      {
        name: 'claude_code_stop_session',
        description: 'Arrête une session Claude Code active',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'read_file',
        description: 'Lit le contenu d\'un fichier dans un projet',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            path: { 
              type: 'string',
              description: 'Chemin du fichier relatif au projet'
            }
          },
          required: ['projectId', 'path']
        }
      },
      {
        name: 'write_file',
        description: 'Écrit du contenu dans un fichier',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            path: { 
              type: 'string',
              description: 'Chemin du fichier relatif au projet'
            },
            content: { 
              type: 'string',
              description: 'Contenu à écrire'
            }
          },
          required: ['projectId', 'path', 'content']
        }
      },
      {
        name: 'list_files',
        description: 'Liste les fichiers d\'un projet',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            path: { 
              type: 'string',
              description: 'Chemin du dossier (optionnel, défaut: racine)',
              default: '.'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'run_terminal_command',
        description: 'Exécute une commande dans le terminal du projet',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            },
            command: { 
              type: 'string',
              description: 'Commande à exécuter'
            }
          },
          required: ['projectId', 'command']
        }
      },
      {
        name: 'get_project_info',
        description: 'Obtient les informations d\'un projet',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { 
              type: 'string',
              description: 'ID du projet'
            }
          },
          required: ['projectId']
        }
      },
      {
        name: 'list_projects',
        description: 'Liste tous les projets disponibles',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'create_project':
            return await this.handleCreateProject(args);
          case 'claude_code_execute':
            return await this.handleClaudeCodeExecute(args);
          case 'claude_code_start_session':
            return await this.handleClaudeCodeStartSession(args);
          case 'claude_code_send_message':
            return await this.handleClaudeCodeSendMessage(args);
          case 'claude_code_stop_session':
            return await this.handleClaudeCodeStopSession(args);
          case 'read_file':
            return await this.handleReadFile(args);
          case 'write_file':
            return await this.handleWriteFile(args);
          case 'list_files':
            return await this.handleListFiles(args);
          case 'run_terminal_command':
            return await this.handleRunTerminalCommand(args);
          case 'get_project_info':
            return await this.handleGetProjectInfo(args);
          case 'list_projects':
            return await this.handleListProjects(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleCreateProject(args: any) {
    const { name, template = 'empty', description } = args;
    const projectId = await this.projectManager.createProject(name, template, description);
    
    return {
      content: [{
        type: 'text',
        text: `Project created successfully with ID: ${projectId}`
      }]
    };
  }

  private async handleClaudeCodeExecute(args: any) {
    const { projectId, command, interactive = false } = args;
    const projectPath = this.projectManager.getProjectPath(projectId);
    
    const result = await this.claudeCodeBridge.executeCommand(
      projectId,
      command,
      projectPath,
      interactive
    );
    
    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }

  private async handleClaudeCodeStartSession(args: any) {
    const { projectId, context } = args;
    const projectPath = this.projectManager.getProjectPath(projectId);
    
    await this.claudeCodeBridge.startInteractiveSession(
      projectId,
      projectPath,
      (output) => logger.info('Claude output:', output),
      (error) => logger.error('Claude error:', error)
    );
    
    return {
      content: [{
        type: 'text',
        text: `Claude Code session started for project ${projectId}`
      }]
    };
  }

  private async handleClaudeCodeSendMessage(args: any) {
    const { projectId, message } = args;
    const sent = this.claudeCodeBridge.sendToSession(projectId, message);
    
    return {
      content: [{
        type: 'text',
        text: sent ? 'Message sent successfully' : 'No active session found'
      }]
    };
  }

  private async handleClaudeCodeStopSession(args: any) {
    const { projectId } = args;
    const stopped = this.claudeCodeBridge.terminateSession(projectId);
    
    return {
      content: [{
        type: 'text',
        text: stopped ? 'Session stopped successfully' : 'No active session found'
      }]
    };
  }

  private async handleReadFile(args: any) {
    const { projectId, path } = args;
    const content = await this.projectManager.readFile(projectId, path);
    
    return {
      content: [{
        type: 'text',
        text: content
      }]
    };
  }

  private async handleWriteFile(args: any) {
    const { projectId, path, content } = args;
    await this.projectManager.writeFile(projectId, path, content);
    
    return {
      content: [{
        type: 'text',
        text: `File ${path} written successfully`
      }]
    };
  }

  private async handleListFiles(args: any) {
    const { projectId, path = '.' } = args;
    const files = await this.projectManager.listFiles(projectId, path);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(files, null, 2)
      }]
    };
  }

  private async handleRunTerminalCommand(args: any) {
    const { projectId, command } = args;
    const result = await this.terminalManager.executeCommand(projectId, command);
    
    return {
      content: [{
        type: 'text',
        text: result
      }]
    };
  }

  private async handleGetProjectInfo(args: any) {
    const { projectId } = args;
    const info = await this.projectManager.getProjectInfo(projectId);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(info, null, 2)
      }]
    };
  }

  private async handleListProjects(args: any) {
    const projects = await this.projectManager.listProjects();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(projects, null, 2)
      }]
    };
  }

  private setupEventHandlers() {
    // Claude Code Bridge events
    this.claudeCodeBridge.on('stdout', (projectId, data) => {
      logger.info(`Claude Code stdout [${projectId}]:`, data);
    });

    this.claudeCodeBridge.on('stderr', (projectId, data) => {
      logger.error(`Claude Code stderr [${projectId}]:`, data);
    });

    this.claudeCodeBridge.on('session-ended', (projectId, code) => {
      logger.info(`Claude Code session ended [${projectId}] with code ${code}`);
    });

    // Project Manager events
    this.projectManager.on('project-created', (projectId, info) => {
      logger.info(`Project created: ${projectId}`, info);
    });

    this.projectManager.on('project-deleted', (projectId) => {
      logger.info(`Project deleted: ${projectId}`);
    });

    // Terminal Manager events
    this.terminalManager.on('command-executed', (projectId, command, result) => {
      logger.info(`Terminal command executed [${projectId}]: ${command}`);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('🚀 MCP Replit Claude Max Server started');
  }

  async stop() {
    await this.claudeCodeBridge.cleanup();
    await this.projectManager.cleanup();
    await this.terminalManager.cleanup();
    logger.info('MCP Server stopped');
  }
}