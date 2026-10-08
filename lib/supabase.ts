import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Warning: Supabase credentials are not configured in environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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
 * Scoped to user folder for RLS compliance: {userId}/{timestamp}-{filename}
 * Throws on failure to avoid saving local blob URLs.
 */
export async function uploadReportPhoto(file: File, userId?: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, GIF, HEIC).');
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    throw new Error('Image size exceeds the 10 MB limit. Please select a smaller photo.');
  }

  const userFolder = userId || 'public';
  const fileExt = file.name.split('.').pop() || 'jpg';
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${userFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${sanitizedName}`;

  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('report-photos').getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Could not retrieve public URL for uploaded photo.');
  }

  return data.publicUrl;
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
 * Quick check to determine if the Supabase instance is reachable.
 */
export async function checkSupabaseHealth(): Promise<{
  ok: boolean;
  hasTables: boolean;
  error?: string;
}> {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        hasTables: false,
        error: 'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).',
      };
    }

    const { error } = await supabase
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
      error: err instanceof Error ? err.message : 'Unknown connection error',
    };
  }
}
