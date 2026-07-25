const fs = require('fs');
const path = require('path');
const screensDir = path.join('C:', 'Users', 'georg', 'OneDrive', 'Desktop', 'khedma_app', 'mobile', 'src', 'screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(screensDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace backgroundColor for 'container' style. We'll use a regex that looks specifically inside styles.create({ container: { ... } })
    // Or simpler: look for container: { ... backgroundColor: '#f5f5f5' ... }
    
    // This regex looks for container: { followed by anything that isn't }, then backgroundColor, then the rest until }
    // But since regex across lines is tricky, we can just replace specific strings known from our grep search:
    
    const lines = content.split('\n');
    let inContainer = false;
    for(let i=0; i < lines.length; i++) {
        if (lines[i].includes('container: {')) {
            inContainer = true;
        }
        if (inContainer && lines[i].includes('backgroundColor:')) {
            if (lines[i].includes('#f5f5f5') || lines[i].includes('#fff') || lines[i].includes('white') || lines[i].includes('#ffffff') || lines[i].includes('\"#fff\"') || lines[i].includes('\"#f5f5f5\"')) {
                lines[i] = lines[i].replace(/backgroundColor:\s*['"]?(#f5f5f5|#fff|white|#ffffff)['"]?/, "backgroundColor: 'transparent'");
            }
            // Once we replace or see a backgroundColor, we might not be out of container, but if we see '}' we are out
        }
        if (inContainer && lines[i].includes('}')) {
             // this might end it prematurely but it's okay for most formats here 
             // actually let's just use string replacements for the exact lines we saw.
             inContainer = false;
        }
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
});
