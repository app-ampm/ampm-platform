// Runs once the test framework is installed (setupFilesAfterEnv), so React Native Testing Library
// still registers its automatic cleanup between tests; loading it from setupFiles would skip that.
//
// findBy* and waitFor give up after 1s by default. On a cold CI runner jest-expo's first render can take
// several seconds (testTimeout is 15s for the same reason), so a screen whose data arrives a moment
// later failed there while passing locally and on the PR (the app's HotelsScreen, main CI after #130). 5s absorbs
// the warmup and still fails a missing element well inside the test's own 15s.
const { configure } = require("@testing-library/react-native");

configure({ asyncUtilTimeout: 5000 });
