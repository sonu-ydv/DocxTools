
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ToolsGrid from './components/ToolsGrid';
import About from './components/About';
import Footer from './components/Footer';
import Modal from './components/Modal';
import { ThemeProvider } from './hooks/useTheme';
import { useIntersectionObserver } from './hooks/useIntersectionObserver';
import { toolImplementations } from './services/toolImplementations';
import type { Tool } from './types';

const AppContent: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<Tool | null>(null);

    useIntersectionObserver('.reveal');

    const openModal = useCallback((tool: Tool) => {
        setActiveTool(tool);
        setIsModalOpen(true);
        document.body.style.overflow = 'hidden';
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setActiveTool(null);
        document.body.style.overflow = '';
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
                <Hero />
                <div className="my-8 reveal flex justify-center">
                    <div className="w-[728px] h-[90px] border border-dashed border-gray-400 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">Advertisement - 728x90</span>
                    </div>
                </div>
                <ToolsGrid onToolSelect={openModal} />
                <About />
            </main>
            <Footer />
            {isModalOpen && activeTool && (
                <Modal tool={activeTool} onClose={closeModal} />
            )}
        </div>
    );
};


const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;