import { Result }
from "../shared/Result.js";
export class TaskManager {
 constructor(storage) {
 this.storage =
 storage;
 this.tasks = [];
 }
 async load() {
 this.tasks =
 await this.storage.get(
 "tasks"
 )
 || [];
 }
 async save() {
 await this.storage.set(
 "tasks",
 this.tasks
 );
 }
 async create(task) {
 task.id =
 crypto.randomUUID();
 this.tasks.push(task);
 await this.save();
 return Result.ok(task);
 }
 async getAll() {
 return Result.ok(
 this.tasks
 );
 }
}
