"use client";

import { SunMedium, Move, ZoomIn, Layers, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TOOL_NAMES = {
  WindowLevel: "WindowLevel",
  Pan:         "Pan",
  Zoom:        "Zoom",
  StackScroll: "StackScroll",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

interface ToolButton {
  name: ToolName;
  label: string;
  icon: React.ReactNode;
  hint: string;
}

const TOOLS: ToolButton[] = [
  {
    name:  TOOL_NAMES.WindowLevel,
    label: "W/L",
    icon:  <SunMedium className="h-4 w-4" aria-hidden="true" />,
    hint:  "Window / Level — drag to adjust brightness & contrast",
  },
  {
    name:  TOOL_NAMES.Pan,
    label: "Pan",
    icon:  <Move className="h-4 w-4" aria-hidden="true" />,
    hint:  "Pan — drag to move the image",
  },
  {
    name:  TOOL_NAMES.Zoom,
    label: "Zoom",
    icon:  <ZoomIn className="h-4 w-4" aria-hidden="true" />,
    hint:  "Zoom — drag up/down to zoom in/out",
  },
  {
    name:  TOOL_NAMES.StackScroll,
    label: "Scroll",
    icon:  <Layers className="h-4 w-4" aria-hidden="true" />,
    hint:  "Stack Scroll — drag to move through frames",
  },
];

interface ViewerToolbarProps {
  activeTool: ToolName;
  onToolChange: (tool: ToolName) => void;
  onReset: () => void;
  disabled?: boolean;
}

export function ViewerToolbar({ activeTool, onToolChange, onReset, disabled = false }: ViewerToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Viewer tools"
      className={cn(
        "flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700",
        "bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm px-1.5 py-1",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.name;
        return (
          <Button
            key={tool.name}
            variant={isActive ? "primary" : "ghost"}
            size="sm"
            title={tool.hint}
            aria-label={tool.hint}
            aria-pressed={isActive}
            onClick={() => onToolChange(tool.name)}
            className="gap-1.5"
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </Button>
        );
      })}

      <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />

      <Button
        variant="ghost"
        size="sm"
        title="Reset view — restores default zoom, pan, and window/level"
        aria-label="Reset view"
        onClick={onReset}
        className="gap-1.5"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reset</span>
      </Button>
    </div>
  );
}
