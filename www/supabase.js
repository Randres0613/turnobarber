const SUPABASE_URL =
    "https://dkgkejulxkgvjrppsmly.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_7mxRDvndqfxuf6rCbi8CpA_VWKgK9e2";

const client =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
