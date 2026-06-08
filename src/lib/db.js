import supabase from '@/lib/supabaseClient';

const tableNames = {
  LeagueTable: 'LeagueTable',
  Match: 'Match',
  PlayerCard: 'PlayerCard',
  SubbuteoTeam: 'SubbuteoTeam',
  User: 'users',
  UserCollection: 'UserCollection',
};

const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  return { ...data.user, ...profile };
};

const applyOrder = (query, sort) => {
  if (!sort) return query;

  const ascending = !sort.startsWith('-');
  const column = (ascending ? sort : sort.slice(1)).replace('created_date', 'created_at');
  return query.order(column, { ascending });
};

const entityClient = (entityName) => {
  const tableName = tableNames[entityName] || entityName;

  return {
    async list(sort, limit = 100) {
      let query = supabase.from(tableName).select('*');
      query = applyOrder(query, sort);
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters = {}, sort, limit = 100) {
      let query = supabase.from(tableName).select('*');

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      query = applyOrder(query, sort);
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create(values) {
      const payload = { ...values };

      if (entityName === 'UserCollection' && !payload.user_id) {
        const user = await getCurrentUser();
        payload.user_id = user.id;
      }

      const { data, error } = await supabase.from(tableName).insert([payload]).select('*').single();
      if (error) throw error;
      return data;
    },

    async update(id, values) {
      const { data, error } = await supabase
        .from(tableName)
        .update(values)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
};

const db = {
  auth: {
    me: getCurrentUser,

    async isAuthenticated() {
      const { data } = await supabase.auth.getSession();
      return Boolean(data?.session);
    },

    async loginViaEmailPassword(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async loginWithProvider(provider, redirectTo = '/') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}${redirectTo}` },
      });
      if (error) throw error;
      return data;
    },

    async logout() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    async register({ email, password }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      return data;
    },

    async verifyOtp({ email, otpCode }) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (error) throw error;
      return data?.session || data;
    },

    async resendOtp(email) {
      const { data, error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      return data;
    },

    async resetPasswordRequest(email) {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return data;
    },

    async resetPassword({ newPassword }) {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return data;
    },

    redirectToLogin() {
      window.location.href = '/login';
    },
  },

  entities: new Proxy({}, {
    get: (_target, entityName) => entityClient(entityName),
  }),
};

export default db;
