export interface Project {
  id: string;
  name: string;
  template: string;
  description?: string;
  createdAt: string;
  lastAccessed: string;
  path: string;
  containerId?: string;
  status: 'active' | 'inactive' | 'creating' | 'error';
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  modifiedAt?: string;
  children?: FileNode[];
}

export interface CreateProjectRequest {
  name: string;
  template?: string;
  description?: string;
}

export interface CreateProjectResponse {
  projectId: string;
  project: Project;
}

export type ProjectTemplate = 'empty' | 'node' | 'react' | 'vue' | 'python';