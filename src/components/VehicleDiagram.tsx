'use client';

import { useCallback, useRef, useState } from 'react';
import { VehicleDiagramMark } from '@/types/datasheet';

const VEHICLE_DIAGRAM_IMAGE = '/vehicle-diagram.png';
const ARROW_LENGTH = 10;
const MIN_DRAG_PX = 12;

interface VehicleDiagramProps {
  marks: VehicleDiagramMark[];
  onChange: (marks: VehicleDiagramMark[]) => void;
  readOnly?: boolean;
}

interface Point {
  x: number;
  y: number;
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: Math.max(0, Math.min(100, svgPt.x)), y: Math.max(0, Math.min(100, svgPt.y)) };
}

function angleFromPoints(start: Point, end: Point): number {
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
}

function ImpactArrow({ mark, opacity = 1 }: { mark: VehicleDiagramMark; opacity?: number }) {
  const rad = (mark.angle * Math.PI) / 180;
  const x2 = mark.x + Math.cos(rad) * ARROW_LENGTH;
  const y2 = mark.y + Math.sin(rad) * ARROW_LENGTH;

  return (
    <g opacity={opacity}>
      <line
        x1={mark.x}
        y1={mark.y}
        x2={x2}
        y2={y2}
        stroke="#dc2626"
        strokeWidth="1.4"
        markerEnd="url(#impact-arrow)"
      />
      <circle cx={mark.x} cy={mark.y} r="2" fill="#dc2626" stroke="#fff" strokeWidth="0.6" />
    </g>
  );
}

const DIRECTION_HINTS = [
  { label: 'Front', angle: 0 },
  { label: 'Rear', angle: 180 },
  { label: 'Left', angle: 270 },
  { label: 'Right', angle: 90 },
];

export function VehicleDiagram({ marks, onChange, readOnly }: VehicleDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStart = useRef<Point | null>(null);
  const dragStartClient = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<{ start: Point; end: Point } | null>(null);
  const [pendingPoint, setPendingPoint] = useState<Point | null>(null);

  const addMark = useCallback(
    (point: Point, angle: number) => {
      const mark: VehicleDiagramMark = {
        id: `mark-${Date.now()}`,
        x: point.x,
        y: point.y,
        angle,
      };
      onChange([...marks, mark]);
    },
    [marks, onChange],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || !svgRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getSvgPoint(svgRef.current, e.clientX, e.clientY);
    dragStart.current = point;
    dragStartClient.current = { x: e.clientX, y: e.clientY };
    setPreview({ start: point, end: point });
    setPendingPoint(null);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || !svgRef.current || !dragStart.current) return;
    const end = getSvgPoint(svgRef.current, e.clientX, e.clientY);
    setPreview({ start: dragStart.current, end });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || !svgRef.current || !dragStart.current) return;
    const end = getSvgPoint(svgRef.current, e.clientX, e.clientY);
    const clientStart = dragStartClient.current;
    const pixelDist = clientStart
      ? Math.hypot(e.clientX - clientStart.x, e.clientY - clientStart.y)
      : 0;

    if (pixelDist < MIN_DRAG_PX) {
      setPendingPoint(dragStart.current);
      setPreview(null);
    } else {
      addMark(dragStart.current, angleFromPoints(dragStart.current, end));
      setPreview(null);
      setPendingPoint(null);
    }
    dragStart.current = null;
    dragStartClient.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleDirectionPick = (angle: number) => {
    if (!pendingPoint) return;
    addMark(pendingPoint, angle);
    setPendingPoint(null);
  };

  const clearMarks = () => {
    onChange([]);
    setPendingPoint(null);
    setPreview(null);
  };

  const previewMark =
    preview &&
    ({
      id: 'preview',
      x: preview.start.x,
      y: preview.start.y,
      angle: angleFromPoints(preview.start, preview.end),
    } satisfies VehicleDiagramMark);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Click and drag on the vehicle to mark damage and set impact direction
        </p>
        {!readOnly && marks.length > 0 && (
          <button type="button" onClick={clearMarks} className="btn-secondary text-xs">
            Clear marks
          </button>
        )}
      </div>

      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
        <img
          src={VEHICLE_DIAGRAM_IMAGE}
          alt="Top-down vehicle diagram"
          className="pointer-events-none w-full select-none"
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={`absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] ${
            readOnly ? 'pointer-events-none' : 'cursor-crosshair touch-none'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="img"
          aria-label="Vehicle damage diagram"
        >
          <defs>
            <marker
              id="impact-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
            </marker>
          </defs>

          {marks.map((mark) => (
            <ImpactArrow key={mark.id} mark={mark} />
          ))}

          {previewMark && <ImpactArrow mark={previewMark} opacity={0.65} />}
        </svg>
      </div>

      {pendingPoint && !readOnly && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-900">
            Select impact direction for this mark:
          </p>
          <div className="flex flex-wrap gap-2">
            {DIRECTION_HINTS.map((dir) => (
              <button
                key={dir.label}
                type="button"
                onClick={() => handleDirectionPick(dir.angle)}
                className="btn-secondary text-xs"
              >
                {dir.label}
              </button>
            ))}
            {[45, 135, 225, 315].map((angle) => (
              <button
                key={angle}
                type="button"
                onClick={() => handleDirectionPick(angle)}
                className="btn-secondary text-xs"
              >
                {angle}°
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Arrow shows direction of impact. Drag from the damage point to set direction, or tap and
        choose a direction.
      </p>
    </div>
  );
}
