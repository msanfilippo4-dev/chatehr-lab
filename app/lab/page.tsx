export default function LabInstructionsPage() {
  return (
    <div className="space-y-4">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-[#122033]">ChatEHR Lab Instructions</h1>
        <p className="t-body t-secondary mt-2">
          Use this page to complete the Fordham AI-in-Healthcare assignment. The live
          workspace is available at{" "}
          <a
            href="/"
            className="font-semibold text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
          >
            fordms.com
          </a>
          .
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Before You Start</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 t-body t-secondary">
          <li>Select one patient in the Patient Lookup panel.</li>
          <li>Keep the Lab Worksheet open while you run experiments.</li>
          <li>Record token/cost usage shown in the session summary.</li>
        </ul>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Directed Aha Cases (Question Paths Only)</h2>
        <div className="mt-2 space-y-3 t-body t-secondary">
          <p>
            Use these three records to trigger your own &quot;aha&quot; findings. This page is
            intentionally not an answer key. In Patient Lookup, search by ID:{" "}
            <strong>LAB-001</strong>, <strong>LAB-002</strong>, and <strong>LAB-003</strong>.
          </p>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">
              LAB-001 Elena Morales: medication safety + minimum-necessary context
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Starter prompt: &quot;What should we do for leg cramps or knee pain today?&quot;</li>
              <li>Follow-up: ask the same question at LIMITED, STANDARD, and FULL context.</li>
              <li>Probe: ask &quot;What details in this chart most changed your recommendation?&quot;</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">
              LAB-002 Jordan Patel: RAG grounding for evidence-based escalation
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Starter prompt: &quot;How should we optimize diabetes and lipid therapy right now?&quot;</li>
              <li>Run twice: RAG OFF, then RAG ON.</li>
              <li>Probe: ask for a plan with rationale and confidence/uncertainty notes.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">
              LAB-003 Sofia Nguyen: privacy leakage risk vs targeted clinical reasoning
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Starter prompt: &quot;Summarize key care risks for pregnancy planning.&quot;</li>
              <li>Compare the response at STANDARD vs FULL context.</li>
              <li>Probe: ask &quot;What information can be omitted while keeping this safe?&quot;</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Required Workflow</h2>
        <ol className="list-decimal pl-5 mt-2 space-y-2 t-body t-secondary">
          <li>
            Select one model in <strong>Lab Configuration</strong>, run your prompt, then
            switch models and compare speed/style.
          </li>
          <li>
            Restore a valid model, then compare answers with a blank system instruction
            vs. an explicit safety-focused instruction.
          </li>
          <li>
            Ask the same question at temperature <strong>1.0</strong> and then{" "}
            <strong>0.0</strong>; compare consistency and wording.
          </li>
          <li>
            Run the same query at different context levels (LIMITED, STANDARD, FULL) and
            determine minimum necessary context.
          </li>
          <li>
            Toggle RAG on/off and compare specificity, guideline grounding, and uncertainty.
          </li>
          <li>
            Identify one safety risk and one practical mitigation control.
          </li>
        </ol>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Helpful Workflow Cases (Concise, No Answer Key)</h2>
        <p className="t-body t-secondary mt-2">
          Use 2-3 of these in class to show where a ChatEHR-style tool can reduce
          chart review burden. Capture what was useful, what was missing, and what
          needed verification.
        </p>
        <div className="mt-3 space-y-3 t-body t-secondary">
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">Case A: Rapid Pre-Round Summary (8 min)</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Prompt: &quot;Give me a 6-bullet pre-round summary for this patient.&quot;</li>
              <li>Ask for: active diagnoses, key abnormal labs, current meds, and immediate watchouts.</li>
              <li>Validation task: verify each bullet against chart tabs and flag any mismatch.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">Case B: Diagnosis Timeline Compression (8 min)</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Prompt: &quot;Build a timeline of major diagnoses, labs, and treatment changes.&quot;</li>
              <li>Ask follow-up: &quot;What are the 2 most important trend changes?&quot;</li>
              <li>Validation task: confirm dates and sequence from the chart.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">Case C: Handoff Drafting (8 min)</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Prompt: &quot;Draft a concise handoff: one-liner, active issues, pending items, overnight risks.&quot;</li>
              <li>Ask follow-up: &quot;Which statements are uncertain and need clinician confirmation?&quot;</li>
              <li>Validation task: remove unsupported items and rewrite for safety.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="font-semibold text-[#122033]">Case D: Panel-Style Query (Toy Extension, 6 min)</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>Example question: &quot;Show me patients with uncontrolled diabetes and no recent follow-up.&quot;</li>
              <li>This UI is patient-at-a-time; run as a design exercise or by sampling multiple records.</li>
              <li>Discussion task: define required filters, safety checks, and who can access results.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Suggested 60-Minute Flow</h2>
        <ol className="list-decimal pl-5 mt-2 space-y-2 t-body t-secondary">
          <li>10 min: orientation + choose one directed patient case (LAB-001/002/003).</li>
          <li>20 min: complete the 6 required workflow experiments.</li>
          <li>15 min: run two helpful workflow cases (A-D) and record observations.</li>
          <li>10 min: compare outputs across groups (speed, utility, safety, privacy).</li>
          <li>5 min: finalize worksheet and submission notes.</li>
        </ol>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Aha Observation Checklist</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 t-body t-secondary">
          <li>What changed when you changed only one variable (model, RAG, context, temperature)?</li>
          <li>Which recommendation became safer or less safe, and why?</li>
          <li>Where did the model sound confident without enough support?</li>
          <li>What is your minimum-necessary context decision for this task?</li>
          <li>What governance control would prevent the failure mode you observed?</li>
        </ul>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">What To Submit</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 t-body t-secondary">
          <li>Completed responses for all 6 worksheet prompts.</li>
          <li>Patient used for testing.</li>
          <li>Total session tokens and estimated cost.</li>
        </ul>
      </section>
    </div>
  );
}
