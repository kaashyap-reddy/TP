export interface Resource {
  id: string;
  title: string;
  category: string;
  batchId: string | 'All';
  uploadedBy: string;
  verified: boolean;
  uploadedAt: string;
  lastUpdated: string;
  version: string;
  downloadCount: number;
  fileSize: string;
  /** Set for resources copied from a Training Plan template (a shared link, not an uploaded file). */
  externalUrl: string | null;
}
