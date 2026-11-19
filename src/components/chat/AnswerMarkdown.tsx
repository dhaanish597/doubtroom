import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function AnswerMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown skipHtml disallowedElements={["img"]} remarkPlugins={[remarkGfm]} components={{
      table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
    }}>{markdown}</ReactMarkdown>
  );
}
