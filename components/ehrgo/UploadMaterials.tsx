"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api";
import { EHRGO_FILE_ACCEPT, EHRGO_FILE_TYPES, EHRGO_MAX_UPLOAD_BYTES } from "@/lib/ehrgo-materials";
import { uploadFile } from "./upload-file";

export default function UploadMaterials({ activities }: { activities: { id: string; title: string }[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [audience, setAudience] = useState("instructor");
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState("");
  const [confirmation, setConfirmation] = useState<{ id: string; name: string; audience: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage(null);
    let receipt = confirmation;
    if (!receipt) {
      const file = fileInput.current?.files?.[0];
      if (!file) { setMessage({ text: "Choose a file to upload.", error: true }); return; }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!Object.hasOwn(EHRGO_FILE_TYPES, extension) || file.size === 0 || file.size > EHRGO_MAX_UPLOAD_BYTES) {
        setMessage({ text: "Choose a nonempty PDF, Office document, CSV, text file, ZIP, or image, up to 50 MB.", error: true }); return;
      }
    }
    setBusy(true);
    setPercent(0);
    try {
      if (!receipt) {
        const file = fileInput.current!.files![0];
        setStage("Preparing upload…");
        const prepared = await postJson<{ id: string; signedUrl: string; contentType: string }>("/api/ehrgo/uploads", { activityId, audience, name: file.name, bytes: file.size });
        setStage("Uploading file…");
        await uploadFile(prepared.signedUrl, file, prepared.contentType, setPercent);
        receipt = { id: prepared.id, name: file.name, audience };
        setConfirmation(receipt);
      }
      setStage("Confirming received file…");
      await postJson("/api/ehrgo/uploads/complete", { id: receipt.id });
      setMessage({ text: `${receipt.name} uploaded. ${receipt.audience === "student" ? "Available to students and faculty." : "Available to instructors and admins only."}`, error: false });
      setConfirmation(null);
      setAudience("instructor");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "The file could not be uploaded. Please try again.", error: true });
    } finally { setBusy(false); setStage(""); }
  }

  return (
    <section className="materials-upload" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Upload course material</h2>
      <p>Add a worksheet, dataset, reference, or faculty answer key. Faculty-only files are hidden from students.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || !!confirmation}>
          <label htmlFor="upload-activity">Activity</label>
          <select id="upload-activity" value={activityId} onChange={(event) => setActivityId(event.target.value)}>
            {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
          </select>
          <label htmlFor="upload-audience">Who can download this file?</label>
          <select id="upload-audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="instructor">Faculty only — answer keys and instructor resources</option>
            <option value="student">Students and faculty — worksheets, datasets, and references</option>
          </select>
          <label htmlFor="upload-file">Course file</label>
          <input id="upload-file" ref={fileInput} type="file" accept={EHRGO_FILE_ACCEPT} aria-describedby="upload-help" />
          <small id="upload-help">PDF, DOCX, XLSX, PPTX, CSV, TXT, ZIP, PNG, or JPG · Maximum 50 MB per file</small>
        </fieldset>
        <button className="primary" type="submit" disabled={busy}>{busy ? stage : confirmation ? "Confirm uploaded file" : "Upload file"}</button>
        {confirmation && !busy && <button className="materials-upload-restart" type="button" onClick={() => {
          setConfirmation(null); setMessage(null); setAudience("instructor");
          if (fileInput.current) fileInput.current.value = "";
        }}>Start another upload</button>}
        {busy && stage === "Uploading file…" && <progress max={100} value={percent} aria-label="File upload progress">{percent}%</progress>}
        {message && <p className={`materials-upload-message ${message.error ? "error" : "success"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
      </form>
    </section>
  );
}
