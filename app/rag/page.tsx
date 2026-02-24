import { getRagExampleChunks, loadRagCorpus } from "@/lib/rag-corpus";

function clip(text: string, max = 260): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

export default async function RagPage() {
  const { chunks, fileSummaries, sourceSummaries, warnings } = await loadRagCorpus();
  const examples = getRagExampleChunks(chunks, 7);
  const totalChunks = chunks.length;
  const uniqueKeywords = new Set(
    chunks.flatMap((chunk) => chunk.keywords.map((keyword) => keyword.toLowerCase()))
  ).size;

  return (
    <div className="space-y-4">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-[#122033]">RAG Database Guide</h1>
        <p className="t-body t-secondary mt-2">
          This page shows what is in the lab&apos;s RAG corpus, how retrieval works, and why it
          improves guideline-grounded answers.
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6 space-y-3">
        <h2 className="t-heading t-primary">What RAG Does Here</h2>
        <p className="t-body t-secondary">
          In this app, RAG retrieves relevant guideline chunks and appends them to the model
          context before chat generation. It does not replace chart evidence or clinician review;
          it gives the model policy/guideline scaffolding during answers.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Guideline Files" value={fileSummaries.length.toString()} />
          <Stat label="Indexed Chunks" value={totalChunks.toString()} />
          <Stat label="Unique Keywords" value={uniqueKeywords.toString()} />
        </div>
      </section>

      <section className="ehr-shell p-5 md:p-6 space-y-3">
        <h2 className="t-heading t-primary">What Is in the RAG Database</h2>
        <p className="t-caption t-secondary">
          Corpus location: <span className="font-mono">public/data/guidelines/*.json</span>
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="t-caption font-semibold text-[#122033] mb-1.5">By Source</p>
            <ul className="list-disc pl-5 t-caption text-[#4c637f] space-y-1">
              {sourceSummaries.map((source) => (
                <li key={source.source}>
                  {source.source}: {source.chunkCount} chunks
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
            <p className="t-caption font-semibold text-[#122033] mb-1.5">By File</p>
            <ul className="list-disc pl-5 t-caption text-[#4c637f] space-y-1">
              {fileSummaries.map((file) => (
                <li key={file.file}>
                  <span className="font-mono">{file.file}</span>: {file.chunkCount} chunks
                </li>
              ))}
            </ul>
          </div>
        </div>
        {warnings.length > 0 && (
          <div className="rounded-lg border border-[#f0c4c4] bg-[#fff6f6] px-3 py-2.5">
            <p className="t-caption font-semibold text-[#8C1515]">Corpus Warnings</p>
            <ul className="list-disc pl-5 mt-1 t-caption text-[#8C1515] space-y-0.5">
              {warnings.map((warning, idx) => (
                <li key={`${warning.file}-${idx}`}>
                  {warning.file}: {warning.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="ehr-shell p-5 md:p-6 space-y-3">
        <h2 className="t-heading t-primary">Real Chunk Examples</h2>
        <p className="t-caption t-secondary">
          These are actual indexed entries (ID, source, title, snippet, keywords).
        </p>
        {examples.length === 0 ? (
          <p className="t-caption text-[#8C1515]">No chunks available.</p>
        ) : (
          <div className="space-y-2">
            {examples.map((chunk) => (
              <div
                key={chunk.id}
                className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-1.5"
              >
                <p className="t-caption text-[#4c637f]">
                  <span className="font-mono">{chunk.id}</span> · {chunk.source}
                </p>
                <p className="font-semibold text-[#122033]">{chunk.title}</p>
                <p className="t-caption text-[#4c637f]">{clip(chunk.text)}</p>
                <div className="flex flex-wrap gap-1">
                  {chunk.keywords.slice(0, 6).map((keyword) => (
                    <span
                      key={`${chunk.id}-${keyword}`}
                      className="rounded bg-[#e9eff8] px-1.5 py-0.5 t-micro text-[#4c637f]"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ehr-shell p-5 md:p-6 space-y-3">
        <h2 className="t-heading t-primary">How This RAG Is Built</h2>
        <ol className="list-decimal pl-5 t-body t-secondary space-y-1">
          <li>Curate guideline text into JSON chunks with `id`, `source`, `title`, `text`, `keywords`.</li>
          <li>Load all chunks from the five guideline files in `/public/data/guidelines`.</li>
          <li>At query time, tokenize question + supplemental patient terms and remove stop words.</li>
          <li>Score chunks by keyword/title/body matches, rank them, return top 3, and append to model context.</li>
        </ol>
        <p className="t-caption text-[#4c637f]">
          Retrieval engine: <span className="font-mono">lib/rag-retrieval.ts</span> · API:
          <span className="font-mono"> /api/rag</span>
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Why It Helps (and Limits)</h2>
        <ul className="list-disc pl-5 mt-2 t-body t-secondary space-y-1">
          <li>
            Helpful for targeted, guideline-driven prompts (for example A1c goals, statin intensity,
            BP targets).
          </li>
          <li>Improves answer grounding by injecting explicit guideline snippets into context.</li>
          <li>
            Limitation: this is keyword retrieval, not semantic vector search, so lexical mismatch can
            miss relevant chunks.
          </li>
          <li>
            Best practice in lab: compare RAG OFF vs ON and cite retrieved chunk titles in your notes.
          </li>
        </ul>
        <p className="t-caption mt-2">
          <a
            href="/"
            className="font-semibold text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
          >
            Back to workspace
          </a>
          {" · "}
          <a
            href="/lab"
            className="font-semibold text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
          >
            Lab instructions
          </a>
          {" · "}
          <a
            href="/submissions"
            className="font-semibold text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
          >
            Submissions
          </a>
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] px-3 py-2.5">
      <p className="t-caption text-[#4c637f]">{label}</p>
      <p className="text-lg font-semibold text-[#122033]">{value}</p>
    </div>
  );
}
