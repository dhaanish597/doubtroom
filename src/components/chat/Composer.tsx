"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { AtSign, GraduationCap, ImagePlus, Megaphone, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomContext } from "@/components/rooms/RoomContext";
import { doubtImageExtensions, doubtImageLimit, isDoubtImageType } from "@/lib/rooms/doubt-images";
import { BOT_IDS } from "@/lib/nexconn/identities";
import { mentionAt, mentionPattern } from "@/lib/rooms/timeline";
import type { RoomMember } from "@/lib/rooms/types";
import { languages, type AnswerLanguage } from "@/lib/ai/languages";
import { AnnounceComposer } from "./AnnounceComposer";
import { MentionPicker } from "./MentionPicker";
import { MutedNotice, useMutedUntil } from "./MuteGate";

const TA = { userId: BOT_IDS.TA, name: "TA (DoubtRoom TA)" };
export type SendDraft =
  | { kind: "chat"; text: string; mentions: string[] }
  | { kind: "photo"; file: File }
  | { kind: "doubt"; lang: AnswerLanguage; doubtId: string; text: string; unit?: string; file?: File }
  /** A senior's reply to the doubt in `reply`. */
  | { kind: "answer"; text: string };

export function Composer({ roomId, defaultLanguage = "en", units, allowDoubts, connected, progress, onSend, allowMentions = true, allowPhotos = true, prefill = "", prefillMode, prefillUnit, onInput, reply }: {
  roomId: string;
  defaultLanguage?: AnswerLanguage;
  units: string[];
  allowDoubts: boolean;
  connected: boolean;
  progress: number | null;
  onSend: (draft: SendDraft) => void;
  allowMentions?: boolean;
  /** Text-only rooms (Exam Eve) hide the photo button. */
  allowPhotos?: boolean;
  /** Fills an empty composer once, for example with a quoted doubt. */
  prefill?: string;
  /** With a mode, the prefill replaces the draft and switches mode (the demo tour's example doubt). */
  prefillMode?: "chat" | "doubt";
  prefillUnit?: string;
  onInput?: () => void;
  /** Senior answer mode: the next message replies to this doubt. */
  reply?: { quotedText: string; onCancel: () => void } | null;
}) {
  const [draft, setDraft] = useState(prefill);
  const [appliedPrefill, setAppliedPrefill] = useState(prefill);
  const [mode, setMode] = useState<"chat" | "doubt">(prefill && prefillMode === "doubt" && allowDoubts ? "doubt" : "chat");
  const [language, setLanguage] = useState<AnswerLanguage | null>(null);
  const [unit, setUnit] = useState(prefill && prefillUnit && units.includes(prefillUnit) ? prefillUnit : "");
  if (prefill !== appliedPrefill) {
    setAppliedPrefill(prefill);
    if (prefill && (!draft || prefillMode)) setDraft(prefill.slice(0, 2000));
    if (prefill && prefillMode && (prefillMode === "chat" || allowDoubts)) {
      setMode(prefillMode);
      if (prefillUnit && units.includes(prefillUnit)) setUnit(prefillUnit);
    }
  }
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
  const answering = Boolean(reply);
  // Phase 11A: reps and admins can switch to Announcement mode. Muted members see a notice instead.
  const room = useRoomContext();
  const canAnnounce = allowDoubts && room?.roomId === roomId && Boolean(room.moderation?.canAnnounce);
  const [announcing, setAnnouncing] = useState(false);
  const mutedUntil = useMutedUntil(roomId);
  const mention = allowMentions && !answering && !dismissed && mode === "chat" ? mentionAt(draft, cursor) : null;
  const pickerOpen = Boolean(mention && connected);
  const options = mention ? members.filter(({ name }) => name.toLowerCase().includes(mention.query.toLowerCase())) : [];

  useEffect(() => () => memberRequest.current?.abort(), []);
  useEffect(() => { if (answering) input.current?.focus(); }, [answering, reply?.quotedText]);
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
    if (value.length > draft.length) onInput?.();
    setDraft(value);
    setCursor(caret);
    setDismissed(false);
    if (allowMentions && connected && memberStatus === "idle" && mentionAt(value, caret)) fetchMembers();
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
    if (!connected || progress !== null) return;
    const text = draft.trim();
    if (answering) {
      if (!text) return;
      onSend({ kind: "answer", text });
      setDraft("");
      setCursor(0);
      return;
    }
    if (mode === "doubt") {
      if ((!text && !file) || (units.length && !unit)) return;
      if (file && !isDoubtImageType(file.type)) {
        setError("Choose a JPEG, PNG, WebP or HEIC photo.");
        return;
      }
      onSend({ kind: "doubt", lang: language ?? defaultLanguage, doubtId: crypto.randomUUID(), text, unit: unit || undefined, file: file ?? undefined });
      setDraft("");
      setFile(null);
      setLanguage(null);
      setCursor(0);
      setError("");
      return;
    }
    if (file) {
      onSend({ kind: "photo", file });
      setFile(null);
      setDismissed(true);
      return;
    }
    if (!text) return;
    const selected = new Map(mentioned.current).set(TA.userId, "TA");
    const mentions = [...selected].filter(([, name]) => new RegExp(mentionPattern(name), "u").test(text)).map(([id]) => id);
    onSend({ kind: "chat", text, mentions });
    mentioned.current.clear();
    setDraft("");
    setCursor(0);
    setDismissed(true);
  }

  if (mutedUntil) return <MutedNotice until={mutedUntil} />;
  if (announcing && canAnnounce && !answering) {
    return <AnnounceComposer roomId={roomId} connected={connected} onClose={() => setAnnouncing(false)} />;
  }

  return (
    <div className="shrink-0 border-t border-border bg-background px-2.5 py-2 sm:px-5">
      <form aria-label="Send a message" onSubmit={submit} className="mx-auto max-w-3xl space-y-1">
        <div className="flex items-center justify-between gap-1">
          {reply && (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border-s-4 border-emerald-600 bg-emerald-50 py-1 pl-2 text-sm text-emerald-950">
              <GraduationCap aria-hidden="true" className="size-4 shrink-0" />
              <p className="min-w-0 flex-1"><span className="font-semibold">Senior answer to </span><span className="line-clamp-1 wrap-anywhere">{reply.quotedText}</span></p>
              <Button type="button" variant="ghost" aria-label="Cancel senior answer" className="size-11 shrink-0" onClick={reply.onCancel}><X aria-hidden="true" /></Button>
            </div>
          )}
          {allowDoubts && !answering && <div className="flex rounded-full bg-muted p-0.5" role="group" aria-label="Compose mode">
            {(["chat", "doubt"] as const).map((option) => (
              <Button key={option} type="button" variant="ghost" aria-pressed={mode === option} className={`h-11 rounded-full px-3 capitalize ${mode === option ? "bg-card text-primary shadow-xs" : "text-muted-foreground"}`} onClick={() => { setMode(option); setError(""); }}>{option}</Button>
            ))}
            {canAnnounce && <Button type="button" variant="ghost" aria-pressed={false} className="h-11 rounded-full px-3 text-muted-foreground" onClick={() => setAnnouncing(true)}><Megaphone aria-hidden="true" /><span className="sr-only sm:not-sr-only">Announce</span></Button>}
          </div>}
          {progress !== null && <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><label htmlFor="room-upload" className="sr-only">Image upload</label><progress id="room-upload" max={100} value={progress} className="h-2 w-14 accent-primary sm:w-24" /><span>{Math.round(progress)}%</span></div>}
        </div>
        {mode === "doubt" && !answering && <div role="group" aria-label="Answer language" className="flex flex-wrap items-center gap-1">
          {Object.entries(languages).map(([id, label]) => <Button key={id} type="button" size="sm" variant={(language ?? defaultLanguage) === id ? "secondary" : "ghost"}
            aria-pressed={(language ?? defaultLanguage) === id} onClick={() => setLanguage(id as AnswerLanguage)}>{id === "en" ? "EN" : label}</Button>)}
        </div>}
        {mode === "doubt" && !answering && units.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-medium">
            Unit
            <select className="min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-2" value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="">Choose a unit</option>
              {units.map((label) => <option key={label}>{label}</option>)}
            </select>
          </label>
        )}
        {file && <div className="flex items-center justify-between gap-2 rounded-xl bg-muted pl-3 text-sm"><span className="truncate">{file.name}</span><Button type="button" variant="ghost" aria-label="Remove attached image" className="size-11 shrink-0" onClick={() => setFile(null)}><X aria-hidden="true" /></Button></div>}
        <div className="relative flex items-end gap-0.5 rounded-2xl border bg-card p-1 focus-within:border-primary/60">
          {pickerOpen && <MentionPicker members={options} loading={memberStatus === "loading"} failed={memberStatus === "failed"} onPick={selectMember} onRetry={fetchMembers} />}
          <input type="file" hidden ref={attach} accept={mode === "doubt" ? Object.keys(doubtImageExtensions).join(",") : "image/*"} onChange={(event) => {
            const selected = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!selected) return;
            const validType = mode === "doubt" ? isDoubtImageType(selected.type)
              : selected.type.startsWith("image/") && selected.type !== "image/svg+xml";
            if (!validType || !selected.size || selected.size > doubtImageLimit) {
              setError(mode === "doubt" ? "Choose a JPEG, PNG, WebP or HEIC photo up to 5 MB." : "Choose a photo up to 5 MB.");
              return;
            }
            setError("");
            setFile(selected);
          }} />
          {allowPhotos && <Button type="button" variant="ghost" className="size-11 shrink-0 text-primary" aria-label="Attach a photo" disabled={!connected || progress !== null || answering} onClick={() => attach.current?.click()}><ImagePlus aria-hidden="true" /></Button>}
          {mode === "chat" && allowMentions && !answering && <Button type="button" variant="ghost" className="size-11 shrink-0 text-primary" aria-label="Mention someone" disabled={!connected} onClick={insertMention}><AtSign aria-hidden="true" /></Button>}
          <textarea ref={input} rows={1} aria-label={answering ? "Your answer" : mode === "doubt" ? "What’s your doubt?" : "Message"}
            placeholder={answering ? "Write a better answer" : mode === "doubt" ? "What’s your doubt?" : "Write a message"} value={draft} maxLength={2000} disabled={!connected}
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
          <Button type="submit" aria-label={answering ? "Post senior answer" : mode === "doubt" ? "Post doubt" : file ? "Send photo" : "Send message"} className="h-11 min-w-11 shrink-0 rounded-xl px-2.5"
            disabled={!connected || progress !== null || (answering ? !draft.trim() : (!draft.trim() && !file) || (mode === "doubt" && units.length > 0 && !unit))}>
            <Send aria-hidden="true" /><span className="hidden sm:inline">Send</span>
          </Button>
        </div>
        {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
