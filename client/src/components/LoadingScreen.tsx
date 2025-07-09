import { Zap } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-claude-50">
      <div className="text-center">
        {/* Animated logo */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-claude-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <div className="relative flex items-center justify-center w-20 h-20 bg-claude-600 rounded-full mx-auto">
              <Zap className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Loading text */}
        <h1 className="text-4xl font-bold mb-4">
          <span className="gradient-text">MCP Replit</span>
          <span className="text-gray-900"> Claude Max</span>
        </h1>
        
        <p className="text-lg text-gray-600 mb-8">
          AI-powered development environment
        </p>

        {/* Loading animation */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Initializing your coding environment...
        </p>
      </div>
    </div>
  );
};