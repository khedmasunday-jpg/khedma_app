import os
import re

SCREENS_DIR = "/home/georgehany/Desktop/khedma/mobile/src/screens"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content
    
    # Replace hardcoded colors with theme variables
    content = content.replace("color: '#888'", "color: theme.textMuted")
    content = content.replace("color: '#666'", "color: theme.textMuted")
    content = content.replace("color: '#555'", "color: theme.text")
    content = content.replace("color: '#333333'", "color: theme.text")
    content = content.replace("color: '#333'", "color: theme.text")
    content = content.replace("color: '#a0a0a0'", "color: theme.textMuted")
    content = content.replace("color: 'rgba(47, 67, 96, 0.7)'", "color: theme.textMuted")
    content = content.replace('placeholderTextColor="#a0a0a0"', 'placeholderTextColor={theme.textMuted}')
    content = content.replace("color: '#2f4360'", "color: theme.text")
    
    # Fix TaioScreen
    if "TayoScreen.js" in filepath:
        content = content.replace("backgroundColor: '#fffcf7'", "backgroundColor: theme.cardBackground")
        
    if orig != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")

for root, _, files in os.walk(SCREENS_DIR):
    for file in files:
        if file.endswith('.js'):
            process_file(os.path.join(root, file))

