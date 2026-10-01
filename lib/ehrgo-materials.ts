export const EHRGO_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const EHRGO_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
export const EHRGO_FILE_ACCEPT = Object.keys(EHRGO_FILE_TYPES).map((extension) => `.${extension}`).join(",");

export interface UploadedEhrgoMaterial {
  id: string;
  activityId: string;
  name: string;
  audience: "student" | "instructor";
  bytes: number;
  uploadedAt: string;
}

export interface EhrgoSubmission {
  id: string;
  activityId: string;
  name: string;
  bytes: number;
  email: string;
  studentName: string | null;
  submittedAt: string;
}
