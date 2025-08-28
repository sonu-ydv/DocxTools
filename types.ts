
import React from 'react';

export interface EditPdfComponentRef {
    getSaveState: () => Record<string, any>;
    getOutputFilename: () => string;
}

export interface Tool {
    id: string;
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    fileType: string;
    multipleFiles: boolean;
    new?: boolean;
    optionsComponent?: React.ForwardRefExoticComponent<{ 
        options: any; 
        setOptions: (options: any) => void; 
        files: File[];
        onProcess?: () => void;
        onClose?: () => void;
    } & React.RefAttributes<EditPdfComponentRef | undefined>>;
    process: (files: File[], options?: any) => Promise<void>;
}
