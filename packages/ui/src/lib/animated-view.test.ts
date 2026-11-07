/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type * as ReactNative from "react-native";

import type * as AnimatedViewModule from "./animated-view";

const SRC = join(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

// NativeWind registers only the primitives: classes on a bare Animated.View never reach the web's DOM
// (the TabBar's sliding pill once rendered unstyled). AnimatedView is registered with cssInterop.
describe("AnimatedView", () => {
  it("is the only animated view in the library that carries classes", () => {
    const offenders = sources(SRC)
      .filter((file) => /<Animated\.\w+\b[^>]*\bclassName=/.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  // jest.setup.cjs replaces this module with a bare Animated.View for the component tests, so the
  // real file is loaded here, in its own module registry, against a recording cssInterop.
  it("registers React Native's own Animated.View with NativeWind instead of wrapping it", () => {
    jest.isolateModules(() => {
      jest.doMock("nativewind", () => ({ cssInterop: jest.fn() }));
      const { cssInterop } = jest.requireMock<{ cssInterop: jest.Mock }>("nativewind");
      const { Animated } = jest.requireActual<typeof ReactNative>("react-native");
      const real = jest.requireActual<typeof AnimatedViewModule>("./animated-view");
      expect(cssInterop).toHaveBeenCalledWith(Animated.View, { className: "style" });
      expect(real.AnimatedView).toBe(Animated.View);
    });
  });
});
