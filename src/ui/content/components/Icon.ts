export function createIcon(svg: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'aimd-icon';
    span.innerHTML = svg;
    return span;
}

