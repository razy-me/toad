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
        xs = [p[0] for p in loop]
        if len(loop) > 100 and (max(xs) - min(xs)) > 20:
            loops.append(loop)

loops.sort(key=len, reverse=True)

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
        # Clamp to box [0, 920] and [0, 1156] so curves stay cleanly in frame
        c1[0] = np.clip(c1[0], 0, 920)
        c1[1] = np.clip(c1[1], 0, 1156)
        c2[0] = np.clip(c2[0], 0, 920)
        c2[1] = np.clip(c2[1], 0, 1156)
        pn = np.clip(p_next, [0, 0], [920, 1156])
        d_parts.append(f'C {c1[0]:.1f} {c1[1]:.1f}, {c2[0]:.1f} {c2[1]:.1f}, {pn[0]:.1f} {pn[1]:.1f}')
    d_parts.append('Z')
    return ' '.join(d_parts)

scale_x = 920.0 / W
scale_y = 1156.0 / H

svg_paths = []
for i, loop in enumerate(loops):
    scaled_loop = [(min(920.0, max(0.0, p[0] * scale_x)), min(1156.0, max(0.0, p[1] * scale_y))) for p in loop]
    simp = simplify_closed_loop(scaled_loop, epsilon=2.0)
    d = points_to_cubic_bezier_svg(simp)
    print(f'Loop {i}: {len(loop)} -> {len(simp)} points, len(d)={len(d)}')
    svg_paths.append(d)

toad_code = f'''// ============================================================================
// JAPANESE EXHIBITION POSTER (1968) - YUSAKU KAMEKURA / DESIGN GALLERY 1953
// Recreated in TOAD DSL
// Dimensions: 1000 x 1400 px • 5:7 Poster Ratio • Multi-Format Export
// ============================================================================

// --- Color Tokens ---
>bgPaper = #eff2f5;
>inkBlue = #1a3258;

// ============================================================================
// CANVAS CONFIGURATION
// ============================================================================

canvas "Tokyo-Olympic-Kamekura" {{
  size: 1000px 1400px;
  background: >bgPaper;
  export: all;
  quality: 95;
}}

// ============================================================================
// INNER FRAME BORDER
// ============================================================================

rect #frameBorder {{
  size: 920px 1156px;
  fill: transparent;
  stroke: >inkBlue 1.5px;
  at: (40px, 40px);
}}

// ============================================================================
// MAIN SERPENTINE GRAPHIC (DEEP INDIGO BLUE INK)
// ============================================================================

// Serpentine base ribbon path
path #serpentineBase {{
  d: "{svg_paths[0]}";
  size: 920px 1156px;
  fill: >inkBlue;
  at: (40px, 40px);
}}

// Internal cutout channel 1 (upper-middle crescent)
path #crescentHole1 {{
  d: "{svg_paths[1]}";
  size: 920px 1156px;
  fill: >bgPaper;
  at: (40px, 40px);
}}

// Internal cutout channel 2 (lower-middle crescent)
path #crescentHole2 {{
  d: "{svg_paths[2]}";
  size: 920px 1156px;
  fill: >bgPaper;
  at: (40px, 40px);
}}

// ============================================================================
// FINE CREASE / FOLD LINES (LIGHT ACCENT STROKES)
// ============================================================================

path #creaseTopLeft {{
  d: "M 175 130 L 215 95";
  size: 920px 1156px;
  stroke: >bgPaper 1.8px;
  at: (40px, 40px);
}}

path #creaseUpperMid {{
  d: "M 495 305 L 510 275";
  size: 920px 1156px;
  stroke: >bgPaper 1.8px;
  at: (40px, 40px);
}}

path #creaseLowerMid {{
  d: "M 270 650 L 255 620";
  size: 920px 1156px;
  stroke: >bgPaper 1.8px;
  at: (40px, 40px);
}}

path #creaseBottom {{
  d: "M 180 930 L 175 900";
  size: 920px 1156px;
  stroke: >bgPaper 1.8px;
  at: (40px, 40px);
}}

// ============================================================================
// BOTTOM TYPOGRAPHY SECTION
// ============================================================================

// Header Category
text #categoryText {{
  content: "第48回 デザインギャラリー展";
  font-family: "Yu Gothic";
  font-size: 15px;
  font-weight: 500;
  color: >inkBlue;
  at: (42px, 1238px);
}}

// Main Exhibition Title
text #titleText {{
  content: "東京オリンピックの公式ポスタ (亀倉 雄策)";
  font-family: "Yu Gothic";
  font-size: 30px;
  font-weight: bold;
  color: >inkBlue;
  letter-spacing: 0.5px;
  at: (42px, 1272px);
}}

// Exhibition Details / Dates
text #detailsText {{
  content: "第48回　第48回　かめくら ゆうさく、1915年4月6日 - 1997年5月11日。";
  font-family: "Yu Gothic";
  font-size: 13px;
  font-weight: 400;
  color: >inkBlue;
  at: (42px, 1312px);
}}

// ============================================================================
// DESIGN COMMITTEE / DESIGN GALLERY 1953 GEOMETRIC LOGO
// ============================================================================

// Shape 1: Solid Circle (Diameter 58px)
circle #logoCircle {{
  size: 58px;
  fill: >inkBlue;
  at: (828px, 1256px);
}}

// Shape 2: Left Semicircle (Width 29px, Height 58px)
path #logoSemicircle1 {{
  d: "M 0 29 A 29 29 0 0 1 29 0 L 29 58 A 29 29 0 0 1 0 29 Z";
  size: 29px 58px;
  fill: >inkBlue;
  at: (894px, 1256px);
}}

// Shape 3: Left Semicircle (Width 29px, Height 58px)
path #logoSemicircle2 {{
  d: "M 0 29 A 29 29 0 0 1 29 0 L 29 58 A 29 29 0 0 1 0 29 Z";
  size: 29px 58px;
  fill: >inkBlue;
  at: (931px, 1256px);
}}
'''

target_path = 'C:/toad/kamekura-tokyo-poster/kamekura_poster.toad'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write(toad_code)
print('Successfully generated:', target_path)
