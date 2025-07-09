'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { IDE } from '../components/IDE';
import { ProjectSelector } from '../components/ProjectSelector';
import { LoadingScreen } from '../components/LoadingScreen';
import { useProjects } from '../hooks/useProjects';
import { useSocket } from '../hooks/useSocket';

export default function Home() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { projects, isLoading: projectsLoading, error } = useProjects();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    // Check if we have a project ID in localStorage
    const savedProjectId = localStorage.getItem('currentProjectId');
    if (savedProjectId && projects.some(p => p.id === savedProjectId)) {
      setCurrentProjectId(savedProjectId);
    }
    
    setIsLoading(false);
  }, [projects]);

  useEffect(() => {
    // Save current project ID to localStorage
    if (currentProjectId) {
      localStorage.setItem('currentProjectId', currentProjectId);
    } else {
      localStorage.removeItem('currentProjectId');
    }
  }, [currentProjectId]);

  useEffect(() => {
    // Show connection status
    if (isConnected) {
      toast.success('Connected to server');
    } else {
      toast.error('Disconnected from server');
    }
  }, [isConnected]);

  useEffect(() => {
    // Show error if any
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleProjectSelect = (projectId: string) => {
    setCurrentProjectId(projectId);
  };

  const handleProjectClose = () => {
    setCurrentProjectId(null);
  };

  if (isLoading || projectsLoading) {
    return <LoadingScreen />;
  }

  if (!isConnected) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting to server...</h2>
          <p className="text-gray-600">Please wait while we establish the connection.</p>
        </div>
      </div>
    );
  }

  if (!currentProjectId) {
    return (
      <ProjectSelector
        projects={projects}
        onProjectSelect={handleProjectSelect}
      />
    );
  }

  return (
    <IDE
      projectId={currentProjectId}
      onProjectClose={handleProjectClose}
    />
  );
}