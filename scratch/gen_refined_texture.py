from PIL import Image, ImageFilter
import numpy as np

W, H = 1000, 1400

# Base neutral gray
base = np.full((H, W), 128.0, dtype=np.float32)

# 1. Fine paper fibers (salt-and-pepper grain)
np.random.seed(1968)
fine_grain = np.random.normal(0, 16, (H, W)).astype(np.float32)

# 2. Medium paper fibers (washi texture)
med = np.random.normal(0, 18, (H // 3, W // 3)).astype(np.float32)
med_img = Image.fromarray(med).resize((W, H), Image.Resampling.BICUBIC)
med_grain = np.array(med_img)

# 3. Organic ink mottling / watercolor pooling (clouds of ink density)
mottle = np.random.normal(0, 22, (H // 10, W // 10)).astype(np.float32)
mottle_img = Image.fromarray(mottle).resize((W, H), Image.Resampling.BICUBIC)
mottle_grain = np.array(mottle_img)

# 4. Vertical center seam / dark cylinder shadow
# In original poster, the darker vertical band runs around x = 480 to 550 px (centered around x = 515)
x_coords = np.arange(W, dtype=np.float32)
center_seam = -35.0 * np.exp(-((x_coords - 515.0) ** 2) / (2 * (55.0 ** 2)))
# Secondary softer wider band
center_wide = -15.0 * np.exp(-((x_coords - 515.0) ** 2) / (2 * (140.0 ** 2)))
vertical_band = np.tile(center_seam + center_wide, (H, 1)).astype(np.float32)

# 5. Combine all components
combined = base + fine_grain * 0.8 + med_grain * 0.9 + mottle_grain * 1.1 + vertical_band
combined = np.clip(combined, 0, 255).astype(np.uint8)

# Convert to RGB image
texture_img = Image.fromarray(combined).convert('RGB')
texture_path = 'C:/toad/kamekura-tokyo-poster/paper_texture.png'
texture_img.save(texture_path)
print('Generated refined paper texture:', texture_path)
