// NativeWind: className on every React Native primitive (jsxImportSource) and its Babel plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
