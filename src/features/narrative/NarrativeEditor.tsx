/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Narrative, NarrativeStep } from '../../types/domain';
import { Plus, Trash2, GripVertical, Info } from 'lucide-react';
import { motion, Reorder } from 'motion/react';

interface NarrativeEditorProps {
  narrative: Narrative;
  onChange: (narrative: Narrative) => void;
  activeStepId?: string;
  onStepClick?: (stepId: string) => void;
}

export const NarrativeEditor: React.FC<NarrativeEditorProps> = ({
  narrative,
  onChange,
  activeStepId,
  onStepClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeStepId && containerRef.current) {
      const activeElement = containerRef.current.querySelector('.narrative-step-card.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeStepId]);

  const updateStep = (stepId: string, updates: Partial<NarrativeStep>) => {
    const newSteps = (narrative.steps || []).map(s => s.id === stepId ? { ...s, ...updates } : s);
    onChange({ ...narrative, steps: newSteps });
  };

  const addStep = () => {
    const newStep: NarrativeStep = {
      id: `step_${Date.now()}`,
      title: 'New Step',
      description: 'Describe what happens in this step...',
      type: 'task'
    };
    onChange({ ...narrative, steps: [...(narrative.steps || []), newStep] });
  };

  const removeStep = (stepId: string) => {
    onChange({ ...narrative, steps: (narrative.steps || []).filter(s => s.id !== stepId) });
  };

  const handleReorder = (newSteps: NarrativeStep[]) => {
    onChange({ ...narrative, steps: newSteps });
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="mb-8">
        <input
          type="text"
          value={narrative.title}
          onChange={(e) => onChange({ ...narrative, title: e.target.value })}
          className="text-3xl font-bold bg-transparent border-none focus:ring-0 w-full mb-2 text-slate-900 placeholder-slate-400"
          placeholder="Process Name"
        />
        <textarea
          value={narrative.description}
          onChange={(e) => onChange({ ...narrative, description: e.target.value })}
          className="text-slate-500 bg-transparent border-none focus:ring-0 w-full resize-none h-20 placeholder-slate-400"
          placeholder="Describe the overall business objective..."
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Business Steps</h3>
        <button
          onClick={addStep}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Step
        </button>
      </div>

      <Reorder.Group axis="y" values={narrative.steps || []} onReorder={handleReorder} className="space-y-4">
        {(narrative.steps || []).map((step) => (
          <Reorder.Item
            key={step.id}
            value={step}
            className={`narrative-step-card group ${activeStepId === step.id ? 'active' : ''}`}
            onClick={() => onStepClick?.(step.id)}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-400">
                <GripVertical size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                    className="font-semibold text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-full"
                    placeholder="Step Title"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  value={step.description}
                  onChange={(e) => updateStep(step.id, { description: e.target.value })}
                  className="text-sm text-slate-600 bg-transparent border-none focus:ring-0 p-0 w-full resize-none h-12"
                  placeholder="What happens here?"
                />
                
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Actor:</span>
                    <input
                      type="text"
                      value={step.actor || ''}
                      onChange={(e) => updateStep(step.id, { actor: e.target.value })}
                      className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded border-none focus:ring-0"
                      placeholder="Assignee"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    {step.bpmnElementId && (
                      <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        SYNCED
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
};
