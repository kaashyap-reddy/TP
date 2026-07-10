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
}
