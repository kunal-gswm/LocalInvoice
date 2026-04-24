from PIL import Image, ImageDraw
import numpy as np
import sys

def remove_white_background(img_path):
    try:
        # Open image and ensure it has an alpha channel
        img = Image.open(img_path).convert("RGBA")
        data = np.array(img)
        
        # Define 'white' threshold (e.g., RGB > 240)
        r, g, b, a = data.T
        white_areas = (r > 240) & (g > 240) & (b > 240)
        
        # Find the bounding box of non-white areas
        non_white_indices = np.where(~white_areas.T)
        if len(non_white_indices[0]) == 0:
            print("Image is entirely white!")
            return
            
        y_min, y_max = np.min(non_white_indices[0]), np.max(non_white_indices[0])
        x_min, x_max = np.min(non_white_indices[1]), np.max(non_white_indices[1])
        
        # Assume the actual logo is a circle inscribed in this bounding box
        width = x_max - x_min
        height = y_max - y_min
        
        # We'll create a smooth anti-aliased circular mask matching this bounding box
        # Actually, let's just make the mask the size of the whole image to be safe
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((x_min, y_min, x_max, y_max), fill=255)
        
        # Apply the mask to the alpha channel
        img.putalpha(mask)
        
        # Save over the original
        img.save(img_path, "PNG")
        print("Background removed successfully.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_white_background("logo.png")
