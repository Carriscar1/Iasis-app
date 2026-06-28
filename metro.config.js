const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mantem package exports desligado: evita o bug do "import.meta" / resolucao
// quebrada do @supabase/supabase-js no Metro/Expo Web.
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;