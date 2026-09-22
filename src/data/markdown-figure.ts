import { defineHastPlugin } from 'satteri';
import type { Element } from 'hast';

// タイトル付きの画像 ![代替テキスト](画像 "キャプション") が単独で段落になっているとき、
// figure と figcaption に置き換える。キャプションは alt と別に持たせ、読み上げで同じ文を二度読ませない。
export const figureFromTitledImage = defineHastPlugin({
  name: 'figure-from-titled-image',
  element: {
    filter: ['p'],
    visit(node, ctx) {
      const children = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const img = children[0];
      if (children.length !== 1 || img.type !== 'element' || img.tagName !== 'img') return;
      const title = img.properties?.title;
      if (typeof title !== 'string' || !title) return;
      const image: Element = { ...img, properties: { ...img.properties, title: undefined } };
      ctx.replaceNode(node, {
        type: 'element', tagName: 'figure', properties: {},
        children: [image, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: title }] }],
      });
    },
  },
});
