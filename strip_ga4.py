import re, sys, glob

# Matches the static GA4 block regardless of exact whitespace/indentation,
# anchored on the comment and the config call so it's safe even if a page
# formats it slightly differently.
PATTERN = re.compile(
    r'\s*<!--\s*Google tag \(gtag\.js\)\s*-->.*?gtag\(\'config\',\s*\'G-DBL7XJFFQL\'\);\s*</script>',
    re.DOTALL
)

changed = []
for path in glob.glob('*.html'):
    src = open(path, encoding='utf-8').read()
    new_src, n = PATTERN.subn('', src, count=1)
    if n:
        open(path, 'w', encoding='utf-8').write(new_src)
        changed.append(path)

print(f"Removed static GA4 block from {len(changed)} file(s):")
for c in changed:
    print(" -", c)
