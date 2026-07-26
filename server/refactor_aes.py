import os
import glob
import re

server_dir = '/home/georgehany/Desktop/khedma/server'

# Find all js files in server_dir recursively, excluding node_modules
js_files = []
for root, dirs, files in os.walk(server_dir):
    if 'node_modules' in root:
        continue
    for f in files:
        if f.endswith('.js'):
            js_files.append(os.path.join(root, f))

for filepath in js_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace AES_KEY definition
    if 'const AES_SECRET = process.env.' in content and 'const AES_KEY = crypto.createHash' in content:
        # Skip if already lazy
        if 'function getAesKey()' in content:
            continue

        content = re.sub(
            r'const AES_SECRET = process\.env\.(?:AES_SECRET_KEY|ENCRYPTION_KEY)(?:\s*\|\|\s*process\.env\.(?:AES_SECRET_KEY|ENCRYPTION_KEY))?;?\n\s*if \(!AES_SECRET\) throw new Error\([^)]+\);?\n+\s*const AES_KEY = crypto\.createHash\(\'sha256\'\)\.update\(AES_SECRET\)\.digest\(\);?\n+',
            '''function getAesKey() {
  const secret = process.env.AES_SECRET_KEY || process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error('Missing AES_SECRET_KEY in .env');
  return crypto.createHash('sha256').update(secret).digest();
}

''',
            content
        )
        content = content.replace('crypto.createCipheriv(\'aes-256-gcm\', AES_KEY,', 'crypto.createCipheriv(\'aes-256-gcm\', getAesKey(),')
        content = content.replace('crypto.createDecipheriv(\'aes-256-gcm\', AES_KEY,', 'crypto.createDecipheriv(\'aes-256-gcm\', getAesKey(),')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored AES logic in {filepath}")

print("Finished refactoring AES logic in all files.")
