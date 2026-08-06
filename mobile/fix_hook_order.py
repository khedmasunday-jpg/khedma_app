import os
import re

SCREENS_DIR = "/home/georgehany/Desktop/khedma/mobile/src/screens"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the wrongly ordered lines
    wrong_order = r"(\s*const styles = getStyles\(theme, isDarkMode\);)\s*(const \{ theme, isDarkMode \} = useTheme\(\);)"
    if re.search(wrong_order, content):
        content = re.sub(wrong_order, r"\2\1", content)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for filename in os.listdir(SCREENS_DIR):
    if filename.endswith(".js"):
        process_file(os.path.join(SCREENS_DIR, filename))
