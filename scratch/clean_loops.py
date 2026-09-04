from PIL import Image, ImageDraw
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
        xs = [p[0] for p in loop]
        if len(loop) > 100 and (max(xs) - min(xs)) > 20: # filter 1px edge artifacts
            loops.append(loop)

loops.sort(key=len, reverse=True)
print(f'Clean loops: {len(loops)}')
for i, l in enumerate(loops):
    xs = [p[0] for p in l]; ys = [p[1] for p in l]
    print(f'Loop {i}: len={len(l)}, x=[{min(xs):.1f}, {max(xs):.1f}], y=[{min(ys):.1f}, {max(ys):.1f}]')
