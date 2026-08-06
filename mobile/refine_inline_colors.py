import os
import re

SCREENS_DIR = "/home/georgehany/Desktop/khedma/mobile/src/screens"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Skip LoginScreen as it was manually perfected
    if "LoginScreen.js" in filepath:
        return

    original_content = content

    # Replace <Ionicons ... color="#..." with color={theme.iconColor}
    content = re.sub(r'(<Ionicons[^>]*?)color=[\'"]#[0-9a-fA-F]+[\'"]', r'\1color={theme.iconColor}', content)
    
    # Replace placeholderTextColor="#..." with placeholderTextColor={theme.textMuted}
    content = re.sub(r'(<TextInput[^>]*?)placeholderTextColor=[\'"]#[0-9a-fA-F]+[\'"]', r'\1placeholderTextColor={theme.textMuted}', content)
    content = re.sub(r'(<TextInput[^>]*?)placeholderTextColor=[\'"]rgba\([^)]+\)[\'"]', r'\1placeholderTextColor={theme.textMuted}', content)

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Refined {filepath}")

for filename in os.listdir(SCREENS_DIR):
    if filename.endswith(".js"):
        process_file(os.path.join(SCREENS_DIR, filename))
