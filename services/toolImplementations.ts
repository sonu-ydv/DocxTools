// Fix: Replaced JSX with React.createElement to resolve parsing issues in .ts file.
import React from 'react';
import type { Tool, EditPdfComponentRef } from '../types';
import {
    MergeIcon, SplitIcon, CompressIcon, WordIcon, PptIcon, ExcelIcon,
    EditIcon, JpgIcon, SignIcon, WatermarkIcon, RotateIcon, HtmlIcon,
    UnlockIcon, LockIcon, OrganizeIcon, PageNumberIcon, OcrIcon, RedactIcon,
    CropIcon, DefaultIcon, PointerIcon, TypeIcon, RectangleIcon, PencilIcon, EraserIcon,
    ZoomInIcon, ZoomOutIcon, ExitIcon, UndoIcon, RedoIcon, CircleIcon, LineIcon,
    BoldIcon, ItalicIcon, UnderlineIcon, AlignLeftIcon, AlignCenterIcon, AlignRightIcon
} from '../components/icons';

declare const PDFLib: any;
declare const pdfjsLib: any;
declare const mammoth: any;
declare const html2pdf: any;
declare const PptxGenJS: any;
declare const JSZip: any;
declare const fabric: any;
declare const Tesseract: any;
// FIX: Added declaration for XLSX to resolve 'Cannot find name' error.
declare const XLSX: any;

const createDownload = (data: Uint8Array | Blob, filename: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const event = new CustomEvent('create-download', { detail: { url, filename } });
    window.dispatchEvent(event);
};

const placeholderProcess = (toolTitle: string) => async () => {
    alert(`${toolTitle} is not yet implemented.`);
    return Promise.resolve();
};

const fonts = [
    { name: 'Arial', family: 'Arial, sans-serif' },
    { name: 'Helvetica', family: 'Helvetica, sans-serif' },
    { name: 'Times New Roman', family: "'Times New Roman', Times, serif" },
    { name: 'Courier New', family: "'Courier New', Courier, monospace" },
    { name: 'Roboto', family: 'Roboto, sans-serif' },
    { name: 'Montserrat', family: 'Montserrat, sans-serif' },
    { name: 'Lobster', family: 'Lobster, cursive' },
    { name: 'Playfair Display', family: "'Playfair Display', serif" },
];

const EditPdfComponent = React.forwardRef<EditPdfComponentRef, { 
    files: File[], 
    onProcess?: () => void, 
    onClose?: () => void 
}>(({ files, onProcess, onClose }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = React.useRef<any>(null);
    const pdfDocRef = React.useRef<any>(null);
    
    const fabricStatesRef = React.useRef<Record<number, any>>({});
    const historyRef = React.useRef<Record<number, any[]>>({});
    const historyIndexRef = React.useRef<Record<number, number>>({});
    const isUpdatingFromHistory = React.useRef(false);

    const [thumbnails, setThumbnails] = React.useState<string[]>([]);
    const [totalPages, setTotalPages] = React.useState(0);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [zoom, setZoom] = React.useState(1);
    const [activeTool, setActiveTool] = React.useState('select');
    const [toolSettings, setToolSettings] = React.useState({
        fillColor: '#e5322d80',
        strokeColor: '#e5322d',
        textColor: '#1a202c',
        brushWidth: 5,
        fontSize: 24,
        fontFamily: 'Roboto, sans-serif',
    });
    const [historyState, setHistoryState] = React.useState({ canUndo: false, canRedo: false });
    const [isTextSelected, setIsTextSelected] = React.useState(false);
    const [activeObjectStyles, setActiveObjectStyles] = React.useState({
        fontWeight: 'normal', fontStyle: 'normal', underline: false, textAlign: 'left',
    });
    const [outputFilename, setOutputFilename] = React.useState('');
    
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);


    React.useEffect(() => {
        setOutputFilename(files[0]?.name.replace(/\.pdf$/i, '_edited.pdf') || 'edited.pdf');
    }, [files]);
    
    const updateHistoryButtons = React.useCallback(() => {
        const pageHistory = historyRef.current[currentPage] || [];
        const currentIndex = historyIndexRef.current[currentPage] ?? -1;
        setHistoryState({
            canUndo: currentIndex > 0,
            canRedo: currentIndex < pageHistory.length - 1,
        });
    }, [currentPage]);
    
    const saveState = React.useCallback((canvas: any) => {
        if (isUpdatingFromHistory.current) return;
        const pageHistory = historyRef.current[currentPage] || [];
        let currentIndex = historyIndexRef.current[currentPage] ?? -1;
        const newHistory = pageHistory.slice(0, currentIndex + 1);
        const newState = canvas.toJSON();
        newHistory.push(newState);
        historyRef.current[currentPage] = newHistory;
        historyIndexRef.current[currentPage] = newHistory.length - 1;
        updateHistoryButtons();
    }, [currentPage, updateHistoryButtons]);

    const debouncedSaveState = React.useCallback(
        (...args: [any]) => {
            const debounce = (func: Function, delay: number) => {
                let timeout: number;
                return (...args: any[]) => {
                    clearTimeout(timeout);
                    timeout = window.setTimeout(() => func(...args), delay);
                };
            };
            return debounce(saveState, 300)(...args);
        },
        [saveState]
    );

    const undo = React.useCallback(() => {
        const currentIndex = historyIndexRef.current[currentPage];
        if (currentIndex > 0) {
            isUpdatingFromHistory.current = true;
            const newIndex = currentIndex - 1;
            historyIndexRef.current[currentPage] = newIndex;
            const prevState = historyRef.current[currentPage][newIndex];
            fabricCanvasRef.current.loadFromJSON(prevState, () => {
                fabricCanvasRef.current.renderAll();
                isUpdatingFromHistory.current = false;
            });
            updateHistoryButtons();
        }
    }, [currentPage, updateHistoryButtons]);

    const redo = React.useCallback(() => {
        const pageHistory = historyRef.current[currentPage];
        const currentIndex = historyIndexRef.current[currentPage];
        if (currentIndex < pageHistory.length - 1) {
            isUpdatingFromHistory.current = true;
            const newIndex = currentIndex + 1;
            historyIndexRef.current[currentPage] = newIndex;
            const nextState = pageHistory[newIndex];
            fabricCanvasRef.current.loadFromJSON(nextState, () => {
                fabricCanvasRef.current.renderAll();
                isUpdatingFromHistory.current = false;
            });
            updateHistoryButtons();
        }
    }, [currentPage, updateHistoryButtons]);

    React.useImperativeHandle(ref, () => ({
        getSaveState: () => {
            if (fabricCanvasRef.current) {
                fabricStatesRef.current[currentPage] = fabricCanvasRef.current.toJSON();
            }
            return fabricStatesRef.current;
        },
        getOutputFilename: () => outputFilename,
    }));

    const renderPage = React.useCallback(async (pageNum: number) => {
        if (!pdfDocRef.current || !fabricCanvasRef.current) return;
        const fabricCanvas = fabricCanvasRef.current;
        const page = await pdfDocRef.current.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 * zoom });

        fabricCanvas.setWidth(viewport.width);
        fabricCanvas.setHeight(viewport.height);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewport.width;
        tempCanvas.height = viewport.height;
        const context = tempCanvas.getContext('2d');
        if(!context) return;
        
        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = tempCanvas.toDataURL();
        fabricCanvas.setBackgroundImage(dataUrl, fabricCanvas.renderAll.bind(fabricCanvas));

        const pageState = fabricStatesRef.current[pageNum];
        if (pageState) {
            fabricCanvas.loadFromJSON(pageState, () => fabricCanvas.renderAll());
        } else {
            fabricCanvas.clear();
            saveState(fabricCanvas);
        }
        updateHistoryButtons();
    }, [zoom, saveState, updateHistoryButtons]);
    
    React.useEffect(() => {
        if(pdfDocRef.current) {
            renderPage(currentPage);
        }
    }, [zoom, currentPage, renderPage]);

    const applyTextFormatting = (property: string, value: any) => {
        const canvas = fabricCanvasRef.current;
        const activeObject = canvas?.getActiveObject();
        if (activeObject?.type === 'textbox') {
            if (activeObject.isEditing) {
                activeObject.setSelectionStyles({ [property]: value });
            } else {
                activeObject.set(property, value);
            }
            canvas.requestRenderAll();
            debouncedSaveState(canvas);
        }
    };

// FIX: The original state update logic was not type-safe.
// This refactors `toggleTextStyle` with a type-safe branching structure
// to help TypeScript understand the correlation between `style` and `newValue`.
    const toggleTextStyle = (style: 'fontWeight' | 'fontStyle' | 'underline') => {
        const canvas = fabricCanvasRef.current;
        const activeObject = canvas?.getActiveObject();
        if (activeObject?.type === 'textbox') {
            const isToggled = style === 'fontWeight' ? activeObject[style] === 'bold' : style === 'fontStyle' ? activeObject[style] === 'italic' : activeObject[style];
            const newValue = style === 'fontWeight' ? (isToggled ? 'normal' : 'bold') : style === 'fontStyle' ? (isToggled ? 'normal' : 'italic') : !isToggled;
            
            if (activeObject.isEditing && activeObject.selectionStart !== activeObject.selectionEnd) {
                 activeObject.setSelectionStyles({ [style]: newValue });
            } else {
                activeObject.set(style, newValue);
            }
            
            canvas.requestRenderAll();
            debouncedSaveState(canvas);
            
            if (style === 'fontWeight') {
                setActiveObjectStyles(s => ({ ...s, fontWeight: newValue as string }));
            } else if (style === 'fontStyle') {
                setActiveObjectStyles(s => ({ ...s, fontStyle: newValue as string }));
            } else if (style === 'underline') {
                setActiveObjectStyles(s => ({ ...s, underline: newValue as boolean }));
            }
        }
    };
    
    const setAlignment = (align: 'left' | 'center' | 'right') => {
        applyTextFormatting('textAlign', align);
        setActiveObjectStyles({...activeObjectStyles, textAlign: align });
    };

    React.useEffect(() => {
        const file = files[0];
        if (!file) return;

        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
        
        const initCanvas = () => {
            if (canvasRef.current && !fabricCanvasRef.current) {
                const canvas = new fabric.Canvas(canvasRef.current);
                fabricCanvasRef.current = canvas;

                const handleSelection = (e: any) => {
                    const selection = e.target || e.selected?.[0];
                    if (!selection) {
                        setIsTextSelected(false);
                        return;
                    }

                    const isText = selection.type === 'textbox';
                    setIsTextSelected(isText);

                    if (isText) {
                        setActiveObjectStyles({
                            fontWeight: selection.fontWeight || 'normal',
                            fontStyle: selection.fontStyle || 'normal',
                            underline: selection.underline || false,
                            textAlign: selection.textAlign || 'left',
                        });
                        setToolSettings(s => ({
                            ...s, 
                            textColor: selection.fill || '#1a202c',
                            fontFamily: selection.fontFamily, 
                            fontSize: selection.fontSize
                        }));
                    } else {
                        setToolSettings(s => ({...s, fillColor: selection.fill || 'transparent', strokeColor: selection.stroke || '#000000' }));
                    }
                };

                canvas.on('selection:created', handleSelection);
                canvas.on('selection:updated', handleSelection);
                canvas.on('selection:cleared', () => setIsTextSelected(false));
                canvas.on('object:added', () => debouncedSaveState(canvas));
                canvas.on('object:removed', () => debouncedSaveState(canvas));
                canvas.on('object:modified', () => debouncedSaveState(canvas));
            }
        };

        const loadPdf = async () => {
            const pdfData = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            pdfDocRef.current = pdf;
            setTotalPages(pdf.numPages);
            setCurrentPage(1);
            fabricStatesRef.current = {}; historyRef.current = {}; historyIndexRef.current = {};
            await renderPage(1);
            generateThumbnails(pdf);
        };

        const generateThumbnails = async (pdf: any) => {
            const thumbs = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => {
                const page = await pdf.getPage(i + 1);
                const viewport = page.getViewport({ scale: 0.2 });
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const ctx = canvas.getContext('2d');
                if (!ctx) return '';
                await page.render({ canvasContext: ctx, viewport }).promise;
                return canvas.toDataURL();
            }));
            setThumbnails(thumbs);
        };

        initCanvas();
        loadPdf();

        return () => { fabricCanvasRef.current?.dispose(); fabricCanvasRef.current = null; };
    }, [files, renderPage, debouncedSaveState]);
    
    React.useEffect(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        canvas.isDrawingMode = false;
        canvas.off('mouse:down');
        canvas.selection = true;
        canvas.forEachObject((obj: any) => obj.set({ selectable: true }));

        const addShape = (shapeType: 'rect' | 'circle' | 'line') => (o: any) => {
            if (o.target || o.e.defaultPrevented) return;
            const pointer = canvas.getPointer(o.e);
            let shape: any;
            const sharedProps = {
                left: pointer.x, top: pointer.y, width: 0, height: 0,
                fill: toolSettings.fillColor, stroke: toolSettings.strokeColor, strokeWidth: toolSettings.brushWidth,
            };

            if (shapeType === 'rect') shape = new fabric.Rect(sharedProps);
            else if (shapeType === 'circle') shape = new fabric.Ellipse({ ...sharedProps, rx: 0, ry: 0, originX: 'left', originY: 'top' });
            else if (shapeType === 'line') shape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], { stroke: toolSettings.strokeColor, strokeWidth: toolSettings.brushWidth });
            
            if (!shape) return;
            canvas.add(shape);

            const onMouseMove = (oMove: any) => {
                const pointerMove = canvas.getPointer(oMove.e);
                const width = Math.abs(pointer.x - pointerMove.x);
                const height = Math.abs(pointer.y - pointerMove.y);
                const left = Math.min(pointer.x, pointerMove.x);
                const top = Math.min(pointer.y, pointerMove.y);

                if (shapeType === 'rect') {
                    shape.set({ width, height, left, top });
                } else if (shapeType === 'circle') {
                    shape.set({ rx: width / 2, ry: height / 2, left, top });
                } else if (shapeType === 'line') {
                    shape.set({ x2: pointerMove.x, y2: pointerMove.y });
                }
                canvas.renderAll();
            };
            const onMouseUp = () => { canvas.off('mouse:move', onMouseMove); canvas.off('mouse:up', onMouseUp); debouncedSaveState(canvas); };
            canvas.on('mouse:move', onMouseMove);
            canvas.on('mouse:up', onMouseUp);
        };
        
        if (activeTool === 'text') {
            canvas.on('mouse:down', (o: any) => {
                if (o.target) return;
                const pointer = canvas.getPointer(o.e);
                const text = new fabric.Textbox('Your text here', {
                    left: pointer.x, top: pointer.y, fill: toolSettings.textColor, fontSize: toolSettings.fontSize, fontFamily: toolSettings.fontFamily, width: 200,
                });
                canvas.add(text).setActiveObject(text);
                setActiveTool('select');
            });
        } else if (['rect', 'circle', 'line'].includes(activeTool)) {
            canvas.on('mouse:down', addShape(activeTool as 'rect' | 'circle' | 'line'));
        } else if (activeTool === 'draw') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = toolSettings.strokeColor;
            canvas.freeDrawingBrush.width = toolSettings.brushWidth;
        } else if (activeTool === 'eraser') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.width = toolSettings.brushWidth;
            canvas.freeDrawingBrush.globalCompositeOperation = 'destination-out';
        }
        
        return () => { if(canvas) canvas.off('mouse:down'); };
    }, [activeTool, toolSettings, debouncedSaveState]);

    const goToPage = (pageNum: number) => {
        if (pageNum < 1 || pageNum > totalPages || pageNum === currentPage) return;
        if (fabricCanvasRef.current) fabricStatesRef.current[currentPage] = fabricCanvasRef.current.toJSON();
        setCurrentPage(pageNum);
    };

    const handleZoom = (newZoom: number) => {
        const clampedZoom = Math.max(0.2, Math.min(newZoom, 5));
        setZoom(clampedZoom);
    };
    
    const handleColorChange = (type: 'fill' | 'stroke', color: string) => {
        const prop = type === 'fill' ? 'fillColor' : 'strokeColor';
        setToolSettings(s => ({ ...s, [prop]: color }));
        const canvas = fabricCanvasRef.current;
        const activeObject = canvas?.getActiveObject();
        if (activeObject) {
            activeObject.set(type, color);
            canvas.requestRenderAll();
            debouncedSaveState(canvas);
        }
    };
    
    const handleGeneratePreview = async () => {
        setIsGenerating(true);
        try {
            if (fabricCanvasRef.current) {
                fabricStatesRef.current[currentPage] = fabricCanvasRef.current.toJSON();
            }
            
            const { PDFDocument } = PDFLib;
            const file = files[0];
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const tempCanvas = new fabric.StaticCanvas(null, { width: 1, height: 1 });
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                const pageNum = i + 1;
                if (fabricStatesRef.current[pageNum]) {
                    const page = pages[i];
                    const { width, height } = page.getSize();
                    tempCanvas.setDimensions({ width, height });

                    const pageState = { ...fabricStatesRef.current[pageNum] };
                    // The background image is the rendered PDF page. We must remove it
                    // so we only render the user's annotations onto a transparent background.
                    pageState.backgroundImage = null;
                    
                    await new Promise<void>(resolve => tempCanvas.loadFromJSON(pageState, () => {
                        tempCanvas.renderAll();
                        resolve();
                    }));
                    
                    const dataUrl = tempCanvas.toDataURL({ format: 'png' });
                    const pngImage = await pdfDoc.embedPng(dataUrl);
                    page.drawImage(pngImage, { x: 0, y: 0, width: width, height: height });
                }
            }
            
            tempCanvas.dispose();
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            setPdfBlob(blob);
            setPreviewUrl(url);
        } catch (error) {
            console.error("Error generating PDF preview:", error);
            alert("Could not generate PDF preview. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfBlob || !previewUrl) return;
        const a = document.createElement('a');
        a.href = previewUrl;
        a.download = outputFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleBackToEditor = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPdfBlob(null);
    };

    React.useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // Consistent styling for controls
    const inputBaseClasses = 'h-9 px-2 py-1 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent';
    const colorInputClasses = 'w-8 h-8 p-1 border-2 border-transparent hover:border-primary-red dark:border-gray-600 dark:hover:border-primary-red rounded cursor-pointer bg-clip-content';
    const rangeInputClasses = 'w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-red';

    const ToolButton = ({ tool, Icon, label }: { tool: string, Icon: React.FC<{className?: string}>, label: string }) =>
        React.createElement('button', {
            onClick: () => setActiveTool(tool),
            className: `p-2 rounded-md transition-colors ${activeTool === tool ? 'bg-primary-red text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`,
            title: label,
        } as React.ComponentProps<'button'>, React.createElement(Icon, { className: 'h-6 w-6' }));
        
    const TextFormatButton = ({ style, Icon, label, value }: { style?: string, Icon: React.FC<{className?: string}>, label: string, value?: string }) =>
        React.createElement('button', {
            onClick: () => {
                if (label === 'Bold') toggleTextStyle('fontWeight');
                else if (label === 'Italic') toggleTextStyle('fontStyle');
                else if (label === 'Underline') toggleTextStyle('underline');
                else if (label.includes('Align')) setAlignment(value as 'left' | 'center' | 'right');
            },
            className: `p-2 rounded-md transition-colors ${
                (label === 'Bold' && activeObjectStyles.fontWeight === 'bold') ||
                (label === 'Italic' && activeObjectStyles.fontStyle === 'italic') ||
                (label === 'Underline' && activeObjectStyles.underline) ||
                (label.includes('Align') && activeObjectStyles.textAlign === value)
                 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`,
            title: label,
        } as React.ComponentProps<'button'>, React.createElement(Icon, { className: 'h-5 w-5' }));
    
    const TextToolbar = () => React.createElement('div', { className: 'flex items-center gap-1 border-l pl-2 ml-2 dark:border-gray-600' },
        React.createElement('label', { className: 'flex items-center' },
            React.createElement('input', {
                type: 'color',
                title: 'Text Color',
                value: toolSettings.textColor,
                onChange: e => {
                    const newColor = e.target.value;
                    applyTextFormatting('fill', newColor);
                    setToolSettings(s => ({...s, textColor: newColor}));
                },
                className: colorInputClasses,
            } as React.ComponentProps<'input'>)
        ),
        React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
        React.createElement(TextFormatButton, { Icon: BoldIcon, label: 'Bold' }),
        React.createElement(TextFormatButton, { Icon: ItalicIcon, label: 'Italic' }),
        React.createElement(TextFormatButton, { Icon: UnderlineIcon, label: 'Underline' }),
        React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
        React.createElement(TextFormatButton, { Icon: AlignLeftIcon, label: 'Align Left', value: 'left' }),
        React.createElement(TextFormatButton, { Icon: AlignCenterIcon, label: 'Align Center', value: 'center' }),
        React.createElement(TextFormatButton, { Icon: AlignRightIcon, label: 'Align Right', value: 'right' }),
        React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
        React.createElement('select', {
            title: 'Font Family',
            value: toolSettings.fontFamily,
            onChange: e => { applyTextFormatting('fontFamily', e.target.value); setToolSettings(s => ({...s, fontFamily: e.target.value})); },
            className: `${inputBaseClasses} w-40`
        } as React.ComponentProps<'select'>,
            ...fonts.map(font => React.createElement('option', { key: font.name, value: font.family, style: { fontFamily: font.family } }, font.name))
        ),
        React.createElement('input', {
            type: 'number',
            title: 'Font Size',
            value: toolSettings.fontSize,
            onChange: e => { const size = parseInt(e.target.value, 10); if (size > 0) { applyTextFormatting('fontSize', size); setToolSettings(s => ({...s, fontSize: size})); } },
            className: `${inputBaseClasses} w-20`,
        } as React.ComponentProps<'input'>)
    );

    const ShapeToolbar = () => React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
        React.createElement('label', { className: 'flex items-center' },
            React.createElement('input', {
                type: 'color',
                title: 'Fill Color',
                value: toolSettings.fillColor,
                onChange: e => handleColorChange('fill', e.target.value),
                className: colorInputClasses,
            } as React.ComponentProps<'input'>)
        ),
        React.createElement('label', { className: 'flex items-center' },
            React.createElement('input', {
                type: 'color',
                title: 'Stroke Color',
                value: toolSettings.strokeColor,
                onChange: e => handleColorChange('stroke', e.target.value),
                className: colorInputClasses,
            } as React.ComponentProps<'input'>)
        ),
        React.createElement('label', { className: 'flex items-center gap-2 text-sm', title: 'Brush/Stroke Size' } as React.ComponentProps<'label'>, 'Size:',
            React.createElement('input', {
                type: 'range',
                min: 1,
                max: 50,
                value: toolSettings.brushWidth,
                onChange: e => setToolSettings(s => ({ ...s, brushWidth: parseInt(e.target.value, 10) })),
                className: rangeInputClasses,
            }),
            React.createElement('span', { className: 'w-6 text-center text-xs font-mono' }, toolSettings.brushWidth)
        )
    );


    if (isGenerating) {
        return React.createElement('div', { className: 'h-screen w-screen flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-200' },
            React.createElement('div', { className: 'spinner w-12 h-12 border-4 border-primary-red border-t-transparent rounded-full mb-4' }),
            React.createElement('p', { className: 'text-lg font-semibold' }, 'Generating your PDF...'),
            React.createElement('p', { className: 'text-sm text-gray-600 dark:text-gray-400' }, 'This may take a moment, please wait.')
        );
    }
    
    if (previewUrl) {
        return React.createElement('div', { className: 'h-screen w-screen flex flex-col bg-gray-200 dark:bg-gray-900' },
            React.createElement('header', { className: 'flex items-center justify-between p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm' },
                React.createElement('p', { className: 'text-lg font-bold truncate text-gray-800 dark:text-gray-200 pl-2' }, outputFilename),
                React.createElement('div', { className: 'flex items-center gap-2' },
// FIX: Add type assertion to fix 'title' property error.
                    React.createElement('button', { onClick: handleBackToEditor, className: 'px-4 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600', title: 'Return to the editor' } as React.ComponentProps<'button'>, 'Back to Editor'),
// FIX: Add type assertion to fix 'title' property error.
                    React.createElement('button', { onClick: handleDownload, className: 'px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700', title: 'Download the edited PDF' } as React.ComponentProps<'button'>, 'Download PDF'),
// FIX: Add type assertion to fix 'title' property error.
                    React.createElement('button', { onClick: onClose, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Exit' } as React.ComponentProps<'button'>, React.createElement(ExitIcon, { className: 'h-6 w-6 text-gray-800 dark:text-gray-200' }))
                )
            ),
            React.createElement('main', { className: 'flex-1 bg-gray-500' },
                React.createElement('iframe', { src: previewUrl, className: 'w-full h-full border-none', title: 'PDF Preview' })
            )
        );
    }

    return React.createElement('div', { className: 'h-screen w-screen flex flex-col bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-200' },
        React.createElement('header', { className: 'flex items-center justify-between p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm' },
// FIX: Add type assertion to fix 'title' property error.
            React.createElement('input', { type: 'text', value: outputFilename, onChange: e => setOutputFilename(e.target.value), className: 'text-lg font-bold truncate px-2 py-1 rounded bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 w-1/3 border border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition', title: 'Click to edit the output filename' } as React.ComponentProps<'input'>),
            React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('button', { onClick: undo, disabled: !historyState.canUndo, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed', title: 'Undo (Ctrl+Z)' } as React.ComponentProps<'button'>, React.createElement(UndoIcon, { className: 'h-6 w-6' })),
                React.createElement('button', { onClick: redo, disabled: !historyState.canRedo, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed', title: 'Redo (Ctrl+Y)' } as React.ComponentProps<'button'>, React.createElement(RedoIcon, { className: 'h-6 w-6' })),
                React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
// FIX: Add type assertion to fix 'title' property error.
                React.createElement('button', { onClick: () => handleZoom(zoom * 0.8), className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Zoom Out' } as React.ComponentProps<'button'>, React.createElement(ZoomOutIcon, { className: 'h-6 w-6' })),
                React.createElement('span', { className: 'w-12 text-center font-mono' }, `${Math.round(zoom * 100)}%`),
// FIX: Add type assertion to fix 'title' property error.
                React.createElement('button', { onClick: () => handleZoom(zoom * 1.25), className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Zoom In' } as React.ComponentProps<'button'>, React.createElement(ZoomInIcon, { className: 'h-6 w-6' })),
                React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
// FIX: Add type assertion to fix 'title' property error.
                React.createElement('button', { onClick: handleGeneratePreview, className: 'px-4 py-2 bg-primary-red text-white font-bold rounded-lg hover:bg-red-700', title: 'Finalize and Preview PDF' } as React.ComponentProps<'button'>, 'Done'),
// FIX: Add type assertion to fix 'title' property error.
                React.createElement('button', { onClick: onClose, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Exit Editor' } as React.ComponentProps<'button'>, React.createElement(ExitIcon, { className: 'h-6 w-6' }))
            )
        ),
        React.createElement('div', { className: 'flex-1 flex overflow-hidden' },
            React.createElement('aside', { className: 'w-48 bg-gray-100 dark:bg-gray-800 p-2 overflow-y-auto border-r dark:border-gray-700' },
// FIX: Add type assertion to fix 'title' property error.
                thumbnails.map((thumb, index) => React.createElement('div', { key: index, onClick: () => goToPage(index + 1), className: `cursor-pointer p-1 mb-2 rounded border-2 ${currentPage === index + 1 ? 'border-primary-red' : 'border-transparent hover:border-gray-400'}`, title: `Go to page ${index + 1}` } as React.ComponentProps<'div'>,
                    React.createElement('img', { src: thumb, alt: `Page ${index + 1}`, className: 'w-full shadow-md' }),
                    React.createElement('p', {className: 'text-center text-xs mt-1'}, `Page ${index + 1}`)
                ))
            ),
            React.createElement('main', { className: 'flex-1 flex flex-col' },
                React.createElement('div', { className: 'flex flex-wrap items-center gap-1 p-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800' },
                    React.createElement(ToolButton, { tool: 'select', Icon: PointerIcon, label: 'Select Tool' }),
                    React.createElement(ToolButton, { tool: 'text', Icon: TypeIcon, label: 'Add Text' }),
                    React.createElement(ToolButton, { tool: 'draw', Icon: PencilIcon, label: 'Draw (Pencil)' }),
                    React.createElement(ToolButton, { tool: 'eraser', Icon: EraserIcon, label: 'Eraser' }),
                    React.createElement(ToolButton, { tool: 'rect', Icon: RectangleIcon, label: 'Add Rectangle' }),
                    React.createElement(ToolButton, { tool: 'circle', Icon: CircleIcon, label: 'Add Circle/Ellipse' }),
                    React.createElement(ToolButton, { tool: 'line', Icon: LineIcon, label: 'Add Line' }),
                    isTextSelected ? React.createElement(TextToolbar, null) : React.createElement(ShapeToolbar, null)
                ),
                React.createElement('div', { className: 'flex-1 overflow-auto p-4' },
                    React.createElement('canvas', { ref: canvasRef, className: 'shadow-lg mx-auto' })
                )
            )
        )
    );
});

const toolImplementationsList: Omit<Tool, 'id'>[] = [
    {
        title: 'Compress PDF',
        description: 'Reduce PDF file size to a specific target.',
        icon: CompressIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        optionsComponent: React.forwardRef(({ options, setOptions }: { options: any, setOptions: (o: any) => void }, _ref) => {
            const selectedSize = options.targetSize || '100'; // Default to 100kb
            const customSize = options.customSize || '';

            const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                if (value === 'custom') {
                    setOptions({ ...options, targetSize: 'custom' });
                } else {
                    setOptions({ ...options, targetSize: value, customSize: '' });
                }
            };

            const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                setOptions({ ...options, customSize: e.target.value });
            };

            const sizes = [
                { value: '50', label: 'Small (approx. 50 KB)' },
                { value: '100', label: 'Medium (approx. 100 KB)' },
                { value: '200', label: 'Large (approx. 200 KB)' },
                { value: '300', label: 'X-Large (approx. 300 KB)' },
            ];

            const radioClassName = 'h-4 w-4 text-primary-red border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 focus:ring-primary-red focus:ring-offset-2 dark:focus:ring-offset-gray-800';

            const sizeOptions = sizes.map(size =>
                React.createElement('label', { key: size.value, className: 'flex items-center p-3 border rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50' },
                    React.createElement('input', {
                        type: 'radio',
                        name: 'compression-size',
                        value: size.value,
                        checked: selectedSize === size.value,
                        onChange: handleSizeChange,
                        className: radioClassName
                    }),
                    React.createElement('span', { className: 'ml-3 text-sm font-medium text-gray-900 dark:text-white' }, size.label)
                )
            );

            const customOption = React.createElement('div', { className: 'p-3 border rounded-lg dark:border-gray-600' },
                React.createElement('label', { className: 'flex items-center cursor-pointer' },
                    React.createElement('input', {
                        type: 'radio',
                        name: 'compression-size',
                        value: 'custom',
                        checked: selectedSize === 'custom',
                        onChange: handleSizeChange,
                        className: radioClassName
                    }),
                    React.createElement('span', { className: 'ml-3 text-sm font-medium text-gray-900 dark:text-white' }, 'Custom Size')
                ),
                selectedSize === 'custom' && React.createElement('div', { className: 'mt-3 flex items-center' },
                    React.createElement('input', {
                        type: 'number',
                        placeholder: 'e.g., 250',
                        value: customSize,
                        onChange: handleCustomInputChange,
                        className: 'w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600'
                    }),
                    React.createElement('span', { className: 'ml-2 text-sm text-gray-500 dark:text-gray-400' }, 'KB')
                )
            );

            return React.createElement('div', { className: 'space-y-3' }, ...sizeOptions, customOption);
        }),
        process: async (files, { targetSize = '100', customSize, showLoader }) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
            const file = files[0];
            
            const targetBytes = (targetSize === 'custom' ? parseInt(customSize, 10) : parseInt(targetSize, 10)) * 1024;
            if (isNaN(targetBytes) || targetBytes <= 0) {
                throw new Error("Invalid target size specified.");
            }

            const initialPdfBytes = await file.arrayBuffer();
            if (initialPdfBytes.byteLength < targetBytes) {
                alert("The original file is already smaller than the target size. No compression needed.");
                createDownload(new Uint8Array(initialPdfBytes), `${file.name.replace(/\.pdf$/i, '')}_original.pdf`);
                return;
            }

            const pdf = await pdfjsLib.getDocument(initialPdfBytes).promise;
            const pageCanvases: HTMLCanvasElement[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                if(showLoader) showLoader(`Preparing page ${i}/${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');
                if(!context) throw new Error('Could not get canvas context');
                context.fillStyle = 'white';
                context.fillRect(0, 0, canvas.width, canvas.height);
                await page.render({ canvasContext: context, viewport }).promise;
                pageCanvases.push(canvas);
            }
            
            const createPdfFromCanvases = async (quality: number) => {
                const { PDFDocument } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                for (let i = 0; i < pageCanvases.length; i++) {
                    if(showLoader) showLoader(`Compressing page ${i+1}/${pdf.numPages}...`);
                    const canvas = pageCanvases[i];
                    const page = pdfDoc.addPage([canvas.width, canvas.height]);
                    const jpgUrl = canvas.toDataURL('image/jpeg', quality);
                    const jpgImageBytes = await fetch(jpgUrl).then(res => res.arrayBuffer());
                    const jpgImage = await pdfDoc.embedJpg(jpgImageBytes);
                    page.drawImage(jpgImage, {
                        x: 0,
                        y: 0,
                        width: canvas.width,
                        height: canvas.height,
                    });
                }
                return await pdfDoc.save();
            };

            let high = 1.0;
            let low = 0.0;
            let bestPdfBytes: Uint8Array | null = null;
            
            if(showLoader) showLoader('Finding optimal compression level...');

            // Binary search for the best quality setting
            for (let i = 0; i < 10; i++) {
                const mid = (high + low) / 2;
                const pdfBytes = await createPdfFromCanvases(mid);
                if (pdfBytes.length <= targetBytes) {
                    bestPdfBytes = pdfBytes;
                    low = mid; 
                } else {
                    high = mid;
                }
            }

            if (!bestPdfBytes) {
                // If even lowest quality is too big, use the lowest.
                bestPdfBytes = await createPdfFromCanvases(0.1);
            }
            
            const finalSize = (bestPdfBytes.length / 1024).toFixed(2);
            if(showLoader) showLoader(`Compression complete! Final size: ${finalSize} KB`);

            createDownload(bestPdfBytes, `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`);
        },
    },
    {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into one unified document.',
        icon: MergeIcon,
        fileType: 'application/pdf',
        multipleFiles: true,
        process: async (files, { showLoader }) => {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();
            for (const [index, file] of files.entries()) {
                if (showLoader) showLoader(`Merging file ${index + 1}/${files.length}: ${file.name}`);
                const pdfBytes = await file.arrayBuffer();
                const pdf = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            if (showLoader) showLoader('Finalizing merged PDF...');
            const mergedPdfBytes = await mergedPdf.save();
            createDownload(mergedPdfBytes, 'merged.pdf');
        },
    },
    {
        title: 'Split PDF',
        description: 'Extract specific pages or page ranges from a PDF file.',
        icon: SplitIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Split PDF'),
    },
    {
        title: 'PDF to Word',
        description: 'Convert PDF files to editable Word documents.',
        icon: WordIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('PDF to Word'),
    },
    {
        title: 'Word to PDF',
        description: 'Convert Word documents to PDF format.',
        icon: WordIcon,
        fileType: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            if (showLoader) showLoader('Converting Word to HTML...');
            const file = files[0];
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value;

            if (showLoader) showLoader('Converting HTML to PDF...');
            const element = document.createElement('div');
            element.innerHTML = html;
            // Basic styling to make it look like a document
            element.style.padding = '2cm';
            element.style.lineHeight = '1.5';
            element.style.fontFamily = 'Times New Roman, serif';
            element.style.fontSize = '12pt';

            document.body.appendChild(element);

            await html2pdf().from(element).set({
                margin: 1,
                filename: `${file.name.replace(/\.(docx|doc)$/i, '')}.pdf`,
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            }).save();
            
            document.body.removeChild(element);
        },
    },
    {
        title: 'PDF to PowerPoint',
        description: 'Convert PDFs into editable PowerPoint presentations.',
        icon: PptIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('PDF to PowerPoint'),
    },
    {
        title: 'PowerPoint to PDF',
        description: 'Convert PowerPoint presentations to PDF.',
        icon: PptIcon,
        fileType: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            alert('PowerPoint to PDF conversion is complex and has limited support. Images and text will be extracted, but layout may differ significantly.');
            const file = files[0];
            const pptx = new PptxGenJS();
            if (showLoader) showLoader('Loading PowerPoint file...');
            await pptx.load(file);
            if (showLoader) showLoader('Saving as PDF...');
            await pptx.save({
                fileName: `${file.name.replace(/\.(pptx|ppt)$/i, '')}`,
                format: 'pdf',
            });
        },
    },
    {
        title: 'PDF to Excel',
        description: 'Extract data from PDFs into Excel spreadsheets.',
        icon: ExcelIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('PDF to Excel'),
    },
    {
        title: 'Excel to PDF',
        description: 'Convert Excel spreadsheets to PDF documents.',
        icon: ExcelIcon,
        fileType: '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            showLoader?.('This is a basic conversion. For complex layouts, formatting may be lost.');
            const file = files[0];
            showLoader?.('Reading Excel file...');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            showLoader?.('Converting spreadsheet to HTML...');
            const html = XLSX.utils.sheet_to_html(worksheet);
            
            const element = document.createElement('div');
            element.innerHTML = `
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                    th, td { border: 1px solid #dddddd; text-align: left; padding: 8px; }
                    th { background-color: #f2f2f2; }
                </style>
                ${html}
            `;
            
            document.body.appendChild(element);
            
            showLoader?.('Generating PDF from HTML...');
            await html2pdf().from(element).set({
                margin: 0.5,
                filename: `${file.name.replace(/\.(xlsx|xls)$/i, '')}.pdf`,
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
            }).save();
            
            document.body.removeChild(element);
        },
    },
    {
        title: 'Edit PDF',
        description: 'Add text, shapes, and drawings to a PDF file.',
        icon: EditIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        new: true,
        optionsComponent: EditPdfComponent,
        process: async (files, options) => {
            const { showLoader } = options;
            const { PDFDocument } = PDFLib;
            const file = files[0];
            if (showLoader) showLoader('Loading original PDF...');
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            const fabricStates = options.fabricStates;
            const outputFilename = options.outputFilename || 'edited.pdf';
            const tempCanvas = new fabric.StaticCanvas(null, { width: 1, height: 1 });
            const pages = pdfDoc.getPages();
            
            for (let i = 0; i < pages.length; i++) {
                const pageNum = i + 1;
                if (fabricStates[pageNum]) {
                    if (showLoader) showLoader(`Applying edits to page ${pageNum}/${pages.length}...`);
                    const page = pages[i];
                    const { width, height } = page.getSize();
                    tempCanvas.setDimensions({ width, height });
                    
                    const pageState = { ...fabricStates[pageNum] };
                    pageState.backgroundImage = null;
                    
                    await new Promise<void>(resolve => tempCanvas.loadFromJSON(pageState, () => {
                        tempCanvas.renderAll();
                        resolve();
                    }));
                    
                    const dataUrl = tempCanvas.toDataURL({ format: 'png' });
                    const pngImage = await pdfDoc.embedPng(dataUrl);
                    page.drawImage(pngImage, { x: 0, y: 0, width, height });
                }
            }
            
            tempCanvas.dispose();
            if (showLoader) showLoader('Saving final PDF...');
            const pdfBytes = await pdfDoc.save();
            createDownload(pdfBytes, outputFilename);
        },
    },
    {
        title: 'PDF to JPG',
        description: 'Convert each page of a PDF to a high-quality JPG image.',
        icon: JpgIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
            const file = files[0];
            const pdfData = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(pdfData).promise;
            
            if (pdf.numPages === 1) {
                if (showLoader) showLoader('Converting page 1/1...');
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');
                if(!context) return;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                canvas.toBlob(blob => {
                    if (blob) createDownload(blob, `${file.name.replace('.pdf', '')}.jpg`);
                }, 'image/jpeg', 0.95);
            } else {
                const zip = new JSZip();
                for (let i = 1; i <= pdf.numPages; i++) {
                    if (showLoader) showLoader(`Converting page ${i}/${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    if(!context) continue;
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                    if (blob) {
                        zip.file(`${file.name.replace('.pdf', '')}_page_${i}.jpg`, blob);
                    }
                }
                if (showLoader) showLoader('Zipping images...');
                const content = await zip.generateAsync({ type: "blob" });
                createDownload(content, `${file.name.replace('.pdf', '')}.zip`);
            }
        },
    },
    {
        title: 'JPG to PDF',
        description: 'Convert JPG, PNG, and other image formats to PDF.',
        icon: JpgIcon,
        fileType: 'image/*',
        multipleFiles: true,
        process: async (files, { showLoader }) => {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.create();

            for (let i = 0; i < files.length; i++) {
                if (showLoader) showLoader(`Adding image ${i+1}/${files.length}...`);
                const file = files[i];
                const imageBytes = await file.arrayBuffer();
                let image;
                if (file.type === 'image/jpeg') {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    console.warn(`Unsupported image type: ${file.type}. Skipping.`);
                    continue;
                }
                
                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            }
            
            if (showLoader) showLoader('Finalizing PDF...');
            const pdfBytes = await pdfDoc.save();
            createDownload(pdfBytes, 'images_converted.pdf');
        },
    },
    {
        title: 'Sign PDF',
        description: 'Add your signature to a PDF document securely.',
        icon: SignIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Sign PDF'),
    },
    {
        title: 'Watermark PDF',
        description: 'Stamp an image or text over your PDF in seconds.',
        icon: WatermarkIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Watermark PDF'),
    },
    {
        title: 'Rotate PDF',
        description: 'Rotate all or specific pages in your PDF file.',
        icon: RotateIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Rotate PDF'),
    },
    {
        title: 'HTML to PDF',
        description: 'Convert web pages to PDF documents.',
        icon: HtmlIcon,
        fileType: '.html,.htm,text/html',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            const file = files[0];
            if (showLoader) showLoader('Reading HTML file...');
            const htmlContent = await file.text();
            const element = document.createElement('div');
            element.innerHTML = htmlContent;
            document.body.appendChild(element);
            if (showLoader) showLoader('Generating PDF from HTML...');
            await html2pdf().from(element).set({
                filename: `${file.name.replace(/\.(html|htm)$/i, '')}.pdf`,
            }).save();
            document.body.removeChild(element);
        },
    },
    {
        title: 'Unlock PDF',
        description: 'Remove passwords and restrictions from your PDFs.',
        icon: UnlockIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            const file = files[0];
            const password = prompt("Enter the password for the PDF file:");
            if (!password) {
                alert("Password is required to unlock the PDF.");
                return;
            }
            try {
                if (showLoader) showLoader('Attempting to decrypt PDF...');
                const { PDFDocument } = PDFLib;
                const existingPdfBytes = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(existingPdfBytes, {
                    password: password,
                    ignoreEncryption: false
                });
                if (showLoader) showLoader('Saving unlocked PDF...');
                const pdfBytes = await pdfDoc.save();
                createDownload(pdfBytes, `${file.name.replace(/\.pdf$/i, '')}_unlocked.pdf`);
            } catch (error) {
                alert("Failed to unlock PDF. The password may be incorrect or the encryption algorithm is not supported.");
                console.error(error);
            }
        },
    },
    {
        title: 'Protect PDF',
        description: 'Add a password and encrypt your PDF file.',
        icon: LockIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            const file = files[0];
            const password = prompt("Enter a password to protect the PDF:");
            if (!password) {
                alert("A password is required.");
                return;
            }
            if (showLoader) showLoader('Loading PDF...');
            const { PDFDocument } = PDFLib;
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            pdfDoc.setProducer('DocxTools Web');
            pdfDoc.setCreator('DocxTools Web');
            if (showLoader) showLoader('Encrypting and saving protected PDF...');
            const pdfBytes = await pdfDoc.save({
                userPassword: password,
                ownerPassword: password,
            });
            createDownload(pdfBytes, `${file.name.replace(/\.pdf$/i, '')}_protected.pdf`);
        },
    },
    {
        title: 'Organize PDF',
        description: 'Reorder, delete, or duplicate pages in your PDF.',
        icon: OrganizeIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Organize PDF'),
    },
    {
        title: 'Add Page Numbers',
        description: 'Insert page numbers into your PDF file.',
        icon: PageNumberIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Add Page Numbers'),
    },
    {
        title: 'Scan to PDF (OCR)',
        description: 'Convert scanned documents into searchable PDFs.',
        icon: OcrIcon,
        fileType: 'image/*',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            const { PDFDocument, rgb } = PDFLib;
            const { createWorker } = Tesseract;
            
            const file = files[0];
            const worker = await createWorker();
            
            await worker.load();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');

            const imageData = await file.arrayBuffer();
            const imageBlob = new Blob([imageData], { type: file.type });
            const imageUrl = URL.createObjectURL(imageBlob);

            if (showLoader) showLoader('Recognizing text in the image...');
            const { data: { text, words, confidence } } = await worker.recognize(imageUrl);
            URL.revokeObjectURL(imageUrl);
            
            if (showLoader) showLoader('Creating searchable PDF...');
            
            const pdfDoc = await PDFDocument.create();
            const image = file.type === 'image/png' ? await pdfDoc.embedPng(imageData) : await pdfDoc.embedJpg(imageData);
            const page = pdfDoc.addPage([image.width, image.height]);

            page.drawImage(image, { x: 0, y: 0 });

            // Add invisible text layer
            words.forEach(word => {
                const { x0, y0, x1, y1 } = word.bbox;
                page.drawText(word.text, {
                    x: x0,
                    y: page.getHeight() - y1,
                    size: y1 - y0, // Approximate font size
                    color: rgb(1, 1, 1),
                    opacity: 0, // Make text invisible
                });
            });
            
            await worker.terminate();
            
            const pdfBytes = await pdfDoc.save();
            createDownload(pdfBytes, `${file.name.split('.')[0]}_ocr.pdf`);
        },
    },
    {
        title: 'Redact PDF',
        description: 'Permanently remove sensitive content from your PDF.',
        icon: RedactIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Redact PDF'),
    },
    {
        title: 'Crop PDF',
        description: 'Crop the visible area of pages in your PDF.',
        icon: CropIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Crop PDF'),
    },
];

const createId = (title: string) => title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const toolImplementations = toolImplementationsList.reduce((acc, tool) => {
    const id = createId(tool.title);
    acc[id] = { ...tool, id };
    return acc;
}, {} as { [id: string]: Tool });
