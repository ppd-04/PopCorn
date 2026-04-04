import re

with open('server_ours.js', 'r', encoding='utf-8') as f:
    ours_content = f.read()

with open('server_theirs.js', 'r', encoding='utf-8') as f:
    theirs_content = f.read()

resend_imports = """
const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY || process.env.SMTP_PASS);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
"""

if "require('resend')" not in ours_content:
    ours_content = ours_content.replace("const { Server } = require('socket.io');\n", "const { Server } = require('socket.io');\n" + resend_imports)

match_theirs = re.search(r'const generateOTP = \(\) => Math\.floor.*?// Start  server', theirs_content, re.DOTALL)
if match_theirs:
    theirs_auth_block = match_theirs.group(0)
    theirs_auth_block = theirs_auth_block.replace('// Start  server', '')
    
    match_ours = re.search(r'// first route e, new user register.*?// Start  server', ours_content, re.DOTALL)
    if match_ours:
        ours_content = ours_content[:match_ours.start()] + '// first route e, new user register\n\n' + theirs_auth_block + '// Start  server' + ours_content[match_ours.end():]

match_series = re.search(r'// ==========================================\n// SERIES DETAILS ROUTES\n// ==========================================.*?(?=(?:// ==========================================\n// FRIENDS & PROFILE ROUTES|// admin habijabi|// ==========================================\n// ADMIN DASHBOARD ROUTES))', theirs_content, re.DOTALL)

if match_series:
    series_block = match_series.group(0)
    insert_after_match = re.search(r'app\.get\(\'/api/series/top\'.*?\}\n\}\);\n', ours_content, re.DOTALL)
    if insert_after_match:
        ours_content = ours_content[:insert_after_match.end()] + '\n' + series_block + '\n' + ours_content[insert_after_match.end():]
    else:
        ours_content = ours_content.replace('// ==========================================\n// FRIENDS & PROFILE ROUTES', series_block + '\n// ==========================================\n// FRIENDS & PROFILE ROUTES')
else:
    print("Could not find series details routes in theirs.")

with open('../popcorn-backend/server_merged.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(ours_content)
print("Merge complete!")
