export type PinnedAnnouncement = {
  messageId: string;
  title: string;
  body: string;
  urgent: boolean;
  sentTime: number;
  authorId: string;
  authorName: string;
};

export type ViewerModeration = {
  canAnnounce: boolean;
  canMute: boolean;
  isAdmin: boolean;
  /** Epoch ms while the viewer is muted in this room. */
  mutedUntil: number | null;
  pinned: PinnedAnnouncement | null;
};

export type MuteStatus = {
  mutedUntil: number | null;
  /** Muted members by Nexconn ID. Only for viewers who can mute. */
  members?: Record<string, number>;
};

export type AdminProfile = {
  email: string;
  name: string;
  role: string;
  dept: string | null;
  year: number | null;
  courses: string[];
  editable: boolean;
};
