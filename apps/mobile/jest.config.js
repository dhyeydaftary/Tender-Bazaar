module.exports = {
  preset: '@react-native/jest-preset',
  // pnpm stores packages under node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>, so the
  // preset's pattern matched the outer `node_modules/.pnpm` segment and left React
  // Native's own (untranspiled) setup files untransformed. Skip `.pnpm` and decide on
  // the inner package name instead.
  transformIgnorePatterns: [
    'node_modules/(?!\\.pnpm|((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
};
