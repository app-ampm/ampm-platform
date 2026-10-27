// Conventional Commits (code.md, Git): `feat(ui): add Sheet`, `fix(api): ...`, `chore: ...`.
/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 120],
    "body-max-line-length": [2, "always", 120],
    // A closing paragraph such as "Verified: ..." parses as a footer; same width as the body.
    "footer-max-line-length": [2, "always", 120],
  },
};
