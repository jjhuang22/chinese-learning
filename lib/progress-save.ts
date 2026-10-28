import type { StudyState } from "./model";
// One request at a time. Changes made during a save are sent next.
export class ProgressSaver {
  private latest: StudyState;
  private saved: StudyState;
  private running: Promise<void> | null = null;
  constructor(
    initial: StudyState,
    private write: (state: StudyState) => Promise<void>,
  ) {
    this.latest = this.saved = initial;
  }
  update(state: StudyState) {
    this.latest = state;
  }
  get dirty() {
    return this.latest !== this.saved;
  }
  async flush(): Promise<void> {
    while (this.dirty) {
      this.running ??= this.drain().finally(() => {
        this.running = null;
      });
      await this.running;
    }
  }
  private async drain() {
    while (this.dirty) {
      const snapshot = this.latest;
      await this.write(snapshot);
      this.saved = snapshot;
    }
  }
}
