/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Narrative, NarrativeStep } from '../../types/domain';
import { Send, Sparkles, Loader2, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { normalizeBpmnXml } from '../../lib/bpmnUtils';

interface CopilotChatProps {
  narrative: Narrative;
  onUpdateNarrative: (narrative: Narrative) => void;
  onUpdateBpmn: (xml: string) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ 
  narrative, 
  onUpdateNarrative, 
  onUpdateBpmn,
  isGenerating,
  setIsGenerating
}) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: "Hello! I'm your Scotiaflow Copilot. I can help you turn your business narrative into an executable process model. What are we building today?" }
  ]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    if (!process.env.GEMINI_API_KEY) {
      setMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, but the Gemini API key is not configured. Please check your environment settings." }]);
      return;
    }

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsGenerating(true);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [{
              text: `
                Current Business Narrative:
                Title: ${narrative.title}
                Description: ${narrative.description}
                Steps: ${JSON.stringify(narrative.steps)}

                User Request: ${userMsg}

                Please update the process model. Ensure the BPMN XML is valid, uses Camunda 8 namespaces, and maps narrative step IDs to BPMN element IDs correctly.
              `
            }]
          }
        ],
        config: {
          systemInstruction: `
            You are a Principal Process Automation Architect specializing in Camunda 8 and BPMN 2.0.
            Your goal is to translate business narratives into executable technical artifacts.

            CRITICAL XML STRUCTURE RULES:
            1. You MUST return a COMPLETE BPMN 2.0 XML document.
            2. The XML MUST follow this exact structure for Camunda 8 (Zeebe):
               <?xml version="1.0" encoding="UTF-8"?>
               <bpmn:definitions 
                 xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                 xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                 xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                 xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                 xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" 
                 xmlns:modeler="http://camunda.org/schema/modeler/1.0"
                 targetNamespace="http://bpmn.io/schema/bpmn" 
                 exporter="Camunda Modeler" 
                 exporterVersion="5.0.0">
                 <bpmn:process id="Process_1" isExecutable="true">
                   ... tasks and flows ...
                 </bpmn:process>
                 <bpmndi:BPMNDiagram id="BPMNDiagram_1">
                   <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
                     ... DI information ...
                   </bpmndi:BPMNPlane>
                 </bpmndi:BPMNDiagram>
               </bpmn:definitions>
            3. CRITICAL: The 'bpmnElement' attribute of <bpmndi:BPMNPlane> MUST EXACTLY MATCH the 'id' of the <bpmn:process> (or <bpmn:collaboration> if present). 
               Failure to do this causes a 'root-0' error.
            4. Ensure all IDs (elements, flows, shapes, edges) are UNIQUE within the document.
            5. NEVER return a partial XML or just a snippet.
            6. Ensure all IDs used in <bpmndi:BPMNShape> and <bpmndi:BPMNEdge> exist in the <bpmn:process> section.
            7. Use Zeebe namespaces: xmlns:zeebe="http://camunda.org/schema/zeebe/1.0".
            8. If you use a <bpmn:collaboration>, the <bpmndi:BPMNPlane> MUST point to the collaboration ID, NOT the process ID.
            9. NEVER generate more than one <bpmndi:BPMNDiagram> element.
          `,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { 
                type: Type.STRING,
                description: "A brief explanation of the changes made to the process."
              },
              narrative: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        actor: { type: Type.STRING },
                        type: { 
                          type: Type.STRING,
                          enum: ['task', 'userTask', 'serviceTask', 'gateway', 'event']
                        },
                        bpmnElementId: { type: Type.STRING }
                      }
                    }
                  }
                }
              },
              bpmnXml: { 
                type: Type.STRING,
                description: "The complete, valid BPMN 2.0 XML string including DI information."
              }
            },
            required: ["explanation", "narrative", "bpmnXml"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.explanation) {
        setMessages(prev => [...prev, { role: 'ai', content: result.explanation }]);
      }
      
      if (result.narrative) {
        onUpdateNarrative(result.narrative);
      }
      
      if (result.bpmnXml) {
        const sanitizedXml = normalizeBpmnXml(result.bpmnXml);

        // Final check: if it doesn't look like BPMN at all, don't update
        // Stricter check: must have a process or collaboration AND a diagram section
        const hasProcess = /<([\w-]*:)?process/i.test(sanitizedXml);
        const hasCollaboration = /<([\w-]*:)?collaboration/i.test(sanitizedXml);
        const hasDiagram = /<([\w-]*:)?BPMNDiagram/i.test(sanitizedXml);
        const hasPlane = /<([\w-]*:)?BPMNPlane/i.test(sanitizedXml);

        if ((hasProcess || hasCollaboration) && hasDiagram && hasPlane) {
          onUpdateBpmn(sanitizedXml);
        } else {
          console.warn('AI generated invalid BPMN XML structure:', sanitizedXml);
          setMessages(prev => [...prev, { 
            role: 'ai', 
            content: "I generated a process model, but the technical XML structure was incomplete (missing process or diagram information). I've updated the business narrative, but the diagram might not have refreshed correctly. \n\nWould you like me to try and **reconstruct a valid BPMN diagram** from the narrative?" 
          }]);
        }
      }

    } catch (error) {
      console.error('Copilot Error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: "I encountered an error while generating the process model. Please try again." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
          <Sparkles size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Scotiaflow Copilot</h3>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">AI-Native Automation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              <div className="markdown-body prose prose-sm prose-slate max-w-none prose-invert">
                <ReactMarkdown>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-xs text-slate-500 font-medium">Generating process model...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask Copilot to build or update your process..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
          <Info size={12} />
          <span>AI suggestions are non-destructive and require confirmation.</span>
        </div>
      </div>
    </div>
  );
};
