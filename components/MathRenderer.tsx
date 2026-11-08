"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Bulletproof LaTeX math renderer with KaTeX.
 * Parses $...$ (inline) and $$...$$ (display), with safe fallback
 * so malformed LaTeX formulas never crash the examination interface.
 */
export function MathRenderer({ content, className = "" }: MathRendererProps) {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    // Regex to detect $$...$$, $...$, \[...\], \(...\)
    const regex = /(\$\$[\s\S]*?\$\$|(?:\$)(?:\\.|[^\$\\])+?(?:\$)|\\[[\s\S]*?\\]|\\\([\s\S]*?\\\))/g;

    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      const isDoubleDollar = part.startsWith("$$") && part.endsWith("$$");
      const isBracketDisplay = part.startsWith("\\[") && part.endsWith("\\]");
      const isSingleDollar = part.startsWith("$") && part.endsWith("$") && part.length > 1;
      const isParenInline = part.startsWith("\\(") && part.endsWith("\\)");

      if (isDoubleDollar || isBracketDisplay) {
        const formula = isDoubleDollar ? part.slice(2, -2) : part.slice(2, -2);
        try {
          const html = katex.renderToString(formula, {
            displayMode: true,
            throwOnError: false,
            errorColor: "#ef4444",
          });
          return (
            <span
              key={index}
              className="my-3 block overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code
              key={index}
              className="my-2 block overflow-x-auto rounded bg-zinc-900 border border-zinc-800 p-2 font-mono text-xs text-zinc-400"
            >
              {part}
            </code>
          );
        }
      }

      if (isSingleDollar || isParenInline) {
        const formula = isSingleDollar ? part.slice(1, -1) : part.slice(2, -2);
        try {
          const html = katex.renderToString(formula, {
            displayMode: false,
            throwOnError: false,
            errorColor: "#ef4444",
          });
          return (
            <span
              key={index}
              className="inline-block px-0.5 align-baseline"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code
              key={index}
              className="rounded bg-zinc-900 border border-zinc-800 px-1 py-0.5 font-mono text-xs text-zinc-400"
            >
              {part}
            </code>
          );
        }
      }

      return <span key={index}>{part}</span>;
    });
  }, [content]);

  return <div className={`leading-relaxed ${className}`}>{renderedElements}</div>;
}

export default MathRenderer;
