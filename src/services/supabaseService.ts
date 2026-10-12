// ==============================================================================
// Concerned Citizens of PE Metro - Supabase Sync & Persistence Service
// ==============================================================================

import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from '../lib/supabase';
import {
  CommunityIssue,
  CommunityPost,
  CrimeSafetyNotice,
  CommunityWorkItem,
  CommunityStats,
  LeadershipMember,
  Supporter,
  GalleryItem,
  OrgSettings,
} from '../types';

export interface SupabaseStatus {
  isConfigured: boolean;
  isConnected: boolean;
  urlPreview?: string;
  message: string;
}

const isUUID = (str?: string): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

/**
 * Checks whether Supabase environment variables are provided and
 * tests connection to the database.
 */
export async function testSupabaseConnection(): Promise<SupabaseStatus> {
  if (!isSupabaseConfigured) {
    return {
      isConfigured: false,
      isConnected: false,
      message:
        'Supabase URL and API Key are not set in environment variables. The portal is currently running in local offline mode.',
    };
  }

  try {
    const rawUrl = (import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '') as string;
    const maskedUrl = rawUrl.replace(/(https?:\/\/)([^.]+)(.*)/, '$1$2***$3');

    // Test query against issues table
    const { error } = await supabase
      .from('community_issues')
      .select('count', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        return {
          isConfigured: true,
          isConnected: true,
          urlPreview: maskedUrl,
          message:
            'Connected to Supabase! The tables have not been created yet. Please execute supabase/schema.sql in your Supabase SQL editor.',
        };
      }
      return {
        isConfigured: true,
        isConnected: false,
        urlPreview: maskedUrl,
        message: `Supabase responded with: ${error.message} (Code: ${error.code})`,
      };
    }

    return {
      isConfigured: true,
      isConnected: true,
      urlPreview: maskedUrl,
      message: 'Successfully connected to Supabase Cloud Database! Real-time persistence is active.',
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      message: `Failed to connect to Supabase: ${err.message || 'Unknown network error'}`,
    };
  }
}

// ==============================================================================
// 1. COMMUNITY ISSUES
// ==============================================================================

export async function fetchIssuesFromSupabase(): Promise<CommunityIssue[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('community_issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch issues:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      reference_number: row.reference_number,
      title: row.title,
      description: row.description,
      category: row.category,
      location: row.location,
      suburb: row.suburb,
      ward: row.ward || undefined,
      urgency: row.urgency,
      status: row.status,
      reporter_name: row.reporter_name,
      reporter_contact: row.reporter_contact,
      images: row.images || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      admin_notes: row.admin_notes || undefined,
      assigned_team: row.assigned_team || undefined,
      timeline: row.timeline || [],
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching issues:', err);
    return null;
  }
}

export async function pushIssueToSupabase(issue: CommunityIssue): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      reference_number: issue.reference_number,
      title: issue.title,
      description: issue.description,
      category: issue.category,
      location: issue.location,
      suburb: issue.suburb,
      ward: issue.ward || null,
      urgency: issue.urgency,
      status: issue.status,
      reporter_name: issue.reporter_name,
      reporter_contact: issue.reporter_contact,
      images: issue.images || [],
      admin_notes: issue.admin_notes || null,
      assigned_team: issue.assigned_team || null,
      timeline: issue.timeline || [],
      updated_at: new Date().toISOString(),
    };

    if (isUUID(issue.id)) {
      payload.id = issue.id;
    }

    const { error } = await supabase
      .from('community_issues')
      .upsert(payload, { onConflict: 'reference_number' });

    if (error) {
      console.warn('[Supabase] Failed to save issue:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error saving issue:', err);
    return false;
  }
}

export async function updateIssueInSupabase(
  idOrRef: string,
  fields: Partial<CommunityIssue>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    delete payload.id;

    let query = supabase.from('community_issues').update(payload);

    if (isUUID(idOrRef)) {
      query = query.eq('id', idOrRef);
    } else {
      query = query.eq('reference_number', idOrRef);
    }

    const { error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to update issue:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error updating issue:', err);
    return false;
  }
}

export async function deleteIssueFromSupabase(idOrRef: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    let query = supabase.from('community_issues').delete();
    if (isUUID(idOrRef)) {
      query = query.eq('id', idOrRef);
    } else {
      query = query.eq('reference_number', idOrRef);
    }
    const { error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to delete issue:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting issue:', err);
    return false;
  }
}

// ==============================================================================
// 2. COMMUNITY POSTS
// ==============================================================================

export async function fetchPostsFromSupabase(): Promise<CommunityPost[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch posts:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      author: row.author,
      author_role: row.author_role || undefined,
      author_avatar: row.author_avatar || undefined,
      category: row.category,
      images: row.images || [],
      likes: row.likes || 0,
      liked_by: row.liked_by || [],
      comments_count: row.comments_count || 0,
      comments: row.comments || [],
      created_at: row.created_at,
      location: row.location || undefined,
      area: row.area || undefined,
      is_pinned: Boolean(row.is_pinned),
      source: row.source || 'direct',
      facebook_post_url: row.facebook_post_url || undefined,
      facebook_post_id: row.facebook_post_id || undefined,
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching posts:', err);
    return null;
  }
}

export async function pushPostToSupabase(post: CommunityPost): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      title: post.title,
      content: post.content,
      author: post.author,
      author_role: post.author_role || null,
      author_avatar: post.author_avatar || null,
      category: post.category,
      images: post.images || [],
      likes: post.likes || 0,
      liked_by: post.liked_by || [],
      comments_count: post.comments_count || 0,
      comments: post.comments || [],
      location: post.location || null,
      area: post.area || null,
      is_pinned: Boolean(post.is_pinned),
      source: post.source || 'direct',
      facebook_post_url: post.facebook_post_url || null,
      facebook_post_id: post.facebook_post_id || null,
    };

    if (isUUID(post.id)) {
      payload.id = post.id;
    }

    const { data, error } = await supabase
      .from('community_posts')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save post:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving post:', err);
    return { success: false };
  }
}

export async function updatePostInSupabase(
  id: string,
  fields: Partial<CommunityPost>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload: Record<string, any> = { ...fields };
    delete payload.id;

    let query = supabase.from('community_posts').update(payload);
    if (isUUID(id)) {
      query = query.eq('id', id);
    } else if (fields.facebook_post_id) {
      query = query.eq('facebook_post_id', fields.facebook_post_id);
    } else {
      query = query.eq('title', fields.title || '');
    }

    const { error } = await query;
    if (error) {
      console.warn('[Supabase] Failed to update post:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error updating post:', err);
    return false;
  }
}

export async function deletePostFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return true;
    const { error } = await supabase.from('community_posts').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to delete post:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting post:', err);
    return false;
  }
}

// ==============================================================================
// 3. CRIME & SAFETY NOTICES
// ==============================================================================

export async function fetchSafetyNoticesFromSupabase(): Promise<CrimeSafetyNotice[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('crime_safety_notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch safety notices:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      area: row.area,
      alert_level: row.alert_level,
      category: row.category,
      date: row.date,
      action_required: row.action_required || undefined,
      contact_person: row.contact_person || undefined,
      emergency_numbers: row.emergency_numbers || [],
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching safety notices:', err);
    return null;
  }
}

export async function pushSafetyNoticeToSupabase(
  notice: CrimeSafetyNotice
): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      title: notice.title,
      description: notice.description,
      area: notice.area,
      alert_level: notice.alert_level,
      category: notice.category,
      date: notice.date,
      action_required: notice.action_required || null,
      contact_person: notice.contact_person || null,
      emergency_numbers: notice.emergency_numbers || ['10111', '041 585 1555'],
    };

    if (isUUID(notice.id)) {
      payload.id = notice.id;
    }

    const { data, error } = await supabase
      .from('crime_safety_notices')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save safety notice:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving safety notice:', err);
    return { success: false };
  }
}

export async function updateSafetyNoticeInSupabase(
  id: string,
  fields: Partial<CrimeSafetyNotice>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return false;
    const payload: Record<string, any> = { ...fields };
    delete payload.id;

    const { error } = await supabase.from('crime_safety_notices').update(payload).eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to update notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error updating notice:', err);
    return false;
  }
}

export async function deleteSafetyNoticeFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return true;
    const { error } = await supabase.from('crime_safety_notices').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to delete notice:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting notice:', err);
    return false;
  }
}

// ==============================================================================
// 4. COMMUNITY WORK & RELIEF PROJECTS
// ==============================================================================

export async function fetchCommunityWorkFromSupabase(): Promise<CommunityWorkItem[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('community_work')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch community work:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      date: row.date,
      location: row.location,
      impact_stat: row.impact_stat,
      images: row.images || [],
      organizer: row.organizer || 'Concerned Citizens Task Team',
      volunteers_count: row.volunteers_count || 0,
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching community work:', err);
    return null;
  }
}

export async function pushCommunityWorkToSupabase(
  work: CommunityWorkItem
): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      title: work.title,
      description: work.description,
      category: work.category,
      date: work.date,
      location: work.location,
      impact_stat: work.impact_stat,
      images: work.images || [],
      organizer: work.organizer || 'Concerned Citizens Task Team',
      volunteers_count: work.volunteers_count || 0,
    };

    if (isUUID(work.id)) {
      payload.id = work.id;
    }

    const { data, error } = await supabase
      .from('community_work')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save community work:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving community work:', err);
    return { success: false };
  }
}

export async function updateCommunityWorkInSupabase(
  id: string,
  fields: Partial<CommunityWorkItem>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return false;
    const payload: Record<string, any> = { ...fields };
    delete payload.id;

    const { error } = await supabase.from('community_work').update(payload).eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to update community work:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error updating community work:', err);
    return false;
  }
}

export async function deleteCommunityWorkFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return true;
    const { error } = await supabase.from('community_work').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to delete community work:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting community work:', err);
    return false;
  }
}

// ==============================================================================
// 5. GALLERY ITEMS
// ==============================================================================

export async function fetchGalleryFromSupabase(): Promise<GalleryItem[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('gallery_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch gallery:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      category: row.category || 'soup-kitchen',
      image_url: row.image_url,
      event_date: row.event_date || '',
      date: row.event_date || '',
      location: row.location || 'Nelson Mandela Bay',
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching gallery:', err);
    return null;
  }
}

export async function pushGalleryItemToSupabase(
  item: GalleryItem
): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      title: item.title,
      description: item.description,
      category: item.category,
      image_url: item.image_url,
      event_date: item.event_date || item.date || '',
      location: item.location || 'Nelson Mandela Bay',
    };

    if (isUUID(item.id)) {
      payload.id = item.id;
    }

    const { data, error } = await supabase
      .from('gallery_items')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save gallery item:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving gallery item:', err);
    return { success: false };
  }
}

export async function deleteGalleryItemFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return true;
    const { error } = await supabase.from('gallery_items').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to delete gallery item:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting gallery item:', err);
    return false;
  }
}

export async function clearGalleryInSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from('gallery_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn('[Supabase] Failed to clear gallery:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error clearing gallery:', err);
    return false;
  }
}

// ==============================================================================
// 6. LEADERSHIP MEMBERS
// ==============================================================================

export async function fetchLeadershipFromSupabase(): Promise<LeadershipMember[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('leadership_members')
      .select('*')
      .order('is_founder', { ascending: false })
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('[Supabase] Failed to fetch leadership:', error?.message);
      return null;
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      role_title: row.role_title,
      category: row.category,
      bio: row.bio || '',
      avatar_url: row.avatar_url || '/logo.jpg',
      phone: row.phone || undefined,
      email: row.email || undefined,
      ward_or_area: row.ward_or_area,
      joined_date: row.joined_date,
      badges: row.badges || [],
      is_founder: Boolean(row.is_founder),
    }));
  } catch (err) {
    console.warn('[Supabase] Error fetching leadership:', err);
    return null;
  }
}

export async function pushLeadershipMemberToSupabase(
  member: LeadershipMember
): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      name: member.name,
      role_title: member.role_title,
      category: member.category,
      bio: member.bio || null,
      avatar_url: member.avatar_url || null,
      phone: member.phone || null,
      email: member.email || null,
      ward_or_area: member.ward_or_area,
      joined_date: member.joined_date,
      badges: member.badges || [],
      is_founder: Boolean(member.is_founder),
    };

    if (isUUID(member.id)) {
      payload.id = member.id;
    }

    const { data, error } = await supabase
      .from('leadership_members')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save leadership member:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving leadership member:', err);
    return { success: false };
  }
}

export async function updateLeadershipMemberInSupabase(
  id: string,
  fields: Partial<LeadershipMember>
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return false;
    const payload: Record<string, any> = { ...fields };
    delete payload.id;

    const { error } = await supabase.from('leadership_members').update(payload).eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to update leadership member:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error updating leadership member:', err);
    return false;
  }
}

export async function deleteLeadershipMemberFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (!isUUID(id)) return true;
    const { error } = await supabase.from('leadership_members').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Failed to delete leadership member:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error deleting leadership member:', err);
    return false;
  }
}

// ==============================================================================
// 7. SUPPORTERS
// ==============================================================================

export async function fetchSupportersFromSupabase(): Promise<Supporter[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('supporters')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      organization: row.organization,
      logo_url: row.logo_url || undefined,
      tier: row.tier,
      contribution_type: row.contribution_type,
      message: row.message || undefined,
      website_url: row.website_url || undefined,
    }));
  } catch {
    return null;
  }
}

export async function pushSupporterToSupabase(
  supporter: Supporter
): Promise<{ success: boolean; id?: string }> {
  if (!isSupabaseConfigured) return { success: false };
  try {
    const payload: Record<string, any> = {
      name: supporter.name,
      organization: supporter.organization,
      logo_url: supporter.logo_url || null,
      tier: supporter.tier,
      contribution_type: supporter.contribution_type,
      message: supporter.message || null,
      website_url: supporter.website_url || null,
    };

    if (isUUID(supporter.id)) {
      payload.id = supporter.id;
    }

    const { data, error } = await supabase
      .from('supporters')
      .upsert(payload)
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase] Failed to save supporter:', error.message);
      return { success: false };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.warn('[Supabase] Error saving supporter:', err);
    return { success: false };
  }
}

// ==============================================================================
// 8. ORG SETTINGS
// ==============================================================================

export async function fetchOrgSettingsFromSupabase(): Promise<OrgSettings | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('org_settings')
      .select('*')
      .eq('id', 'current')
      .single();

    if (error || !data) return null;

    return {
      org_name: data.org_name,
      task_team_title: data.task_team_title,
      motto: data.motto,
      region: data.region,
      logo_url: data.logo_url,
      hero_title: data.hero_title || undefined,
      hero_subtitle: data.hero_subtitle || undefined,
      npo_number: data.npo_number || undefined,
      founder_name: data.founder_name || 'Farouk Jeftha',
      founder_title: data.founder_title || 'Movement Founder & Civil Leader',
      founder_bio: data.founder_bio || undefined,
      founder_image: data.founder_image || undefined,
      founder_quote: data.founder_quote || undefined,
      founder_phone: data.founder_phone || undefined,
      founder_email: data.founder_email || undefined,
      alert_banner_active: Boolean(data.alert_banner_active),
      alert_banner_text: data.alert_banner_text || '',
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      emergency_hotline: data.emergency_hotline,
      whatsapp_number: data.whatsapp_number,
      facebook_url: data.facebook_url,
      facebook_page_name: data.facebook_page_name || undefined,
      facebook_page_id: data.facebook_page_id || undefined,
      address: data.address,
      banking_details: data.banking_details || {
        bank: 'First National Bank (FNB)',
        account_name: 'Concerned Citizens of PE Metro Task Team NPC',
        account_number: '62899451234',
        branch_code: '210515',
        account_type: 'Non-Profit Cheque Account',
        reference: 'DONATION / [YOUR NAME]',
      },
    };
  } catch {
    return null;
  }
}

export async function saveOrgSettingsToSupabase(settings: OrgSettings): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload = {
      id: 'current',
      org_name: settings.org_name,
      task_team_title: settings.task_team_title,
      motto: settings.motto,
      region: settings.region,
      logo_url: settings.logo_url,
      hero_title: settings.hero_title || null,
      hero_subtitle: settings.hero_subtitle || null,
      npo_number: settings.npo_number || null,
      founder_name: settings.founder_name || null,
      founder_title: settings.founder_title || null,
      founder_bio: settings.founder_bio || null,
      founder_image: settings.founder_image || null,
      founder_quote: settings.founder_quote || null,
      founder_phone: settings.founder_phone || null,
      founder_email: settings.founder_email || null,
      alert_banner_active: Boolean(settings.alert_banner_active),
      alert_banner_text: settings.alert_banner_text || null,
      contact_email: settings.contact_email,
      contact_phone: settings.contact_phone,
      emergency_hotline: settings.emergency_hotline,
      whatsapp_number: settings.whatsapp_number,
      facebook_url: settings.facebook_url,
      facebook_page_name: settings.facebook_page_name || null,
      facebook_page_id: settings.facebook_page_id || null,
      address: settings.address,
      banking_details: settings.banking_details,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('org_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase] Failed to save org settings:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error saving org settings:', err);
    return false;
  }
}

// ==============================================================================
// 9. COMMUNITY STATS
// ==============================================================================

export async function fetchStatsFromSupabase(): Promise<CommunityStats | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('community_stats')
      .select('*')
      .eq('id', 'current')
      .single();

    if (error || !data) return null;

    return {
      issues_resolved: data.issues_resolved,
      families_fed: data.families_fed,
      water_litres_distributed: data.water_litres_distributed,
      active_patrols: data.active_patrols,
      cleanups_conducted: data.cleanups_conducted,
      community_volunteers: data.community_volunteers,
    };
  } catch {
    return null;
  }
}

export async function saveStatsToSupabase(stats: CommunityStats): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const payload = {
      id: 'current',
      issues_resolved: stats.issues_resolved,
      families_fed: stats.families_fed,
      water_litres_distributed: stats.water_litres_distributed,
      active_patrols: stats.active_patrols,
      cleanups_conducted: stats.cleanups_conducted,
      community_volunteers: stats.community_volunteers,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('community_stats')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase] Failed to save stats:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Error saving stats:', err);
    return false;
  }
}

// ==============================================================================
// 10. SEED / MIGRATION TOOL
// ==============================================================================

export async function seedLocalDataToSupabase(data: {
  issues?: CommunityIssue[];
  posts?: CommunityPost[];
  safetyNotices?: CrimeSafetyNotice[];
  communityWork?: CommunityWorkItem[];
  leadership?: LeadershipMember[];
  supporters?: Supporter[];
  gallery?: GalleryItem[];
  stats?: CommunityStats;
  settings?: OrgSettings;
}): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      syncedCount: 0,
      errors: ['Supabase environment variables (VITE_SUPABASE_URL and key) are not configured.'],
    };
  }

  let count = 0;
  const errors: string[] = [];

  // 1. Sync Issues
  if (data.issues && data.issues.length > 0) {
    for (const issue of data.issues) {
      const ok = await pushIssueToSupabase(issue);
      if (ok) count++;
      else errors.push(`Issue ${issue.reference_number} failed to sync.`);
    }
  }

  // 2. Sync Posts
  if (data.posts && data.posts.length > 0) {
    for (const post of data.posts) {
      const res = await pushPostToSupabase(post);
      if (res.success) count++;
      else errors.push(`Post "${post.title.slice(0, 20)}..." failed to sync.`);
    }
  }

  // 3. Sync Safety Notices
  if (data.safetyNotices && data.safetyNotices.length > 0) {
    for (const notice of data.safetyNotices) {
      const res = await pushSafetyNoticeToSupabase(notice);
      if (res.success) count++;
      else errors.push(`Notice "${notice.title.slice(0, 20)}..." failed to sync.`);
    }
  }

  // 4. Sync Community Work
  if (data.communityWork && data.communityWork.length > 0) {
    for (const work of data.communityWork) {
      const res = await pushCommunityWorkToSupabase(work);
      if (res.success) count++;
      else errors.push(`Work "${work.title.slice(0, 20)}..." failed to sync.`);
    }
  }

  // 5. Sync Leadership
  if (data.leadership && data.leadership.length > 0) {
    for (const leader of data.leadership) {
      const res = await pushLeadershipMemberToSupabase(leader);
      if (res.success) count++;
      else errors.push(`Leader "${leader.name}" failed to sync.`);
    }
  }

  // 6. Sync Supporters
  if (data.supporters && data.supporters.length > 0) {
    for (const supporter of data.supporters) {
      const res = await pushSupporterToSupabase(supporter);
      if (res.success) count++;
      else errors.push(`Supporter "${supporter.name}" failed to sync.`);
    }
  }

  // 7. Sync Gallery
  if (data.gallery && data.gallery.length > 0) {
    for (const item of data.gallery) {
      const res = await pushGalleryItemToSupabase(item);
      if (res.success) count++;
      else errors.push(`Gallery item "${item.title.slice(0, 20)}..." failed to sync.`);
    }
  }

  // 8. Sync Stats
  if (data.stats) {
    const ok = await saveStatsToSupabase(data.stats);
    if (ok) count++;
    else errors.push('Stats sync failed.');
  }

  // 9. Sync Settings
  if (data.settings) {
    const ok = await saveOrgSettingsToSupabase(data.settings);
    if (ok) count++;
    else errors.push('Settings sync failed.');
  }

  return {
    success: errors.length === 0,
    syncedCount: count,
    errors,
  };
}
