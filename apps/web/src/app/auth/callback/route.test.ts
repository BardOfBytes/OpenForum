import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn();
  const getUser = vi.fn();
  const signOut = vi.fn();
  const upsert = vi.fn();
  const from = vi.fn(() => ({ upsert }));
  const createServerClient = vi.fn(() => ({
    auth: {
      exchangeCodeForSession,
      getUser,
      signOut,
    },
    from,
  }));
  const cookieStore = {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  };
  const cookies = vi.fn(async () => cookieStore);

  return {
    exchangeCodeForSession,
    getUser,
    signOut,
    upsert,
    createServerClient,
    cookies,
    cookieStore,
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "writer@csvtu.ac.in",
          user_metadata: { full_name: "Writer One" },
        },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("redirects missing code to auth error", async () => {
    const request = new NextRequest("http://localhost/auth/callback");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=missing_code"
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("signs out and redirects when email domain is invalid", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000002",
          email: "writer@gmail.com",
          user_metadata: {},
        },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost/auth/callback?code=abc123");
    const response = await GET(request);

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/error?reason=domain"
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("redirects valid users to /articles by default", async () => {
    const request = new NextRequest("http://localhost/auth/callback?code=abc123");
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/articles");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("accepts @students.csvtu.ac.in emails", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "00000000-0000-0000-0000-000000000003",
          email: "writer@students.csvtu.ac.in",
          user_metadata: { full_name: "Writer Student" },
        },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost/auth/callback?code=abc123");
    const response = await GET(request);

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/articles");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("redirects valid users to sanitized next param", async () => {
    const request = new NextRequest(
      "http://localhost/auth/callback?code=abc123&next=%2Fwrite"
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/write");
  });
});
