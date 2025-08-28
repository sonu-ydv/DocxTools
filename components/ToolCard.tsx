
import React from 'react';
import type { Tool } from '../types';

interface ToolCardProps {
    tool: Tool;
    onClick: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => {
    return (
        <div 
            onClick={onClick} 
            className="group relative flex flex-col items-center justify-center text-center p-6 h-full bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl hover:scale-105 border-2 border-transparent hover:border-primary-red transition-all duration-300 cursor-pointer"
        >
            {tool.new && (
                <span className="absolute top-2 right-2 bg-primary-red text-white text-xs font-bold px-2 py-1 rounded-full">New!</span>
            )}
            <div className="mb-4 text-primary-red">
                <tool.icon className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tool.title}</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex-grow">{tool.description}</p>
        </div>
    );
};

export default ToolCard;
