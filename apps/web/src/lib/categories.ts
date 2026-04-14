export interface CategoryDefinition {
  name: string;
  slug: string;
  color: string;
  description: string;
}

export const CATEGORY_CATALOG: CategoryDefinition[] = [
  {
    name: "Campus News",
    slug: "campus-news",
    color: "#d4613c",
    description: "Breaking developments, announcements, and events across campus.",
  },
  {
    name: "Tech & AI",
    slug: "tech-ai",
    color: "#3d7cc9",
    description: "Practical analysis of tools, research, and the future of technology.",
  },
  {
    name: "Editorials",
    slug: "editorials",
    color: "#8b5e3c",
    description: "Strong student opinions on policies, culture, and direction.",
  },
  {
    name: "Internship Diaries",
    slug: "internship-diaries",
    color: "#3d8b5f",
    description: "First-hand internship stories, lessons, and preparation playbooks.",
  },
  {
    name: "Career Paths",
    slug: "career-paths",
    color: "#9b59a6",
    description: "Role roadmaps, alumni guidance, and career decisions that matter.",
  },
  {
    name: "Culture & Events",
    slug: "culture-events",
    color: "#c4852c",
    description: "Festivals, clubs, performances, and the heartbeat of student life.",
  },
  {
    name: "Investigations",
    slug: "investigations",
    color: "#c4392b",
    description: "Deep reporting into issues that need transparency and accountability.",
  },
];

const CATEGORY_BY_SLUG = new Map(
  CATEGORY_CATALOG.map((category) => [category.slug, category])
);

export function getCategoryBySlug(slug: string): CategoryDefinition | null {
  return CATEGORY_BY_SLUG.get(slug) ?? null;
}

export function categorySlugFromName(name: string): string {
  const matched = CATEGORY_CATALOG.find(
    (category) => category.name.toLowerCase() === name.toLowerCase()
  );

  if (matched) {
    return matched.slug;
  }

  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
