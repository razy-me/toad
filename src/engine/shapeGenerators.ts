import { LayoutBox } from '../parser/math.js';

export function generateShapePath(type: string, box: LayoutBox): string {
  const { w, h } = box;
  
  switch (type) {
    case 'triangle':
      return `M ${w/2} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'star': {
      const cx = w / 2;
      const cy = h / 2;
      const outerRadius = Math.min(w, h) / 2;
      const innerRadius = outerRadius * 0.382;
      let d = '';
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        d += i === 0 ? `M ${px} ${py} ` : `L ${px} ${py} `;
      }
      return d + 'Z';
    }
    case 'arrow':
      return `M 0 ${h * 0.3} L ${w * 0.6} ${h * 0.3} L ${w * 0.6} 0 L ${w} ${h / 2} L ${w * 0.6} ${h} L ${w * 0.6} ${h * 0.7} L 0 ${h * 0.7} Z`;
    case 'cross': {
      const thick = Math.min(w, h) * 0.2;
      return `M ${w/2 - thick/2} 0 L ${w/2 + thick/2} 0 L ${w/2 + thick/2} ${h/2 - thick/2} L ${w} ${h/2 - thick/2} L ${w} ${h/2 + thick/2} L ${w/2 + thick/2} ${h/2 + thick/2} L ${w/2 + thick/2} ${h} L ${w/2 - thick/2} ${h} L ${w/2 - thick/2} ${h/2 + thick/2} L 0 ${h/2 + thick/2} L 0 ${h/2 - thick/2} L ${w/2 - thick/2} ${h/2 - thick/2} Z`;
    }
    default:
      return '';
  }
}
