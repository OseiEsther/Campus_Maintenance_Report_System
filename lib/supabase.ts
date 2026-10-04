import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://auedssowxperapcdkuaf.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZWRzc293eHBlcmFwY2RrdWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODI0MDEsImV4cCI6MjEwNDY1ODQwMX0.PXBJ18Gt1C3HWRQ6anXEeFh4yj-UwtZqENjouF6L4uE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});




const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload an incident photo directly to the Supabase Storage bucket ('report-photos').
 * Returns the public URL of the uploaded image, or falls back to a temporary object URL.
 */
export async function uploadReportPhoto(file: File): Promise<string> {
  // Client-side format and size validation
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, GIF, HEIC).');
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('Image size exceeds the 10 MB limit. Please select a smaller photo.');
  }

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `reports/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('report-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) {
      console.warn('Supabase storage upload returned notice, using local object preview:', uploadError.message);
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage.from('report-photos').getPublicUrl(filePath);
    return data?.publicUrl || URL.createObjectURL(file);
  } catch (err) {
    console.warn('Could not upload to Supabase storage, using fallback preview:', err);
    return URL.createObjectURL(file);
  }
}

/**
 * Delete an incident photo from Supabase Storage using its public URL.
 */
export async function deleteReportPhoto(photoUrl: string): Promise<boolean> {
  try {
    if (!photoUrl || !photoUrl.includes('/report-photos/')) return false;
    const pathPart = photoUrl.split('/report-photos/')[1];
    if (!pathPart) return false;

    const { error } = await supabase.storage
      .from('report-photos')
      .remove([pathPart]);

    if (error) {
      console.warn('Could not remove photo from Supabase storage:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting photo from storage:', err);
    return false;
  }
}

/**
 * Quick check to determine if the Supabase instance is reachable and the database tables are ready.
 */
export async function checkSupabaseHealth(): Promise<{
  ok: boolean;
  hasTables: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('id')
      .limit(1);

    if (error) {
      return {
        ok: false,
        hasTables: false,
        error: error.message,
      };
    }

    return {
      ok: true,
      hasTables: true,
    };
  } catch (err) {
    return {
      ok: false,
      hasTables: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
