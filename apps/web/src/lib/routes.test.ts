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
    expect(ROUTES.categories).toBe("/categories");
    expect(ROUTES.about).toBe("/about");
    expect(ROUTES.guidelines).toBe("/guidelines");
    expect(ROUTES.privacy).toBe("/privacy");
    expect(ROUTES.terms).toBe("/terms");
    expect(ROUTES.article.detail("hello-world")).toBe("/articles/hello-world");
    expect(ROUTES.category.detail("tech-ai")).toBe("/categories/tech-ai");
    expect(ROUTES.signup).toBe("/signup");
    expect(ROUTES.write).toBe("/write");
    expect(DEFAULT_POST_LOGIN_REDIRECT).toBe("/articles");
  });

  it("maps legacy paths to canonical targets", () => {
    expect(legacyRedirectFor("/feed")).toBe("/articles");
    expect(legacyRedirectFor("/article/new")).toBe("/write");
    expect(legacyRedirectFor("/article/some-slug")).toBe("/articles/some-slug");
    expect(legacyRedirectFor("/category")).toBe("/categories");
    expect(legacyRedirectFor("/category/tech-ai")).toBe("/categories/tech-ai");
  });

  it("sanitizes post-login redirect values", () => {
    expect(normalizePostLoginRedirect(null)).toBe("/articles");
    expect(normalizePostLoginRedirect(undefined)).toBe("/articles");
    expect(normalizePostLoginRedirect("https://evil.com")).toBe("/articles");
    expect(normalizePostLoginRedirect("//evil.com")).toBe("/articles");
    expect(normalizePostLoginRedirect("/write")).toBe("/write");
  });
});
