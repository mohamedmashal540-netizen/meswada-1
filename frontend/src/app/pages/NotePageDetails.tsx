import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Sparkles,
  Languages,
  Wand2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIntl } from "react-intl";
import { useAuth } from "@clerk/react";
import useNotesApi from "@/hooks/useNotesApi";
import useAiApi, { type RewriteMode } from "@/hooks/useAiApi";
import type { Note } from "@/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type AiKind = "summarize" | "rewrite" | "translate";

const AUTOSAVE_DELAY_MS = 1200;

function NotePageDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const intl = useIntl();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { getNoteById, updateNote, createNote, deleteNote } = useNotesApi();
  const { summarize, rewrite, translate } = useAiApi();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // local editable state
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");

  // The persisted note id. Undefined until the note is actually saved once
  // (either manually or via autosave), even when the route starts at /new.
  const [localNoteId, setLocalNoteId] = useState<string | undefined>(
    id && id !== "new" ? id : undefined
  );
  const isNewNote = !localNoteId;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [aiLoading, setAiLoading] = useState<AiKind | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultKind, setAiResultKind] = useState<AiKind | null>(null);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>("formal");

  const hasLoadedRef = useRef(false);
  const skipNextAutosaveRef = useRef(true);
  const autosaveTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // 2. السر هنا: لو Clerk لسه بيحمل، متعملش حاجة واستنى
    if (!isLoaded) return;

    const fetchNoteData = async () => {
      const token = await getToken();

      if (id && id !== "new") {
        // متعملش fetch تاني لملاحظة اتحملت خلاص محليًا (بعد إن الـ auto-save
        // عمل create وبدّل الـ URL بـ replace navigate)
        if (id === localNoteId && note) {
          setLoading(false);
          hasLoadedRef.current = true;
          return;
        }

        if (token) {
          const data = await getNoteById(id, token);
          if (data) {
            setNote(data);
            setTitle(data.title || "");
            setContent(data.content || "");
            setLocalNoteId(data.id || data._id || id);
          }
        }
      }

      setLoading(false);
      hasLoadedRef.current = true;
      skipNextAutosaveRef.current = true;
    };

    fetchNoteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getToken, getNoteById, isLoaded]);

  const handleBack = () => navigate("/");

  // منطق الحفظ الموحّد: بيستخدمه الحفظ اليدوي والـ auto-save مع بعض
  const persistNote = async (opts: { silent: boolean }): Promise<boolean> => {
    if (!isSignedIn) {
      if (!opts.silent) {
        toast.error(intl.formatMessage({ id: "toast.signInFirst" }));
        navigate("/sign-in");
      }
      return false;
    }

    const token = await getToken();
    if (!token) {
      if (!opts.silent) {
        toast.error(intl.formatMessage({ id: "toast.authRequired" }));
        navigate("/sign-in");
      }
      return false;
    }

    if (!localNoteId) {
      const created = await createNote({ title, content }, token);
      const newId = created?.id || created?._id;
      if (created && newId) {
        setNote(created);
        setLocalNoteId(newId);
        // replace يمنع تراكم history entries، وميعملش re-fetch بسبب الشرط فوق
        navigate(`/notes/${newId}`, { replace: true });
        if (!opts.silent) toast.success(intl.formatMessage({ id: "toast.created" }));
        return true;
      }
      if (!opts.silent) toast.error(intl.formatMessage({ id: "toast.createdFail" }));
      return false;
    }

    const updated = await updateNote(localNoteId, { title, content }, token);
    if (updated) {
      setNote(updated);
      if (!opts.silent) toast.success(intl.formatMessage({ id: "toast.updated" }));
      return true;
    }
    if (!opts.silent) toast.error(intl.formatMessage({ id: "toast.updatedFail" }));
    return false;
  };

  const handleSave = async () => {
    const ok = await persistNote({ silent: false });
    if (ok) navigate("/");
  };

  // 106. Auto-Save: بيتفعّل مع كل تغيير في العنوان أو المحتوى بعد ما التحميل
  // الأولي يخلص، مع debounce عشان منضربش الـ API مع كل حرف.
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (!title.trim() && !content.trim()) return;

    if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    setSaveStatus("saving");

    autosaveTimeoutRef.current = window.setTimeout(async () => {
      const ok = await persistNote({ silent: true });
      setSaveStatus(ok ? "saved" : "error");
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  const handleDeleteConfirmed = async () => {
    if (!localNoteId) return;
    setIsDeleting(true);
    const token = await getToken();
    if (!token) {
      toast.error(intl.formatMessage({ id: "toast.authRequired" }));
      setIsDeleting(false);
      return;
    }
    const ok = await deleteNote(localNoteId, token);
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    if (ok) {
      toast.success(intl.formatMessage({ id: "toast.deleted" }));
      navigate("/");
    } else {
      toast.error(intl.formatMessage({ id: "toast.deletedFail" }));
    }
  };

  // 107 / 109 / 110: أدوات الذكاء الاصطناعي - بتشتغل على المحتوى الحالي في
  // المحرر مباشرة (مش لازم تحفظ الملاحظة الأول).
  const runAi = async (kind: AiKind) => {
    if (!content.trim()) {
      toast.error(intl.formatMessage({ id: "note.ai.emptyText" }));
      return;
    }
    const token = await getToken();
    if (!token) {
      toast.error(intl.formatMessage({ id: "toast.authRequired" }));
      return;
    }

    setAiLoading(kind);
    setAiResult(null);
    try {
      let result: string | null = null;
      if (kind === "summarize") result = await summarize({ text: content }, token);
      else if (kind === "rewrite") result = await rewrite({ text: content }, rewriteMode, token);
      else result = await translate({ text: content }, token);

      if (result) {
        setAiResult(result);
        setAiResultKind(kind);
      } else {
        toast.error(intl.formatMessage({ id: "note.ai.error" }));
      }
    } finally {
      setAiLoading(null);
    }
  };

  const applyResultToContent = () => {
    if (!aiResult) return;
    setContent(aiResult);
    setAiResult(null);
    setAiResultKind(null);
    toast.success(intl.formatMessage({ id: "note.ai.contentUpdated" }));
  };

  const saveResultAsSummary = async () => {
    if (!aiResult || !localNoteId) return;
    const token = await getToken();
    if (!token) return;
    const updated = await updateNote(localNoteId, { summary: aiResult }, token);
    if (updated) {
      setNote(updated);
      toast.success(intl.formatMessage({ id: "note.ai.summarySaved" }));
      setAiResult(null);
      setAiResultKind(null);
    } else {
      toast.error(intl.formatMessage({ id: "toast.updatedFail" }));
    }
  };

  // 4. عرض التحميل لو Clerk لسه بيحمل أو الداتا لسه بتيجي
  if (!isLoaded || loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>{intl.formatMessage({ id: "note.loadingDetails" })}</p>
      </div>
    );
  }

  // 5. حالة الخطأ (لو بنعدل نوتة قديمة والباك إند ملقاهاش بجد)
  if (!note && id !== "new") {
    return (
      <div className="text-center p-20">
        <h2 className="text-2xl font-bold mb-2">
          {intl.formatMessage({ id: "note.notFound" })}
        </h2>
        <Button onClick={handleBack} variant="outline">
          {intl.formatMessage({ id: "note.goBack" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="flex flex-col px-4 py-6 sm:px-10 gap-4">
        <div className="flex items-center justify-between">
          <Button onClick={handleBack} variant="outline" className="cursor-pointer">
            <ArrowLeft className="me-2 h-4 w-4" />
            {intl.formatMessage({ id: "note.back" })}
          </Button>

          <h1 className="text-xl font-bold">
            {isNewNote
              ? intl.formatMessage({ id: "note.new" })
              : intl.formatMessage({ id: "note.edit" })}
          </h1>

          <div className="flex items-center gap-2">
            {!isNewNote && (
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="me-2 h-4 w-4" />
                {intl.formatMessage({ id: "note.delete" })}
              </Button>
            )}

            <Button className="cursor-pointer bg-primary" onClick={handleSave}>
              <Save className="me-2 h-4 w-4" />
              {intl.formatMessage({ id: "note.save" })}
            </Button>
          </div>
        </div>

        {/* حالة الـ Auto-Save */}
        <div className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{intl.formatMessage({ id: "note.autosave.saving" })}</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>{intl.formatMessage({ id: "note.autosave.saved" })}</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span>{intl.formatMessage({ id: "note.autosave.error" })}</span>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <Input
            placeholder={intl.formatMessage({ id: "note.titlePlaceholder" })}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder={intl.formatMessage({ id: "note.contentPlaceholder" })}
            className="min-h-[200px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </GlassCard>

      {/* 107 / 109 / 110: أدوات الذكاء الاصطناعي */}
      <GlassCard className="flex flex-col px-4 py-6 sm:px-10 gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {intl.formatMessage({ id: "note.ai.title" })}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={aiLoading !== null}
            onClick={() => runAi("summarize")}
          >
            {aiLoading === "summarize" ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="me-2 h-4 w-4" />
            )}
            {intl.formatMessage({ id: "note.ai.summarize" })}
          </Button>

          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={aiLoading !== null}
            onClick={() => runAi("translate")}
          >
            {aiLoading === "translate" ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Languages className="me-2 h-4 w-4" />
            )}
            {intl.formatMessage({ id: "note.ai.translate" })}
          </Button>

          <div className="flex items-center gap-1.5">
            <select
              value={rewriteMode}
              onChange={(e) => setRewriteMode(e.target.value as RewriteMode)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              disabled={aiLoading !== null}
            >
              <option value="formal">{intl.formatMessage({ id: "note.ai.mode.formal" })}</option>
              <option value="casual">{intl.formatMessage({ id: "note.ai.mode.casual" })}</option>
              <option value="comedy">{intl.formatMessage({ id: "note.ai.mode.comedy" })}</option>
            </select>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={aiLoading !== null}
              onClick={() => runAi("rewrite")}
            >
              {aiLoading === "rewrite" ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="me-2 h-4 w-4" />
              )}
              {intl.formatMessage({ id: "note.ai.rewrite" })}
            </Button>
          </div>
        </div>

        {aiResult && (
          <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/60 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {intl.formatMessage({ id: "note.ai.resultTitle" })}
            </h3>
            <p className="whitespace-pre-wrap text-sm">{aiResult}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="cursor-pointer" onClick={() => setAiResult(null)}>
                {intl.formatMessage({ id: "note.ai.dismiss" })}
              </Button>
              {aiResultKind === "summarize" && !isNewNote && (
                <Button variant="outline" className="cursor-pointer" onClick={saveResultAsSummary}>
                  {intl.formatMessage({ id: "note.ai.saveSummary" })}
                </Button>
              )}
              <Button className="cursor-pointer" onClick={applyResultToContent}>
                {intl.formatMessage({ id: "note.ai.apply" })}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={intl.formatMessage({ id: "note.delete.confirmTitle" })}
        description={intl.formatMessage({ id: "note.delete.confirmDesc" })}
        confirmLabel={intl.formatMessage({ id: "note.delete.confirmAction" })}
        cancelLabel={intl.formatMessage({ id: "note.delete.confirmCancel" })}
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

export default NotePageDetails;
