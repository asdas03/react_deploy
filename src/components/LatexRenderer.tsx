import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
}

export const LatexRenderer = ({ text }: LatexRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // LaTeX 패턴 매칭: $$...$$ (display) 또는 $...$ (inline)
    const parts: (string | { latex: string; display: boolean })[] = [];
    let currentText = text;
    let match;

    // Display math ($$...$$) 먼저 처리
    const displayRegex = /\$\$(.*?)\$\$/gs;
    let lastIndex = 0;
    
    while ((match = displayRegex.exec(currentText)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = currentText.slice(lastIndex, match.index);
        parts.push(beforeText);
      }
      parts.push({ latex: match[1].trim(), display: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < currentText.length) {
      parts.push(currentText.slice(lastIndex));
    }

    // Inline math ($...$) 처리
    const finalParts: (string | { latex: string; display: boolean })[] = [];
    parts.forEach(part => {
      if (typeof part === 'string') {
        const inlineRegex = /\$(.*?)\$/g;
        let str = part;
        let inlineMatch;
        let inlineLastIndex = 0;
        
        while ((inlineMatch = inlineRegex.exec(str)) !== null) {
          if (inlineMatch.index > inlineLastIndex) {
            finalParts.push(str.slice(inlineLastIndex, inlineMatch.index));
          }
          finalParts.push({ latex: inlineMatch[1].trim(), display: false });
          inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
        }
        
        if (inlineLastIndex < str.length) {
          finalParts.push(str.slice(inlineLastIndex));
        }
      } else {
        finalParts.push(part);
      }
    });

    // 렌더링
    containerRef.current.innerHTML = '';
    finalParts.forEach(part => {
      if (typeof part === 'string') {
        // 일반 텍스트 - 줄바꿈 처리
        const lines = part.split('\n');
        lines.forEach((line, idx) => {
          if (line) {
            const textNode = document.createTextNode(line);
            containerRef.current?.appendChild(textNode);
          }
          if (idx < lines.length - 1) {
            containerRef.current?.appendChild(document.createElement('br'));
          }
        });
      } else {
        // LaTeX 수식
        const span = document.createElement('span');
        span.style.display = part.display ? 'block' : 'inline-block';
        span.style.margin = part.display ? '1em 0' : '0 0.2em';
        try {
          katex.render(part.latex, span, {
            displayMode: part.display,
            throwOnError: false,
            errorColor: '#cc0000',
          });
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          span.textContent = part.display ? `$$${part.latex}$$` : `$${part.latex}$`;
        }
        containerRef.current?.appendChild(span);
      }
    });
  }, [text]);

  return <div ref={containerRef} className="whitespace-pre-wrap" />;
};
