import os
import re

SCREENS_DIR = "/home/georgehany/Desktop/khedma/mobile/src/screens"

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Skip LoginScreen as it's already done
    if "LoginScreen.js" in filepath:
        return

    original_content = content

    # 1. Add import
    if "useTheme" not in content:
        # Find last import
        import_match = list(re.finditer(r"^import\s+.*?;?\s*$", content, re.MULTILINE))
        if import_match:
            last_import = import_match[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + "\nimport { useTheme } from '../utils/ThemeContext';" + content[insert_pos:]
        else:
            content = "import { useTheme } from '../utils/ThemeContext';\n" + content

    # 2. Add hook inside the main component
    comp_match = re.search(r"export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{", content)
    if comp_match and "const { theme, isDarkMode } = useTheme();" not in content:
        insert_pos = comp_match.end()
        content = content[:insert_pos] + "\n  const { theme, isDarkMode } = useTheme();" + content[insert_pos:]

    # 3. Replace styles.container
    content = re.sub(r"style=\{styles\.container\}", r"style={[styles.container, { backgroundColor: theme.background }]}", content)
    content = re.sub(r"style=\{\[styles\.container,\s*", r"style={[styles.container, { backgroundColor: theme.background }, ", content)

    # 4. Replace styles.card
    content = re.sub(r"style=\{styles\.card\}", r"style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }]}", content)
    content = re.sub(r"style=\{\[styles\.card,\s*", r"style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderColor }, ", content)

    # 5. Text colors for specific common elements like headerTitle, nameText, etc
    content = re.sub(r"style=\{styles\.headerTitle\}", r"style={[styles.headerTitle, { color: theme.text }]}", content)
    content = re.sub(r"style=\{\[styles\.headerTitle,\s*", r"style={[styles.headerTitle, { color: theme.text }, ", content)
    
    content = re.sub(r"style=\{styles\.nameText\}", r"style={[styles.nameText, { color: theme.text }]}", content)
    content = re.sub(r"style=\{\[styles\.nameText,\s*", r"style={[styles.nameText, { color: theme.text }, ", content)

    content = re.sub(r"style=\{styles\.title\}", r"style={[styles.title, { color: theme.text }]}", content)
    content = re.sub(r"style=\{\[styles\.title,\s*", r"style={[styles.title, { color: theme.text }, ", content)
    
    content = re.sub(r"style=\{styles\.emptyText\}", r"style={[styles.emptyText, { color: theme.textMuted }]}", content)
    content = re.sub(r"style=\{\[styles\.emptyText,\s*", r"style={[styles.emptyText, { color: theme.textMuted }, ", content)

    # 6. Icons common color #2f4360 -> theme.iconColor
    content = re.sub(r'color="#2f4360"', r'color={theme.iconColor}', content)
    content = re.sub(r"color='#2f4360'", r"color={theme.iconColor}", content)

    # 7. Additional tweaks for lists or modals
    content = re.sub(r"style=\{styles\.modalContent\}", r"style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}", content)
    content = re.sub(r"style=\{\[styles\.modalContent,\s*", r"style={[styles.modalContent, { backgroundColor: theme.cardBackground }, ", content)

    content = re.sub(r"style=\{styles\.modalTitle\}", r"style={[styles.modalTitle, { color: theme.text }]}", content)
    content = re.sub(r"style=\{\[styles\.modalTitle,\s*", r"style={[styles.modalTitle, { color: theme.text }, ", content)
    
    content = re.sub(r"style=\{styles\.modalBodyText\}", r"style={[styles.modalBodyText, { color: theme.text }]}", content)
    content = re.sub(r"style=\{\[styles\.modalBodyText,\s*", r"style={[styles.modalBodyText, { color: theme.text }, ", content)

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for filename in os.listdir(SCREENS_DIR):
    if filename.endswith(".js"):
        process_file(os.path.join(SCREENS_DIR, filename))
