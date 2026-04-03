/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import BpmnModeler from 'camunda-bpmn-js/lib/camunda-cloud/Modeler';
// @ts-ignore
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule
} from 'bpmn-js-properties-panel';
import CamundaBpmnModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import ZeebeBpmnModdle from 'zeebe-bpmn-moddle/resources/zeebe.json';
import { normalizeBpmnXml, aggressiveRepairBpmnXml } from '../../lib/bpmnUtils';

interface BPMNModelerProps {
  xml: string;
  onChange?: (xml: string) => void;
  onElementClick?: (elementId: string) => void;
  onError?: (error: any) => void;
}

export const BPMNModeler: React.FC<BPMNModelerProps> = ({ xml, onChange, onElementClick, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const lastImportedXmlRef = useRef<string>(xml);
  const onChangeRef = useRef(onChange);
  const onElementClickRef = useRef(onElementClick);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onElementClickRef.current = onElementClick;
  }, [onElementClick]);

  useEffect(() => {
    if (!containerRef.current || !propertiesPanelRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      propertiesPanel: {
        parent: propertiesPanelRef.current
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule
      ],
      moddleExtensions: {
        zeebe: ZeebeBpmnModdle
      }
    });

    modelerRef.current = modeler;

    const importXml = async (xmlToImport: string) => {
      if (!xmlToImport || xmlToImport.trim() === '') {
        console.warn('Attempted to import empty BPMN XML');
        return;
      }

      // Pre-heal XML to prevent root-x errors before they happen
      const healedXml = normalizeBpmnXml(xmlToImport);

      // Robust validation for BPMN structure using regex
      const hasProcess = /<([\w-]*:)?process/i.test(healedXml);
      const hasCollaboration = /<([\w-]*:)?collaboration/i.test(healedXml);
      
      if (!hasProcess && !hasCollaboration) {
        console.warn('BPMN XML is missing process or collaboration element');
        return;
      }

      try {
        await modeler.importXML(healedXml);
        lastImportedXmlRef.current = healedXml;
        
        // Fit viewport after successful import, but handle non-finite scale errors
        try {
          const canvas = modeler.get('canvas');
          // Only zoom if there are elements to zoom to
          const elementRegistry = modeler.get('elementRegistry');
          if (elementRegistry.getAll().length > 0) {
            canvas.zoom('fit-viewport');
          }
        } catch (zoomErr) {
          console.warn('Could not fit viewport, likely empty diagram', zoomErr);
        }
      } catch (err: any) {
        console.error('Error importing BPMN XML', err);
        
        // Last resort: if it's a root-x error, try aggressive repair
        if (err.message && /root-\d+/.test(err.message)) {
          console.warn(`Attempting aggressive repair for ${err.message}`);
          const aggressivelyRepairedXml = aggressiveRepairBpmnXml(healedXml);
          try {
            await modeler.importXML(aggressivelyRepairedXml);
            lastImportedXmlRef.current = aggressivelyRepairedXml;
            
            try {
              const canvas = modeler.get('canvas');
              canvas.zoom('fit-viewport');
            } catch (zoomErr) {
              console.warn('Could not fit viewport after repair', zoomErr);
            }
            return; // Success!
          } catch (finalErr) {
            console.error('Aggressive repair failed', finalErr);
          }
        }
        
        if (onError) onError(err);
      }
    };

    importXml(xml);

    modeler.on('commandStack.changed', async () => {
      if (onChangeRef.current) {
        try {
          const { xml: updatedXml } = await modeler.saveXML({ format: true });
          if (updatedXml && updatedXml !== lastImportedXmlRef.current) {
            lastImportedXmlRef.current = updatedXml;
            onChangeRef.current(updatedXml);
          }
        } catch (err) {
          console.error('Error saving BPMN XML', err);
        }
      }
    });

    modeler.on('element.click', (event: any) => {
      if (onElementClickRef.current && event.element) {
        onElementClickRef.current(event.element.id);
      }
    });

    return () => {
      modeler.destroy();
    };
  }, []);

  useEffect(() => {
    if (modelerRef.current && xml && xml !== lastImportedXmlRef.current) {
      // Pre-heal XML
      const healedXml = normalizeBpmnXml(xml);

      // Robust validation for BPMN structure using regex
      const hasProcess = /<([\w-]*:)?process/i.test(healedXml);
      const hasCollaboration = /<([\w-]*:)?collaboration/i.test(healedXml);
      
      if (!hasProcess && !hasCollaboration) {
        console.warn('BPMN XML is missing process or collaboration element, skipping re-import');
        return;
      }

      modelerRef.current.importXML(healedXml)
        .then(() => {
          lastImportedXmlRef.current = healedXml;
          
          try {
            const canvas = modelerRef.current.get('canvas');
            const elementRegistry = modelerRef.current.get('elementRegistry');
            if (elementRegistry.getAll().length > 0) {
              canvas.zoom('fit-viewport');
            }
          } catch (zoomErr) {
            console.warn('Could not fit viewport on re-import', zoomErr);
          }
        })
        .catch(async (err: any) => {
          console.error('Error re-importing BPMN XML', err);
          
          // Last resort: if it's a root-x error, try aggressive repair
          if (err.message && /root-\d+/.test(err.message)) {
            console.warn(`Attempting aggressive repair for ${err.message} (re-import)`);
            const aggressivelyRepairedXml = aggressiveRepairBpmnXml(healedXml);
            try {
              await modelerRef.current.importXML(aggressivelyRepairedXml);
              lastImportedXmlRef.current = aggressivelyRepairedXml;
              
              try {
                const canvas = modelerRef.current.get('canvas');
                canvas.zoom('fit-viewport');
              } catch (zoomErr) {
                console.warn('Could not fit viewport after repair (re-import)', zoomErr);
              }
              return; // Success!
            } catch (finalErr) {
              console.error('Aggressive repair failed (re-import)', finalErr);
            }
          }
          
          if (onError) onError(err);
        });
    }
  }, [xml]);

  return (
    <div className="flex h-full w-full overflow-hidden border border-slate-200 rounded-lg bg-white shadow-sm">
      <div ref={containerRef} className="flex-1 bpmn-container" />
      <div ref={propertiesPanelRef} className="w-80 properties-panel-parent bg-slate-50" />
    </div>
  );
};
