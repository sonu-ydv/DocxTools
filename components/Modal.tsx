import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Tool, EditPdfComponentRef } from '../types';
import { XIcon, UploadIcon, FileIcon, TrashIcon } from './icons';

declare const pdfjsLib: any;

interface ModalProps {
    tool: Tool;
    onClose: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const isFileTypeAllowed = (file: File, acceptedTypesString: string) => {
    if (acceptedTypesString === '*') return true;
    const acceptedTypes = acceptedTypesString.split(',').map(t => t.trim().toLowerCase());

    const fileExtension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
    const fileMime = file.type.toLowerCase();
    const fileBaseMime = fileMime ? `${fileMime.split('/')[0]}/*` : ''; // e.g. image/*

    return acceptedTypes.some(type => {
        if (type.startsWith('.')) { // It's an extension like '.pdf'
            return fileExtension === type;
        }
        if (type.endsWith('/*')) { // It's a wildcard mime like 'image/*'
            return fileBaseMime === type;
        }
        return fileMime === type; // It's a specific mime like 'application/pdf'
    });
};

const Modal: React.FC<ModalProps> = ({ tool, onClose }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [output, setOutput] = useState<React.ReactNode>(null);
    const [options, setOptions] = useState<any>({});
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const optionsRef = useRef<EditPdfComponentRef>(null);

    const isFullScreen = tool.id === 'edit-pdf';

    const resetModal = useCallback(() => {
        setFiles([]);
        setOutput(null);
        setOptions({});
        setPreviewUrl(null);
        setIsPreviewLoading(false);
        setError(null);
    }, []);

    useEffect(() => {
        resetModal();
    }, [tool, resetModal]);

    useEffect(() => {
        let currentPreviewUrl: string | null = null;
        
        if (files.length > 0 && !isFullScreen) {
            const file = files[0];
            const generatePreview = async () => {
                setIsPreviewLoading(true);

                if (file.type.startsWith('image/')) {
                    currentPreviewUrl = URL.createObjectURL(file);
                    setPreviewUrl(currentPreviewUrl);
                } else if (file.type === 'application/pdf') {
                    try {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
                        const pdfData = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument(pdfData).promise;
                        const page = await pdf.getPage(1);
                        const viewport = page.getViewport({ scale: 1.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        if (context) {
                            await page.render({ canvasContext: context, viewport }).promise;
                            setPreviewUrl(canvas.toDataURL());
                        } else {
                            setPreviewUrl(null);
                        }
                    } catch (error) {
                        console.error("Failed to generate PDF preview:", error);
                        setPreviewUrl(null);
                    }
                } else {
                    setPreviewUrl(null); // No preview for other types
                }
                setIsPreviewLoading(false);
            };

            generatePreview();
        } else {
            setPreviewUrl(null);
        }

        return () => {
            if (currentPreviewUrl) {
                URL.revokeObjectURL(currentPreviewUrl);
            }
        };
    }, [files, isFullScreen]);

    const handleFileChange = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;
    
        setError(null);
    
        const newAcceptedFiles: File[] = [];
        let validationError: string | null = null;
    
        for (const file of Array.from(selectedFiles)) {
            if (file.size > MAX_FILE_SIZE) {
                validationError = `${file.name}: File is too large (max 50MB).`;
                break;
            }
    
            if (!isFileTypeAllowed(file, tool.fileType)) {
                validationError = `${file.name}: Invalid file type. Expected: ${tool.fileType}.`;
                break;
            }
            newAcceptedFiles.push(file);
        }
        
        if (validationError) {
            setError(validationError);
            return;
        }
    
        if (tool.multipleFiles) {
            setFiles(prev => [...prev, ...newAcceptedFiles]);
        } else {
            setFiles(newAcceptedFiles.slice(0, 1));
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
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        if (newFiles.length === 0) {
            setError(null);
        }
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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

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
                    className={`flex flex-col items-center justify-center p-10 border-4 border-dashed rounded-lg cursor-pointer transition-colors h-full ${isDragging ? 'border-primary-red bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-red'} ${error ? 'border-red-500' : ''}`}
                >
                    <UploadIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                    <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Drag & drop files here</p>
                    <p className="text-gray-500 dark:text-gray-400">or click to select files</p>
                    {error && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 rounded-lg text-sm w-full">
                            <p className="font-bold text-center">Upload Error</p>
                            <p className="text-center">{error}</p>
                        </div>
                    )}
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Accepted file type(s): {tool.fileType}</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Maximum file size: 50MB</p>
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
            <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* Preview Panel */}
                <div className="md:w-1/2 h-64 md:h-auto bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center p-2 border dark:border-gray-700">
                    {isPreviewLoading ? (
                        <div className="flex flex-col items-center justify-center text-center">
                            <div className="spinner w-8 h-8 border-4 border-primary-red border-t-transparent rounded-full mb-2"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Generating Preview...</p>
                        </div>
                    ) : previewUrl ? (
                        <img src={previewUrl} alt="File preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                            <FileIcon className="w-16 h-16 mx-auto mb-2" />
                            <p className="font-semibold">No preview available</p>
                            <p className="text-sm truncate max-w-xs">{files[0]?.name}</p>
                        </div>
                    )}
                </div>

                {/* Controls Panel */}
                <div className="md:w-1/2 flex flex-col">
                    <div className="space-y-4 overflow-y-auto pr-2">
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
                             {tool.multipleFiles && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-2 w-full text-center bg-gray-200 dark:bg-gray-700 text-sm font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Add more files
                                </button>
                            )}
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
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className={`bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden fade-in ${
                    isFullScreen 
                    ? 'w-screen h-screen max-w-none max-h-none rounded-none' 
                    : 'w-full max-w-4xl max-h-[90vh] rounded-lg'
                }`} 
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {!isFullScreen && (
                    <header className="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
                        <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white">{tool.title}</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                            <XIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </header>
                )}

                <main className={`flex-grow overflow-y-auto ${!isFullScreen ? 'p-6' : 'p-0'}`}>
                    {renderContent()}
                </main>

                {!isFullScreen && files.length > 0 && !isLoading && (
                    <footer className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex-shrink-0">
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
