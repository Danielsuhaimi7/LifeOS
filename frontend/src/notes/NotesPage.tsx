import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/FirebaseAuthProvider";
import { ensureUserProfile, subscribeToTasks, type LifeTask } from "../tasks/taskRepository";
import { subscribeToAppointments, type Appointment } from "../calendar/calendarRepository";
import { createNote, createNoteFolder, deleteNote, renameNoteFolder, subscribeToNoteFolders, subscribeToNotes, updateNote, type LifeNote, type NoteFolder, type NoteInput, type NoteKind } from "./notesRepository";

type SaveState = "saved" | "saving" | "error";
type ChecklistItem = { text: string; checked: boolean };

function errorMessage(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") return "Firestore denied this request. The reviewed LOS-009 rules need to be deployed.";
  if (error instanceof FirebaseError && error.code === "unavailable") return "LifeOS could not reach Firestore. Check your connection and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Your notes could not be loaded or saved. Please try again.";
}

function checklistItems(body: string): ChecklistItem[] {
  if (!body) return [];
  return body.split("\n").map((line) => {
    const match = line.match(/^- \[(x| )\] (.*)$/i);
    return match ? { checked: match[1].toLowerCase() === "x", text: match[2] } : { checked: false, text: line };
  });
}

function checklistBody(items: ChecklistItem[]) {
  return items.map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`).join("\n");
}

function plainToChecklist(body: string) {
  return checklistBody(body ? body.split("\n").map((text) => ({ text, checked: false })) : []);
}

function checklistToPlain(body: string) {
  return checklistItems(body).map((item) => `${item.checked ? "☑" : "☐"} ${item.text}`).join("\n");
}

function relativeEdited(note: LifeNote) {
  const edited = note.updatedAt?.toMillis?.() ?? 0;
  if (!edited) return "Just created";
  const days = Math.floor((Date.now() - edited) / 86400000);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" }).format(edited);
}

function notePreview(note: LifeNote) {
  if (note.kind === "checklist") {
    const first = checklistItems(note.body).find((item) => item.text.trim());
    return first?.text || "Checklist";
  }
  return note.body.trim().replace(/\s+/g, " ") || "No additional text";
}

export function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LifeNote[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [tasks, setTasks] = useState<LifeTask[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [draft, setDraft] = useState<NoteInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [folderName, setFolderName] = useState("");
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const version = useRef(0);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    const stops: Array<() => void> = [];
    setLoading(true);
    void ensureUserProfile(user).then(() => {
      if (cancelled) return;
      stops.push(subscribeToNotes(user.uid, setNotes, (value) => { setError(errorMessage(value)); setLoading(false); }));
      stops.push(subscribeToNoteFolders(user.uid, setFolders, (value) => setError(errorMessage(value))));
      stops.push(subscribeToTasks(user.uid, setTasks, (value) => setError(errorMessage(value))));
      stops.push(subscribeToAppointments(user.uid, setAppointments, (value) => setError(errorMessage(value))));
      setLoading(false);
    }).catch((value: unknown) => { if (!cancelled) { setError(errorMessage(value)); setLoading(false); } });
    return () => { cancelled = true; stops.forEach((stop) => stop()); };
  }, [user]);

  const orderedNotes = useMemo(() => [...notes].sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)), [notes]);
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return orderedNotes.filter((note) => {
      const folderMatches = folderFilter === "all" || (folderFilter === "unfiled" ? !note.folderId : note.folderId === folderFilter);
      const text = `${note.title} ${note.body}`.toLocaleLowerCase();
      return folderMatches && (!query || text.includes(query));
    });
  }, [folderFilter, orderedNotes, search]);
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    if (!selectedNoteId && visibleNotes.length) setSelectedNoteId(visibleNotes[0].id);
    if (selectedNoteId && !notes.some((note) => note.id === selectedNoteId)) setSelectedNoteId(visibleNotes[0]?.id ?? "");
  }, [notes, selectedNoteId, visibleNotes]);

  useEffect(() => {
    if (!selectedNoteId || !selectedNote) return;
    setDraft({ title: selectedNote.title, body: selectedNote.body, kind: selectedNote.kind, folderId: selectedNote.folderId, taskId: selectedNote.taskId, appointmentId: selectedNote.appointmentId });
    setSaveState("saved");
  // A different selected ID starts the editor draft; snapshot updates to the
  // current note must not replace text the user is actively changing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  useEffect(() => {
    if (!user || !selectedNoteId || !draft || !dirty) return;
    if (!draft.title.trim() || draft.title.trim().length > 160 || draft.body.length > 20000) {
      setSaveState("error");
      setError(!draft.title.trim() ? "A note needs a title before it can be saved." : "Notes are limited to 20,000 characters.");
      return;
    }
    const savingVersion = version.current;
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void updateNote(user.uid, selectedNoteId, draft).then(() => {
        if (version.current === savingVersion) { setDirty(false); setSaveState("saved"); setError(""); }
      }).catch((value: unknown) => {
        if (version.current === savingVersion) { setSaveState("error"); setError(errorMessage(value)); }
      });
    }, 700);
    return () => { if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null; } };
  }, [dirty, draft, selectedNoteId, user]);

  function changeDraft(change: Partial<NoteInput>) {
    if (change.body !== undefined && change.body.length > 20000) {
      setSaveState("error"); setError("Notes are limited to 20,000 characters.");
      return;
    }
    version.current += 1;
    setDraft((current) => current ? { ...current, ...change } : current);
    setDirty(true);
    setSaveState("saving");
    setError("");
  }

  async function flushDraft() {
    if (!user || !dirty || !draft || !selectedNoteId) return true;
    if (saveTimer.current !== null) { window.clearTimeout(saveTimer.current); saveTimer.current = null; }
    const pendingVersion = version.current;
    const pendingDraft = draft;
    try {
      await updateNote(user.uid, selectedNoteId, pendingDraft);
      if (version.current !== pendingVersion) return false;
      setDirty(false); setSaveState("saved"); setError("");
      return true;
    } catch (value) {
      setSaveState("error"); setError(errorMessage(value));
      return false;
    }
  }

  async function addNote() {
    if (!user) return;
    if (!await flushDraft()) return;
    const input: NoteInput = { title: "Untitled note", body: "", kind: "plain", folderId: folderFilter !== "all" && folderFilter !== "unfiled" ? folderFilter : null, taskId: null, appointmentId: null };
    try {
      const id = await createNote(user.uid, input);
      version.current += 1;
      setSelectedNoteId(id); setDraft(input); setDirty(false); setSaveState("saved"); setError("");
    } catch (value) { setError(errorMessage(value)); }
  }

  async function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();
    if (!user || !name || name.length > 60) return;
    try { await createNoteFolder(user.uid, name); setFolderName(""); setShowFolderForm(false); setError(""); }
    catch (value) { setError(errorMessage(value)); }
  }

  async function saveRenameFolder(folderId: string) {
    const name = renameValue.trim();
    if (!user || !name || name.length > 60) return;
    try { await renameNoteFolder(user.uid, folderId, name); setRenamingFolder(null); setError(""); }
    catch (value) { setError(errorMessage(value)); }
  }

  async function removeSelectedNote() {
    if (!user || !selectedNoteId) return;
    try { await deleteNote(user.uid, selectedNoteId); setSelectedNoteId(""); setDraft(null); setDirty(false); setConfirmDelete(false); setError(""); }
    catch (value) { setError(errorMessage(value)); }
  }

  async function selectNote(note: LifeNote) {
    if (!await flushDraft()) return;
    version.current += 1;
    setSelectedNoteId(note.id); setDraft({ title: note.title, body: note.body, kind: note.kind, folderId: note.folderId, taskId: note.taskId, appointmentId: note.appointmentId });
    setDirty(false); setSaveState("saved"); setConfirmDelete(false);
  }

  function changeKind(kind: NoteKind) {
    if (!draft || kind === draft.kind) return;
    changeDraft({ kind, body: kind === "checklist" ? plainToChecklist(draft.body) : checklistToPlain(draft.body) });
  }

  function updateChecklist(index: number, change: Partial<ChecklistItem>) {
    if (!draft) return;
    const items = checklistItems(draft.body);
    items[index] = { ...items[index], ...change };
    changeDraft({ body: checklistBody(items) });
  }

  const checklistCount = draft?.kind === "checklist" ? checklistItems(draft.body) : [];
  const doneCount = checklistCount.filter((item) => item.checked).length;

  return <div className="notes-page">
    <header className="notes-heading"><div><p className="text-eyebrow">THOUGHTS, READY WHEN YOU ARE</p><h1 className="heading-display">Notes</h1></div><Button onClick={() => void addNote()} variant="primary">＋ New note</Button></header>
    {error && <p className="tasks-error" role="alert">{error}</p>}
    <div className="notes-workspace">
      <Card className="notes-sidebar" padding="compact">
        <label className="task-search"><span aria-hidden="true">⌕</span><input aria-label="Search notes" onChange={(event) => setSearch(event.target.value)} placeholder="Search notes" value={search} /></label>
        <div className="notes-folder-list" aria-label="Note folders">
          <button className={folderFilter === "all" ? "notes-folder is-selected" : "notes-folder"} onClick={() => setFolderFilter("all")} type="button">All notes <span>{notes.length}</span></button>
          <button className={folderFilter === "unfiled" ? "notes-folder is-selected" : "notes-folder"} onClick={() => setFolderFilter("unfiled")} type="button">Unfiled <span>{notes.filter((note) => !note.folderId).length}</span></button>
          {folders.map((folder) => <div className="notes-folder-row" key={folder.id}>{renamingFolder === folder.id ? <div className="notes-rename"><input aria-label="Folder name" maxLength={60} onChange={(event) => setRenameValue(event.target.value)} value={renameValue} /><Button onClick={() => void saveRenameFolder(folder.id)} variant="ghost">Save</Button><Button onClick={() => setRenamingFolder(null)} variant="ghost">×</Button></div> : <><button className={folderFilter === folder.id ? "notes-folder is-selected" : "notes-folder"} onClick={() => setFolderFilter(folder.id)} type="button">{folder.name}<span>{notes.filter((note) => note.folderId === folder.id).length}</span></button><Button aria-label={`Rename ${folder.name}`} onClick={() => { setRenamingFolder(folder.id); setRenameValue(folder.name); }} variant="ghost">···</Button></>}</div>)}
        </div>
        {showFolderForm ? <form className="notes-folder-form" onSubmit={(event) => void addFolder(event)}><input autoFocus aria-label="New folder name" maxLength={60} onChange={(event) => setFolderName(event.target.value)} placeholder="Folder name" value={folderName} /><Button disabled={!folderName.trim()} type="submit" variant="secondary">Create</Button></form> : <Button className="notes-add-folder" onClick={() => setShowFolderForm(true)} variant="ghost">＋ New folder</Button>}
        <div className="notes-index" aria-label="Notes">{loading ? <p className="text-muted">Loading notes…</p> : visibleNotes.length === 0 ? <p className="notes-index-empty">{search ? "No notes match your search." : "No notes in this view yet."}</p> : visibleNotes.map((note) => <button aria-current={selectedNoteId === note.id ? "page" : undefined} className={selectedNoteId === note.id ? "notes-index-item is-selected" : "notes-index-item"} key={note.id} onClick={() => selectNote(note)} type="button"><strong>{note.title || "Untitled note"}</strong><span>{notePreview(note)}</span><small>{relativeEdited(note)}</small></button>)}</div>
      </Card>
      {draft && selectedNoteId ? <Card className="notes-editor">
        <div className="notes-editor-toolbar"><span className={`notes-save-state is-${saveState}`} role="status">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}</span><div>{confirmDelete ? <><span className="notes-delete-question">Delete this note?</span><Button onClick={() => void removeSelectedNote()} variant="ghost">Confirm</Button><Button onClick={() => setConfirmDelete(false)} variant="ghost">Keep note</Button></> : <Button onClick={() => setConfirmDelete(true)} variant="ghost">Delete</Button>}</div></div>
        <input className="notes-title-input" aria-label="Note title" maxLength={160} onChange={(event) => changeDraft({ title: event.target.value })} placeholder="Untitled note" value={draft.title} />
        <div className="notes-meta-fields"><label className="task-field"><span>Type</span><select onChange={(event) => changeKind(event.target.value as NoteKind)} value={draft.kind}><option value="plain">Plain text</option><option value="checklist">Checklist</option></select></label><label className="task-field"><span>Folder</span><select onChange={(event) => changeDraft({ folderId: event.target.value || null })} value={draft.folderId ?? ""}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label className="task-field"><span>Link task <small>(optional)</small></span><select onChange={(event) => changeDraft({ taskId: event.target.value || null })} value={draft.taskId ?? ""}><option value="">No task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="task-field"><span>Link appointment <small>(optional)</small></span><select onChange={(event) => changeDraft({ appointmentId: event.target.value || null })} value={draft.appointmentId ?? ""}><option value="">No appointment</option>{appointments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
        {draft.kind === "plain" ? <textarea className="notes-body-input" aria-label="Note text" maxLength={20000} onChange={(event) => changeDraft({ body: event.target.value })} placeholder="Start writing…" value={draft.body} /> : <div className="notes-checklist"><div className="notes-checklist-summary">{doneCount} of {checklistCount.length} complete</div>{checklistCount.map((item, index) => <div className="notes-checklist-row" key={index}><input aria-label={`Mark ${item.text || "item"} complete`} checked={item.checked} onChange={(event) => updateChecklist(index, { checked: event.target.checked })} type="checkbox" /><input aria-label={`Checklist item ${index + 1}`} maxLength={1000} onChange={(event) => updateChecklist(index, { text: event.target.value })} placeholder="Checklist item" value={item.text} /><Button aria-label="Remove checklist item" onClick={() => changeDraft({ body: checklistBody(checklistCount.filter((_, itemIndex) => itemIndex !== index)) })} variant="ghost">×</Button></div>)}<Button onClick={() => changeDraft({ body: checklistBody([...checklistCount, { text: "", checked: false }]) })} variant="ghost">＋ Add item</Button></div>}
        <div className="notes-editor-footer"><span>{draft.kind === "checklist" ? `${doneCount}/${checklistCount.length} items complete` : `${draft.body.length.toLocaleString()} / 20,000 characters`}</span><span>{[draft.taskId && `Task: ${tasks.find((task) => task.id === draft.taskId)?.title ?? "Unavailable"}`, draft.appointmentId && `Appointment: ${appointments.find((item) => item.id === draft.appointmentId)?.title ?? "Unavailable"}`].filter(Boolean).join(" · ") || "Private to your account"}</span></div>
      </Card> : <Card className="notes-empty"><span aria-hidden="true">✦</span><h2>{loading ? "Loading your notes…" : "A quiet place for your thoughts"}</h2><p>{loading ? "" : "Create a note or checklist to get started."}</p>{!loading && <Button onClick={() => void addNote()} variant="secondary">Create a note</Button>}</Card>}
    </div>
  </div>;
}
