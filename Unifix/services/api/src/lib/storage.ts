// Supabase & Local Fallback Storage Service - Unifix
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import logger from './logger';

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'ticket-attachments';
const LOCAL_UPLOADS_DIR = fs.existsSync(path.resolve(process.cwd(), 'uploads'))
  ? path.resolve(process.cwd(), 'uploads', 'attachments')
  : path.resolve(__dirname, '../../../uploads/attachments');

// Ensure local uploads directory exists for fallback
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

export interface UploadResult {
  filename: string;
  filepath: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  filepath: string;
  publicUrl: string;
  token?: string;
}

class StorageService {
  private supabase: SupabaseClient | null = null;
  private isConfigured = false;

  constructor() {
    this.initSupabase();
  }

  private initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('[YOUR-PROJECT-REF]')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        this.isConfigured = true;
        logger.info('Supabase Storage client initialized successfully', { bucket: BUCKET_NAME });
      } catch (err: any) {
        logger.warn('Failed to initialize Supabase client, falling back to local disk storage', {
          error: err.message,
        });
      }
    } else {
      logger.info('Supabase credentials not configured or template values detected; using local storage fallback');
    }
  }

  /**
   * Generates a collision-resistant unique file path
   */
  private generateSafeFilename(originalFilename: string, folder = 'tickets'): { filename: string; filepath: string } {
    const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(sanitized);
    const basename = path.basename(sanitized, ext).slice(0, 32);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const filename = `${basename}-${uniqueId}${ext}`;
    const filepath = `${folder}/${filename}`;
    return { filename, filepath };
  }

  /**
   * Upload a file buffer to Supabase Storage (with local disk fallback)
   */
  async uploadFile(params: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    folder?: string;
  }): Promise<UploadResult> {
    const { buffer, originalFilename, mimeType, folder = 'tickets' } = params;
    const { filename, filepath } = this.generateSafeFilename(originalFilename, folder);
    const size = buffer.length;

    // 1. Try Supabase Storage if configured
    if (this.isConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(BUCKET_NAME)
          .upload(filepath, buffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          logger.warn('Supabase upload error, attempting local storage fallback', { error: error.message });
        } else {
          const { data: publicUrlData } = this.supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filepath);

          return {
            filename,
            filepath: data?.path || filepath,
            url: publicUrlData.publicUrl,
            mimeType,
            size,
          };
        }
      } catch (err: any) {
        logger.warn('Supabase storage exception, using local fallback', { error: err.message });
      }
    }

    // 2. Fallback to Local Disk Storage
    const localDir = path.join(LOCAL_UPLOADS_DIR, folder);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const localFilePath = path.join(localDir, filename);
    await fs.promises.writeFile(localFilePath, buffer);

    const publicUrl = `/uploads/attachments/${folder}/${filename}`;

    return {
      filename,
      filepath: `${folder}/${filename}`,
      url: publicUrl,
      mimeType,
      size,
    };
  }

  /**
   * Create a signed upload URL for direct client-to-storage uploads
   */
  async createSignedUploadUrl(params: {
    originalFilename: string;
    mimeType: string;
    folder?: string;
  }): Promise<PresignedUploadResult> {
    const { originalFilename, mimeType, folder = 'tickets' } = params;
    const { filepath } = this.generateSafeFilename(originalFilename, folder);

    if (this.isConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(BUCKET_NAME)
          .createSignedUploadUrl(filepath);

        if (error) throw error;

        const { data: publicUrlData } = this.supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filepath);

        return {
          uploadUrl: data.signedUrl,
          token: data.token,
          filepath,
          publicUrl: publicUrlData.publicUrl,
        };
      } catch (err: any) {
        logger.warn('Supabase createSignedUploadUrl failed', { error: err.message });
      }
    }

    // Local fallback for presigned URL (returns direct API upload path)
    return {
      uploadUrl: `/api/v1/tickets/attachments/upload`,
      filepath,
      publicUrl: `/uploads/attachments/${filepath}`,
    };
  }

  /**
   * Delete a stored file
   */
  async deleteFile(filepath: string): Promise<boolean> {
    if (this.isConfigured && this.supabase) {
      try {
        const { error } = await this.supabase.storage.from(BUCKET_NAME).remove([filepath]);
        if (!error) return true;
      } catch (err: any) {
        logger.warn('Failed to delete file from Supabase storage', { error: err.message });
      }
    }

    // Check and delete local disk file
    try {
      const localFilePath = path.join(LOCAL_UPLOADS_DIR, filepath);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
        return true;
      }
    } catch (err: any) {
      logger.warn('Failed to delete local fallback file', { error: err.message });
    }

    return false;
  }
}

export const storageService = new StorageService();
