import os
import re
import sys

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the function definition
    start_idx = content.find('function decryptField(enc)')
    if start_idx == -1:
        return False
    
    # We want to replace the body of the function.
    # Let's find the opening brace
    open_brace_idx = content.find('{', start_idx)
    
    # Find the matching closing brace
    brace_count = 1
    close_brace_idx = -1
    for i in range(open_brace_idx + 1, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                close_brace_idx = i
                break
                
    if close_brace_idx == -1:
        return False
        
    old_body = content[open_brace_idx+1:close_brace_idx].strip()
    if 'catch' in old_body:
        return False # Already has a try catch or similar
        
    # Rebuild the new function body.
    # The original body starts with `if (!enc || !enc.data || !enc.iv || !enc.tag) return null;`
    # Let's separate the if statement and the rest.
    
    lines = old_body.split('\n')
    if_line = ""
    for line in lines:
        if line.strip().startswith('if'):
            if_line = line.strip()
            break
            
    rest_of_body = old_body[len(if_line):].strip()
    
    new_body = f"""
  {if_line}
  try {{
{rest_of_body}
  }} catch (err) {{
    console.error('Decryption error:', err.message);
    return null;
  }}
"""
    new_content = content[:open_brace_idx+1] + new_body + content[close_brace_idx:]
    
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"Updated {filepath}")
    return True

models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server', 'models')
for filename in os.listdir(models_dir):
    if filename.endswith('.js'):
        process_file(os.path.join(models_dir, filename))
