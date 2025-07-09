'use client';

import { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { IDE } from '../components/IDE';
import { ProjectSelector } from '../components/ProjectSelector';
import { LoadingScreen } from '../components/LoadingScreen';
import { useProjects } from '../hooks/useProjects';
import { useSocket } from '../hooks/useSocket';

export default function Home() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { projects, isLoading: projectsLoading, error, apiUrl } = useProjects();
  const { socket, isConnected, error: socketError, reconnectAttempts } = useSocket();

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
    if (isConnected && reconnectAttempts === 0) {
      toast.success('Connected to server');
    } else if (socketError && reconnectAttempts > 0) {
      toast.error(`Connection failed (attempt ${reconnectAttempts})`);
    }
  }, [isConnected, socketError, reconnectAttempts]);

  useEffect(() => {
    // Show error if any
    if (error) {
      toast.error(`API Error: ${error}`);
    }
  }, [error]);

  const handleProjectSelect = (projectId: string) => {
    setCurrentProjectId(projectId);
  };

  const handleProjectClose = () => {
    setCurrentProjectId(null);
  };

  if (isLoading || projectsLoading) {
    return (
      <>
        <LoadingScreen />
        <Toaster position="top-right" />
      </>
    );
  }

  if (!isConnected && reconnectAttempts === 0) {
    return (
      <>
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connecting to server...</h2>
            <p className="text-gray-600 mb-4">Please wait while we establish the connection.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>API URL:</strong> {apiUrl}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                Make sure the server is running on this URL.
              </p>
            </div>
          </div>
        </div>
        <Toaster position="top-right" />
      </>
    );
  }

  if (socketError && reconnectAttempts > 5) {
    return (
      <>
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-lg">
            <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h2>
            <p className="text-gray-600 mb-4">
              Unable to connect to the server after multiple attempts.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {socketError}
              </p>
              <p className="text-sm text-red-800 mt-1">
                <strong>Attempts:</strong> {reconnectAttempts}
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Troubleshooting:</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Make sure the server is running: <code>npm run dev</code></li>
                <li>• Check the API URL: {apiUrl}</li>
                <li>• Verify ports are not blocked by firewall</li>
                <li>• Try refreshing the page</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-primary mx-auto"
            >
              Retry Connection
            </button>
          </div>
        </div>
        <Toaster position="top-right" />
      </>
    );
  }

  if (!currentProjectId) {
    return (
      <>
        <ProjectSelector
          projects={projects}
          onProjectSelect={handleProjectSelect}
        />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <>
      <IDE
        projectId={currentProjectId}
        onProjectClose={handleProjectClose}
      />
      <Toaster position="top-right" />
    </>
  );
}