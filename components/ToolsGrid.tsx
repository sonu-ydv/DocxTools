import React, { useState, useMemo } from 'react';
import ToolCard from './ToolCard';
import { toolImplementations } from '../services/toolImplementations';
import type { Tool } from '../types';
import { SearchIcon } from './icons';

interface ToolsGridProps {
    onToolSelect: (tool: Tool) => void;
}

const ToolsGrid: React.FC<ToolsGridProps> = ({ onToolSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const tools = Object.values(toolImplementations);

    const filteredTools = useMemo(() => {
        if (!searchQuery) {
            return tools;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return tools.filter(tool =>
            tool.title.toLowerCase().includes(lowerCaseQuery) ||
            tool.description.toLowerCase().includes(lowerCaseQuery)
        );
    }, [searchQuery, tools]);

    return (
        <section id="tools" className="py-16 bg-background-light dark:bg-background-dark">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 reveal">
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                        Our Suite of PDF Tools
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                        Choose from 27 tools to manage your documents effortlessly.
                    </p>
                </div>

                <div className="mb-12 max-w-2xl mx-auto reveal">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </span>
                        <input
                            id="tools-search"
                            type="search"
                            placeholder="Search for a tool (e.g., 'merge', 'word', 'sign')..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-full shadow-sm focus:ring-primary-red focus:border-primary-red dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                            aria-label="Search for a tool"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {filteredTools.length > 0 ? (
                        filteredTools.map((tool) => (
                            <div key={tool.id} className="reveal">
                                <ToolCard tool={tool} onClick={() => onToolSelect(tool)} />
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12">
                            <p className="text-xl text-gray-600 dark:text-gray-400">
                                No tools found for "{searchQuery}"
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ToolsGrid;