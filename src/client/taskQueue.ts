type TaskFunc = () => Promise<void>;

export class TaskControl {
  public stop = false;
};

export class TaskQueue {
  private queue: { func: TaskFunc, ctrl: TaskControl | undefined }[] = [];
  private running: { [id: number]: TaskControl | undefined } = {};
  private task_id: number = 0;
  private task_max = 4;
  private waitingAllTaskDone = false;
  private resolves: ((value: unknown) => void)[] = [];

  runningTaskCount() {
    return Object.keys(this.running).length;
  }

  clear0() {
    return new Promise((resolve, reject) => {
      this.queue = [];
      if (this.runningTaskCount() == 0) {
        resolve(true);
      } else {
        this.waitingAllTaskDone = true;
        this.resolves.push(resolve);
        for (let id in this.running) {
          let ctrl = this.running[id];
          if (ctrl) ctrl.stop = true;
        }
      }
    })
  }

  clear() {
    this.queue = [];
    for (let c of Object.values(this.running))
      if (c) c.stop = true;
    if (this.runningTaskCount() > 0)
      this.waitingAllTaskDone = true;
    return this.waitAllTaskDone();
  }

  waitAllTaskDone() {
    return new Promise((resolve, reject) => {
      if (this.queue.length == 0 && this.runningTaskCount() == 0) {
        resolve(true);
      } else {
        this.resolves.push(resolve);
      }
    });
  }

  add(func: TaskFunc, ctrl: TaskControl | undefined = undefined) {
    if (!ctrl?.stop && !this.waitingAllTaskDone)
      this.queue.push({ func, ctrl });
    this.check();
  }

  check() {
    while (this.runningTaskCount() < this.task_max) {
      let task = this.queue.shift();
      if (!task) break;
      var id = this.task_id++;
      this.running[id] = task.ctrl;
      task.func().finally(() => {
        delete this.running[id];
        if (this.queue.length == 0 && this.runningTaskCount() == 0) {
          this.waitingAllTaskDone = false;
          while (this.resolves.length > 0) {
            let r = this.resolves.shift();
            if (r) r(true);
          }
        }
        this.check();
      });
    }
  }

  stat() {
    return `running:[${Object.keys(this.running).join(',')}] queue len:${this.queue.length}`;
  }
}