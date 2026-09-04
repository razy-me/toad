from PIL import Image
import numpy as np

im = Image.open('C:/toad/cropped_reference.png')
arr = np.array(im)
art = arr[26:782, 26:626]
H, W, _ = art.shape

is_blue = (art[:, :, 2].astype(int) - art[:, :, 0].astype(int) > 15) & (art[:, :, 0] < 100)

# Clean only tiny isolated specks (< 15 pixels)
from collections import deque

def remove_small_specks(binary_map, min_size=25, target_val=False):
    # If target_val is False, we find false regions (holes) smaller than min_size and flip them to True
    # If target_val is True, we find true regions smaller than min_size and flip them to False
    res = binary_map.copy()
    h, w = res.shape
    visited = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            if res[y, x] == target_val and not visited[y, x]:
                comp = []
                q = deque([(y, x)])
                visited[y, x] = True
                while q:
                    cy, cx = q.popleft()
                    comp.append((cy, cx))
                    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and res[ny, nx] == target_val:
                            visited[ny, nx] = True
                            q.append((ny, nx))
                if len(comp) < min_size:
                    for cy, cx in comp:
                        res[cy, cx] = not target_val
    return res

cleaned_blue = remove_small_specks(is_blue, min_size=40, target_val=False) # remove small holes
cleaned_blue = remove_small_specks(cleaned_blue, min_size=40, target_val=True) # remove small islands

img = Image.fromarray((cleaned_blue * 255).astype(np.uint8))
img.save('C:/toad/scratch_mask_refined.png')
print('Saved scratch_mask_refined.png')
