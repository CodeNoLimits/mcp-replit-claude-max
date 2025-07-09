import { useState } from 'react';
import { Plus, Play, Trash2, Clock, Folder, Zap } from 'lucide-react';
import { Project, ProjectTemplate } from '../types/project';
import { useProjects } from '../hooks/useProjects';
import { toast } from 'react-hot-toast';

interface ProjectSelectorProps {
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
}

const templateIcons = {
  empty: '📄',
  node: '🟢',
  react: '⚛️',
  vue: '💚',
  python: '🐍',
};

const templateDescriptions = {
  empty: 'Start with an empty project',
  node: 'Node.js server with Express',
  react: 'React application with TypeScript',
  vue: 'Vue.js application with TypeScript',
  python: 'Python project with pip requirements',
};

export const ProjectSelector = ({ projects, onProjectSelect }: ProjectSelectorProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>('empty');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createProject, deleteProject } = useProjects();

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsCreating(true);
    try {
      const newProject = await createProject(
        projectName.trim(),
        selectedTemplate,
        projectDescription.trim() || undefined
      );
      
      toast.success('Project created successfully!');
      setShowCreateModal(false);
      setProjectName('');
      setProjectDescription('');
      setSelectedTemplate('empty');
      
      // Auto-select the new project
      onProjectSelect(newProject.id);
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteProject(projectId);
      toast.success('Project deleted successfully');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-claude-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-claude-600 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MCP Replit Claude Max</h1>
                <p className="text-sm text-gray-600">AI-powered development environment</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-claude flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">Create your first project to get started with AI-powered development.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-claude flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
                onClick={() => onProjectSelect(project.id)}
              >
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{templateIcons[project.template as keyof typeof templateIcons] || '📄'}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">{project.template}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`status-indicator ${
                        project.status === 'active' ? 'bg-green-500' :
                        project.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                        project.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id, project.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  {project.description && (
                    <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Modified {formatDate(project.lastAccessed)}</span>
                    </div>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="flex items-center justify-between">
                    <span className={`badge ${
                      project.status === 'active' ? 'badge-success' :
                      project.status === 'creating' ? 'badge-warning' :
                      project.status === 'error' ? 'badge-error' : 'badge-primary'
                    }`}>
                      {project.status}
                    </span>
                    <div className="flex items-center space-x-1 text-primary-600 group-hover:text-primary-700">
                      <Play className="w-4 h-4" />
                      <span className="text-sm font-medium">Open</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="input w-full"
                    placeholder="My awesome project"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template
                  </label>
                  <div className="space-y-2">
                    {Object.entries(templateDescriptions).map(([template, description]) => (
                      <label key={template} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="template"
                          value={template}
                          checked={selectedTemplate === template}
                          onChange={(e) => setSelectedTemplate(e.target.value as ProjectTemplate)}
                          className="text-primary-600"
                        />
                        <span className="text-xl">{templateIcons[template as keyof typeof templateIcons]}</span>
                        <div>
                          <div className="font-medium text-sm capitalize">{template}</div>
                          <div className="text-xs text-gray-500">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="input w-full h-20 resize-none"
                    placeholder="Brief description of your project..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  className="btn-claude"
                  disabled={isCreating || !projectName.trim()}
                >
                  {isCreating ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};