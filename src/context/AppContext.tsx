import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CommunityIssue,
  CommunityPost,
  CommunityStats,
  CommunityWorkItem,
  CrimeSafetyNotice,
  EmergencyContact,
  GalleryItem,
  IssueStatus,
  LeadershipMember,
  OrgSettings,
  Supporter,
} from '../types';
import {
  EMERGENCY_CONTACTS,
  INITIAL_COMMUNITY_WORK,
  INITIAL_GALLERY,
  INITIAL_ISSUES,
  INITIAL_LEADERSHIP,
  INITIAL_ORG_SETTINGS,
  INITIAL_POSTS,
  INITIAL_SAFETY_NOTICES,
  INITIAL_STATS,
  INITIAL_SUPPORTERS,
} from '../data/initialData';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchIssuesFromSupabase,
  pushIssueToSupabase,
  updateIssueInSupabase,
  deleteIssueFromSupabase,
  fetchPostsFromSupabase,
  pushPostToSupabase,
  updatePostInSupabase,
  deletePostFromSupabase,
  fetchSafetyNoticesFromSupabase,
  pushSafetyNoticeToSupabase,
  updateSafetyNoticeInSupabase,
  deleteSafetyNoticeFromSupabase,
  fetchCommunityWorkFromSupabase,
  pushCommunityWorkToSupabase,
  updateCommunityWorkInSupabase,
  deleteCommunityWorkFromSupabase,
  fetchGalleryFromSupabase,
  pushGalleryItemToSupabase,
  deleteGalleryItemFromSupabase,
  clearGalleryInSupabase,
  fetchLeadershipFromSupabase,
  pushLeadershipMemberToSupabase,
  updateLeadershipMemberInSupabase,
  deleteLeadershipMemberFromSupabase,
  fetchSupportersFromSupabase,
  pushSupporterToSupabase,
  fetchOrgSettingsFromSupabase,
  saveOrgSettingsToSupabase,
  fetchStatsFromSupabase,
  saveStatsToSupabase,
} from '../services/supabaseService';

interface AppContextType {
  posts: CommunityPost[];
  issues: CommunityIssue[];
  safetyNotices: CrimeSafetyNotice[];
  communityWork: CommunityWorkItem[];
  supporters: Supporter[];
  gallery: GalleryItem[];
  stats: CommunityStats;
  settings: OrgSettings;
  emergencyContacts: EmergencyContact[];

  // In-App Editor state
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  editorActiveSection: string;
  setEditorActiveSection: (section: string) => void;

  // Issue reporting & tracking
  createIssue: (
    issue: Omit<
      CommunityIssue,
      'id' | 'reference_number' | 'created_at' | 'updated_at' | 'timeline'
    >
  ) => CommunityIssue;
  getIssueByRef: (ref: string) => CommunityIssue | undefined;
  updateIssueStatus: (
    id: string,
    status: IssueStatus,
    note?: string,
    assignedTeam?: string
  ) => void;
  updateIssue: (id: string, fields: Partial<CommunityIssue>) => void;
  deleteIssue: (id: string) => void;

  // Community posts & engagement
  createPost: (
    post: Omit<CommunityPost, 'id' | 'likes' | 'comments_count' | 'created_at'> & {
      likes?: number;
      created_at?: string;
      comments_count?: number;
    }
  ) => CommunityPost;
  updatePost: (id: string, fields: Partial<CommunityPost>) => void;
  deletePost: (id: string) => void;
  likePost: (id: string) => void;
  addComment: (postId: string, author: string, text: string) => void;

  // Safety notices
  createSafetyNotice: (notice: Omit<CrimeSafetyNotice, 'id'>) => void;
  updateSafetyNotice: (id: string, fields: Partial<CrimeSafetyNotice>) => void;
  deleteSafetyNotice: (id: string) => void;

  // Community work
  createCommunityWork: (work: Omit<CommunityWorkItem, 'id'>) => void;
  updateCommunityWork: (id: string, fields: Partial<CommunityWorkItem>) => void;
  deleteCommunityWork: (id: string) => void;

  // Supporters & Gallery
  createSupporter: (supporter: Omit<Supporter, 'id'>) => void;
  createGalleryItem: (item: Omit<GalleryItem, 'id'>) => GalleryItem;
  deleteGalleryItem: (id: string) => void;
  updateStats: (newStats: Partial<CommunityStats>) => void;
  updateSettings: (newSettings: Partial<OrgSettings>) => void;

  // Leadership & Founder Management
  leadership: LeadershipMember[];
  createLeadershipMember: (member: Omit<LeadershipMember, 'id'>) => void;
  updateLeadershipMember: (id: string, fields: Partial<LeadershipMember>) => void;
  deleteLeadershipMember: (id: string) => void;

  // Helpers to clear demo data pictures & posts & alerts
  clearAllPosts: () => void;
  clearAllGallery: () => void;
  clearAllSafetyNotices: () => void;
  clearAllDemoContent: () => void;
  resetToDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  POSTS: 'citizen_pe_posts_v2',
  ISSUES: 'citizen_pe_issues_v2',
  NOTICES: 'citizen_pe_notices_v2',
  WORK: 'citizen_pe_work_v2',
  SUPPORTERS: 'citizen_pe_supporters_v2',
  STATS: 'citizen_pe_stats_v2',
  SETTINGS: 'citizen_pe_settings_v2',
  GALLERY: 'citizen_pe_gallery_v2',
  LEADERSHIP: 'citizen_pe_leadership_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // In-app editor open status
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorActiveSection, setEditorActiveSection] = useState('branding');

  // Load state from localStorage or initial defaults
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POSTS);
      return saved !== null ? JSON.parse(saved) : INITIAL_POSTS;
    } catch {
      return INITIAL_POSTS;
    }
  });

  const [issues, setIssues] = useState<CommunityIssue[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ISSUES);
      return saved ? JSON.parse(saved) : INITIAL_ISSUES;
    } catch {
      return INITIAL_ISSUES;
    }
  });

  const [safetyNotices, setSafetyNotices] = useState<CrimeSafetyNotice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTICES);
      return saved !== null ? JSON.parse(saved) : INITIAL_SAFETY_NOTICES;
    } catch {
      return INITIAL_SAFETY_NOTICES;
    }
  });

  const [communityWork, setCommunityWork] = useState<CommunityWorkItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORK);
      return saved ? JSON.parse(saved) : INITIAL_COMMUNITY_WORK;
    } catch {
      return INITIAL_COMMUNITY_WORK;
    }
  });

  const [supporters, setSupporters] = useState<Supporter[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPORTERS);
      return saved ? JSON.parse(saved) : INITIAL_SUPPORTERS;
    } catch {
      return INITIAL_SUPPORTERS;
    }
  });

  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GALLERY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return INITIAL_GALLERY;
    } catch {
      return INITIAL_GALLERY;
    }
  });

  const [stats, setStats] = useState<CommunityStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STATS);
      return saved ? JSON.parse(saved) : INITIAL_STATS;
    } catch {
      return INITIAL_STATS;
    }
  });

  const [settings, setSettings] = useState<OrgSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        const parsed: OrgSettings = JSON.parse(saved);
        if (!parsed.founder_name || parsed.founder_name === 'Rizaan Brown') {
          parsed.founder_name = 'Farouk Jeftha';
          parsed.founder_title = 'Movement Founder & Civil Leader';
          parsed.founder_bio = INITIAL_ORG_SETTINGS.founder_bio;
          parsed.founder_quote = INITIAL_ORG_SETTINGS.founder_quote;
        }
        if (parsed.alert_banner_text && parsed.alert_banner_text.includes('Active Municipal Alert')) {
          parsed.alert_banner_active = false;
          parsed.alert_banner_text = '';
        }
        return parsed;
      }
      return INITIAL_ORG_SETTINGS;
    } catch {
      return INITIAL_ORG_SETTINGS;
    }
  });

  const [leadership, setLeadership] = useState<LeadershipMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEADERSHIP);
      if (saved) {
        let parsed: LeadershipMember[] = JSON.parse(saved);

        // Deduplicate any repeated IDs or duplicate members by id and name
        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        parsed = parsed.filter((member) => {
          if (!member.id || !member.name) return false;
          if (seenIds.has(member.id) || seenNames.has(member.name.toLowerCase().trim())) {
            return false;
          }
          seenIds.add(member.id);
          seenNames.add(member.name.toLowerCase().trim());
          return true;
        });

        parsed = parsed.map((m, idx) => {
          if (m.name === 'Daryl Kock' && m.id === 'lead-03') {
            return { ...m, id: 'lead-03-cpf' };
          }
          return { ...m, id: m.id || `lead-${idx + 1}` };
        });

        return parsed;
      }
      return INITIAL_LEADERSHIP;
    } catch {
      return INITIAL_LEADERSHIP;
    }
  });

  // AUTHORITATIVE SUPABASE LOADING
  // On mount, load all authoritative records from Supabase and hydrate state + local storage cache
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // 1. Issues
    fetchIssuesFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setIssues(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load issues:', err));

    // 2. Posts
    fetchPostsFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setPosts(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load posts:', err));

    // 3. Safety Notices
    fetchSafetyNoticesFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setSafetyNotices(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load safety notices:', err));

    // 4. Community Work
    fetchCommunityWorkFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setCommunityWork(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load community work:', err));

    // 5. Gallery
    fetchGalleryFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setGallery(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load gallery:', err));

    // 6. Leadership
    fetchLeadershipFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setLeadership(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load leadership:', err));

    // 7. Supporters
    fetchSupportersFromSupabase()
      .then((remote) => {
        if (remote && remote.length > 0) {
          setSupporters(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load supporters:', err));

    // 8. Stats
    fetchStatsFromSupabase()
      .then((remote) => {
        if (remote) {
          setStats(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load stats:', err));

    // 9. Org Settings
    fetchOrgSettingsFromSupabase()
      .then((remote) => {
        if (remote) {
          setSettings(remote);
        }
      })
      .catch((err) => console.warn('[Supabase] Failed to load org settings:', err));
  }, []);

  // Sync to localStorage as fast client-side offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    } catch (e) {
      console.warn('Failed saving posts to localStorage', e);
    }
  }, [posts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(issues));
    } catch (e) {
      console.warn('Failed saving issues to localStorage', e);
    }
  }, [issues]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify(safetyNotices));
    } catch (e) {
      console.warn('Failed saving notices to localStorage', e);
    }
  }, [safetyNotices]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORK, JSON.stringify(communityWork));
    } catch (e) {
      console.warn('Failed saving communityWork to localStorage', e);
    }
  }, [communityWork]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SUPPORTERS, JSON.stringify(supporters));
    } catch (e) {
      console.warn('Failed saving supporters to localStorage', e);
    }
  }, [supporters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed saving stats to localStorage', e);
    }
  }, [stats]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed saving settings to localStorage', e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LEADERSHIP, JSON.stringify(leadership));
    } catch (e) {
      console.warn('Failed saving leadership to localStorage', e);
    }
  }, [leadership]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(gallery));
    } catch (e) {
      console.warn('Failed saving gallery to localStorage', e);
    }
  }, [gallery]);

  // ==============================================================================
  // ISSUE MANAGEMENT
  // ==============================================================================

  const createIssue = (
    issueData: Omit<
      CommunityIssue,
      'id' | 'reference_number' | 'created_at' | 'updated_at' | 'timeline'
    >
  ): CommunityIssue => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const refNum = `CPM-${randomSuffix}`;
    const now = new Date().toISOString();

    const newIssue: CommunityIssue = {
      ...issueData,
      id: `issue-${Date.now()}`,
      reference_number: refNum,
      status: 'Reported',
      created_at: now,
      updated_at: now,
      timeline: [
        {
          status: 'Reported',
          timestamp: new Date().toLocaleDateString('en-ZA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          note: `Issue officially logged via Citizen of PE Metro portal. Tracking reference generated.`,
        },
      ],
    };

    setIssues((prev) => [newIssue, ...prev]);

    // Push to Supabase Cloud Database
    if (isSupabaseConfigured) {
      pushIssueToSupabase(newIssue).catch((err) => {
        console.warn('[Supabase] Failed to push new issue:', err);
      });
    }

    return newIssue;
  };

  const getIssueByRef = (ref: string): CommunityIssue | undefined => {
    if (!ref) return undefined;
    const clean = ref.trim().toUpperCase();
    return issues.find(
      (i) =>
        i.reference_number.toUpperCase() === clean ||
        i.reference_number.toUpperCase() === `CPM-${clean}`
    );
  };

  const updateIssueStatus = (
    idOrRef: string,
    status: IssueStatus,
    note?: string,
    assignedTeam?: string
  ) => {
    let targetIssue: CommunityIssue | undefined;

    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id !== idOrRef && issue.reference_number !== idOrRef) return issue;

        const newTimeline = [...issue.timeline];
        newTimeline.unshift({
          status,
          timestamp: new Date().toLocaleDateString('en-ZA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          note: note || `Status updated to ${status}.`,
        });

        const updated = {
          ...issue,
          status,
          assigned_team: assignedTeam || issue.assigned_team,
          updated_at: new Date().toISOString(),
          timeline: newTimeline,
        };
        targetIssue = updated;
        return updated;
      })
    );

    if (isSupabaseConfigured && targetIssue) {
      updateIssueInSupabase(targetIssue.reference_number, {
        status,
        assigned_team: targetIssue.assigned_team,
        timeline: targetIssue.timeline,
      }).catch((err) => console.warn('[Supabase] Failed to update issue status:', err));
    }
  };

  const updateIssue = (idOrRef: string, fields: Partial<CommunityIssue>) => {
    let targetRef = idOrRef;
    setIssues((prev) =>
      prev.map((i) => {
        if (i.id === idOrRef || i.reference_number === idOrRef) {
          targetRef = i.reference_number;
          return { ...i, ...fields, updated_at: new Date().toISOString() };
        }
        return i;
      })
    );

    if (isSupabaseConfigured) {
      updateIssueInSupabase(targetRef, fields).catch((err) =>
        console.warn('[Supabase] Failed to update issue:', err)
      );
    }
  };

  const deleteIssue = (idOrRef: string) => {
    let targetRef = idOrRef;
    setIssues((prev) => {
      const match = prev.find((i) => i.id === idOrRef || i.reference_number === idOrRef);
      if (match) targetRef = match.reference_number;
      return prev.filter((i) => i.id !== idOrRef && i.reference_number !== idOrRef);
    });

    if (isSupabaseConfigured) {
      deleteIssueFromSupabase(targetRef).catch((err) =>
        console.warn('[Supabase] Failed to delete issue:', err)
      );
    }
  };

  // ==============================================================================
  // COMMUNITY POSTS
  // ==============================================================================

  const createPost = (
    postData: Omit<CommunityPost, 'id' | 'likes' | 'comments_count' | 'created_at'> & {
      likes?: number;
      created_at?: string;
      comments_count?: number;
    }
  ): CommunityPost => {
    const tempId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newPost: CommunityPost = {
      ...postData,
      id: tempId,
      likes: postData.likes ?? 0,
      comments_count: postData.comments_count ?? 0,
      created_at: postData.created_at || new Date().toISOString(),
      comments: [],
    };

    setPosts((prev) => [newPost, ...prev]);

    if (isSupabaseConfigured) {
      pushPostToSupabase(newPost).then((res) => {
        if (res.id && res.id !== tempId) {
          setPosts((prev) =>
            prev.map((p) => (p.id === tempId ? { ...p, id: res.id! } : p))
          );
        }
      }).catch((err) => console.warn('[Supabase] Failed to save post:', err));
    }

    return newPost;
  };

  const updatePost = (id: string, fields: Partial<CommunityPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));

    if (isSupabaseConfigured) {
      updatePostInSupabase(id, fields).catch((err) =>
        console.warn('[Supabase] Failed to update post:', err)
      );
    }
  };

  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));

    if (isSupabaseConfigured) {
      deletePostFromSupabase(id).catch((err) =>
        console.warn('[Supabase] Failed to delete post:', err)
      );
    }
  };

  const likePost = (id: string) => {
    let updatedLikes = 0;
    let updatedLikedBy: string[] = [];

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === id) {
          updatedLikes = post.likes + 1;
          updatedLikedBy = [...(post.liked_by || []), 'anonymous-user'];
          return { ...post, likes: updatedLikes, liked_by: updatedLikedBy };
        }
        return post;
      })
    );

    if (isSupabaseConfigured) {
      updatePostInSupabase(id, { likes: updatedLikes, liked_by: updatedLikedBy }).catch(console.warn);
    }
  };

  const addComment = (postId: string, author: string, text: string) => {
    let updatedComments: any[] = [];
    let updatedCount = 0;

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const newComment = {
          id: `comment-${Date.now()}`,
          author,
          text,
          created_at: new Date().toLocaleDateString('en-ZA', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        updatedComments = [...(post.comments || []), newComment];
        updatedCount = (post.comments_count || 0) + 1;
        return {
          ...post,
          comments_count: updatedCount,
          comments: updatedComments,
        };
      })
    );

    if (isSupabaseConfigured) {
      updatePostInSupabase(postId, {
        comments_count: updatedCount,
        comments: updatedComments,
      }).catch(console.warn);
    }
  };

  // ==============================================================================
  // CRIME & SAFETY NOTICES
  // ==============================================================================

  const createSafetyNotice = (noticeData: Omit<CrimeSafetyNotice, 'id'>) => {
    const tempId = `cs-${Date.now()}`;
    const newNotice: CrimeSafetyNotice = {
      ...noticeData,
      id: tempId,
    };
    setSafetyNotices((prev) => [newNotice, ...prev]);

    if (isSupabaseConfigured) {
      pushSafetyNoticeToSupabase(newNotice).then((res) => {
        if (res.id && res.id !== tempId) {
          setSafetyNotices((prev) =>
            prev.map((n) => (n.id === tempId ? { ...n, id: res.id! } : n))
          );
        }
      }).catch((err) => console.warn('[Supabase] Failed to push notice:', err));
    }
  };

  const updateSafetyNotice = (id: string, fields: Partial<CrimeSafetyNotice>) => {
    setSafetyNotices((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...fields } : n))
    );

    if (isSupabaseConfigured) {
      updateSafetyNoticeInSupabase(id, fields).catch(console.warn);
    }
  };

  const deleteSafetyNotice = (id: string) => {
    setSafetyNotices((prev) => prev.filter((n) => n.id !== id));

    if (isSupabaseConfigured) {
      deleteSafetyNoticeFromSupabase(id).catch(console.warn);
    }
  };

  // ==============================================================================
  // COMMUNITY WORK
  // ==============================================================================

  const createCommunityWork = (workData: Omit<CommunityWorkItem, 'id'>) => {
    const tempId = `cw-${Date.now()}`;
    const newWork: CommunityWorkItem = {
      ...workData,
      id: tempId,
    };
    setCommunityWork((prev) => [newWork, ...prev]);

    if (isSupabaseConfigured) {
      pushCommunityWorkToSupabase(newWork).then((res) => {
        if (res.id && res.id !== tempId) {
          setCommunityWork((prev) =>
            prev.map((w) => (w.id === tempId ? { ...w, id: res.id! } : w))
          );
        }
      }).catch((err) => console.warn('[Supabase] Failed to save community work:', err));
    }
  };

  const updateCommunityWork = (id: string, fields: Partial<CommunityWorkItem>) => {
    setCommunityWork((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...fields } : w))
    );

    if (isSupabaseConfigured) {
      updateCommunityWorkInSupabase(id, fields).catch(console.warn);
    }
  };

  const deleteCommunityWork = (id: string) => {
    setCommunityWork((prev) => prev.filter((w) => w.id !== id));

    if (isSupabaseConfigured) {
      deleteCommunityWorkFromSupabase(id).catch(console.warn);
    }
  };

  // ==============================================================================
  // SUPPORTERS & GALLERY
  // ==============================================================================

  const createSupporter = (supporterData: Omit<Supporter, 'id'>) => {
    const tempId = `sup-${Date.now()}`;
    const newSup: Supporter = {
      ...supporterData,
      id: tempId,
    };
    setSupporters((prev) => [...prev, newSup]);

    if (isSupabaseConfigured) {
      pushSupporterToSupabase(newSup).then((res) => {
        if (res.id && res.id !== tempId) {
          setSupporters((prev) =>
            prev.map((s) => (s.id === tempId ? { ...s, id: res.id! } : s))
          );
        }
      }).catch(console.warn);
    }
  };

  const createGalleryItem = (itemData: Omit<GalleryItem, 'id'>): GalleryItem => {
    const tempId = `gal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: GalleryItem = {
      ...itemData,
      id: tempId,
    };
    setGallery((prev) => [newItem, ...prev]);

    if (isSupabaseConfigured) {
      pushGalleryItemToSupabase(newItem).then((res) => {
        if (res.id && res.id !== tempId) {
          setGallery((prev) =>
            prev.map((g) => (g.id === tempId ? { ...g, id: res.id! } : g))
          );
        }
      }).catch((err) => console.warn('[Supabase] Failed to save gallery item:', err));
    }

    return newItem;
  };

  const deleteGalleryItem = (id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));

    if (isSupabaseConfigured) {
      deleteGalleryItemFromSupabase(id).catch(console.warn);
    }
  };

  const clearAllGallery = () => {
    setGallery([]);
    try {
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify([]));
    } catch {}

    if (isSupabaseConfigured) {
      clearGalleryInSupabase().catch(console.warn);
    }
  };

  // ==============================================================================
  // STATS & SETTINGS
  // ==============================================================================

  const updateStats = (newStats: Partial<CommunityStats>) => {
    const updated = { ...stats, ...newStats };
    setStats(updated);

    if (isSupabaseConfigured) {
      saveStatsToSupabase(updated).catch(console.warn);
    }
  };

  const updateSettings = (newSettings: Partial<OrgSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    if (isSupabaseConfigured) {
      saveOrgSettingsToSupabase(updated).catch(console.warn);
    }
  };

  // ==============================================================================
  // LEADERSHIP & FOUNDER MANAGEMENT
  // ==============================================================================

  const createLeadershipMember = (memberData: Omit<LeadershipMember, 'id'>) => {
    const tempId = `lead-${Date.now()}`;
    const newMember: LeadershipMember = {
      ...memberData,
      id: tempId,
    };
    setLeadership((prev) => [...prev, newMember]);

    if (isSupabaseConfigured) {
      pushLeadershipMemberToSupabase(newMember).then((res) => {
        if (res.id && res.id !== tempId) {
          setLeadership((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: res.id! } : m))
          );
        }
      }).catch(console.warn);
    }
  };

  const updateLeadershipMember = (id: string, fields: Partial<LeadershipMember>) => {
    setLeadership((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...fields } : m))
    );

    if (isSupabaseConfigured) {
      updateLeadershipMemberInSupabase(id, fields).catch(console.warn);
    }
  };

  const deleteLeadershipMember = (id: string) => {
    setLeadership((prev) => prev.filter((m) => m.id !== id));

    if (isSupabaseConfigured) {
      deleteLeadershipMemberFromSupabase(id).catch(console.warn);
    }
  };

  const clearAllPosts = () => {
    setPosts([]);
    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify([]));
    } catch {}
  };

  const clearAllSafetyNotices = () => {
    setSafetyNotices([]);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify([]));
    } catch {}
  };

  const clearAllDemoContent = () => {
    setPosts([]);
    setGallery([]);
    setSafetyNotices([]);

    // Clear demo photos from community work and issues
    setCommunityWork((prev) => {
      const cleaned = prev.map((item) => ({ ...item, images: [] }));
      try {
        localStorage.setItem(STORAGE_KEYS.WORK, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    setIssues((prev) => {
      const cleaned = prev.map((item) => ({ ...item, images: [] }));
      try {
        localStorage.setItem(STORAGE_KEYS.ISSUES, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    // Disable broadcast alert ticker
    setSettings((prev) => {
      const cleaned = { ...prev, alert_banner_active: false, alert_banner_text: '' };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });

    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.NOTICES, JSON.stringify([]));
    } catch {}
  };

  const resetToDefaults = () => {
    localStorage.clear();
    setPosts(INITIAL_POSTS);
    setIssues(INITIAL_ISSUES);
    setSafetyNotices(INITIAL_SAFETY_NOTICES);
    setCommunityWork(INITIAL_COMMUNITY_WORK);
    setSupporters(INITIAL_SUPPORTERS);
    setStats(INITIAL_STATS);
    setSettings(INITIAL_ORG_SETTINGS);
    setGallery(INITIAL_GALLERY);
    setLeadership(INITIAL_LEADERSHIP);
  };

  return (
    <AppContext.Provider
      value={{
        posts,
        issues,
        safetyNotices,
        communityWork,
        supporters,
        gallery,
        stats,
        settings,
        leadership,
        emergencyContacts: EMERGENCY_CONTACTS,
        isEditorOpen,
        setIsEditorOpen,
        editorActiveSection,
        setEditorActiveSection,
        createIssue,
        getIssueByRef,
        updateIssueStatus,
        updateIssue,
        deleteIssue,
        createPost,
        updatePost,
        deletePost,
        likePost,
        addComment,
        createSafetyNotice,
        updateSafetyNotice,
        deleteSafetyNotice,
        createCommunityWork,
        updateCommunityWork,
        deleteCommunityWork,
        createSupporter,
        createGalleryItem,
        deleteGalleryItem,
        updateStats,
        updateSettings,
        createLeadershipMember,
        updateLeadershipMember,
        deleteLeadershipMember,
        clearAllPosts,
        clearAllGallery,
        clearAllSafetyNotices,
        clearAllDemoContent,
        resetToDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
