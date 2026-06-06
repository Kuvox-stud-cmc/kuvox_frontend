export type CommunityStat = {
  label: string;
  value: string;
};

export type ForumCategory = {
  id: string;
  title: string;
  description: string;
  icon: string;
  threads: number;
  posts: number;
  accent: string;
};

export type ThreadPost = {
  author: string;
  role: string;
  time: string;
  content: string;
};

export type ForumThread = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  replies: number;
  views: string;
  lastActive: string;
  tags: string[];
  solved?: boolean;
  popular?: boolean;
  posts: ThreadPost[];
};

export type ShowcaseProject = {
  id: string;
  title: string;
  creator: string;
  category: string;
  description: string;
  image: string;
  likes: number;
  views: string;
  tags: string[];
  featured?: boolean;
  highlights: string[];
};

export type LearningResource = {
  title: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  category: string;
  icon: string;
};

export type NewsPost = {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
  featured?: boolean;
};

export const COMMUNITY_STATS: CommunityStat[] = [
  { label: "Creators", value: "18K+" },
  { label: "Discussions", value: "42K" },
  { label: "Shared projects", value: "6.8K" },
  { label: "Guides", value: "120+" },
];

export const FORUM_CATEGORIES: ForumCategory[] = [
  {
    id: "workflow-help",
    title: "Workflow Help",
    description:
      "Get practical answers on imports, timeline cleanup, prompts, and exports.",
    icon: "support",
    threads: 1280,
    posts: 6420,
    accent: "border-primary/50",
  },
  {
    id: "ai-editing",
    title: "AI Editing",
    description:
      "Share prompt patterns, agent recipes, and automation ideas for video teams.",
    icon: "smart_toy",
    threads: 934,
    posts: 4870,
    accent: "border-secondary/50",
  },
  {
    id: "feedback",
    title: "Feedback",
    description:
      "Request product improvements and discuss what should ship next.",
    icon: "rate_review",
    threads: 712,
    posts: 3104,
    accent: "border-tertiary/50",
  },
  {
    id: "announcements",
    title: "Announcements",
    description:
      "Release notes, community events, changelog highlights, and product news.",
    icon: "campaign",
    threads: 218,
    posts: 1408,
    accent: "border-primary/30",
  },
];

export const FORUM_THREADS: ForumThread[] = [
  {
    id: "clean-dialogue-with-music-bed",
    title: "Best way to clean dialogue while keeping a music bed intact?",
    excerpt:
      "I have a talking-head edit with background music and room tone. What prompt gets the cleanest result without flattening the mix?",
    category: "Workflow Help",
    author: "Maya Chen",
    replies: 18,
    views: "2.4K",
    lastActive: "18 min ago",
    tags: ["audio", "prompting", "workflow"],
    solved: true,
    popular: true,
    posts: [
      {
        author: "Maya Chen",
        role: "Creator",
        time: "Today at 09:12",
        content:
          "I am trying to remove air conditioner noise from a dialogue track, but every prompt I try also lowers the music bed. Has anyone found a repeatable approach?",
      },
      {
        author: "Nguyen Hoang Dieu Chau",
        role: "Kuvox Team",
        time: "Today at 09:31",
        content:
          "Use a targeted instruction that names both assets: isolate speech cleanup on the dialogue stem, preserve music bed loudness, then normalize the final mix to -14 LUFS.",
      },
      {
        author: "Priya Shah",
        role: "Editor",
        time: "Today at 09:48",
        content:
          "I also add a before-and-after review step. Ask Kuvox to create a duplicate audio pass first, then compare it against the original in the review panel.",
      },
    ],
  },
  {
    id: "shorts-from-long-interview",
    title: "Generating shorts from a 42-minute interview",
    excerpt:
      "Looking for a workflow that finds strong hooks, keeps context, and exports a batch of vertical clips for review.",
    category: "AI Editing",
    author: "Alex Rivera",
    replies: 31,
    views: "5.1K",
    lastActive: "1 hr ago",
    tags: ["shorts", "batch", "social"],
    popular: true,
    posts: [
      {
        author: "Alex Rivera",
        role: "Studio Lead",
        time: "Yesterday at 16:04",
        content:
          "Our team wants to turn long-form interviews into a weekly clip package. How are you deciding which moments become shorts?",
      },
      {
        author: "Nora Ellis",
        role: "Creator",
        time: "Yesterday at 16:22",
        content:
          "Start with transcript clustering. Ask for moments with a self-contained claim, emotional shift, or surprising phrase, then generate 9:16 drafts with captions.",
      },
    ],
  },
  {
    id: "shared-brand-presets",
    title: "Can teams share brand presets across workspaces?",
    excerpt:
      "We maintain several client looks and want editors to reuse caption, grade, and export settings consistently.",
    category: "Feedback",
    author: "Theo Martin",
    replies: 12,
    views: "980",
    lastActive: "3 hrs ago",
    tags: ["teams", "presets", "brand"],
    posts: [
      {
        author: "Theo Martin",
        role: "Agency Producer",
        time: "Monday at 11:20",
        content:
          "Client brand presets are currently copied project by project. A workspace-level preset library would remove a lot of manual setup.",
      },
      {
        author: "Nguyen Lan Huong",
        role: "Kuvox Team",
        time: "Monday at 12:05",
        content:
          "This is on our collaboration roadmap. We are collecting examples of what teams need to lock versus what editors should be able to adjust.",
      },
    ],
  },
];

export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    id: "neon-streetwear-launch",
    title: "Neon Streetwear Launch",
    creator: "Studio Vale",
    category: "Product Film",
    description:
      "A fast-moving launch edit built from handheld footage, AI scene grouping, and automated beat cuts.",
    image: "/hero-preview.png",
    likes: 842,
    views: "18.7K",
    tags: ["fashion", "beat-sync", "color"],
    featured: true,
    highlights: [
      "Generated three social cuts from one master timeline.",
      "Used prompt-based color references for a consistent neon grade.",
      "Reduced review turnaround from two days to one afternoon.",
    ],
  },
  {
    id: "founder-story-doc",
    title: "Founder Story Documentary",
    creator: "Northline Media",
    category: "Documentary",
    description:
      "A warm founder profile assembled from interview selects, archival stills, and guided narration edits.",
    image: "/hero-preview.png",
    likes: 516,
    views: "9.2K",
    tags: ["interview", "story", "captions"],
    highlights: [
      "AI transcript markers found the strongest narrative arc.",
      "Caption styling stayed aligned with the client's brand system.",
      "Editors used compare mode to approve three pacing passes.",
    ],
  },
  {
    id: "fitness-challenge-series",
    title: "30-Day Fitness Challenge",
    creator: "Pulse House",
    category: "Social Series",
    description:
      "A recurring vertical content package with templated captions, music matching, and batch exports.",
    image: "/hero-preview.png",
    likes: 693,
    views: "14.1K",
    tags: ["vertical", "batch", "templates"],
    featured: true,
    highlights: [
      "Created 30 daily edits from a single production session.",
      "Auto-reframing kept instructors centered in vertical format.",
      "Reusable templates made the series feel consistent.",
    ],
  },
];

export const LEARNING_RESOURCES: LearningResource[] = [
  {
    title: "Build your first AI-assisted edit",
    description:
      "Import footage, describe a rough cut, review suggestions, and export a polished draft.",
    level: "Beginner",
    duration: "18 min",
    category: "Getting Started",
    icon: "rocket_launch",
  },
  {
    title: "Prompt patterns for precise cuts",
    description:
      "Learn how to reference scenes, transcript moments, beats, and shot types in one instruction.",
    level: "Intermediate",
    duration: "26 min",
    category: "AI Editing",
    icon: "terminal",
  },
  {
    title: "Create a repeatable social clip pipeline",
    description:
      "Turn long videos into batches of platform-ready shorts with review checkpoints.",
    level: "Advanced",
    duration: "34 min",
    category: "Workflow",
    icon: "dynamic_feed",
  },
  {
    title: "Color consistency with visual references",
    description:
      "Use saved looks and reference frames to keep multi-video campaigns cohesive.",
    level: "Intermediate",
    duration: "22 min",
    category: "Finishing",
    icon: "palette",
  },
];

export const NEWS_POSTS: NewsPost[] = [
  {
    title: "Workspace review queues are now available",
    excerpt:
      "Teams can assign clips, compare AI passes, and approve final exports from one shared queue.",
    category: "Product update",
    date: "June 4, 2026",
    readTime: "4 min read",
    featured: true,
  },
  {
    title: "Community challenge: edit a launch trailer from raw b-roll",
    excerpt:
      "Submit a 30-second trailer, share your prompt stack, and get featured in the showcase gallery.",
    category: "Community",
    date: "May 28, 2026",
    readTime: "3 min read",
  },
  {
    title: "New caption controls for social exports",
    excerpt:
      "Kuvox now supports caption safe zones, per-platform presets, and reusable style locks.",
    category: "Release note",
    date: "May 21, 2026",
    readTime: "5 min read",
  },
];

export function getThread(threadId: string | undefined) {
  return FORUM_THREADS.find((thread) => thread.id === threadId);
}

export function getShowcaseProject(showcaseId: string | undefined) {
  return SHOWCASE_PROJECTS.find((project) => project.id === showcaseId);
}
