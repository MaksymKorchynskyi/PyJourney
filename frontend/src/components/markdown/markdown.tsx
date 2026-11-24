import clsx from "clsx";
import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

type CodeProps = { className?: string; children?: ReactNode };

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<CodeProps>(node)) return textOf(node.props.children);
  return "";
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-12 mb-5 text-[1.75em] leading-tight font-bold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-12 mb-4 text-[1.5em] leading-tight font-bold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-9 mb-3 text-[1.25em] leading-snug font-bold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="mt-7 mb-2 font-bold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-5 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-5 list-disc space-y-2 pl-6 marker:text-orange">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-6 marker:font-medium marker:text-orange">
      {children}
    </ol>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-orange underline decoration-orange/40 underline-offset-4 hover:decoration-orange"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-5 rounded-2xl border-lime border-l-[6px] bg-lime/20 px-6 py-4 [&>p]:mb-2 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-0 border-mist border-t-2" />,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-2xl bg-panel">
      <table className="w-full border-collapse text-left text-[0.9em]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="px-5 py-3 font-medium text-muted">{children}</th>,
  td: ({ children }) => <td className="border-white border-t-2 px-5 py-3">{children}</td>,
  code: ({ children }) => (
    <code className="rounded-md bg-blue/10 px-1.5 py-0.5 font-mono text-[0.85em] text-blue">
      {children}
    </code>
  ),
  pre: ({ children }) => {
    const child = Children.toArray(children).find((item) => isValidElement<CodeProps>(item));
    const className = isValidElement<CodeProps>(child) ? (child.props.className ?? "") : "";
    const lang = /language-([\w+-]+)/.exec(className)?.[1] ?? "";
    return <CodeBlock code={textOf(child).replace(/\n$/, "")} lang={lang} />;
  },
};

type MarkdownProps = { children: string; size?: "lg" | "md"; className?: string };

export function Markdown({ children, size = "lg", className }: MarkdownProps) {
  return (
    <div
      className={clsx(
        "min-w-0 break-words",
        size === "lg" ? "text-xl leading-relaxed" : "text-[1.05rem] leading-relaxed",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
