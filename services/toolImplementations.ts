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

    const ToolButton = ({ tool, Icon, label }: { tool: string, Icon: React.FC<{className?: string}>, label: string }) =>
        React.createElement('button', {
            onClick: () => setActiveTool(tool),
            className: `p-2 rounded-md ${activeTool === tool ? 'bg-primary-red text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`,
            title: label,
        }, React.createElement(Icon, { className: 'h-6 w-6' }));
        
    const TextFormatButton = ({ style, Icon, label, value }: { style?: string, Icon: React.FC<{className?: string}>, label: string, value?: string }) =>
        React.createElement('button', {
            onClick: () => {
                if (label === 'Bold') toggleTextStyle('fontWeight');
                else if (label === 'Italic') toggleTextStyle('fontStyle');
                else if (label === 'Underline') toggleTextStyle('underline');
                else if (label.includes('Align')) setAlignment(value as 'left' | 'center' | 'right');
            },
            className: `p-2 rounded-md ${
                (label === 'Bold' && activeObjectStyles.fontWeight === 'bold') ||
                (label === 'Italic' && activeObjectStyles.fontStyle === 'italic') ||
                (label === 'Underline' && activeObjectStyles.underline) ||
                (label.includes('Align') && activeObjectStyles.textAlign === value)
                 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`,
            title: label,
        }, React.createElement(Icon, { className: 'h-5 w-5' }));
    
    const TextToolbar = () => React.createElement('div', { className: 'flex items-center gap-1 border-l pl-2 ml-2 dark:border-gray-600' },
        React.createElement('label', { title: 'Text Color', className: 'flex items-center gap-1 text-sm' }, 'Color:', 
            React.createElement('input', { 
                type: 'color', 
                value: toolSettings.textColor, 
                onChange: e => {
                    const newColor = e.target.value;
                    applyTextFormatting('fill', newColor);
                    setToolSettings(s => ({...s, textColor: newColor}));
                },
                className: 'w-8 h-8 cursor-pointer p-0 border-none rounded overflow-hidden bg-transparent' 
            })
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
// FIX: Unrolling the map call for font options to avoid a TypeScript type inference issue with the 'value' prop on <option> elements.
        React.createElement('select', {
            value: toolSettings.fontFamily,
            onChange: e => { applyTextFormatting('fontFamily', e.target.value); setToolSettings(s => ({...s, fontFamily: e.target.value})); },
            className: 'p-1 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-sm h-9'
        },
            React.createElement('option', { key: 'Arial', value: 'Arial, sans-serif' }, 'Arial'),
            React.createElement('option', { key: 'Helvetica', value: 'Helvetica, sans-serif' }, 'Helvetica'),
            React.createElement('option', { key: 'Times New Roman', value: "'Times New Roman', Times, serif" }, 'Times New Roman'),
            React.createElement('option', { key: 'Courier New', value: "'Courier New', Courier, monospace" }, 'Courier New'),
            React.createElement('option', { key: 'Roboto', value: 'Roboto, sans-serif' }, 'Roboto'),
            React.createElement('option', { key: 'Montserrat', value: 'Montserrat, sans-serif' }, 'Montserrat'),
            React.createElement('option', { key: 'Lobster', value: 'Lobster, cursive' }, 'Lobster'),
            React.createElement('option', { key: 'Playfair Display', value: "'Playfair Display', serif" }, 'Playfair Display')
        ),
        React.createElement('input', { 
            type: 'number', value: toolSettings.fontSize,
            onChange: e => { const size = parseInt(e.target.value, 10); if (size > 0) { applyTextFormatting('fontSize', size); setToolSettings(s => ({...s, fontSize: size})); } },
            className: 'w-16 p-1 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 text-sm h-9'
        })
    );

    const ShapeToolbar = () => React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
        React.createElement('label', { title: 'Fill Color', className: 'flex items-center gap-1 text-sm' }, 'Fill:', React.createElement('input', { type: 'color', value: toolSettings.fillColor, onChange: e => handleColorChange('fill', e.target.value), className: 'w-8 h-8 cursor-pointer p-0 border-none' })),
        React.createElement('label', { title: 'Stroke Color', className: 'flex items-center gap-1 text-sm' }, 'Stroke:', React.createElement('input', { type: 'color', value: toolSettings.strokeColor, onChange: e => handleColorChange('stroke', e.target.value), className: 'w-8 h-8 cursor-pointer p-0 border-none' })),
        React.createElement('label', { className: 'flex items-center gap-1 text-sm', title: 'Brush/Stroke Size' }, 'Size:', React.createElement('input', { type: 'range', min: 1, max: 50, value: toolSettings.brushWidth, onChange: e => setToolSettings(s => ({ ...s, brushWidth: parseInt(e.target.value, 10) })) }))
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
                    React.createElement('button', { onClick: handleBackToEditor, className: 'px-4 py-2 bg-gray-500 text-white font-bold rounded-lg hover:bg-gray-600' }, 'Back to Editor'),
                    React.createElement('button', { onClick: handleDownload, className: 'px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700' }, 'Download PDF'),
                    React.createElement('button', { onClick: onClose, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Exit' }, React.createElement(ExitIcon, { className: 'h-6 w-6 text-gray-800 dark:text-gray-200' }))
                )
            ),
            React.createElement('main', { className: 'flex-1 bg-gray-500' },
                React.createElement('iframe', { src: previewUrl, className: 'w-full h-full border-none', title: 'PDF Preview' })
            )
        );
    }

    return React.createElement('div', { className: 'h-screen w-screen flex flex-col bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-200' },
        React.createElement('header', { className: 'flex items-center justify-between p-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm' },
            React.createElement('input', { type: 'text', value: outputFilename, onChange: e => setOutputFilename(e.target.value), className: 'text-lg font-bold truncate px-2 py-1 rounded bg-transparent focus:bg-gray-100 dark:focus:bg-gray-700 w-1/3' }),
            React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('button', { onClick: undo, disabled: !historyState.canUndo, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed', title: 'Undo' } as React.ComponentProps<'button'>, React.createElement(UndoIcon, { className: 'h-6 w-6' })),
                React.createElement('button', { onClick: redo, disabled: !historyState.canRedo, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed', title: 'Redo' } as React.ComponentProps<'button'>, React.createElement(RedoIcon, { className: 'h-6 w-6' })),
                React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
                React.createElement('button', { onClick: () => handleZoom(zoom * 0.8), className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Zoom Out' }, React.createElement(ZoomOutIcon, { className: 'h-6 w-6' })),
                React.createElement('span', { className: 'w-12 text-center' }, `${Math.round(zoom * 100)}%`),
                React.createElement('button', { onClick: () => handleZoom(zoom * 1.25), className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Zoom In' }, React.createElement(ZoomInIcon, { className: 'h-6 w-6' })),
                React.createElement('div', { className: 'w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1' }),
                React.createElement('button', { onClick: handleGeneratePreview, className: 'px-4 py-2 bg-primary-red text-white font-bold rounded-lg hover:bg-red-700' }, 'Done'),
                React.createElement('button', { onClick: onClose, className: 'p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700', title: 'Exit Editor' }, React.createElement(ExitIcon, { className: 'h-6 w-6' }))
            )
        ),
        React.createElement('div', { className: 'flex-1 flex overflow-hidden' },
            React.createElement('aside', { className: 'w-48 bg-gray-100 dark:bg-gray-800 p-2 overflow-y-auto border-r dark:border-gray-700' },
                thumbnails.map((thumb, index) => React.createElement('div', { key: index, onClick: () => goToPage(index + 1), className: `cursor-pointer p-1 mb-2 rounded border-2 ${currentPage === index + 1 ? 'border-primary-red' : 'border-transparent hover:border-gray-400'}` },
                    React.createElement('img', { src: thumb, alt: `Page ${index + 1}`, className: 'w-full shadow-md' }),
                    React.createElement('p', {className: 'text-center text-xs mt-1'}, `Page ${index + 1}`)
                ))
            ),
            React.createElement('main', { className: 'flex-1 flex flex-col' },
                React.createElement('div', { className: 'flex flex-wrap items-center gap-1 p-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800' },
                    React.createElement(ToolButton, { tool: 'select', Icon: PointerIcon, label: 'Select' }),
                    React.createElement(ToolButton, { tool: 'text', Icon: TypeIcon, label: 'Add Text' }),
                    React.createElement(ToolButton, { tool: 'draw', Icon: PencilIcon, label: 'Draw' }),
                    React.createElement(ToolButton, { tool: 'eraser', Icon: EraserIcon, label: 'Eraser' }),
                    React.createElement(ToolButton, { tool: 'rect', Icon: RectangleIcon, label: 'Add Rectangle' }),
                    React.createElement(ToolButton, { tool: 'circle', Icon: CircleIcon, label: 'Add Circle' }),
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

            const sizeOptions = sizes.map(size =>
                React.createElement('label', { key: size.value, className: 'flex items-center p-3 border rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50' },
                    React.createElement('input', {
                        type: 'radio',
                        name: 'compression-size',
                        value: size.value,
                        checked: selectedSize === size.value,
                        onChange: handleSizeChange,
                        className: 'h-4 w-4 text-primary-red border-gray-300 focus:ring-primary-red'
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
                        className: 'h-4 w-4 text-primary-red border-gray-300 focus:ring-primary-red'
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
                const newPdfDoc = await PDFDocument.create();

                for (const canvas of pageCanvases) {
                    const jpegBytes = await new Promise<Uint8Array>((resolve, reject) => {
                        canvas.toBlob((blob) => {
                            if(!blob) return reject(new Error('Canvas toBlob failed'));
                            const reader = new FileReader();
                            reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
                            reader.onerror = reject;
                            reader.readAsArrayBuffer(blob);
                        }, 'image/jpeg', quality);
                    });
                    const image = await newPdfDoc.embedJpg(jpegBytes);
                    const newPage = newPdfDoc.addPage([canvas.width, canvas.height]);
                    newPage.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height });
                }
                return await newPdfDoc.save();
            };

            let lowerBound = 0.01;
            let upperBound = 1.0;
            let bestPdfBytes: Uint8Array | null = null;
            
            const maxIterations = 8;
            for (let i = 0; i < maxIterations; i++) {
                const midQuality = (lowerBound + upperBound) / 2;
                if (showLoader) showLoader(`Optimizing... (Pass ${i + 1}/${maxIterations}, Quality: ${midQuality.toFixed(2)})`);
                
                const currentPdfBytes = await createPdfFromCanvases(midQuality);
                
                if (currentPdfBytes.length <= targetBytes) {
                    bestPdfBytes = currentPdfBytes;
                    lowerBound = midQuality; 
                } else {
                    upperBound = midQuality;
                }
            }
            
            if (showLoader) showLoader(`Finalizing compression...`);
            const finalPdfBytes = await createPdfFromCanvases(lowerBound);
             if (finalPdfBytes.length <= targetBytes) {
                bestPdfBytes = finalPdfBytes;
            }

            if (bestPdfBytes) {
                createDownload(bestPdfBytes, `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`);
            } else {
                throw new Error("Could not compress the file to the target size. Try a larger target size.");
            }
        },
    },
    {
        title: 'Image to PDF',
        description: 'Convert images to a size-optimized PDF.',
        icon: JpgIcon,
        fileType: 'image/*',
        multipleFiles: true,
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

            const sizeOptions = sizes.map(size =>
                React.createElement('label', { key: size.value, className: 'flex items-center p-3 border rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50' },
                    React.createElement('input', {
                        type: 'radio',
                        name: 'compression-size',
                        value: size.value,
                        checked: selectedSize === size.value,
                        onChange: handleSizeChange,
                        className: 'h-4 w-4 text-primary-red border-gray-300 focus:ring-primary-red'
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
                        className: 'h-4 w-4 text-primary-red border-gray-300 focus:ring-primary-red'
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
            const { PDFDocument } = PDFLib;

            const targetBytes = (targetSize === 'custom' ? parseInt(customSize, 10) : parseInt(targetSize, 10)) * 1024;
            if (isNaN(targetBytes) || targetBytes <= 0) {
                throw new Error("Invalid target size specified.");
            }

            const imageCanvases: HTMLCanvasElement[] = [];
            let imageIndex = 0;
            for (const file of files) {
                if (showLoader) showLoader(`Preparing image ${++imageIndex}/${files.length}...`);
                const imageBitmap = await createImageBitmap(file);
                const canvas = document.createElement('canvas');
                canvas.width = imageBitmap.width;
                canvas.height = imageBitmap.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');
                
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(imageBitmap, 0, 0);
                imageCanvases.push(canvas);
            }
            
            const createPdfFromCanvases = async (quality: number) => {
                const newPdfDoc = await PDFDocument.create();
                for (const canvas of imageCanvases) {
                    const jpegBytes = await new Promise<Uint8Array>((resolve, reject) => {
                        canvas.toBlob((blob) => {
                            if(!blob) return reject(new Error('Canvas toBlob failed'));
                            const reader = new FileReader();
                            reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
                            reader.onerror = reject;
                            reader.readAsArrayBuffer(blob);
                        }, 'image/jpeg', quality);
                    });
                    const image = await newPdfDoc.embedJpg(jpegBytes);
                    const newPage = newPdfDoc.addPage([canvas.width, canvas.height]);
                    newPage.drawImage(image, { x: 0, y: 0, width: canvas.width, height: canvas.height });
                }
                return await newPdfDoc.save();
            };

            let lowerBound = 0.01;
            let upperBound = 1.0;
            let bestPdfBytes: Uint8Array | null = null;
            
            const maxIterations = 8;
            for (let i = 0; i < maxIterations; i++) {
                const midQuality = (lowerBound + upperBound) / 2;
                if (showLoader) showLoader(`Optimizing... (Pass ${i + 1}/${maxIterations}, Quality: ${midQuality.toFixed(2)})`);
                
                const currentPdfBytes = await createPdfFromCanvases(midQuality);
                
                if (currentPdfBytes.length <= targetBytes) {
                    bestPdfBytes = currentPdfBytes;
                    lowerBound = midQuality; 
                } else {
                    upperBound = midQuality;
                }
            }
            
            if (showLoader) showLoader(`Finalizing compression...`);
            const finalPdfBytes = await createPdfFromCanvases(lowerBound);
             if (finalPdfBytes.length <= targetBytes) {
                bestPdfBytes = finalPdfBytes;
            }

            if (bestPdfBytes) {
                createDownload(bestPdfBytes, `images-to-pdf_compressed.pdf`);
            } else {
                throw new Error("Could not compress the file to the target size. Try a larger target size.");
            }
        },
    },
    {
        title: 'Edit PDF',
        description: 'Add text, shapes, and drawings to your PDF document.',
        icon: EditIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        new: true,
        optionsComponent: EditPdfComponent,
        process: async () => {
            // This process is now handled entirely inside the EditPdfComponent.
            // This function is a placeholder to satisfy the Tool type.
            return Promise.resolve();
        },
    },
    {
        title: 'Merge PDF',
        description: 'Combine multiple PDFs into one single document.',
        icon: MergeIcon,
        fileType: 'application/pdf',
        multipleFiles: true,
        process: async (files) => {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();
            for (const file of files) {
                const pdfBytes = await file.arrayBuffer();
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            const mergedPdfBytes = await mergedPdf.save();
            createDownload(mergedPdfBytes, 'merged.pdf');
        },
    },
    {
        title: 'Split PDF',
        description: 'Extract a range of pages from a PDF file.',
        icon: SplitIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        optionsComponent: React.forwardRef(({ options, setOptions }: { options: any, setOptions: (o: any) => void }, _ref) => {
            return React.createElement('input', {
                type: "text",
                placeholder: "e.g., 1-3, 5, 7-9",
                className: "w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600",
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOptions({ ...options, range: e.target.value })
            });
        }),
        process: async (files, options) => {
            const file = files[0];
            const { range } = options;
            if (!range) throw new Error('Page range is required.');

            const { PDFDocument } = PDFLib;
            const pdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const newDoc = await PDFDocument.create();

            const indices = new Set<number>();
            range.split(',').forEach((part: string) => {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    for (let i = start; i <= end; i++) {
                        indices.add(i - 1);
                    }
                } else {
                    indices.add(Number(part) - 1);
                }
            });

            const validIndices = Array.from(indices).filter(i => i >= 0 && i < pdfDoc.getPageCount());
            const copiedPages = await newDoc.copyPages(pdfDoc, validIndices);
            copiedPages.forEach(page => newDoc.addPage(page));

            const newPdfBytes = await newDoc.save();
            createDownload(newPdfBytes, 'split.pdf');
        },
    },
    {
        title: 'PDF to Word',
        description: 'Convert your PDF to an editable Word document (as .txt).',
        icon: WordIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
            const file = files[0];
            const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
            let textContent = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                if(showLoader) showLoader(`Extracting text from page ${i}/${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const text = await page.getTextContent();
                textContent += text.items.map((s: any) => s.str).join(' ') + '\n\n';
            }
            const blob = new Blob([textContent], { type: 'text/plain' });
            createDownload(blob, `${file.name.replace('.pdf', '')}.txt`);
        },
    },
    {
        title: 'PDF to PowerPoint',
        description: 'Convert each page of a PDF into a PowerPoint slide.',
        icon: PptIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, {showLoader}) => {
             pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
             const file = files[0];
             const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
             const pptx = new PptxGenJS();
             
             for (let i = 1; i <= pdf.numPages; i++) {
                if(showLoader) showLoader(`Converting page ${i}/${pdf.numPages} to slide...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const context = canvas.getContext('2d');
                if(!context) throw new Error("Could not get canvas context");
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const dataUrl = canvas.toDataURL('image/png');
                const slide = pptx.addSlide();
                slide.addImage({ data: dataUrl, x: 0, y: 0, w: '100%', h: '100%' });
             }
             
             const pptxBlob = await pptx.write('blob');
             createDownload(pptxBlob, 'converted.pptx');
        }
    },
    {
        title: 'PDF to Excel',
        description: 'Extract data from PDF tables into Excel sheets.',
        icon: ExcelIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('PDF to Excel'),
    },
    {
        title: 'Word to PDF',
        description: 'Convert a .docx file to a high-quality PDF.',
        icon: WordIcon,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        multipleFiles: false,
        process: async (files) => {
            const file = files[0];
            const arrayBuffer = await file.arrayBuffer();
            const { value } = await mammoth.convertToHtml({ arrayBuffer });
            const element = document.createElement('div');
            element.innerHTML = value;
            html2pdf().from(element).save('word.pdf');
        }
    },
    {
        title: 'PowerPoint to PDF',
        description: 'Convert your presentation into a PDF document.',
        icon: PptIcon,
        fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        multipleFiles: false,
        process: placeholderProcess('PowerPoint to PDF'),
    },
    {
        title: 'Excel to PDF',
        description: 'Turn your spreadsheets into easily shareable PDFs.',
        icon: ExcelIcon,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        multipleFiles: false,
        process: placeholderProcess('Excel to PDF'),
    },
    {
        title: 'PDF to JPG',
        description: 'Convert each page of a PDF into a high-quality JPG image.',
        icon: JpgIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: async (files, { showLoader }) => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.worker.min.js`;
            const file = files[0];
            const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
            const zip = new JSZip();

            for (let i = 1; i <= pdf.numPages; i++) {
                if(showLoader) showLoader(`Converting page ${i}/${pdf.numPages} to JPG...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const context = canvas.getContext('2d');
                if(!context) throw new Error("Could not get canvas context");
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                if(blob) zip.file(`page_${i}.jpg`, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            createDownload(zipBlob, 'pdf_to_jpg.zip');
        },
    },
    {
        title: 'Sign PDF',
        description: 'Create your signature and sign your PDF documents.',
        icon: SignIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Sign PDF'),
    },
    {
        title: 'Watermark',
        description: 'Add a text or image watermark to your PDF.',
        icon: WatermarkIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        optionsComponent: React.forwardRef(({ options, setOptions }: { options: any, setOptions: (o: any) => void }, _ref) => {
            return React.createElement('div', { className: "space-y-2" },
                React.createElement('input', {
                    type: "text",
                    placeholder: "Watermark Text",
                    className: "w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600",
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOptions({ ...options, text: e.target.value })
                }),
                React.createElement('input', {
                    type: "range",
                    min: "0.1",
                    max: "1.0",
                    step: "0.1",
                    defaultValue: "0.5",
                    className: "w-full",
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOptions({ ...options, opacity: parseFloat(e.target.value) })
                })
            );
        }),
        process: async (files, options) => {
            const { text = 'CONFIDENTIAL', opacity = 0.5 } = options;
            const file = files[0];
            const { PDFDocument, rgb, degrees } = PDFLib;
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            const pages = pdfDoc.getPages();

            for (const page of pages) {
                const { width, height } = page.getSize();
                page.drawText(text, {
                    x: width / 2 - 150,
                    y: height / 2,
                    size: 50,
                    color: rgb(0.5, 0.5, 0.5),
                    opacity,
                    rotate: degrees(45),
                });
            }
            
            const pdfBytes = await pdfDoc.save();
            createDownload(pdfBytes, 'watermarked.pdf');
        }
    },
    {
        title: 'Rotate PDF',
        description: 'Rotate all or specific pages in your PDF file.',
        icon: RotateIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        optionsComponent: React.forwardRef(({ options, setOptions }: { options: any, setOptions: (o: any) => void }, _ref) => {
            // FIX: The use of .map() with React.createElement was causing a TypeScript type inference error on the `value` prop for <option> tags.
            // Unrolling the map into explicit calls for each option resolves this compilation issue.
            return React.createElement('select', {
                    className: "w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600",
                    value: options.angle?.toString() || '90',
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setOptions({ ...options, angle: parseInt(e.target.value, 10) })
                },
// FIX: Add key prop to <option> elements to resolve TypeScript type inference error.
                React.createElement('option', { value: '90', key: '90' }, "90° clockwise"),
                React.createElement('option', { value: '180', key: '180' }, "180°"),
                React.createElement('option', { value: '270', key: '270' }, "270° clockwise")
            );
        }),
        process: async (files, options) => {
            const { angle = 90 } = options;
            const file = files[0];
            const { PDFDocument, RotationTypes } = PDFLib;
            const existingPdfBytes = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            const pages = pdfDoc.getPages();
            pages.forEach(page => {
                 const currentRotation = page.getRotation().angle;
                 page.setRotation({ type: RotationTypes.Degrees, angle: currentRotation + angle });
            });
            
            const pdfBytes = await pdfDoc.save();
            createDownload(pdfBytes, 'rotated.pdf');
        }
    },
    {
        title: 'HTML to PDF',
        description: 'Convert webpages to PDF. (Accepts .html files)',
        icon: HtmlIcon,
        fileType: 'text/html',
        multipleFiles: false,
        process: async (files) => {
            const file = files[0];
            const htmlContent = await file.text();
            const element = document.createElement('div');
            element.innerHTML = htmlContent;
            html2pdf().from(element).save('html.pdf');
        },
    },
    {
        title: 'Unlock PDF',
        description: 'Remove passwords and restrictions from your PDF.',
        icon: UnlockIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Unlock PDF'),
    },
    {
        title: 'Protect PDF',
        description: 'Add a password to protect your PDF file.',
        icon: LockIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Protect PDF'),
    },
    {
        title: 'Organize PDF',
        description: 'Reorder, delete, or add pages to a PDF file.',
        icon: OrganizeIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Organize PDF'),
    },
    {
        title: 'PDF to PDF/A',
        description: 'Convert your PDF to PDF/A for long-term archiving.',
        icon: DefaultIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('PDF to PDF/A'),
    },
    {
        title: 'Repair PDF',
        description: 'Attempt to recover data from a corrupted PDF.',
        icon: DefaultIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Repair PDF'),
    },
    {
        title: 'Add Page Numbers',
        description: 'Easily add page numbers to your PDF document.',
        icon: PageNumberIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('Add Page Numbers'),
    },
    {
        title: 'OCR PDF',
        description: 'Recognize text in scanned PDFs to make them searchable.',
        icon: OcrIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('OCR PDF'),
    },
    {
        title: 'eSign PDF',
        description: 'Legally binding e-signatures for your documents.',
        icon: SignIcon,
        fileType: 'application/pdf',
        multipleFiles: false,
        process: placeholderProcess('eSign PDF'),
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

export const toolImplementations: Record<string, Tool> =
    toolImplementationsList.reduce((acc, tool, index) => {
        const id = tool.title.toLowerCase().replace(/\s+/g, '-').replace('/', '-or-');
        acc[id] = { ...tool, id };
        return acc;
    }, {} as Record<string, Tool>);