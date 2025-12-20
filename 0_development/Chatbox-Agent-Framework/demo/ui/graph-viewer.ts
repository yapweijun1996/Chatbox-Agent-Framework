/**
 * Simple state graph viewer for the debug drawer.
 */

import type { GraphDefinition, Event } from '../../src/core/types';

type NodeStatus = 'idle' | 'running' | 'success' | 'failure' | 'warning';

interface LayoutNode {
    id: string;
    name: string;
    x: number;
    y: number;
}

export class GraphViewer {
    private graph: GraphDefinition | null = null;
    private svg: SVGSVGElement | null = null;
    private nodeEls: Map<string, SVGGElement> = new Map();
    private statusMap: Map<string, NodeStatus> = new Map();

    constructor(
        private readonly container: HTMLElement,
        private readonly emptyState: HTMLElement
    ) {}

    setGraph(graph: GraphDefinition | null) {
        this.graph = graph;
        this.render();
    }

    reset() {
        this.statusMap.clear();
        this.nodeEls.forEach(node => node.setAttribute('data-status', 'idle'));
    }

    handleEvent(event: Event) {
        if (!event.nodeId) return;

        if (event.type === 'node_start') {
            this.updateNodeStatus(event.nodeId, 'running');
            return;
        }

        if (event.type === 'node_end') {
            const status = event.status === 'success'
                ? 'success'
                : event.status === 'failure'
                    ? 'failure'
                    : event.status === 'warning'
                        ? 'warning'
                        : 'idle';
            this.updateNodeStatus(event.nodeId, status);
        }
    }

    private updateNodeStatus(nodeId: string, status: NodeStatus) {
        this.statusMap.set(nodeId, status);
        const nodeEl = this.nodeEls.get(nodeId);
        if (nodeEl) {
            nodeEl.setAttribute('data-status', status);
        }
    }

    private render() {
        this.container.innerHTML = '';
        this.nodeEls.clear();

        if (!this.graph || this.graph.nodes.length === 0) {
            this.container.classList.add('hidden');
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');
        this.container.classList.remove('hidden');

        const layout = this.buildLayout(this.graph);
        const width = 280;
        const height = Math.max(200, layout.length * 80 + 30);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', String(height));
        svg.classList.add('graph-svg');
        this.svg = svg;

        svg.appendChild(this.buildDefs());
        this.renderEdges(svg, layout);
        this.renderNodes(svg, layout);

        this.container.appendChild(svg);
    }

    private buildLayout(graph: GraphDefinition): LayoutNode[] {
        const startY = 20;
        const gapY = 70;
        const nodeWidth = 160;

        return graph.nodes.map((node, index) => {
            const x = (280 - nodeWidth) / 2;
            const y = startY + index * gapY;
            return {
                id: node.id,
                name: node.name,
                x,
                y,
            };
        });
    }

    private buildDefs(): SVGDefsElement {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'graph-arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', 'currentColor');

        marker.appendChild(path);
        defs.appendChild(marker);
        return defs;
    }

    private renderEdges(svg: SVGSVGElement, layout: LayoutNode[]) {
        const positions = new Map(layout.map(node => [node.id, node]));
        const nodeWidth = 160;
        const nodeHeight = 36;

        for (const edge of this.graph!.edges) {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) continue;

            const startX = from.x + nodeWidth / 2;
            const startY = from.y + nodeHeight;
            const endX = to.x + nodeWidth / 2;
            const endY = to.y;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const midY = (startY + endY) / 2;
            const d = `M ${startX} ${startY} C ${startX} ${midY} ${endX} ${midY} ${endX} ${endY}`;
            path.setAttribute('d', d);
            path.setAttribute('class', 'graph-edge');
            path.setAttribute('marker-end', 'url(#graph-arrow)');
            if (edge.condition) {
                path.classList.add('graph-edge-conditional');
            }
            svg.appendChild(path);
        }
    }

    private renderNodes(svg: SVGSVGElement, layout: LayoutNode[]) {
        const nodeWidth = 160;
        const nodeHeight = 36;

        for (const node of layout) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'graph-node');
            group.setAttribute('data-status', this.statusMap.get(node.id) ?? 'idle');

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', String(node.x));
            rect.setAttribute('y', String(node.y));
            rect.setAttribute('width', String(nodeWidth));
            rect.setAttribute('height', String(nodeHeight));
            rect.setAttribute('rx', '10');
            rect.setAttribute('ry', '10');
            rect.setAttribute('class', 'graph-node-rect');

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', String(node.x + nodeWidth / 2));
            text.setAttribute('y', String(node.y + nodeHeight / 2 + 4));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'graph-node-label');
            text.textContent = node.name;

            group.appendChild(rect);
            group.appendChild(text);
            svg.appendChild(group);
            this.nodeEls.set(node.id, group);
        }
    }
}
