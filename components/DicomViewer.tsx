'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface DicomViewerProps {
  studyId?: string;
  imageSrc?: string | ArrayBuffer;
  onAnnotationCreate?: (annotation: AnnotationData) => void;
  onMeasurement?: (measurement: MeasurementData) => void;
  className?: string;
}

interface AnnotationData {
  type: 'length' | 'angle' | 'ellipse' | 'rectangle' | 'arrow' | 'text';
  data: unknown;
}

interface MeasurementData {
  type: string;
  value: number;
  unit: string;
  handles: { x: number; y: number }[];
}

type Tool = 'pan' | 'zoom' | 'wwwc' | 'length' | 'angle' | 'ellipse' | 'rectangle';

type CornerstoneCore = {
  init: () => boolean;
};

type DicomPixelDataElement = {
  dataOffset: number;
  length: number;
};

type DicomDataSet = {
  uint16: (tag: string) => number | undefined;
  string: (tag: string) => string | undefined;
  elements: {
    x7fe00010?: DicomPixelDataElement;
  };
};

type DicomParserModule = {
  parseDicom: (byteArray: Uint8Array) => DicomDataSet;
};

export default function DicomViewer({
  studyId,
  imageSrc,
  onAnnotationCreate,
  onMeasurement,
  className = ''
}: DicomViewerProps) {
  void onAnnotationCreate;
  void onMeasurement;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('pan');
  const [windowWidth, setWindowWidth] = useState(400);
  const [windowCenter, setWindowCenter] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [cornerstoneLoaded, setCornerstoneLoaded] = useState(false);
  const [imageData, setImageData] = useState<ImageData | null>(null);

  // Cornerstone modules (dynamically loaded)
  const csRef = useRef<CornerstoneCore | null>(null);
  const csToolsRef = useRef<unknown>(null);
  const dicomParserRef = useRef<DicomParserModule | null>(null);

  // Load cornerstone dynamically (client-side only)
  useEffect(() => {
    let mounted = true;

    async function loadCornerstone() {
      try {
        // Dynamic imports for browser-only modules
        const [cs, csTools, dicomParser] = await Promise.all([
          import('@cornerstonejs/core'),
          import('@cornerstonejs/tools'),
          import('dicom-parser')
        ]);

        if (!mounted) return;

        csRef.current = cs;
        csToolsRef.current = csTools;
        dicomParserRef.current = dicomParser;

        // Initialize cornerstone
        await cs.init();

        setCornerstoneLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load cornerstone:', err);
        if (mounted) {
          setError('DICOM viewer libraries failed to load. Falling back to basic viewer.');
          setIsLoading(false);
        }
      }
    }

    loadCornerstone();

    return () => {
      mounted = false;
    };
  }, []);

  // Load image when cornerstone is ready and we have an image source
  useEffect(() => {
    if (!imageSrc || !cornerstoneLoaded) return;

    async function loadImage() {
      try {
        setIsLoading(true);

        let arrayBuffer: ArrayBuffer;
        if (typeof imageSrc === 'string') {
          // Fetch from URL
          const response = await fetch(imageSrc);
          arrayBuffer = await response.arrayBuffer();
        } else if (imageSrc instanceof ArrayBuffer) {
          arrayBuffer = imageSrc;
        } else {
          throw new Error('Invalid image source');
        }

        // Parse DICOM
        const dicomParser = dicomParserRef.current;
        if (!dicomParser) {
          throw new Error('DICOM parser not initialized');
        }
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        // Extract basic metadata
        const rows = dataSet.uint16('x00280010') || 512;
        const cols = dataSet.uint16('x00280011') || 512;
        const bitsAllocated = dataSet.uint16('x00280100') || 16;
        const bitsStored = dataSet.uint16('x00280101') || 12;
        const pixelRepresentation = dataSet.uint16('x00280103') || 0;
        void bitsAllocated;
        void bitsStored;
        void pixelRepresentation;
        const rescaleIntercept = parseFloat(dataSet.string('x00281052') || '0');
        const rescaleSlope = parseFloat(dataSet.string('x00281053') || '1');
        const ww = parseFloat(dataSet.string('x00281051') || '400');
        const wc = parseFloat(dataSet.string('x00281050') || '40');

        setWindowWidth(ww);
        setWindowCenter(wc);

        // Get pixel data
        const pixelDataElement = dataSet.elements.x7fe00010;
        if (!pixelDataElement) {
          throw new Error('No pixel data found');
        }

        const pixelData = new Int16Array(
          arrayBuffer,
          pixelDataElement.dataOffset,
          pixelDataElement.length / 2
        );

        // Create ImageData for canvas rendering
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageDataObj = ctx.createImageData(cols, rows);
        setImageData(imageDataObj);

        // Apply window/level and render
        renderImage(pixelData, imageDataObj, cols, rows, ww, wc, rescaleSlope, rescaleIntercept);

        setIsLoading(false);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load DICOM image';
        console.error('Failed to load DICOM:', err);
        setError(errorMessage);
        setIsLoading(false);
      }
    }

    loadImage();
  }, [imageSrc, cornerstoneLoaded]);

  // Re-render when window/level changes
  useEffect(() => {
    if (!imageData || !canvasRef.current) return;
    // Note: we'd need to store pixelData in state to re-render on ww/wc change
    // For now, this is a placeholder for the full implementation
  }, [windowWidth, windowCenter, imageData]);

  function renderImage(
    pixelData: Int16Array,
    imgData: ImageData,
    cols: number,
    rows: number,
    ww: number,
    wc: number,
    slope: number,
    intercept: number
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = imgData.data;
    const wwMin = wc - ww / 2;
    const wwMax = wc + ww / 2;

    for (let i = 0; i < pixelData.length; i++) {
      const raw = pixelData[i];
      const hu = raw * slope + intercept;

      // Apply window/level
      let intensity: number;
      if (hu <= wwMin) {
        intensity = 0;
      } else if (hu >= wwMax) {
        intensity = 255;
      } else {
        intensity = ((hu - wwMin) / ww) * 255;
      }

      const idx = i * 4;
      data[idx] = intensity;     // R
      data[idx + 1] = intensity; // G
      data[idx + 2] = intensity; // B
      data[idx + 3] = 255;       // A
    }

    ctx.putImageData(imgData, 0, 0);
  }

  const handleToolSelect = useCallback((tool: Tool) => {
    setActiveTool(tool);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z / 1.2, 0.2));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setWindowWidth(400);
    setWindowCenter(40);
  }, []);

  if (error && !cornerstoneLoaded) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-900 text-white p-8 ${className}`}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 mb-2">DICOM Viewer</p>
          <p className="text-sm text-gray-500">{error}</p>
          {imageSrc && (
            <p className="text-xs text-gray-600 mt-2">Image source provided but cannot be displayed</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-gray-900 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-1">
          <ToolButton
            active={activeTool === 'pan'}
            onClick={() => handleToolSelect('pan')}
            title="Pan"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          </ToolButton>
          <ToolButton
            active={activeTool === 'zoom'}
            onClick={() => handleToolSelect('zoom')}
            title="Zoom"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </ToolButton>
          <ToolButton
            active={activeTool === 'wwwc'}
            onClick={() => handleToolSelect('wwwc')}
            title="Window/Level"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </ToolButton>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <div className="flex items-center gap-1">
          <ToolButton
            active={activeTool === 'length'}
            onClick={() => handleToolSelect('length')}
            title="Length Measurement"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </ToolButton>
          <ToolButton
            active={activeTool === 'angle'}
            onClick={() => handleToolSelect('angle')}
            title="Angle Measurement"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l6-6m0 0l6-6m-6 6l6 6m-6-6l-6-6" />
            </svg>
          </ToolButton>
          <ToolButton
            active={activeTool === 'ellipse'}
            onClick={() => handleToolSelect('ellipse')}
            title="Ellipse ROI"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <ellipse cx="12" cy="12" rx="8" ry="5" strokeWidth={2} />
            </svg>
          </ToolButton>
          <ToolButton
            active={activeTool === 'rectangle'}
            onClick={() => handleToolSelect('rectangle')}
            title="Rectangle ROI"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="4" y="6" width="16" height="12" strokeWidth={2} rx="1" />
            </svg>
          </ToolButton>
        </div>

        <div className="w-px h-6 bg-gray-600" />

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-gray-300 hover:bg-gray-700"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-gray-300 hover:bg-gray-700"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded text-gray-300 hover:bg-gray-700"
            title="Reset"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
          <span>W: {Math.round(windowWidth)}</span>
          <span>L: {Math.round(windowCenter)}</span>
          <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Viewer Area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden bg-black"
        style={{ minHeight: '400px' }}
      >
        {isLoading ? (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-2" />
            <span>Loading...</span>
          </div>
        ) : !imageSrc ? (
          <div className="text-gray-500 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>No image loaded</p>
            <p className="text-sm text-gray-600 mt-1">Select or upload a DICOM file to view</p>
          </div>
        ) : (
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <span>{studyId ? `Study: ${studyId}` : 'No study loaded'}</span>
        <span>Tool: {activeTool}</span>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}
