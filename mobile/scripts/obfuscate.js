const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const distDir = path.join(__dirname, '../dist');

function getAllJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllJsFiles(filePath, files);
    } else if (stat.isFile() && file.endsWith('.js')) {
      files.push(filePath);
    }
  }
  return files;
}

console.log('🔍 Locating JavaScript files in:', distDir);
const jsFiles = getAllJsFiles(distDir);
console.log(`Found ${jsFiles.length} JavaScript file(s) to obfuscate.`);

for (const file of jsFiles) {
  console.log(`🔒 Obfuscating: ${file}`);
  try {
    const code = fs.readFileSync(file, 'utf8');
    
    // Obfuscate code with robust settings optimized for size and compatibility
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: false, // Disabling this prevents extreme size inflation and boot-up lags
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: false,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: false,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayEncoding: ['rc4'], // Encrypt strings to hide backend API paths
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false
    });
    
    fs.writeFileSync(file, obfuscationResult.getObfuscatedCode(), 'utf8');
    console.log(`✅ Obfuscated and saved: ${file}`);
  } catch (err) {
    console.error(`❌ Failed to obfuscate ${file}:`, err);
    process.exit(1);
  }
}

// Clean up any source maps if they were accidentally created
function deleteSourceMaps(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      deleteSourceMaps(filePath);
    } else if (stat.isFile() && (file.endsWith('.map') || file.endsWith('.js.map'))) {
      console.log(`🧹 Deleting source map: ${file}`);
      fs.unlinkSync(filePath);
    }
  }
}
deleteSourceMaps(distDir);
console.log('🎉 Production obfuscation completed successfully!');
