/**
 * AEDIRS Database Layer
 * Operates purely using Supabase.
 */
import { supabase } from "./supabase";
import { classifyIncident, assignPriority, dispatchTeam } from './aiEngine';

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const db = {

  // ── Login ──────────────────────────────────────────────────────────────────
  async login(email, password) {

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    // fetch profile row
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id);

    let profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email.split('@')[0],
          email: data.user.email,
          role: data.user.user_metadata?.role || 'citizen',
          phone: data.user.user_metadata?.phone || '',
        })
        .select()
        .single();
      if (newProfile) profile = newProfile;
    }

    // Sync phone and metadata if they are missing in profile but present in auth metadata
    const metaPhone = data.user.user_metadata?.phone;
    if (profile && metaPhone && !profile.phone) {
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ phone: metaPhone })
        .eq('id', data.user.id)
        .select()
        .single();
      if (updatedProfile) profile = updatedProfile;
    }

    return {
      user: {
        id: data.user.id,
        name: profile?.name || data.user.email,
        email: data.user.email,
        role: profile?.role || 'citizen',
        phone: profile?.phone || '',
      },
      token: data.session?.access_token || '',
    };
  },

  // ── Register ───────────────────────────────────────────────────────────────
  async register({ name, email, password, phone, role = 'citizen' }) {

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, phone }
      }
    });

    if (error) {
      // Handle different Supabase error types with clear messages
      const msg = error.message || '';
      const status = error.status || 0;

      if (msg.includes('rate limit') || status === 429) {
        throw new Error('Email rate limit exceeded. Supabase free tier allows only 3 signup emails per hour. Please wait an hour or disable email confirmation in your Supabase dashboard.');
      }
      if (status === 500 || error.name === 'AuthRetryableFetchError') {
        throw new Error('Supabase email service error. The built-in email service has likely hit its rate limit. Please disable "Confirm email" in your Supabase Auth settings, or configure a custom SMTP provider.');
      }
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw new Error(msg || 'Registration failed. Please try again.');
    }

    if (data.session) {
      // upsert profile if session is immediately active
      await supabase.from('profiles').upsert({
        id: data.user.id, name, email, phone, role,
      });

      // Sign out immediately to prevent auto-login
      await supabase.auth.signOut();

      return {
        user: null,
        token: '',
        needsConfirmation: false,
      };
    } else {
      // no session means email confirmation is required by Supabase configuration
      return {
        user: null,
        token: '',
        needsConfirmation: true,
      };
    }
  },

  // ── Restore session ────────────────────────────────────────────────────────
  async getSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.session.user.id);

    let profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (!profile) {
      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({
          id: data.session.user.id,
          name: data.session.user.user_metadata?.name || data.session.user.email.split('@')[0],
          email: data.session.user.email,
          role: data.session.user.user_metadata?.role || 'citizen',
          phone: data.session.user.user_metadata?.phone || '',
        })
        .select()
        .single();
      if (newProfile) profile = newProfile;
    }

    // Sync phone if missing in profile but present in auth metadata
    const metaPhone = data.session.user.user_metadata?.phone;
    if (profile && metaPhone && !profile.phone) {
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ phone: metaPhone })
        .eq('id', data.session.user.id)
        .select()
        .single();
      if (updatedProfile) profile = updatedProfile;
    }

    return {
      user: {
        id: data.session.user.id,
        name: profile?.name || data.session.user.email,
        email: data.session.user.email,
        role: profile?.role || 'citizen',
        phone: profile?.phone || '',
      },
      token: data.session.access_token,
    };
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  async logout() {
    await supabase.auth.signOut();
  },

  // ─── INCIDENTS ─────────────────────────────────────────────────────────────

  async getIncidents({ myOnly = false, userId = null, status = null } = {}) {

    let q = supabase.from('incidents').select('*').order('created_at', { ascending: false });
    if (myOnly && userId) q = q.eq('reported_by', userId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(normalizeIncident);


  },

  async createIncident({ title, description, location, lat, lng, userId }) {
    const combined = title + ' ' + description;
    const category = classifyIncident(combined);
    const priority = assignPriority(combined);
    const teams = await db.getTeams();
    const { team, eta } = dispatchTeam(category, lat, lng, teams);

    // Add slight random offset (jitter) if coordinates are exactly Pune center to avoid stacked pins
    let finalLat = lat;
    let finalLng = lng;
    if (lat === 18.5204 && lng === 73.8567) {
      finalLat = 18.5204 + (Math.random() - 0.5) * 0.08;
      finalLng = 73.8567 + (Math.random() - 0.5) * 0.08;
    }

    const { data, error } = await supabase.from('incidents').insert({
      title, description, category, priority,
      status: 'Reported',
      lat: finalLat, lng: finalLng, location,
      reported_by: userId,
      assigned_team: team ? team.name : null,
      eta: team ? eta : 0,
    }).select().single();

    if (error) throw new Error(error.message);

    // mark team busy
    if (team) {
      await supabase.from('rescue_teams')
        .update({ status: 'On Route' })
        .eq('id', team.id);
    }

    return { incident: normalizeIncident(data), category, priority, team, eta };
  },

  async updateIncidentStatus(id, status) {
    const { error } = await supabase
      .from('incidents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);

    // free up team when resolved
    if (status === 'Resolved') {
      const { data: inc } = await supabase.from('incidents').select('assigned_team').eq('id', id).single();
      if (inc?.assigned_team) {
        await supabase.from('rescue_teams')
          .update({ status: 'Available' })
          .eq('name', inc.assigned_team);
      }
    }
    return true;
  },

  // ─── TEAMS ─────────────────────────────────────────────────────────────────

  async getTeams() {

    const { data, error } = await supabase.from('rescue_teams').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(t => ({
      id: t.id, name: t.name, type: t.type,
      lat: t.lat, lng: t.lng, status: t.status, members: t.members,
    }));

  },

  async updateTeamStatus(teamId, status) {

    const { error } = await supabase
      .from('rescue_teams').update({ status }).eq('id', teamId);
    if (error) throw new Error(error.message);
    return true;

  },

  async updateTeamLocation(teamId, lat, lng) {
    const { error } = await supabase
      .from('rescue_teams')
      .update({ lat, lng })
      .eq('id', teamId);
    if (error) throw new Error(error.message);
    return true;
  },

  // Find a rescue team whose name matches the logged-in user's profile name
  async getTeamByName(name) {
    const { data, error } = await supabase
      .from('rescue_teams')
      .select('*')
      .ilike('name', `%${(name || '').split(' ')[0]}%`)
      .limit(5);
    if (error) throw new Error(error.message);
    return (data || []).map(t => ({
      id: t.id, name: t.name, type: t.type,
      lat: t.lat, lng: t.lng, status: t.status, members: t.members,
    }));
  },

  async getTeamMembers(teamId) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);
    if (error) throw new Error(error.message);
    return (data || []).map(m => ({
      id: m.id, name: m.name, grade: m.grade, status: m.status,
    }));
  },


  // ─── USERS ─────────────────────────────────────────────────────────────────

  async getUsers() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw new Error(error.message);
    return data || [];

  },

  // ─── STATS ─────────────────────────────────────────────────────────────────

  async getStats() {

    const { data } = await supabase.from('incidents').select('priority, status');
    const rows = data || [];
    return {
      total: rows.length,
      active: rows.filter(r => r.status !== 'Resolved').length,
      resolved: rows.filter(r => r.status === 'Resolved').length,
      critical: rows.filter(r => r.priority === 'P1' && r.status !== 'Resolved').length,
      available: 0,
    };

  },

  async getNotifications(userId) {

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];

  },
};

// ─── normalise Supabase snake_case → camelCase ────────────────────────────────
function normalizeIncident(i) {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    category: i.category,
    priority: i.priority,
    status: i.status,
    lat: i.lat,
    lng: i.lng,
    location: i.location,
    reportedBy: i.reported_by,
    assignedTeam: i.assigned_team,
    eta: i.eta || 0,
    createdAt: (i.created_at || '').slice(0, 16).replace('T', ' '),
    updatedAt: (i.updated_at || '').slice(0, 16).replace('T', ' '),
  };
}
