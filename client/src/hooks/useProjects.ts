import { useState, useEffect, useCallback } from 'react';
import { Project } from '../types/project';

// Try to get API URL from environment or detect from current location
const getApiUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    console.log('Using API URL from environment:', envUrl);
    return envUrl;
  }
  
  // Try to detect from current location
  const currentPort = window.location.port;
  if (currentPort) {
    console.log('Frontend port detected:', currentPort);
    const backendPort = parseInt(currentPort) - 29; // 3030 -> 3001
    if (backendPort > 0) {
      console.log('Calculated backend port:', backendPort);
      return `http://localhost:${backendPort}`;
    }
  }
  
  // Default fallback
  console.log('Using default API URL: http://localhost:3001');
  return 'http://localhost:3001';
};

export interface UseProjectsReturn {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProject: (name: string, template?: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  apiUrl: string;
}

export const useProjects = (): UseProjectsReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl] = useState(() => getApiUrl());

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching projects from:', `${apiUrl}/api/projects`);
      const response = await fetch(`${apiUrl}/api/projects`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(errorMessage);
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  const createProject = useCallback(async (
    name: string,
    template: string = 'empty',
    description?: string
  ): Promise<Project> => {
    try {
      console.log('Creating project with API URL:', apiUrl);
      console.log('Project data:', { name, template, description });
      
      const response = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          template,
          description,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Project created successfully:', data);
      
      // Refresh the projects list
      await fetchProjects();
      
      return data.project;
    } catch (err) {
      console.error('Create project error:', err);
      
      // More specific error messages
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const errorMessage = `Network error: Cannot connect to API at ${apiUrl}. Please check if the server is running.`;
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw err;
    }
  }, [apiUrl, fetchProjects]);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      console.log('Deleting project:', projectId);
      const response = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.statusText}`);
      }

      // Refresh the projects list
      await fetchProjects();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw err;
    }
  }, [apiUrl, fetchProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    refetch: fetchProjects,
    createProject,
    deleteProject,
    apiUrl,
  };
};