export function TypingIndicator({ name }: { name: string | null }) {
  return (
    <p role="status" aria-live="polite" className="min-h-6 shrink-0 bg-[#f9f8fd] px-4 text-xs italic text-muted-foreground">
      {name && (
        <span className="mx-auto flex max-w-3xl items-center gap-1.5">
          <span aria-hidden="true" className="flex gap-0.5">
            {[0, 150, 300].map((delay) => <span key={delay} className="size-1 animate-bounce rounded-full bg-primary/60 motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }} />)}
          </span>
          {name} is typing…
        </span>
      )}
    </p>
  );
}
