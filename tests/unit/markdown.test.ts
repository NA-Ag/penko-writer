import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { createExtensions } from '../../editor/extensions';
import { htmlToMarkdown, markdownToHtml } from '../../utils/markdownConverter';

const throughEditor = (html: string) => {
  const editor = new Editor({ extensions: createExtensions({ paginate: false }), content: html });
  const out = editor.getHTML();
  editor.destroy();
  return out;
};

describe('markdownToHtml', () => {
  it('keeps fenced code blocks verbatim with language', () => {
    const html = markdownToHtml('```js\nconst a = 1 < 2 && b_c;\n**not bold**\n```\n');
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const a = 1 &lt; 2 &amp;&amp; b_c;');
    expect(html).toContain('**not bold**');
    expect(html).not.toContain('<strong>');
  });

  it('renders images as <img>', () => {
    const html = markdownToHtml('![A cat](https://example.com/cat.png "Title")');
    expect(html).toMatch(/<img[^>]+src="https:\/\/example.com\/cat.png"/);
    expect(html).toContain('alt="A cat"');
  });

  it('renders nested lists', () => {
    const html = markdownToHtml('- one\n  - nested\n- two\n\n1. first\n2. second\n');
    expect(html).toMatch(/<ul>\s*<li>one\s*<ul>\s*<li>nested<\/li>/);
    expect(html).toMatch(/<ol>\s*<li>first<\/li>\s*<li>second<\/li>\s*<\/ol>/);
  });

  it('renders GFM tables', () => {
    const html = markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>2</td>');
  });

  it('does not italicise snake_case', () => {
    const html = markdownToHtml('use my_variable_name here');
    expect(html).not.toContain('<em>');
    expect(html).toContain('my_variable_name');
  });

  it('keeps entities escaped and strips scripts', () => {
    const html = markdownToHtml('a &lt;b&gt; c\n\n<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('converts footnotes and equations to editor nodes', () => {
    const html = markdownToHtml('Text[^1] and $x^2$ costs $5 and $10.\n\n[^1]: A note.\n');
    expect(html).toContain('data-type="footnote"');
    expect(html).toContain('data-content="A note."');
    expect(html).toContain('data-latex="x^2"');
    expect(html).toContain('$5 and $10');
    expect(html).not.toContain('[^1]:');
  });
});

describe('htmlToMarkdown', () => {
  it('writes code blocks as fenced blocks', () => {
    const md = htmlToMarkdown('<pre data-language="python"><code class="language-python">print("a_b")\nx = 2 * 3</code></pre>');
    expect(md).toContain('```python\nprint("a_b")\nx = 2 * 3\n```');
  });

  it('writes images, links and emphasis', () => {
    const md = htmlToMarkdown('<p><strong>B</strong> <em>I</em> <a href="https://x.org">link</a> <img src="https://x.org/a.png" alt="pic"></p>');
    expect(md).toContain('**B**');
    expect(md).toContain('*I*');
    expect(md).toContain('[link](https://x.org)');
    expect(md).toContain('![pic](https://x.org/a.png)');
  });

  it('does not treat <span> as strikethrough and keeps snake_case readable', () => {
    const md = htmlToMarkdown('<p><span style="color: red">my_var</span> <s>gone</s></p>');
    expect(md).toContain('my_var');
    expect(md).toContain('~~gone~~');
    expect(md.match(/~~/g)?.length).toBe(2);
  });

  it('escapes things that look like HTML', () => {
    const md = htmlToMarkdown('<p>a &lt;b&gt; c &amp;amp;</p>');
    const back = markdownToHtml(md);
    expect(back).toContain('a &lt;b&gt; c &amp;amp;');
  });

  it('converts custom nodes', () => {
    const md = htmlToMarkdown(
      '<p>See<sup data-type="footnote" data-note-type="footnote" data-content="Note text" data-number="1">1</sup> ' +
        '<span data-type="equation" data-latex="E=mc^2"></span> <span data-type="citation" data-citation-id="c1">(Smith, 2020)</span> ' +
        '<mark data-color="#ff0">hi</mark></p><div data-type="page-break"></div><p>after</p>',
    );
    expect(md).toContain('See[^1]');
    expect(md).toContain('[^1]: Note text');
    expect(md).toContain('$E=mc^2$');
    expect(md).toContain('(Smith, 2020)');
    expect(md).toContain('<mark>hi</mark>');
    expect(md).toContain('data-type="page-break"');
  });
});

describe('round trips through the editor schema', () => {
  const cases: [string, string][] = [
    ['code block', '```ts\nconst x: Array<number> = [];\nfoo_bar();\n```\n'],
    ['image', '![alt text](https://example.com/a.png)\n'],
    ['lists', '- a\n- b\n  - c\n\n1. one\n2. two\n'],
    ['table', '| H1 | H2 |\n| --- | --- |\n| a | b |\n'],
    ['snake_case', 'call my_function_name now\n'],
    ['entities', 'x &lt; y &amp;&amp; <b>not html</b>\n'],
  ];
  for (const [name, src] of cases) {
    it(name, () => {
      const html1 = throughEditor(markdownToHtml(src));
      const md = htmlToMarkdown(html1);
      const html2 = throughEditor(markdownToHtml(md));
      expect(html2).toBe(html1);
    });
  }

  it('keeps footnotes, equations and page breaks', () => {
    const html1 = throughEditor(markdownToHtml('A[^1] $a+b$\n\n<div data-type="page-break"></div>\n\nB\n\n[^1]: note\n'));
    expect(html1).toContain('data-type="footnote"');
    expect(html1).toContain('data-type="equation"');
    expect(html1).toContain('data-type="page-break"');
    const html2 = throughEditor(markdownToHtml(htmlToMarkdown(html1)));
    expect(html2).toBe(html1);
  });
});
