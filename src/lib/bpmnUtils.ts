/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes and heals BPMN XML to prevent common rendering errors like 'root-0'.
 * Uses DOMParser for robust XML manipulation instead of fragile regex.
 */
export const normalizeBpmnXml = (xml: string): string => {
  if (!xml || xml.trim() === '') return xml;

  try {
    const parser = new DOMParser();
    // AI sometimes wraps XML in markdown or adds extra text. 
    // We try to find the start of the XML.
    let xmlContent = xml.trim();
    const definitionsStart = xmlContent.indexOf('<');
    if (definitionsStart > 0) {
      xmlContent = xmlContent.substring(definitionsStart);
    }

    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    
    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      console.warn("XML parsing error during normalization, falling back to original XML");
      return xml;
    }

    const definitions = xmlDoc.documentElement;
    if (!definitions || !definitions.nodeName.toLowerCase().includes('definitions')) {
      return xml;
    }

    // 1. Ensure essential namespaces
    const namespaces: Record<string, string> = {
      'xmlns:bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
      'xmlns:bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
      'xmlns:dc': 'http://www.omg.org/spec/DD/20100524/DC',
      'xmlns:di': 'http://www.omg.org/spec/DD/20100524/DI',
      'xmlns:zeebe': 'http://camunda.org/schema/zeebe/1.0',
      'xmlns:modeler': 'http://camunda.org/schema/modeler/1.0',
      'targetNamespace': 'http://bpmn.io/schema/bpmn'
    };

    Object.entries(namespaces).forEach(([attr, url]) => {
      if (!definitions.hasAttribute(attr)) {
        definitions.setAttribute(attr, url);
      }
    });

    if (!definitions.hasAttribute('id')) {
      definitions.setAttribute('id', 'Definitions_1');
    }

    // 2. Identify the root element (Collaboration or Process)
    const collaborations = xmlDoc.getElementsByTagNameNS('*', 'collaboration');
    const processes = xmlDoc.getElementsByTagNameNS('*', 'process');
    
    let rootElement = collaborations.length > 0 ? collaborations[0] : (processes.length > 0 ? processes[0] : null);
    
    if (!rootElement && processes.length === 0) {
      // If no process exists, create a default one
      const newProcess = xmlDoc.createElementNS(namespaces['xmlns:bpmn'], 'bpmn:process');
      newProcess.setAttribute('id', 'Process_1');
      newProcess.setAttribute('isExecutable', 'true');
      definitions.insertBefore(newProcess, definitions.firstChild);
      rootElement = newProcess;
    } else if (rootElement && !rootElement.getAttribute('id')) {
      const defaultId = rootElement.nodeName.toLowerCase().includes('collaboration') ? 'Collaboration_1' : 'Process_1';
      rootElement.setAttribute('id', defaultId);
    }

    const rootId = rootElement?.getAttribute('id') || 'Process_1';

    // 3. Handle BPMNDiagram and BPMNPlane
    const diagrams = xmlDoc.getElementsByTagNameNS('*', 'BPMNDiagram');
    
    // Keep only the first diagram to prevent root-x errors
    if (diagrams.length > 1) {
      console.warn(`Found ${diagrams.length} BPMNDiagram elements. Keeping only the first one.`);
      while (diagrams.length > 1) {
        diagrams[1].parentNode?.removeChild(diagrams[1]);
      }
    }

    let diagram = diagrams[0];
    if (!diagram) {
      diagram = xmlDoc.createElementNS(namespaces['xmlns:bpmndi'], 'bpmndi:BPMNDiagram');
      diagram.setAttribute('id', 'BPMNDiagram_1');
      definitions.appendChild(diagram);
    }

    let plane = diagram.getElementsByTagNameNS('*', 'BPMNPlane')[0];
    if (!plane) {
      plane = xmlDoc.createElementNS(namespaces['xmlns:bpmndi'], 'bpmndi:BPMNPlane');
      plane.setAttribute('id', 'BPMNPlane_1');
      diagram.appendChild(plane);
    }

    // The "Golden Link": Ensure BPMNPlane references the root ID
    if (plane.getAttribute('bpmnElement') !== rootId) {
      plane.setAttribute('bpmnElement', rootId);
    }

    // 4. Clean up broken DI elements (BPMNShape/BPMNEdge referencing non-existent elements)
    // This prevents "root-x" and other rendering errors when DI is out of sync with semantic model.
    const allSemanticIds = new Set<string>();
    const semanticTags = [
      'process', 'collaboration', 'participant', 'lane',
      'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'businessRuleTask', 'sendTask', 'receiveTask',
      'startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent', 'boundaryEvent',
      'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'complexGateway', 'eventBasedGateway',
      'sequenceFlow', 'messageFlow', 'association', 'dataInputAssociation', 'dataOutputAssociation',
      'callActivity', 'subProcess', 'transaction', 'adHocSubProcess',
      'dataObject', 'dataObjectReference', 'dataStoreReference'
    ];

    semanticTags.forEach(tag => {
      const elements = xmlDoc.getElementsByTagNameNS('*', tag);
      Array.from(elements).forEach(el => {
        const id = el.getAttribute('id');
        if (id) allSemanticIds.add(id);
      });
    });
    
    // Ensure the rootId itself is in the set
    allSemanticIds.add(rootId);

    const shapes = xmlDoc.getElementsByTagNameNS('*', 'BPMNShape');
    const edges = xmlDoc.getElementsByTagNameNS('*', 'BPMNEdge');

    Array.from(shapes).forEach(shape => {
      const bpmnElement = shape.getAttribute('bpmnElement');
      if (bpmnElement && !allSemanticIds.has(bpmnElement)) {
        console.warn(`Removing BPMNShape for non-existent element: ${bpmnElement}`);
        shape.parentNode?.removeChild(shape);
      }
    });

    Array.from(edges).forEach(edge => {
      const bpmnElement = edge.getAttribute('bpmnElement');
      if (bpmnElement && !allSemanticIds.has(bpmnElement)) {
        console.warn(`Removing BPMNEdge for non-existent element: ${bpmnElement}`);
        edge.parentNode?.removeChild(edge);
      }
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  } catch (err) {
    console.error("Error in normalizeBpmnXml:", err);
    return xml;
  }
};

/**
 * A more aggressive repair strategy that rebuilds the BPMN XML from scratch
 * using the extracted process and collaboration elements.
 */
export const aggressiveRepairBpmnXml = (xml: string): string => {
  if (!xml || xml.trim() === '') return xml;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");
    
    const processes = Array.from(xmlDoc.getElementsByTagNameNS('*', 'process'));
    const collaborations = Array.from(xmlDoc.getElementsByTagNameNS('*', 'collaboration'));

    if (processes.length === 0 && collaborations.length === 0) {
      return xml;
    }

    const serializer = new XMLSerializer();
    
    // Identify the root ID and ensure it's set on the element before serialization
    let rootId = 'Process_1';
    if (collaborations.length > 0) {
      if (!collaborations[0].getAttribute('id')) {
        collaborations[0].setAttribute('id', 'Collaboration_1');
      }
      rootId = collaborations[0].getAttribute('id')!;
    } else if (processes.length > 0) {
      if (!processes[0].getAttribute('id')) {
        processes[0].setAttribute('id', 'Process_1');
      }
      rootId = processes[0].getAttribute('id')!;
    }

    const processXml = processes.map(p => serializer.serializeToString(p)).join('\n  ');
    const collaborationXml = collaborations.map(c => serializer.serializeToString(c)).join('\n  ');

    // Rebuild the XML with a clean structure
    const repairedXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions 
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" 
  xmlns:modeler="http://camunda.org/schema/modeler/1.0"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn" 
  exporter="Scotiaflow Repair" 
  exporterVersion="1.0.0">
  ${collaborationXml}
  ${processXml}
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${rootId}">
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

    return repairedXml;
  } catch (err) {
    console.error("Error in aggressiveRepairBpmnXml:", err);
    return xml;
  }
};
