import type { StudyState } from "./model";

export class ProgressConflictError extends Error {}
export class ProgressSaveError extends Error {}

// Serialize snapshots in one tab. The database revision protects other tabs/devices.
export class ProgressSync {
  private current: StudyState;
  private saved: StudyState;
  private revision: number;
  private inFlight: Promise<boolean> | null = null;
  private conflict = false;

  constructor(
    initial: StudyState,
    revision: number,
    private write: (state: StudyState, revision: number) => Promise<number>,
  ) {
    this.current = this.saved = initial;
    this.revision = revision;
  }

  hasPendingChanges() {
    return this.current !== this.saved;
  }

  update(state: StudyState) {
    this.current = state;
  }

  async save(): Promise<boolean> {
    if (this.conflict) return false;
    while (this.hasPendingChanges()) {
      this.inFlight ??= this.drain().finally(() => {
        this.inFlight = null;
      });
      await this.inFlight;
      if (this.conflict) return false;
    }
    return true;
  }

  private async drain() {
    while (this.current !== this.saved) {
      const snapshot = this.current;
      try {
        this.revision = await this.write(snapshot, this.revision);
      } catch (error) {
        if (error instanceof ProgressConflictError) this.conflict = true;
        throw error;
      }
      this.saved = snapshot;
    }
    return true;
  }
}
