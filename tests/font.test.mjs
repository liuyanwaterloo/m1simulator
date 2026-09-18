import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const web = fs.existsSync(new URL('../public/',import.meta.url)) ? '../public/' : '../dist/';
const read = name => JSON.parse(fs.readFileSync(new URL(web+name,import.meta.url)));
const source=read('generated/source.json'), atlas=read('generated/menu-font.json');
const languages=read('locales/overrides.json').languages;
const {DisplayRenderer}=await import(web+'render.js');
const {createModel}=await import(web+'model.js');
const {MenuEngine}=await import(web+'engine.js');
const fontC=fs.readFileSync(new URL('../firmware/shared/m1_menu_font.c',import.meta.url),'utf8');
test('all translations have real glyphs; original ASCII bytes are unchanged',()=>{
  for(const language of languages) for(const [key,value] of Object.entries(language.strings))
    for(const char of value) assert.ok(atlas.glyphs[char],`${language.id} ${key} ${char}`);
  for(const [char,glyph] of Object.entries(source.fonts)) assert.deepEqual(atlas.glyphs[char],glyph);
  for(const [char,g] of Object.entries(atlas.glyphs)) {
    assert.equal(g.bytes.length,Math.ceil(g.w/2)*g.h,char);
    if(char.codePointAt(0)>127) assert.ok(g.y>=0&&g.y+g.h<=16,char);
  }
});
test('C glyph bytes and metrics match the web atlas for every character',()=>{
  for(const [char,g] of Object.entries(atlas.glyphs)) {
    const code=char.codePointAt(0).toString(16).toUpperCase().padStart(4,'0');
    const bitmap=fontC.match(new RegExp(`bitmap_${code}\\[\\] = \\{([^}]*)\\}`));
    assert.ok(bitmap,code);
    assert.deepEqual(bitmap[1].split(',').map(Number),g.bytes,code);
    const metric=fontC.match(new RegExp(`glyph_${code} = \\{([^}]*)\\}`));
    assert.deepEqual(metric[1].split(',').slice(0,5).map(Number),[g.w,g.h,g.x,g.y,g.advance],code);
  }
});
test('translated menus and every option fit the small screen; missing glyphs never use OS fallback',()=>{
  const noop=()=>{};
  const context={fillRect:noop,save:noop,restore:noop,translate:noop,rotate:noop,drawImage:noop,fillText:noop};
  const renderer=new DisplayRenderer({getContext:()=>context},{...source,fonts:atlas.glyphs,icons:{}});
  const model=createModel(source);
  for(const lang of languages) {
    renderer.locale=lang.id; renderer.custom=lang.strings;
    for(const [group,entries] of Object.entries({...model.groups, manual:model.manual(1)})) {
      for(let i=0;i<entries.length;i++) {
        const engine=new MenuEngine(model);
        engine.group=group; engine.page='list'; engine.mainIndex=group==='dmx'?0:group==='program'?2:group==='manual'?3:1;
        engine.index=i; engine.cursor=0;
        renderer.draw(engine,{temperature:77,version:'----'});
        assert.deepEqual(renderer.warnings,[],`${lang.id} ${group} ${entries[i].en}`);
        const e=entries[i];
        assert.ok(renderer.textWidth(renderer.name(e))<=(['choice','action','group'].includes(e.kind)?160:119), `${lang.id} numeric title ${e.en}`);
        if(e.array) for(const option of engine.options(e))
          {
            const label=lang.strings[option.trim()]??option.trim();
            assert.ok(renderer.textWidth(label)<=160,option);
            if(e.kind==='choice') assert.ok(renderer.textWidth(renderer.name(e))+renderer.textWidth(label)<=160,`${lang.id} ${e.en} / ${label}`);
          }
      }
    }
    for(const [label,x] of [['DMX',12],['Pers',64],['Prog',114],['Manu',10],['Info',67]])
      assert.ok(x+renderer.textWidth(lang.strings[label])<=160,`${lang.id} ${label}`);
  }
  assert.throws(()=>renderer.text('😀',0,0),/Missing bitmap glyph/);
});
