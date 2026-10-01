"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api";
import { EHRGO_FILE_ACCEPT, EHRGO_FILE_TYPES, EHRGO_MAX_UPLOAD_BYTES, type EhrgoSubmission } from "@/lib/ehrgo-materials";
import { uploadFile } from "./upload-file";

export default function SubmitAnswerSheet({ activities }: { activities: { id: string; title: string }[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [percent, setPercent] = useState(0);
  const [confirmation, setConfirmation] = useState<{ id: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage(null);
    let receipt = confirmation;
    if (!receipt) {
      const file = fileInput.current?.files?.[0];
      const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
      if (!file || !Object.hasOwn(EHRGO_FILE_TYPES, extension) || file.size === 0 || file.size > EHRGO_MAX_UPLOAD_BYTES) {
        setMessage({ text: "Choose a nonempty answer-sheet file, up to 50 MB.", error: true }); return;
      }
    }
    setBusy(true);
    setPercent(0);
    try {
      if (!receipt) {
        const file = fileInput.current!.files![0];
        setStage("Preparing submission…");
        const prepared = await postJson<{ id: string; signedUrl: string; contentType: string }>("/api/ehrgo/submissions", { activityId, name: file.name, bytes: file.size });
        setStage("Uploading answer sheet…");
        await uploadFile(prepared.signedUrl, file, prepared.contentType, setPercent);
        receipt = { id: prepared.id };
        setConfirmation(receipt);
      }
      setStage("Confirming submission…");
      const { submission } = await postJson<{ submission: EhrgoSubmission }>("/api/ehrgo/submissions/complete", { id: receipt.id });
      const time = new Date(submission.submittedAt).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
      setMessage({ text: `Submission received: ${submission.name} · ${time} ET. Your instructor can now review it. Receipt: ${submission.id}.`, error: false });
      setConfirmation(null);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage({ text: `${error instanceof Error ? error.message : "Your answer sheet could not be submitted."} If the problem continues, email your instructor with the file attached.`, error: true });
    } finally { setBusy(false); setStage(""); }
  }

  return (
    <section id="submit-answer-sheet" className="materials-upload" aria-labelledby="submission-heading">
      <h2 id="submission-heading">Submit your answer sheet</h2>
      <p>Upload your completed worksheet for instructor review. Your file is visible to you and course faculty. If you have trouble submitting, email your instructor with the file attached.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || !!confirmation}>
          <label htmlFor="submission-activity">Assignment</label>
          <select id="submission-activity" value={activityId} onChange={(event) => setActivityId(event.target.value)}>
            {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
          </select>
          <label htmlFor="submission-file">Completed answer sheet</label>
          <input id="submission-file" ref={fileInput} type="file" accept={EHRGO_FILE_ACCEPT} aria-describedby="submission-help" />
          <small id="submission-help">PDF, DOCX, XLSX, PPTX, CSV, TXT, ZIP, PNG, or JPG · Maximum 50 MB per file</small>
        </fieldset>
        <button className="primary" type="submit" disabled={busy}>{busy ? stage : confirmation ? "Confirm answer-sheet submission" : "Submit answer sheet"}</button>
        {confirmation && !busy && <button className="materials-upload-restart" type="button" onClick={() => {
          setConfirmation(null); setMessage(null);
          if (fileInput.current) fileInput.current.value = "";
        }}>Choose another answer sheet</button>}
        {busy && stage === "Uploading answer sheet…" && <progress max={100} value={percent} aria-label="Answer-sheet upload progress">{percent}%</progress>}
        {message && <p className={`materials-upload-message ${message.error ? "error" : "success"}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
      </form>
    </section>
  );
}
