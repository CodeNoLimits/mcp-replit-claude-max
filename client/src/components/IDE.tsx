import { useState } from 'react';
import { ArrowLeft, Layout, Zap } from 'lucide-react';
import { Project } from '../types/project';
import { useProjects } from '../hooks/useProjects';

interface IDEProps {
  projectId: string;
  onProjectClose: () => void;
}

export const IDE = ({ projectId, onProjectClose }: IDEProps) => {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const { projects } = useProjects();
  
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist.</p>
          <button
            onClick={onProjectClose}
            className="btn-primary flex items-center space-x-2 mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onProjectClose}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-claude-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-gray-900">{project.name}</h1>
                  <p className="text-xs text-gray-500 capitalize">{project.template} project</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`status-indicator ${
                project.status === 'active' ? 'bg-green-500' :
                project.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                project.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="text-sm text-gray-600 capitalize">{project.status}</span>
              <button
                onClick={() => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal')}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                title="Toggle Layout"
              >
                <Layout className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* IDE Content */}
      <div className="flex-1 flex">
        {/* Coming Soon Placeholder */}
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-claude-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">IDE Coming Soon</h2>
            <p className="text-gray-600 mb-4">
              Full IDE interface with file explorer, Monaco Editor, terminal, and Claude Code panel
            </p>
            <div className="text-sm text-gray-500">
              <p>Project: <span className="font-medium">{project.name}</span></p>
              <p>Template: <span className="font-medium capitalize">{project.template}</span></p>
              <p>Layout: <span className="font-medium capitalize">{layout}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};