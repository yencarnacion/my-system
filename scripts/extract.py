"""Extract inert, structured book data. Never evaluate the legacy parameters."""
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Comment
import re, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'sources/book.html'
soup = BeautifulSoup(source.read_text(), 'html.parser')
chapters = []
current = None
page = 1
aliases = {}
diagrams = []

def plain(node):
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True) if hasattr(node, 'get_text') else str(node)).strip()

def safe_html(node):
    copy = BeautifulSoup(str(node), 'html.parser')
    for t in copy.find_all(True):
        if t.name not in ['i', 'b', 'em', 'strong', 'a', 'br', 'sup', 'sub', 'table', 'tr', 'td', 'th', 'thead', 'tbody']:
            t.unwrap()
            continue
        attrs = dict(t.attrs)
        t.attrs = {}
        if t.name == 'a' and attrs.get('href', '').startswith('#'):
            t['href'] = attrs['href']
        for a in ['colspan', 'rowspan']:
            if str(attrs.get(a, '')).isdigit(): t[a] = attrs[a]
    return re.sub(r'\s+', ' ', str(copy)).strip()

def add(kind, text='', html='', **extra):
    if not current or (not text and not extra): return
    block = dict(id=f"{current['id']}-b{len(current['blocks'])+1}", type=kind, text=text, page=page, **extra)
    if html: block['html'] = html
    current['blocks'].append(block)
    return block

def walk(node):
    global current, page
    if isinstance(node, Comment): return
    if isinstance(node, NavigableString):
        txt=plain(node)
        if txt: add('paragraph', txt)
        return
    if not node.name: return
    ident=node.get('id','')
    match=re.match(r'page(\d+)vs',ident)
    if match: page=int(match[1])
    name=node.get('name','')
    if re.fullmatch(r'pa\d+ch\d+|game\d+|preface|bio|list_of_games_quoted|list_of_illustrative_games',name):
        group='games' if name.startswith('game') else 'elements' if name.startswith('pa01') else 'position' if name.startswith('pa02') else 'front'
        current=dict(id=name, title=plain(node) or name, group=group, page=page, blocks=[])
        chapters.append(current)
        return
    if node.name in ['script','style','guide']: return
    if name and current: aliases[name]=dict(chapter=current['id'], block=f"{current['id']}-b{len(current['blocks'])+1}")
    if 'boardImage' in node.get('class',[]):
        params=re.sub(r'/\*.*?\*/','',node.get('parameters',''),flags=re.S)
        fen=re.search(r"fen:\s*'([^']+)'",params)
        caption=plain(node)
        d=dict(id=ident, label=ident.replace('diagram_','Diagram '), placement=fen.group(1) if fen else '8/8/8/8/8/8/8/8',caption=caption,chapter=current['id'],page=page, conceptual=not bool(fen))
        d['strokes']=[dict(start=a,end=b) for a,b in re.findall(r"start:\s*'([a-i][0-8])'.*?end:\s*'([a-i][0-8])'",params,re.S)]
        diagrams.append(d)
        add('diagram',caption,diagram=ident)
        aliases['img_'+ident]=dict(chapter=current['id'],diagram=ident)
        aliases[ident]=aliases['img_'+ident]
        return
    # Malformed legacy nesting must not swallow diagrams or later chapters.
    contains_structure=node.find(class_='boardImage') or node.find('a',attrs={'name': re.compile(r'pa\d+ch|game\d+')})
    if node.name=='pre' and not contains_structure:
        # The hand-edited game scores put each main-line move on its own line.
        raw=node.get_text('',strip=False)
        for part in re.split(r'\n\s*\n',raw):
            t=re.sub(r'\s+',' ',part).strip()
            if t: add('paragraph',t)
        return
    if node.name in ['p','table','h1','h2','h3','h4','h5','h6'] and not contains_structure:
        if current:
            for nested in node.find_all(True):
                key=nested.get('name') or nested.get('id')
                if key: aliases[key]=dict(chapter=current['id'],block=f"{current['id']}-b{len(current['blocks'])+1}")
        txt=plain(node)
        if node.name.startswith('h'):
            if node.name=='h4' and current and current['id'].startswith('pa') and len(current['blocks'])<3:
                current['title']=txt.title()
            else: add('heading',txt)
        else:
            kind='table' if node.name=='table' else 'paragraph'
            if re.match(r'§\s*\d',txt):kind='section'
            add(kind,txt,safe_html(node))
        return
    for child in node.children: walk(child)

walk(soup.body)
# Preserve meaningful titles even where the old document has missing heading tags.
titles=['On the Centre and Development','On Open Files','The Seventh and Eighth Ranks','The Passed Pawn','On Exchanging','The Elements of End-Game Strategy','The Pin','Discovered Check','The Pawn-Chain']
for c in chapters:
    if c['id'].startswith('pa01'): c['title']=titles[int(c['id'][-2:])-1]
    if c['id'].startswith('pa02'): c['title']=['Elements of Position Play','The Doubled Pawn and Restraint',"The Isolated Queen’s Pawn and His Descendants",'The Two Bishops','Over-Protection','Manoeuvring Against Weaknesses'][int(c['id'][-2:])-1]
    if c['group']=='games':
        players=next((b['text'] for b in c['blocks'][:8] if '—' in b['text'] and not re.match(r'\d|White',b['text'])), '')
        c['title']=f"Game {int(c['id'][4:])}"+(f" · {players}" if players else '')
    c['wordCount']=sum(len(b['text'].split()) for b in c['blocks'])
    c['diagramCount']=sum(b['type']=='diagram' for b in c['blocks'])
all_blocks=[(c,b) for c in chapters if c['group']!='front' for b in c['blocks']]
# Page references in the legacy lists are useful navigation, even when a page
# starts in the middle of a paragraph in this reflowable edition.
for n in range(1,304):
    matches=[(c,b) for c,b in all_blocks if b['page']==n]
    if matches:
        c,b=matches[0]
        aliases.setdefault(f'page{n:03d}vs',dict(chapter=c['id'],block=b['id']))
for part,chapter in [('part01','pa01ch01'),('part02','pa02ch01'),('part03','game01')]:
    aliases[part]=dict(chapter=chapter)
for key,needle in [('footnote_001','Note on Zugzwang'),('footnote_002','Die Blockade von')]:
    if key not in aliases:
        found=next(((c,b) for c,b in all_blocks if needle.lower() in b['text'].lower()),None)
        if found: aliases[key]=dict(chapter=found[0]['id'],block=found[1]['id'])
result=dict(title='My System',author='Aron Nimzowitsch',translator='Philip Hereford',year=1929,chapters=chapters,diagrams=diagrams,aliases=aliases,sourceHash=hashlib.sha256(source.read_bytes()).hexdigest())
(ROOT/'sources/extracted.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f"Extracted {len(chapters)} reading units, {len(diagrams)} diagrams, {sum(c['wordCount'] for c in chapters):,} words")
