from PIL import Image
import numpy as np

# Read the current toad file to preserve paths
with open('C:/toad/kamekura-tokyo-poster/kamekura_poster.toad', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert the texture overlay right after serpentineBase and before crescentHole1
texture_snippet = '''
// Paper Texture & Mottled Ink Wash (Clipped to Serpentine Ribbon)
image #serpentinePaperTexture {
  src: "./paper_texture.png";
  size: 1000px 1400px;
  at: (0px, 0px);
  opacity: 0.65;
  blend-mode: overlay;
  mask: #serpentineBase;
}
'''

new_content = content.replace('path #crescentHole1 {', texture_snippet + '\n// Internal cutout channel 1 (upper-middle crescent)\npath #crescentHole1 {')

with open('C:/toad/kamekura-tokyo-poster/kamekura_poster.toad', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated kamekura_poster.toad with paper texture overlay!')
