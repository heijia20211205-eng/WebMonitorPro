export class MessageRouter {
 constructor(app) {
 this.app = app;
 }
 async handle(message) {
 const taskManager =
 this.app.get("taskManager");
 switch (message.type) {
 case "TASK_CREATE":
 return await taskManager.create(
 message.task
 );
 case "TASK_LIST":
 return await taskManager.getAll();
 default:
 return {
 success: false,
 error: {
 code: "UNKNOWN_MESSAGE",
 message:
 message.type
 }
 };
 }
 }
}
