import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  ROUTES,
  legacyRedirectFor,
  normalizePostLoginRedirect,
} from "./routes";

describe("route map normalization", () => {
  it("keeps canonical route decisions locked", () => {
    expect(ROUTES.articles).toBe("/articles");
    expect(ROUTES.article.detail("hello-world")).toBe("/articles/hello-world");
    expect(ROUTES.signup).toBe("/signup");
    expect(ROUTES.write).toBe("/write");
    expect(DEFAULT_POST_LOGIN_REDIRECT).toBe("/articles");
  });

  it("maps legacy paths to canonical targets", () => {
    expect(legacyRedirectFor("/feed")).toBe("/articles");
    expect(legacyRedirectFor("/article/new")).toBe("/write");
    expect(legacyRedirectFor("/article/some-slug")).toBe("/articles/some-slug");
  });

  it("sanitizes post-login redirect values", () => {
    expect(normalizePostLoginRedirect(null)).toBe("/articles");
    expect(normalizePostLoginRedirect(undefined)).toBe("/articles");
    expect(normalizePostLoginRedirect("https://evil.com")).toBe("/articles");
    expect(normalizePostLoginRedirect("//evil.com")).toBe("/articles");
    expect(normalizePostLoginRedirect("/write")).toBe("/write");
  });
});
