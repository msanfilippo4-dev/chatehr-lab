import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCourseUser } from "@/lib/server/session";
import { EHRGO_ACTIVITIES, EHRGO_PACKAGES, materialSize, visibleEhrgoFiles, type EhrgoActivity } from "@/lib/server/ehrgo";
import { Icon } from "@/components/ui/Icon";
import UploadMaterials from "@/components/ehrgo/UploadMaterials";
import { listUploadedEhrgoMaterials } from "@/lib/server/ehrgo-uploads";
import type { UploadedEhrgoMaterial } from "@/lib/ehrgo-materials";
import "./materials.css";

export const metadata: Metadata = { title: "EHR Go materials | FordMS" };
export const dynamic = "force-dynamic";

export default async function EhrgoMaterialsPage() {
  const user = await requireCourseUser().catch((error: unknown) => {
    if (error instanceof Error && ["UNAUTHORIZED", "DROPPED"].includes(error.message)) redirect("/login?callbackUrl=%2Fehrgo");
    throw error;
  });
  const instructor = user.role === "instructor" || user.role === "admin";
  const packages = EHRGO_PACKAGES.filter((item) => item.audience === "student" || instructor);
  const uploads = await listUploadedEhrgoMaterials(instructor);

  return (
    <div className="materials-shell">
      <a href="#main" className="skip-link">Skip to materials</a>
      <header className="topbar">
        <Link href="/" className="brand materials-brand">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span><strong>FordMS</strong><small>HINF 6105 · Fall 2026</small></span>
        </Link>
        <nav className="materials-nav" aria-label="Course navigation">
          <Link href="/">Practice EHR</Link>
          <Link href="/quizzes">Quizzes</Link>
          <Link href="/ehrgo" aria-current="page">EHR Go materials</Link>
        </nav>
      </header>

      <main id="main" className="materials-main">
        <div className="materials-heading">
          <p className="materials-kicker">Course resources</p>
          <h1>EHR Go materials</h1>
          <p>Download worksheets, datasets, and supporting readings, then open the matching activity in EHR Go. Follow your Blackboard assignment instructions and submit completed work there.</p>
          <a className="materials-access" href="https://slides.fordms.com/ehrgo" target="_blank" rel="noopener noreferrer">EHR Go account setup and course access <Icon name="arrow" size={15} /></a>
        </div>

        <div className="materials-packages" aria-label="Download packages">
          {packages.map((item) => (
            <a className="materials-package" key={item.id} href={`/api/ehrgo/downloads/${item.id}`}>
              <Icon name={item.audience === "student" ? "book" : "shield"} size={25} />
              <span><strong>{item.audience === "student" ? "Download student materials ZIP" : "Download faculty answer keys ZIP"}</strong><small>{item.audience === "student" ? "42 original worksheets, datasets, and references" : "13 original keys · Instructor access"} · ZIP · {materialSize(item.bytes)}</small></span>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
        {uploads.length > 0 && <p className="materials-package-note">Newly uploaded files are listed under their activity below and are downloaded individually.</p>}
        {instructor && <UploadMaterials activities={EHRGO_ACTIVITIES.map(({ id, title }) => ({ id, title }))} />}

        <section className="materials-section" aria-labelledby="assigned-heading">
          <h2 id="assigned-heading">Assigned activities</h2>
          <p>For Activity 1, use the answer sheet assigned to you in Blackboard. The EHR Orientation worksheet below supports your chart review.</p>
          <div className="materials-grid">
            {EHRGO_ACTIVITIES.filter((item) => item.category === "assigned").map((item) => <Activity key={item.id} activity={item} instructor={instructor} uploads={uploads} assigned />)}
          </div>
        </section>

        <section className="materials-section" aria-labelledby="analytics-heading">
          <h2 id="analytics-heading">Data querying and analytics</h2>
          <p>Your instructor will identify the exercise for Activity 2, due November 15. These query prerequisites and analytics activities are available for preparation and practice.</p>
          <div className="materials-grid">
            {EHRGO_ACTIVITIES.filter((item) => item.category === "analytics").map((item) => <Activity key={item.id} activity={item} instructor={instructor} uploads={uploads} />)}
          </div>
        </section>

        <section className="materials-section" aria-labelledby="practice-heading">
          <h2 id="practice-heading">Additional practice</h2>
          <p>Terminology, patient identity, and implementation resources for course demonstrations and optional practice. The implementation example supports practice; use the Crescent Health instructions for your graded paper.</p>
          <div className="materials-grid">
            {EHRGO_ACTIVITIES.filter((item) => item.category === "practice").map((item) => <Activity key={item.id} activity={item} instructor={instructor} uploads={uploads} />)}
          </div>
        </section>
      </main>
      <footer><span>Fordham HINF 6105 · EHR Go course materials</span><span>Resource copies retrieved September 30, 2026</span></footer>
    </div>
  );
}

function Activity({ activity, instructor, uploads, assigned = false }: { activity: EhrgoActivity; instructor: boolean; uploads: UploadedEhrgoMaterial[]; assigned?: boolean }) {
  const files = [...uploads.filter((file) => file.activityId === activity.id), ...visibleEhrgoFiles(activity.id, instructor)];
  const due = activity.due ? new Date(activity.due).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" }) : null;
  return (
    <article className="materials-card">
      <div className="materials-card-heading">
        <span className="materials-label">{assigned ? (activity.id === "74" ? "Activity 1" : "Activity 3") : activity.category === "analytics" ? "Preparation & practice" : "Optional practice"}</span>
        <h3>{activity.title}</h3>
        {due && <p className="materials-due">Due {due} · 11:59 p.m. ET</p>}
      </div>
      <a className="materials-open" href={activity.url} target="_blank" rel="noopener noreferrer">Open activity in EHR Go <Icon name="arrow" size={14} /></a>
      <details className="materials-files" open={assigned}>
        <summary>Download files <span>{files.length}</span></summary>
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <a href={`/api/ehrgo/downloads/${file.id}`}>
                <span>{file.name}</span>
                <small>{file.audience === "instructor" ? "Faculty only · " : ""}{materialSize(file.bytes)}{"uploadedAt" in file && ` · Uploaded ${new Date(file.uploadedAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}`}</small>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
