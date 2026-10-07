export interface Track {
  title: string;
  url: string;
  duration: number;
  requestedBy: string;
  thumbnail?: string;
  artist?: string;
}

export class MusicQueue {
  private tracks: Track[] = [];
  private currentIndex = -1;

  add(track: Track): number {
    this.tracks.push(track);
    return this.tracks.length;
  }

  next(): Track | null {
    if (this.currentIndex + 1 < this.tracks.length) {
      this.currentIndex++;
      return this.tracks[this.currentIndex];
    }
    return null;
  }

  current(): Track | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.tracks.length) {
      return this.tracks[this.currentIndex];
    }
    return null;
  }

  getUpcomingTracks(): Track[] {
    return this.tracks.slice(this.currentIndex + 1);
  }

  clear(): void {
    this.tracks = [];
    this.currentIndex = -1;
  }

  get length(): number {
    return this.tracks.length;
  }

  get remaining(): number {
    return Math.max(0, this.tracks.length - this.currentIndex - 1);
  }

  get allTracks(): Track[] {
    return [...this.tracks];
  }
}
