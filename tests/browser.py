"""Real Chromium checks at desktop and iPhone sizes, including project-path hosting."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys, json, os

base=sys.argv[1]
output=Path(__file__).resolve().parents[1]/'test-results'
output.mkdir(exist_ok=True)
errors=[]
accessibility=[]
axe_path=sys.argv[2] if len(sys.argv)>2 else ''

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox'])
    desktop=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
    page=desktop.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.wait_for_selector('.hero .board')
    assert page.locator('.board .square').count()==64
    assert 'Step 4 of 5' in page.locator('.board-status').inner_text()
    page.locator('[data-lab="next"]').click()
    assert page.locator('[data-square="c3"] img').get_attribute('src').endswith('wn.svg')
    page.screenshot(path=str(output/'desktop-home.png'),full_page=True)
    no_overflow(page)
    page.goto(base+'#/read/pa01ch01?diagram=diagram_III&ply=5&section=pa01ch01-b14')
    page.wait_for_selector('.reader-shell .board')
    assert 'Step 5 of 5' in page.locator('.board-status').inner_text()
    page.locator('[data-lab="prev"]').click()
    assert 'ply=4' in page.url
    page.reload()
    page.wait_for_selector('.board')
    assert 'Step 4 of 5' in page.locator('.board-status').inner_text()
    page.locator('[data-lab="next"]').focus()
    page.keyboard.press('ArrowLeft')
    assert 'Step 3 of 5' in page.locator('.board-status').inner_text()
    page.keyboard.press('Home');page.keyboard.press('ArrowRight')
    assert 'Step 1 of 5' in page.locator('.board-status').inner_text()
    page.locator('[data-lab="first"]').click()
    page.locator('[data-lab="explore"]').click()
    page.locator('[data-square="e2"]').click()
    assert page.locator('[data-square="e4"]').get_attribute('class').find('legal')>=0
    page.locator('[data-square="e4"]').click()
    assert 'e4' in page.locator('.annotation').inner_text()
    assert page.locator('[data-square="e4"] img').count()==1
    page.locator('[data-lab="undo"]').click()
    assert page.locator('[data-square="e2"] img').count()==1
    page.locator('[data-lab="explore"]').click()
    assert 'Step 0 of 5' in page.locator('.board-status').inner_text()
    page.locator('[data-lab="flip"]').click()
    assert page.locator('.board .square').first.get_attribute('data-square')=='h1'
    page.locator('#bookmark').click()
    page.locator('#settings-open').click()
    page.locator('[data-size="26"]').click()
    page.locator('[data-theme="night"]').click()
    page.locator('#settings-dialog .close-dialog').click()
    assert page.locator('.prose').evaluate('(e)=>getComputedStyle(e).fontSize')=='26px'
    page.reload();page.wait_for_selector('.prose')
    assert page.locator('html').get_attribute('data-theme')=='night'
    page.locator('#settings-open').click();page.locator('[data-size="20"]').click();page.locator('[data-theme="paper"]').click();page.locator('#settings-dialog .close-dialog').click()
    page.goto(base+'#/read/game01')
    page.wait_for_selector('.board')
    page.locator('[data-lab="last"]').click()
    assert 'Re8#' in page.locator('.move-list .active').inner_text()
    page.locator('[data-lab="first"]').click()
    with page.expect_download() as download:
        page.locator('[data-lab="pgn"]').click()
    assert download.value.suggested_filename=='game01.pgn'
    # A real book position exercises the custom underpromotion picker.
    page.goto(base+'#/read/game22?ply=82');page.wait_for_selector('.board')
    page.locator('[data-lab="explore"]').click()
    page.locator('[data-square="c7"]').click();page.locator('[data-square="c8"]').click()
    page.get_by_role('button',name='Promote to knight').click()
    assert page.locator('[data-square="c8"] img').get_attribute('src').endswith('wn.svg')
    page.locator('[data-lab="explore"]').click()
    assert page.locator('[data-square="c7"] img').get_attribute('src').endswith('wp.svg')
    # Alternative source lines retain their identity in a shareable URL.
    page.goto(base+'#/study?diagram=diagram_IV');page.wait_for_selector('#line-select')
    line_id=page.locator('#line-select option').nth(1).get_attribute('value')
    page.locator('#line-select').select_option(line_id)
    assert 'line='+line_id in page.url
    page.reload();page.wait_for_selector('#line-select')
    assert page.locator('#line-select').input_value()==line_id
    page.goto(base+'#/read/pa01ch02');page.wait_for_selector('.reader-title')
    page.screenshot(path=str(output/'desktop-reader.png'),full_page=False)
    if axe_path:
        page.add_script_tag(path=axe_path)
        results=page.evaluate("async()=> (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))")
        accessibility.extend(results)
    page.locator('#search-open').click();page.locator('#search-input').fill('blockade')
    assert page.locator('.search-result').count()>0
    page.locator('.search-result').first.click()
    assert 'section=' in page.url
    page.goto(base+'#/library');page.wait_for_selector('#library-list')
    page.locator('#library-group').select_option('saved');assert page.locator('.game-card').count()==1
    page.locator('#library-group').select_option('games');assert page.locator('.game-card').count()==50
    page.locator('#library-filter').fill('Alapin');assert page.locator('.game-card').count()>=1
    no_overflow(page)
    # Reference text, diagram-only / schematic boards, a corrected diagram, and final chapter.
    # Prose without an original diagram has its own inline, shareable replay.
    page.goto(base+'#/read/pa01ch01?section=pa01ch01-b15');page.wait_for_selector('[data-open-passage="pawnless-development"]')
    page.locator('[data-open-passage="pawnless-development"]').click()
    assert page.locator('#passage-player .inline-square').count()==64
    assert page.locator('#passage-player').is_visible()
    page.locator('[data-inline-action="next"]').click()
    assert 'White knight: g1 → f3.' in page.locator('.inline-explanation').inner_text()
    assert page.locator('[data-inline-square="f3"] img').get_attribute('src').endswith('wn.svg')
    page.locator('[data-passage-ply="8"]').click()
    assert 'demobilizing effect' in page.locator('.inline-explanation').inner_text()
    assert page.locator('.inline-arrows .threat-arrow').count()==1
    page.locator('[data-inline-action="last"]').click()
    assert page.locator('[data-inline-square="d4"] img').get_attribute('src').endswith('bp.svg')
    assert 'pawnless-development' in page.url and 'ply=10' in page.url
    page.reload();page.wait_for_selector('#passage-player')
    assert 'Step 10 of 10' in page.locator('.inline-player-head').inner_text()
    page.screenshot(path=str(output/'desktop-passage.png'),full_page=False)
    # Choosing another paragraph/variation replaces the inline player and its line.
    choices=page.locator('#pa01ch01-b26 [data-open-passage]')
    assert choices.count()>=2
    choice_id=choices.nth(1).get_attribute('data-open-passage')
    choices.nth(1).click()
    assert page.locator('#passage-player').count()==1 and choice_id in page.url
    page.locator('[data-inline-action="last"]').click()
    page.reload();page.wait_for_selector('#passage-player')
    assert page.locator('[data-open-passage="'+choice_id+'"]').get_attribute('aria-expanded')=='true'
    no_overflow(page)
    for route in ['#/read/preface','#/read/pa01ch06','#/read/pa02ch06','#/read/game50','#/study?diagram=diagram_CXLIX','#/study?diagram=diagram_CCXVII','#/about']:
        page.goto(base+route);page.wait_for_timeout(150);no_overflow(page)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    phone=mobile.new_page();phone.on('pageerror',lambda e:errors.append(str(e)))
    phone.goto(base);phone.wait_for_selector('.hero .board');no_overflow(phone)
    phone.screenshot(path=str(output/'iphone-home.png'),full_page=True)
    phone.goto(base+'#/read/pa01ch01');phone.wait_for_selector('.reader-title')
    assert phone.locator('.reader-content').is_visible()
    assert not phone.locator('.reader-shell .lab-column').is_visible()
    no_overflow(phone)
    phone.screenshot(path=str(output/'iphone-reader.png'),full_page=False)
    phone.locator('[data-open-diagram="diagram_III"]').click()
    assert phone.locator('.reader-shell .lab-column').is_visible()
    assert not phone.locator('.reader-content').is_visible()
    phone.locator('[data-lab="first"]').click();phone.locator('[data-lab="next"]').click();no_overflow(phone)
    assert phone.locator('[data-lab="next"]').bounding_box()['height']>=44
    phone.locator('[data-view="read"]').click()
    assert phone.evaluate('scrollY')>500,'Returning to the text should preserve the reading position.'
    phone.locator('[data-view="board"]').click()
    phone.screenshot(path=str(output/'iphone-board.png'),full_page=False)
    if axe_path:
        phone.add_script_tag(path=axe_path)
        accessibility.extend(phone.evaluate("async()=> (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))"))
    phone.reload();phone.wait_for_selector('.board');assert phone.locator('.reader-shell .lab-column').is_visible()
    phone.locator('[data-view="read"]').click();assert phone.locator('.reader-content').is_visible()
    phone.goto(base+'#/read/pa01ch01?section=pa01ch01-b15');phone.wait_for_selector('[data-open-passage="pawnless-development"]')
    phone.locator('[data-open-passage="pawnless-development"]').click()
    assert phone.locator('.reader-content').is_visible()
    assert not phone.locator('.reader-shell .lab-column').is_visible()
    phone.locator('[data-passage-ply="8"]').click()
    phone.locator('#passage-player').scroll_into_view_if_needed()
    phone.evaluate('document.getElementById("passage-player").scrollIntoView({block:"start"})')
    assert phone.locator('[data-inline-action="next"]').bounding_box()['height']>=44
    no_overflow(phone)
    phone.screenshot(path=str(output/'iphone-passage.png'),full_page=False)
    if axe_path:
        phone.add_script_tag(path=axe_path)
        accessibility.extend(phone.evaluate("async()=> (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))"))
    phone.locator('[data-inline-action="laboratory"]').click()
    assert phone.locator('.reader-shell .lab-column').is_visible()
    assert phone.locator('[data-lab="explore"]').inner_text()=='Return to book'
    phone.locator('[data-lab="explore"]').click()
    phone.locator('[data-view="read"]').click()
    assert 'Step 8 of 10' in phone.locator('.inline-player-head').inner_text()
    phone.reload();phone.wait_for_selector('#passage-player')
    assert phone.locator('.reader-content').is_visible()
    assert 'Step 8 of 10' in phone.locator('.inline-player-head').inner_text()
    phone.set_viewport_size({'width':320,'height':568});no_overflow(phone)
    phone.locator('[data-view="board"]').click();no_overflow(phone)
    phone.goto(base+'#/read/bio');phone.wait_for_selector('.prose');no_overflow(phone)
    # A fresh load under a denied localStorage environment still works.
    denied=browser.new_context();denied.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('storage denied')}})")
    dp=denied.new_page();dp.goto(base);dp.wait_for_selector('.hero .board');denied.close()
    # Offline reload works after the first install (PDF deliberately excluded).
    page.goto(base);page.wait_for_selector('.board');page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    desktop.set_offline(True);page.reload();page.wait_for_selector('.hero .board');page.goto(base+'#/read/game02');page.wait_for_selector('.reader-title');desktop.set_offline(False)
    assert not errors,errors
    (output/'accessibility.json').write_text(json.dumps(accessibility,indent=2))
    assert not accessibility,json.dumps(accessibility,indent=2)
    (output/'browser-report.json').write_text(json.dumps({'status':'passed','viewports':[1440,390,320],'javascriptErrors':errors,'checks':['replay','FEN board rendering','keyboard','deep-link reload','exploration and undo','flip','PGN export','search','bookmarks','persistent settings','project subpath','offline reload','storage denied','mobile overflow']},indent=2))
    print('PASS: desktop + iPhone + 320px, replay, exploration, search, persistence, offline, project-path hosting; no JavaScript errors.')
    browser.close()
