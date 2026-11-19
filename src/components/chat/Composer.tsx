"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { AtSign, ImagePlus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { mentionAt, mentionPattern } from "@/lib/rooms/timeline";
import type { RoomMember } from "@/lib/rooms/types";
import { MentionPicker } from "./MentionPicker";

const TA = { userId: BOT_IDS.TA, name: "TA (DoubtRoom TA)" };
const imageLimit = 5 * 1024 * 1024;
export type SendDraft = { text: string; mentions: string[] } | { file: File };

export function Composer({ roomId, connected, progress, onSend }: {
  roomId: string;
  connected: boolean;
  progress: number | null;
  onSend: (draft: SendDraft) => void;
}) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"chat" | "doubt">("chat");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([TA]);
  const [memberStatus, setMemberStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const mentioned = useRef(new Map<string, string>());
  const input = useRef<HTMLTextAreaElement>(null);
  const requestedCaret = useRef<number | null>(null);
  const attach = useRef<HTMLInputElement>(null);
  const memberRequest = useRef<AbortController | null>(null);
  const mention = !dismissed && mode === "chat" ? mentionAt(draft, cursor) : null;
  const pickerOpen = Boolean(mention && connected);
  const options = mention ? members.filter(({ name }) => name.toLowerCase().includes(mention.query.toLowerCase())) : [];

  useEffect(() => () => memberRequest.current?.abort(), []);
  useLayoutEffect(() => {
    const caret = requestedCaret.current;
    if (caret === null) return;
    requestedCaret.current = null;
    input.current?.focus();
    input.current?.setSelectionRange(caret, caret);
  }, [draft]);

  function fetchMembers() {
    memberRequest.current?.abort();
    const controller = new AbortController();
    memberRequest.current = controller;
    setMemberStatus("loading");
    void fetch(`/api/rooms/${roomId}/members`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Members unavailable");
        const data = await response.json() as { members: RoomMember[] };
        if (controller.signal.aborted) return;
        setMembers([TA, ...data.members.filter(({ userId }) => userId !== TA.userId)]);
        setMemberStatus("ready");
      }).catch(() => { if (!controller.signal.aborted) setMemberStatus("failed"); });
  }

  function edit(value: string, caret: number) {
    setDraft(value);
    setCursor(caret);
    setDismissed(false);
    if (connected && memberStatus === "idle" && mentionAt(value, caret)) fetchMembers();
  }

  function insertMention() {
    const start = input.current?.selectionStart ?? draft.length;
    const end = input.current?.selectionEnd ?? start;
    const token = start && !/\s/.test(draft[start - 1]) ? " @" : "@";
    if (draft.length + token.length > 2000) return;
    requestedCaret.current = start + token.length;
    edit(draft.slice(0, start) + token + draft.slice(end), start + token.length);
  }

  function selectMember(member: RoomMember) {
    if (!mention) return;
    const sameName = members.some(({ name, userId }) => name === member.name && userId !== member.userId);
    const name = member.userId === TA.userId ? "TA" : sameName ? `${member.name} (${member.userId})` : member.name;
    const token = `@${name} `;
    const value = draft.slice(0, mention.from) + token + draft.slice(mention.to);
    if (value.length > 2000) return;
    mentioned.current.set(member.userId, name);
    requestedCaret.current = mention.from + token.length;
    edit(value, mention.from + token.length);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!connected || mode !== "chat" || progress !== null) return;
    if (file) {
      onSend({ file });
      setFile(null);
      setDismissed(true);
      return;
    }
    const text = draft.trim();
    if (!text) return;
    const selected = new Map(mentioned.current).set(TA.userId, "TA");
    const mentions = [...selected].filter(([, name]) => new RegExp(mentionPattern(name), "u").test(text)).map(([id]) => id);
    onSend({ text, mentions });
    mentioned.current.clear();
    setDraft("");
    setCursor(0);
    setDismissed(true);
  }

  return (
    <div className="shrink-0 border-t border-[#e9e7f4] bg-background px-2.5 py-2 sm:px-5">
      <form aria-label="Send a message" onSubmit={submit} className="mx-auto max-w-3xl space-y-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex rounded-full bg-[#f2f0fb] p-0.5" role="group" aria-label="Compose mode">
            {(["chat", "doubt"] as const).map((option) => (
              <Button key={option} type="button" variant="ghost" aria-pressed={mode === option} className={`h-11 rounded-full px-3 capitalize ${mode === option ? "bg-white text-primary shadow-xs" : "text-muted-foreground"}`} onClick={() => setMode(option)}>{option}</Button>
            ))}
          </div>
          {progress !== null && <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><label htmlFor="room-upload" className="sr-only">Image upload</label><progress id="room-upload" max={100} value={progress} className="h-2 w-14 accent-primary sm:w-24" /><span>{Math.round(progress)}%</span></div>}
        </div>
        {mode === "doubt" ? <p role="status" className="min-h-12 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Doubt mode is coming soon. You can ask in Chat now.</p> : (
          <>
            {file && <div className="flex items-center justify-between gap-2 rounded-xl bg-muted pl-3 text-sm"><span className="truncate">{file.name}</span><Button type="button" variant="ghost" aria-label="Remove attached image" className="size-11 shrink-0" onClick={() => setFile(null)}><X aria-hidden="true" /></Button></div>}
            <div className="relative flex items-end gap-0.5 rounded-2xl border bg-white p-1 focus-within:border-primary/60">
              {pickerOpen && <MentionPicker members={options} loading={memberStatus === "loading"} failed={memberStatus === "failed"} onPick={selectMember} onRetry={fetchMembers} />}
              <input type="file" hidden ref={attach} accept="image/*" onChange={(event) => {
                const selected = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!selected) return;
                if (!selected.type.startsWith("image/") || selected.type === "image/svg+xml" || !selected.size || selected.size > imageLimit) {
                  setError("Choose a photo up to 5 MB.");
                  return;
                }
                setError("");
                setFile(selected);
              }} />
              <Button type="button" variant="ghost" className="size-11 shrink-0 text-primary" aria-label="Attach a photo" disabled={!connected || progress !== null} onClick={() => attach.current?.click()}><ImagePlus aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" className="size-11 shrink-0 text-primary" aria-label="Mention someone" disabled={!connected} onClick={insertMention}><AtSign aria-hidden="true" /></Button>
              <textarea ref={input} rows={1} aria-label="Message" placeholder="Write a message" value={draft} maxLength={2000} disabled={!connected}
                onChange={(event) => edit(event.target.value, event.target.selectionStart)} onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setDismissed(true);
                  if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || !matchMedia("(pointer: fine)").matches) return;
                  event.preventDefault();
                  if (pickerOpen && options[0]) selectMember(options[0]);
                  else submit();
                }}
                className="min-h-11 min-w-0 flex-1 field-sizing-content resize-none overflow-auto rounded-lg px-1 py-2.5 text-base leading-6 outline-none [max-height:7.5rem] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/45"
              />
              <Button type="submit" aria-label={file ? "Send photo" : "Send message"} className="h-11 min-w-11 shrink-0 rounded-xl px-2.5" disabled={!connected || progress !== null || (!draft.trim() && !file)}>
                <Send aria-hidden="true" /><span className="hidden sm:inline">Send</span>
              </Button>
            </div>
            {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
          </>
        )}
      </form>
    </div>
  );
}
