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

    # 1. Transform StyleSheet.create to getStyles
    if "const getStyles" not in content and "StyleSheet.create" in content:
        content = re.sub(
            r"const\s+styles\s*=\s*StyleSheet\.create\(\{",
            r"const getStyles = (theme, isDarkMode) => StyleSheet.create({",
            content
        )
        
        # We need to inject const styles = getStyles(theme, isDarkMode); into the component
        # Find the main component
        comp_match = re.search(r"export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*\{", content)
        if comp_match:
            insert_pos = comp_match.end()
            # Check if theme is imported and hooked
            if "const { theme, isDarkMode } = useTheme();" not in content:
                hook_code = "\n  const { theme, isDarkMode } = useTheme();\n  const styles = getStyles(theme, isDarkMode);"
            else:
                hook_code = "\n  const styles = getStyles(theme, isDarkMode);"
                # Remove any existing styles assignment if any
            
            content = content[:insert_pos] + hook_code + content[insert_pos:]
            
            # Clean up old inline styles injected by previous script
            # e.g., style={[styles.container, { backgroundColor: theme.background }]}
            content = re.sub(r"style=\{\[styles\.([^,]+),\s*\{\s*backgroundColor:\s*theme\.[^}]+\s*\}\s*\]\}", r"style={styles.\1}", content)
            content = re.sub(r"style=\{\[styles\.([^,]+),\s*\{\s*color:\s*theme\.[^}]+\s*\}\s*\]\}", r"style={styles.\1}", content)
            content = re.sub(r"style=\{\[styles\.([^,]+),\s*\{\s*backgroundColor:\s*theme\.[^,]+,\s*borderColor:\s*theme\.[^}]+\s*\}\s*\]\}", r"style={styles.\1}", content)

    # Now, process the styles object specifically
    style_match = re.search(r"const getStyles = \(theme, isDarkMode\) => StyleSheet\.create\({(.*?)^\}\);", content, re.MULTILINE | re.DOTALL)
    if style_match:
        styles_str = style_match.group(1)
        
        # Color replacements within styles
        # Backgrounds
        styles_str = re.sub(r"backgroundColor:\s*'#fff(?:fff)?'", r"backgroundColor: theme.cardBackground", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*[0-9.]+\)'", r"backgroundColor: theme.cardBackground", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'#f3ede0'", r"backgroundColor: theme.background", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'rgba\(243,\s*237,\s*224,\s*[0-9.]+\)'", r"backgroundColor: theme.background", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'#efe5d2'", r"backgroundColor: theme.headerBackground", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'#2f4360'", r"backgroundColor: theme.primary", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'rgba\(255,\s*252,\s*246,\s*[0-9.]+\)'", r"backgroundColor: theme.cardBackground", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'#f5f5f5'", r"backgroundColor: theme.background", styles_str)
        styles_str = re.sub(r"backgroundColor:\s*'#fafafa'", r"backgroundColor: theme.background", styles_str)
        
        # Texts
        styles_str = re.sub(r"color:\s*'#333(?:333)?'", r"color: theme.text", styles_str)
        styles_str = re.sub(r"color:\s*'#444(?:444)?'", r"color: theme.text", styles_str)
        styles_str = re.sub(r"color:\s*'#222(?:222)?'", r"color: theme.text", styles_str)
        styles_str = re.sub(r"color:\s*'#000(?:000)?'", r"color: theme.text", styles_str)
        styles_str = re.sub(r"color:\s*'#2f4360'", r"color: theme.text", styles_str)
        styles_str = re.sub(r"color:\s*'#24364f'", r"color: theme.text", styles_str)
        
        # Muted Texts
        styles_str = re.sub(r"color:\s*'#555(?:555)?'", r"color: theme.textMuted", styles_str)
        styles_str = re.sub(r"color:\s*'#666(?:666)?'", r"color: theme.textMuted", styles_str)
        styles_str = re.sub(r"color:\s*'#777(?:777)?'", r"color: theme.textMuted", styles_str)
        styles_str = re.sub(r"color:\s*'#888(?:888)?'", r"color: theme.textMuted", styles_str)
        styles_str = re.sub(r"color:\s*'#999(?:999)?'", r"color: theme.textMuted", styles_str)
        styles_str = re.sub(r"color:\s*'rgba\(36,\s*54,\s*79,\s*[0-9.]+\)'", r"color: theme.textMuted", styles_str)
        
        # Borders
        styles_str = re.sub(r"borderColor:\s*'#ccc(?:ccc)?'", r"borderColor: theme.borderColor", styles_str)
        styles_str = re.sub(r"borderColor:\s*'#ddd(?:ddd)?'", r"borderColor: theme.borderColor", styles_str)
        styles_str = re.sub(r"borderColor:\s*'#eee(?:eee)?'", r"borderColor: theme.borderColor", styles_str)
        styles_str = re.sub(r"borderColor:\s*'rgba\(47,\s*67,\s*96,\s*[0-9.]+\)'", r"borderColor: theme.borderColor", styles_str)
        
        content = content[:style_match.start(1)] + styles_str + content[style_match.end(1):]

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Refactored {filepath}")

for filename in os.listdir(SCREENS_DIR):
    if filename.endswith(".js"):
        process_file(os.path.join(SCREENS_DIR, filename))
