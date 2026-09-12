import { NoteEditor } from "@/components/editor/NoteEditor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // key forces a full editor remount between notes — clean timers, no stale drafts
  return <NoteEditor key={id} noteId={id} />;
}
