"use client";

import { AIReview } from "@/components/views/AIReview";
import { Analytics } from "@/components/views/Analytics";
import { Assignments } from "@/components/views/Assignments";
import { AuditReview } from "@/components/views/AuditReview";
import { Billing } from "@/components/views/Billing";
import { EMar } from "@/components/views/EMar";
import { Encounter } from "@/components/views/Encounter";
import { Flowsheets } from "@/components/views/Flowsheets";
import { HIEReconciliation } from "@/components/views/HIEReconciliation";
import { ImplementationReadiness } from "@/components/views/ImplementationReadiness";
import { InBasket } from "@/components/views/InBasket";
import { MPIWorkbench } from "@/components/views/MPIWorkbench";
import { OrdersResults } from "@/components/views/OrdersResults";
import { Patients } from "@/components/views/Patients";
import { Portal } from "@/components/views/Portal";
import { QueryStudio } from "@/components/views/QueryStudio";
import { Quizzes } from "@/components/views/Quizzes";
import { Registration } from "@/components/views/Registration";
import { Schedule } from "@/components/views/Schedule";
import { Tickets } from "@/components/views/Tickets";
import { Worklist } from "@/components/views/Worklist";
import type { ViewProps } from "@/components/views/shared";
import { PageHeader } from "@/components/ui/primitives";
import type { CourseData } from "@/hooks/useCourseData";
import type { View } from "@/lib/config/defaults";
import type { EHRState } from "@/lib/types";

interface Props {
  view: View;
  viewProps: ViewProps;
  courseData: CourseData | null;
  readOnly: boolean;
  exportLearnerReport: () => void;
  refreshCourseData: () => Promise<unknown>;
  flushSync: () => Promise<unknown>;
  replaceWorkspace: (next: EHRState, message?: string) => void;
}

/** Renders the active clinical or course view. Gradebook and Admin are rendered by the shell. */
export function ViewSwitch({ view, viewProps, courseData, readOnly, exportLearnerReport, refreshCourseData, flushSync, replaceWorkspace }: Props) {
  switch (view) {
    case "Worklist": return <Worklist {...viewProps} courseData={courseData} />;
    case "Schedule": return <Schedule {...viewProps} />;
    case "Registration": return <Registration {...viewProps} />;
    case "Patients": return <Patients {...viewProps} />;
    case "MPI": return <MPIWorkbench {...viewProps} />;
    case "Encounter": return <Encounter {...viewProps} />;
    case "Orders & Results": return <OrdersResults {...viewProps} />;
    case "Portal": return <Portal {...viewProps} />;
    case "HIE": return <HIEReconciliation {...viewProps} />;
    case "Analytics": return <Analytics {...viewProps} />;
    case "Query Studio": return <QueryStudio {...viewProps} />;
    case "AI Review": return <AIReview {...viewProps} />;
    case "Implementation": return <ImplementationReadiness {...viewProps} />;
    case "Audit Review": return <AuditReview {...viewProps} />;
    case "eMAR": return <EMar {...viewProps} />;
    case "Flowsheets": return <Flowsheets {...viewProps} />;
    case "In Basket": return <InBasket {...viewProps} />;
    case "Billing": return <Billing {...viewProps} />;
    case "Tickets": return <Tickets {...viewProps} />;
    case "Assignments":
      return (
        <Assignments
          state={viewProps.state}
          courseData={courseData}
          readOnly={readOnly}
          exportLearnerReport={exportLearnerReport}
          refreshCourseData={refreshCourseData}
          flushSync={flushSync}
          replaceWorkspace={replaceWorkspace}
          navigate={viewProps.navigate}
        />
      );
    case "Quizzes":
      return (
        <>
          <PageHeader eyebrow="Course" title="Quizzes" subtitle="Weekly knowledge checks on the course readings and FordMS workflows." />
          <Quizzes readOnly={readOnly} />
        </>
      );
    default: return null;
  }
}
