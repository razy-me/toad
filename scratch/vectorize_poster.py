from PIL import Image
import numpy as np
from collections import defaultdict

mask = np.array(Image.open('C:/toad/scratch_mask_refined.png')) > 128
H, W = mask.shape
padded = np.pad(mask, 1, mode='constant', constant_values=False)

tl = padded[:-1, :-1]; tr = padded[:-1, 1:]; bl = padded[1:, :-1]; br = padded[1:, 1:]
cell_type = (tl.astype(int) << 3) | (tr.astype(int) << 2) | (br.astype(int) << 1) | bl.astype(int)
edge_offsets = {0: (0.0, 0.5), 1: (0.5, 1.0), 2: (1.0, 0.5), 3: (0.5, 0.0)}
cases = {
    1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(1, 0)],
    5: [(3, 0), (1, 2)], 6: [(2, 0)], 7: [(3, 0)],
    8: [(0, 3)], 9: [(0, 2)], 10: [(0, 1), (2, 3)],
    11: [(0, 1)], 12: [(1, 3)], 13: [(1, 2)], 14: [(2, 3)],
}

segments = []
for y in range(H + 1):
    for x in range(W + 1):
        ct = cell_type[y, x]
        if ct in cases:
            for e1, e2 in cases[ct]:
                dy1, dx1 = edge_offsets[e1]; dy2, dx2 = edge_offsets[e2]
                segments.append(((round(x - 1 + dx1, 2), round(y - 1 + dy1, 2)), (round(x - 1 + dx2, 2), round(y - 1 + dy2, 2))))

adj = defaultdict(list)
for p1, p2 in segments: adj[p1].append(p2)

visited_edges = set(); loops = []
for p1, p2_list in list(adj.items()):
    for p2 in p2_list:
        if (p1, p2) in visited_edges: continue
        loop = [p1]; curr = p2; visited_edges.add((p1, p2))
        while curr != p1:
            loop.append(curr)
            next_p = None
            for cand in adj[curr]:
                if (curr, cand) not in visited_edges:
                    next_p = cand; visited_edges.add((curr, cand)); break
            if next_p is None: break
            curr = next_p
        if len(loop) > 80: loops.append(loop)

loops.sort(key=len, reverse=True)
print(f'Found {len(loops)} loops with lengths: {[len(l) for l in loops]}')

def rdp_2d(points, epsilon):
    dmax = 0.0; index = 0
    p1 = points[0]; p2 = points[-1]
    dx = p2[0] - p1[0]; dy = p2[1] - p1[1]
    line_len = (dx*dx + dy*dy)**0.5
    for i in range(1, len(points) - 1):
        p = points[i]
        if line_len == 0: d = ((p[0] - p1[0])**2 + (p[1] - p1[1])**2)**0.5
        else: d = abs(dx * (p1[1] - p[1]) - dy * (p1[0] - p[0])) / line_len
        if d > dmax: index = i; dmax = d
    if dmax > epsilon:
        rec1 = rdp_2d(points[:index+1], epsilon)
        rec2 = rdp_2d(points[index:], epsilon)
        return rec1[:-1] + rec2
    else: return [points[0], points[-1]]

def simplify_closed_loop(loop, epsilon=2.0):
    n = len(loop)
    h1 = rdp_2d(loop[:n//2 + 1], epsilon)
    h2 = rdp_2d(loop[n//2:], epsilon)
    res = h1[:-1] + h2
    if len(res) > 1 and abs(res[0][0] - res[-1][0]) < 1e-4 and abs(res[0][1] - res[-1][1]) < 1e-4:
        res.pop()
    return res

def points_to_cubic_bezier_svg(pts):
    n = len(pts)
    if n < 3: return ''
    d_parts = [f'M {pts[0][0]:.1f} {pts[0][1]:.1f}']
    for i in range(n):
        p_prev = np.array(pts[(i - 1) % n])
        p_curr = np.array(pts[i])
        p_next = np.array(pts[(i + 1) % n])
        p_next2 = np.array(pts[(i + 2) % n])
        
        c1 = p_curr + (p_next - p_prev) / 6.0
        c2 = p_next - (p_next2 - p_curr) / 6.0
        d_parts.append(f'C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {p_next[0]:.1f} {p_next[1]:.1f}')
    d_parts.append('Z')
    return ' '.join(d_parts)

scale_x = 920.0 / W
scale_y = 1156.0 / H

svg_paths = []
for i, loop in enumerate(loops):
    scaled_loop = [(p[0] * scale_x, p[1] * scale_y) for p in loop]
    simp = simplify_closed_loop(scaled_loop, epsilon=2.2)
    d = points_to_cubic_bezier_svg(simp)
    print(f'Loop {i}: {len(loop)} -> {len(simp)} points, len(d)={len(d)}')
    svg_paths.append(d)

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" width="1000" height="1400">
  <rect width="1000" height="1400" fill="#f0f3f6" />
  <rect x="40" y="40" width="920" height="1156" fill="none" stroke="#1a3258" stroke-width="1.5" />
  <g transform="translate(40, 40)">
    <path d="{svg_paths[0]}" fill="#1a3258" />
'''
for d in svg_paths[1:]:
    svg_content += f'    <path d="{d}" fill="#f0f3f6" />\n'
svg_content += '''  </g>
</svg>'''

with open('C:/toad/scratch_test_poster.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)
print('Wrote C:/toad/scratch_test_poster.svg')
