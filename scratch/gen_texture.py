from PIL import Image, ImageFilter
import numpy as np

# Generate high-resolution authentic Japanese paper & ink grain texture
W, H = 1000, 1400

# 1. Base neutral gray for overlay blending (128 is neutral in overlay/soft-light)
base = np.full((H, W), 128.0, dtype=np.float32)

# 2. Fine paper fibers / grain (Gaussian noise)
np.random.seed(42)
fine_noise = np.random.normal(0, 18, (H, W)).astype(np.float32)

# 3. Medium fibrous texture (stretched slightly vertically for paper fibers)
med_noise = np.random.normal(0, 12, (H // 2, W // 2)).astype(np.float32)
med_img = Image.fromarray(med_noise).resize((W, H), Image.Resampling.BILINEAR)
med_noise_scaled = np.array(med_img)

# 4. Low-frequency wash / mottling (ink unevenness)
low_noise = np.random.normal(0, 10, (H // 8, W // 8)).astype(np.float32)
low_img = Image.fromarray(low_noise).resize((W, H), Image.Resampling.BICUBIC)
low_noise_scaled = np.array(low_img)

# 5. Vertical central shade band (matches the darker vertical seam at x=450-530 in the original)
x_coords = np.linspace(0, 1, W)
# Bell curve centered around x=0.5 (center of canvas)
center_band = -18.0 * np.exp(-((x_coords - 0.51) ** 2) / (2 * (0.07 ** 2)))
center_band_2d = np.tile(center_band, (H, 1)).astype(np.float32)

# Combine layers
combined = base + fine_noise * 0.7 + med_noise_scaled * 0.6 + low_noise_scaled * 0.9 + center_band_2d
combined = np.clip(combined, 0, 255).astype(np.uint8)

# Convert to RGB image
texture_img = Image.fromarray(combined).convert('RGB')

# Save to project folder
texture_path = 'C:/toad/kamekura-tokyo-poster/paper_texture.png'
texture_img.save(texture_path)
print('Generated:', texture_path)
