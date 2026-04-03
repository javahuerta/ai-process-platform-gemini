/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NarrativeStep {
  id: string;
  title: string;
  description: string;
  actor?: string;
  type: 'task' | 'decision' | 'event' | 'sub-process';
  inputs?: string[];
  outputs?: string[];
  sla?: string;
  policy?: string;
  bpmnElementId?: string; // Link to technical layer
}

export interface Narrative {
  id: string;
  title: string;
  description: string;
  steps: NarrativeStep[];
  actors: string[];
  metadata: Record<string, any>;
}

export interface TechnicalLayer {
  bpmnXml: string;
  forms: Record<string, any>; // Form JSONs keyed by ID
  dmnXml?: string;
}

export interface SyncMapping {
  narrativeStepId: string;
  bpmnElementId: string;
  confidence: number;
  lastSyncedAt: string;
}

export interface ProcessModel {
  id: string;
  name: string;
  narrative: Narrative;
  technical: TechnicalLayer;
  mappings: SyncMapping[];
}
