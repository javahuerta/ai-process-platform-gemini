/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NarrativeEditor } from './features/narrative/NarrativeEditor';
import { BPMNModeler } from './features/modeling/BPMNModeler';
import { CopilotChat } from './features/copilot/CopilotChat';
import { Narrative, ProcessModel } from './types/domain';
import { INITIAL_BPMN_XML } from './lib/constants';
import { aggressiveRepairBpmnXml } from './lib/bpmnUtils';
import { 
  Layout, 
  Layers, 
  Zap, 
  Save, 
  Share2, 
  Settings, 
  ChevronRight,
  FileText,
  Workflow,
  Table,
  MessageSquare,
  RotateCcw
} from 'lucide-react';

export default function App() {
  const [narrative, setNarrative] = useState<Narrative>({
    id: 'process_1',
    title: 'New Process Narrative',
    description: 'Describe your business process here...',
    steps: [
      {
        id: 'step_1',
        title: 'Initial Step',
        description: 'The first step of the process',
        type: 'task',
        actor: 'Admin',
        bpmnElementId: 'Task_1'
      }
    ],
    actors: ['Admin'],
    metadata: {}
  });

  const [bpmnXml, setBpmnXml] = useState<string>(INITIAL_BPMN_XML);
  const [activeStepId, setActiveStepId] = useState<string | undefined>('step_1');
  const [activeView, setActiveView] = useState<'bpmn' | 'dmn' | 'forms'>('bpmn');
  const [isGenerating, setIsGenerating] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleNarrativeChange = useCallback((newNarrative: Narrative) => {
    setNarrative(newNarrative);
  }, []);

  const handleBpmnChange = useCallback((newXml: string) => {
    setBpmnXml(newXml);
    setImportError(null);
  }, []);

  const handleReset = () => {
    setBpmnXml(INITIAL_BPMN_XML);
    setImportError(null);
  };

  const handleRepair = () => {
    if (bpmnXml) {
      const repaired = aggressiveRepairBpmnXml(bpmnXml);
      setBpmnXml(repaired);
      setImportError(null);
    }
  };

  const handleStepClick = (stepId: string) => {
    setActiveStepId(stepId);
    // In a real app, we would scroll the BPMN modeler to the linked element
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <Zap size={18} fill="currentColor" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight">Scotiaflow</span>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest">Studio</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200 mx-2" />
          <div className="flex items-center gap-1 text-sm text-slate-500 font-medium">
            <span>Processes</span>
            <ChevronRight size={14} />
            <span className="text-slate-900">{narrative.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
            <Share2 size={16} /> Share
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-700 transition-all shadow-sm active:scale-95">
            <Save size={16} /> Deploy
          </button>
          <div className="h-6 w-[1px] bg-slate-200 mx-1" />
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Panel: Narrative Editor */}
          <Panel defaultSize={25} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="h-12 border-b border-slate-200 bg-white flex items-center px-4 gap-2">
                <FileText size={16} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Business Layer</span>
              </div>
              <NarrativeEditor 
                narrative={narrative} 
                onChange={handleNarrativeChange}
                activeStepId={activeStepId}
                onStepClick={handleStepClick}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

          {/* Middle Panel: Technical Modeler */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col bg-white">
              <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveView('bpmn')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeView === 'bpmn' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <Workflow size={14} /> BPMN
                  </button>
                  <button 
                    onClick={() => setActiveView('dmn')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeView === 'dmn' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <Table size={14} /> DMN
                  </button>
                  <button 
                    onClick={() => setActiveView('forms')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-widest transition-all border-b-2 ${activeView === 'forms' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    <Layout size={14} /> Forms
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleReset}
                    title="Reset to Initial Diagram"
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technical Layer</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-4 bg-slate-50 overflow-hidden relative">
                {isGenerating && (
                  <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">AI Architecting...</span>
                    </div>
                  </div>
                )}
                {activeView === 'bpmn' && (
                  <div className="h-full relative">
                    {importError && (
                      <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex items-center justify-center p-8">
                        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-2xl border border-red-100 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-300">
                          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                            <Zap size={32} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Technical Model Error</h3>
                            <p className="text-sm text-slate-500 mt-2">
                              The generated BPMN XML contains technical inconsistencies that prevent rendering.
                            </p>
                            <div className="mt-4 p-3 bg-slate-50 rounded-lg text-[10px] font-mono text-red-600 text-left overflow-auto max-h-32 w-full border border-slate-100">
                              {importError}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 w-full mt-2">
                            <div className="flex items-center gap-3 w-full">
                              <button 
                                onClick={handleRepair}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-md"
                              >
                                Repair Diagram
                              </button>
                              <button 
                                onClick={handleReset}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all"
                              >
                                Reset to Default
                              </button>
                            </div>
                            <button 
                              onClick={() => {
                                setImportError(null);
                              }}
                              className="w-full px-4 py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-all"
                            >
                              Dismiss Error
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <BPMNModeler 
                      xml={bpmnXml} 
                      onChange={handleBpmnChange}
                      onError={(err) => setImportError(err.message || String(err))}
                      onElementClick={(id) => {
                        // Find corresponding narrative step
                        const step = (narrative.steps || []).find(s => s.bpmnElementId === id);
                        if (step) setActiveStepId(step.id);
                      }}
                    />
                  </div>
                )}
                {activeView === 'dmn' && (
                  <div className="flex items-center justify-center h-full text-slate-400 font-medium italic">
                    DMN Editor integration in progress...
                  </div>
                )}
                {activeView === 'forms' && (
                  <div className="flex items-center justify-center h-full text-slate-400 font-medium italic">
                    Form Builder integration in progress...
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

          {/* Right Panel: Copilot Chat */}
          <Panel defaultSize={25} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="h-12 border-b border-slate-200 bg-white flex items-center px-4 gap-2">
                <MessageSquare size={16} className="text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">AI Copilot</span>
              </div>
              <CopilotChat 
                narrative={narrative}
                onUpdateNarrative={handleNarrativeChange}
                onUpdateBpmn={handleBpmnChange}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
              />
            </div>
          </Panel>
        </PanelGroup>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-8 bg-white border-t border-slate-200 flex items-center justify-between px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Camunda 8 Compatible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>Sync: Active</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>v1.0.0-alpha</span>
          <span className="text-slate-300">|</span>
          <span>Last saved: Just now</span>
        </div>
      </footer>
    </div>
  );
}
