import { EventEmitter } from 'events';
import Docker from 'dockerode';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ProjectManager');

export interface ProjectInfo {
  id: string;
  name: string;
  template: string;
  description?: string;
  createdAt: Date;
  lastAccessed: Date;
  path: string;
  containerId?: string;
  status: 'active' | 'inactive' | 'creating' | 'error';
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  modifiedAt?: Date;
  children?: FileNode[];
}

export class ProjectManager extends EventEmitter {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();
  private projects: Map<string, ProjectInfo> = new Map();
  private projectsDir: string;

  constructor(projectsDir: string = './projects') {
    super();
    this.docker = new Docker();
    this.projectsDir = path.resolve(projectsDir);
    this.initializeProjectsDirectory();
    this.loadExistingProjects();
  }

  private async initializeProjectsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      logger.info(`📁 Projects directory initialized: ${this.projectsDir}`);
    } catch (error) {
      logger.error('Failed to initialize projects directory:', error);
      throw error;
    }
  }

  private async loadExistingProjects(): Promise<void> {
    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(this.projectsDir, entry.name);
          const configPath = path.join(projectPath, '.repliclaude-config.json');
          
          try {
            const configData = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configData);
            
            const projectInfo: ProjectInfo = {
              ...config,
              lastAccessed: new Date(config.lastAccessed),
              createdAt: new Date(config.createdAt),
              status: 'inactive'
            };
            
            this.projects.set(projectInfo.id, projectInfo);
            logger.info(`📂 Loaded existing project: ${projectInfo.name} (${projectInfo.id})`);
          } catch (error) {
            logger.warn(`⚠️  Could not load project config for ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load existing projects:', error);
    }
  }

  /**
   * Create a new project with the specified template
   */
  async createProject(name: string, template: string = 'empty', description?: string): Promise<string> {
    const projectId = `project_${Date.now()}_${uuidv4().split('-')[0]}`;
    const projectPath = path.join(this.projectsDir, projectId);
    
    logger.info(`🚀 Creating project: ${name} (${projectId}) with template: ${template}`);
    
    try {
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });
      
      // Initialize project based on template
      await this.initializeTemplate(projectPath, template);
      
      // Create project configuration
      const projectInfo: ProjectInfo = {
        id: projectId,
        name,
        template,
        description,
        createdAt: new Date(),
        lastAccessed: new Date(),
        path: projectPath,
        status: 'creating'
      };
      
      await this.saveProjectConfig(projectInfo);
      
      // Create and start Docker container
      const container = await this.createContainer(projectId, projectPath);
      await container.start();
      
      projectInfo.containerId = container.id;
      projectInfo.status = 'active';
      
      this.containers.set(projectId, container);
      this.projects.set(projectId, projectInfo);
      
      await this.saveProjectConfig(projectInfo);
      
      logger.info(`✅ Project created successfully: ${name} (${projectId})`);
      this.emit('project-created', projectId, projectInfo);
      
      return projectId;
    } catch (error) {
      logger.error(`❌ Failed to create project ${name}:`, error);
      // Cleanup on failure
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error('Failed to cleanup project directory:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Initialize project template
   */
  private async initializeTemplate(projectPath: string, template: string): Promise<void> {
    const templates = {
      'node': {
        'package.json': JSON.stringify({
          name: 'my-node-project',
          version: '1.0.0',
          main: 'index.js',
          scripts: {
            start: 'node index.js',
            dev: 'nodemon index.js'
          },
          dependencies: {},
          devDependencies: {
            nodemon: '^3.0.0'
          }
        }, null, 2),
        'index.js': `console.log('Hello from Node.js!');

// Your code here
`,
        'README.md': `# My Node.js Project

A new Node.js project created with ReplicLaude IDE.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`
`
      },
      'react': {
        'package.json': JSON.stringify({
          name: 'my-react-app',
          version: '1.0.0',
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test',
            eject: 'react-scripts eject'
          },
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            'react-scripts': '^5.0.0'
          }
        }, null, 2),
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My React App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
        'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
`,
        'src/App.js': `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello from React!</h1>
      <p>Welcome to your new React app created with ReplicLaude IDE.</p>
    </div>
  );
}

export default App;
`,
        'README.md': `# My React App

A new React application created with ReplicLaude IDE.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`
`
      },
      'python': {
        'main.py': `print("Hello from Python!")

# Your code here
`,
        'requirements.txt': `# Add your Python dependencies here
`,
        'README.md': `# My Python Project

A new Python project created with ReplicLaude IDE.

## Getting Started

\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\`
`
      },
      'vue': {
        'package.json': JSON.stringify({
          name: 'my-vue-app',
          version: '1.0.0',
          scripts: {
            serve: 'vue-cli-service serve',
            build: 'vue-cli-service build'
          },
          dependencies: {
            vue: '^3.0.0'
          },
          devDependencies: {
            '@vue/cli-service': '^5.0.0'
          }
        }, null, 2),
        'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`,
        'src/App.vue': `<template>
  <div>
    <h1>Hello from Vue!</h1>
    <p>Welcome to your new Vue app created with ReplicLaude IDE.</p>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>
`,
        'public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>My Vue App</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>`,
        'README.md': `# My Vue App

A new Vue application created with ReplicLaude IDE.

## Getting Started

\`\`\`bash
npm install
npm run serve
\`\`\`
`
      },
      'empty': {
        'README.md': `# My Project

A new project created with ReplicLaude IDE.

Start coding!
`
      }
    };

    const templateFiles = templates[template as keyof typeof templates] || templates.empty;
    
    for (const [filePath, content] of Object.entries(templateFiles)) {
      const fullPath = path.join(projectPath, filePath);
      const dir = path.dirname(fullPath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content);
    }
    
    logger.info(`📝 Template '${template}' initialized in ${projectPath}`);
  }

  /**
   * Create Docker container for project
   */
  private async createContainer(projectId: string, projectPath: string): Promise<Docker.Container> {
    const containerName = `repliclaude_${projectId}`;
    
    logger.info(`🐳 Creating Docker container: ${containerName}`);
    
    return await this.docker.createContainer({
      Image: 'node:18-alpine',
      name: containerName,
      WorkingDir: '/workspace',
      Cmd: ['tail', '-f', '/dev/null'], // Keep container running
      HostConfig: {
        Binds: [`${projectPath}:/workspace`],
        AutoRemove: true,
        Memory: 512 * 1024 * 1024, // 512MB memory limit
        CpuShares: 512 // CPU limit
      },
      Env: [
        'NODE_ENV=development',
        `PROJECT_ID=${projectId}`,
        'DEBIAN_FRONTEND=noninteractive'
      ],
      Labels: {
        'repliclaude.project.id': projectId,
        'repliclaude.project.type': 'development'
      }
    });
  }

  /**
   * Save project configuration
   */
  private async saveProjectConfig(projectInfo: ProjectInfo): Promise<void> {
    const configPath = path.join(projectInfo.path, '.repliclaude-config.json');
    await fs.writeFile(configPath, JSON.stringify(projectInfo, null, 2));
  }

  /**
   * Get project path
   */
  getProjectPath(projectId: string): string {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    return project.path;
  }

  /**
   * Get project information
   */
  async getProjectInfo(projectId: string): Promise<ProjectInfo> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    // Update last accessed time
    project.lastAccessed = new Date();
    await this.saveProjectConfig(project);
    
    return project;
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectInfo[]> {
    return Array.from(this.projects.values());
  }

  /**
   * Read file content
   */
  async readFile(projectId: string, filePath: string): Promise<string> {
    const projectPath = this.getProjectPath(projectId);
    const fullPath = path.join(projectPath, filePath);
    
    // Security check: ensure file is within project directory
    if (!fullPath.startsWith(projectPath)) {
      throw new Error('Access denied: File path outside project directory');
    }
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      logger.info(`📖 Read file: ${filePath} from project ${projectId}`);
      return content;
    } catch (error) {
      logger.error(`❌ Failed to read file ${filePath} from project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  async writeFile(projectId: string, filePath: string, content: string): Promise<void> {
    const projectPath = this.getProjectPath(projectId);
    const fullPath = path.join(projectPath, filePath);
    
    // Security check: ensure file is within project directory
    if (!fullPath.startsWith(projectPath)) {
      throw new Error('Access denied: File path outside project directory');
    }
    
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, content);
      logger.info(`✏️  Wrote file: ${filePath} to project ${projectId}`);
    } catch (error) {
      logger.error(`❌ Failed to write file ${filePath} to project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * List files in project directory
   */
  async listFiles(projectId: string, relativePath: string = '.'): Promise<FileNode[]> {
    const projectPath = this.getProjectPath(projectId);
    const fullPath = path.join(projectPath, relativePath);
    
    // Security check: ensure path is within project directory
    if (!fullPath.startsWith(projectPath)) {
      throw new Error('Access denied: Path outside project directory');
    }
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileNode[] = [];
      
      for (const entry of entries) {
        // Skip hidden files and config files
        if (entry.name.startsWith('.') && entry.name !== '.repliclaude-config.json') {
          continue;
        }
        
        const entryPath = path.join(fullPath, entry.name);
        const stats = await fs.stat(entryPath);
        
        const fileNode: FileNode = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(relativePath, entry.name),
          size: entry.isFile() ? stats.size : undefined,
          modifiedAt: stats.mtime
        };
        
        files.push(fileNode);
      }
      
      // Sort: directories first, then files, alphabetically
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      return files;
    } catch (error) {
      logger.error(`❌ Failed to list files in ${relativePath} for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Execute command in project container
   */
  async executeInContainer(projectId: string, command: string): Promise<string> {
    const container = this.containers.get(projectId);
    if (!container) {
      throw new Error(`No container found for project ${projectId}`);
    }

    try {
      const exec = await container.exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({});
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        stream.on('end', () => resolve(output));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`❌ Failed to execute command in container for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    logger.info(`🗑️  Deleting project: ${project.name} (${projectId})`);
    
    try {
      // Stop and remove container
      const container = this.containers.get(projectId);
      if (container) {
        await container.stop();
        await container.remove();
        this.containers.delete(projectId);
      }
      
      // Remove project directory
      await fs.rm(project.path, { recursive: true, force: true });
      
      // Remove from memory
      this.projects.delete(projectId);
      
      logger.info(`✅ Project deleted successfully: ${projectId}`);
      this.emit('project-deleted', projectId);
    } catch (error) {
      logger.error(`❌ Failed to delete project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup all projects and containers
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up Project Manager...');
    
    const containerIds = Array.from(this.containers.keys());
    
    for (const projectId of containerIds) {
      try {
        const container = this.containers.get(projectId);
        if (container) {
          await container.stop();
          await container.remove();
        }
      } catch (error) {
        logger.error(`Failed to cleanup container for project ${projectId}:`, error);
      }
    }
    
    this.containers.clear();
    this.projects.clear();
    
    logger.info('✅ Project Manager cleanup completed');
  }
}