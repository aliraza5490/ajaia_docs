export type UserRole = 'viewer' | 'editor';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role_title?: string;
  color: string;
  created_at?: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  filename: string;
  filesize: number;
  filetype: string;
  data_url: string;
  uploaded_by_id?: string;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_title?: string;
  content: string;
  saved_by_id: string;
  saved_by_name?: string;
  created_at: string;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  user_color: string;
  role: UserRole;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  content_plain?: string;
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
  owner_avatar?: string;
  owner_color?: string;
  is_public: number;
  public_role: UserRole;
  created_at: string;
  updated_at: string;
  
  // Computed permission for the currently requesting user
  user_role?: 'owner' | 'editor' | 'viewer' | 'none';
  is_owner?: boolean;
  can_edit?: boolean;
  shares?: DocumentShare[];
  attachments?: DocumentAttachment[];
}
