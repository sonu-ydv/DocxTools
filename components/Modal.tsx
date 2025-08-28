
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Tool, EditPdfComponentRef } from '../types';
import { XIcon, UploadIcon, FileIcon, TrashIcon } from './icons';

interface ModalProps {
    tool: Tool;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ tool, onClose }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [output, setOutput] = useState<React.ReactNode>(null);
    const [options, setOptions] = useState<any>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const optionsRef = useRef<EditPdfComponentRef>(null);

    const isFullScreen = tool.id === 'edit-pdf';

    const resetModal = useCallback(() => {
        setFiles([]);
        setOutput(null);
        setOptions({});
    }, []);

    useEffect(() => {
        resetModal();
    }, [tool, resetModal]);

    const handleFileChange = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;

        const newFiles = Array.from(selectedFiles).filter(file => {
            if (tool.fileType === 'image/*') {
                return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
            }
            return file.type === tool.fileType || tool.fileType === '*' || tool.fileType.endsWith('/*');
        });
        
        if (tool.multipleFiles) {
            setFiles(prev => [...prev, ...newFiles]);
        } else {
            setFiles(newFiles.slice(0, 1));
        }
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files);
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleProcess = async () => {
        if (files.length === 0) return;
        setIsLoading(true);
        setLoadingText('Processing your file(s)...');
        setOutput(null);

        let finalOptions = { ...options };
        if (tool.id === 'edit-pdf' && optionsRef.current) {
            finalOptions.fabricStates = optionsRef.current.getSaveState();
            finalOptions.outputFilename = optionsRef.current.getOutputFilename();
        }

        try {
            await tool.process(files, { ...finalOptions, showLoader: setLoadingText });
        } catch (error) {
            console.error('Processing error:', error);
            alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
            if(tool.id === 'edit-pdf') {
                onClose(); // Close after processing for full-screen editor
            }
        }
    };
    
    useEffect(() => {
        const handleDownload = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { url, filename } = customEvent.detail;
            
            setOutput(prev => (
                <>
                    {prev}
                    <a 
                        href={url} 
                        download={filename}
                        className="block w-full text-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors mt-4"
                    >
                        Download {filename}
                    </a>
                </>
            ));
        };

        window.addEventListener('create-download', handleDownload);
        return () => {
            window.removeEventListener('create-download', handleDownload);
        };
    }, []);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="spinner w-12 h-12 border-4 border-primary-red border-t-transparent rounded-full mb-4"></div>
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">{loadingText}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Please wait, this may take a moment...</p>
                </div>
            );
        }

        if (files.length === 0) {
            return (
                <div 
                    onDragEnter={handleDragEnter} 
                    onDragLeave={handleDragLeave} 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-10 border-4 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary-red bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-red'}`}
                >
                    <UploadIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                    <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Drag & drop files here</p>
                    <p className="text-gray-500 dark:text-gray-400">or click to select files</p>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Accepted file type: {tool.fileType}</p>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        multiple={tool.multipleFiles}
                        accept={tool.fileType}
                        onChange={(e) => handleFileChange(e.target.files)} 
                        className="hidden" 
                    />
                </div>
            );
        }

        if (isFullScreen && tool.optionsComponent) {
            const OptionsComponent = tool.optionsComponent;
            return <OptionsComponent ref={optionsRef} options={options} setOptions={setOptions} files={files} onProcess={handleProcess} onClose={onClose} />;
        }
        
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Selected Files:</h3>
                    <ul className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-md dark:border-gray-600">
                        {files.map((file, index) => (
                            <li key={index} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                <div className="flex items-center truncate">
                                    <FileIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                                    <span className="truncate text-sm">{file.name}</span>
                                </div>
                                <button onClick={() => removeFile(index)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50">
                                    <TrashIcon className="w-5 h-5 text-red-500" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                {tool.optionsComponent && (
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Options:</h3>
                        {React.createElement(tool.optionsComponent, { ref: optionsRef, options, setOptions, files })}
                    </div>
                )}
                 {output && (
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Output:</h3>
                        {output}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
            <div 
                className={`bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden fade-in ${
                    isFullScreen 
                    ? 'w-screen h-screen max-w-none max-h-none rounded-none' 
                    : 'w-full max-w-4xl max-h-[90vh] rounded-lg'
                }`} 
                onClick={(e) => e.stopPropagation()}
            >
                {!isFullScreen && (
                    <header className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tool.title}</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                            <XIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </header>
                )}

                <div className={`flex-grow flex overflow-hidden ${isFullScreen ? 'flex-row' : ''}`}>
                    <main className={`flex-1 overflow-y-auto ${!isFullScreen ? 'p-6' : 'p-0'}`}>
                        {renderContent()}
                    </main>

                    {!isFullScreen && (
                         <aside className="hidden md:block w-[200px] bg-gray-50 dark:bg-gray-900/50 p-4 border-l dark:border-gray-700">
                             <div className="w-full h-[400px] border border-dashed border-gray-400 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                                <span className="text-gray-500 dark:text-gray-400 text-center">Advertisement<br/>200x400</span>
                            </div>
                        </aside>
                    )}
                </div>

                {!isFullScreen && files.length > 0 && !isLoading && (
                    <footer className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700">
                        <button 
                            onClick={handleProcess}
                            disabled={files.length === 0}
                            className="w-full bg-primary-red text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {tool.title}
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default Modal;
