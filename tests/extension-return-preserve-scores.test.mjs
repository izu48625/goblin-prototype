import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const index=read("index.html");
const launcher=read("app/src/launcher.js");
const editorHtml=read("app/editor.html");
const editorEntry=read("app/src/editor-entry.js");
const editor=read("app/src/editor/editor.js");

// Test the actual Home fresh-sheet condition rather than a duplicated rule.
const match=index.match(/const fresh=([^;]+);/);
assert.ok(match,"Home must declare its fresh-sheet condition");
const freshCondition=new Function(
  "params","valid","resumeRemix","resumePublish",
  `return Boolean(${match[1]});`
);
function fresh(query,options={}){
  return freshCondition(
    new URLSearchParams(query),
    options.community??false,
    options.remix??false,
    options.publish??false
  );
}

test("ordinary Home links still open an empty sheet",()=>{
  assert.equal(fresh(""),true);
  assert.equal(fresh("?lang=ja"),true);
});

test("returning to extension picker preserves the existing scored sheet",()=>{
  assert.equal(fresh("?extensions=1"),false);
  assert.equal(fresh("?extensions=1&resume=1"),false);
  assert.equal(fresh("?resume=1"),false);
});

test("existing community, remix and publish resume flows stay intact",()=>{
  assert.equal(fresh("?community=abc",{community:true}),false);
  assert.equal(fresh("?remixed=1",{remix:true}),false);
  assert.equal(fresh("?from=public",{publish:true}),false);
});

test("both editor back and browser Back preserve the current Home sheet",()=>{
  assert.match(editorHtml,/index\.html\?extensions=1&resume=1/);
  assert.match(launcher,/returnUrl\.searchParams\.set\("resume","1"\)/);
  assert.match(launcher,/history\.replaceState\(history\.state/);
  assert.match(editorEntry,/index\.html\?extensions=1&resume=1/);
  assert.match(editor,/index\.html\?extensions=1&resume=1/);
});
