import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const THEME = "vitesse-light";

const ALIASES: Record<string, string> = {
  py: "python",
  python3: "python",
  sh: "shellscript",
  bash: "shellscript",
  shell: "shellscript",
  console: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
};

let highlighter: Promise<HighlighterCore> | undefined;

function load() {
  highlighter ??= createHighlighterCore({
    themes: [import("@shikijs/themes/vitesse-light")],
    langs: [
      import("@shikijs/langs/python"),
      import("@shikijs/langs/shellscript"),
      import("@shikijs/langs/json"),
      import("@shikijs/langs/toml"),
      import("@shikijs/langs/yaml"),
      import("@shikijs/langs/sql"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export function languageOf(lang: string) {
  const normalized = lang.toLowerCase();
  return ALIASES[normalized] ?? normalized;
}

const cache = new Map<string, Promise<ReactNode>>();

export function highlight(code: string, lang: string) {
  const key = `${lang}\u0000${code}`;
  let result = cache.get(key);
  if (!result) {
    result = load().then((core) => {
      const language = core.getLoadedLanguages().includes(lang) ? lang : "text";
      const tree = core.codeToHast(code, {
        lang: language,
        theme: THEME,
        transformers: [
          {
            pre(node) {
              node.properties = {
                className: "overflow-x-auto px-6 py-5 font-mono text-[0.95rem] leading-7".split(
                  " ",
                ),
                tabIndex: 0,
              };
            },
          },
        ],
      });
      return toJsxRuntime(tree, { Fragment, jsx, jsxs });
    });
    cache.set(key, result);
  }
  return result;
}
