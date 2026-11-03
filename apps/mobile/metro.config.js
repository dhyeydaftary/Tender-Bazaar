const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Packages that must exist exactly once in the bundle. Libraries that import
// `react` without declaring it as a peer dependency (e.g. react-native-vector-icons)
// otherwise fall back to pnpm's hoisted copy in node_modules/.pnpm/node_modules,
// which is React 18 from another workspace, and React 19's renderer rejects their
// elements ("A React Element from an older version of React was rendered").
const singletonPackages = ['react'];
const singletonOrigin = path.join(projectRoot, 'package.json');

/**
 * Metro configuration for pnpm monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    resolveRequest: (context, moduleName, platform) => {
      const isSingleton = singletonPackages.some(
        (name) => moduleName === name || moduleName.startsWith(`${name}/`),
      );
      if (isSingleton) {
        // Resolve as if imported from the app itself, so every module gets the app's copy.
        return context.resolveRequest(
          { ...context, originModulePath: singletonOrigin },
          moduleName,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
